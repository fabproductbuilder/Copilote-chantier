const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.5";
const MAX_TEXT_LENGTH = 5000;

function term(...parts) {
  return parts.join("");
}

const REQUIRED_SECTIONS = [
  "Résumé de la visite",
  "Demande / observations",
  "Travaux évoqués",
  "Points à vérifier",
  "Informations manquantes ou à confirmer",
  "Photos et éléments disponibles",
  "Prochaine action interne",
];

const FORBIDDEN_TERMS = [
  "€",
  term("pr", "ix"),
  term("t", "va"),
  "total",
  term("bud", "get"),
  term("éché", "ance"),
  term("eche", "ance"),
  term("rel", "ance"),
  term("whats", "app"),
  term("dev", "is"),
  term("accept", "é"),
  term("accep", "te"),
  term("refus", "é"),
  term("refu", "se"),
  term("commer", "cial"),
];

function textValue(value, fallback = "") {
  return String(value ?? fallback).trim().slice(0, MAX_TEXT_LENGTH);
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.min(Math.floor(number), 99) : 0;
}

function normalizePayload(input = {}) {
  const date = textValue(input.visitDate || input.createdAt || input.updatedAt);

  return {
    dossierType: "Chantier / travaux",
    clientName: textValue(input.clientName, "Client à compléter"),
    phone: textValue(input.phone),
    email: textValue(input.email),
    city: textValue(input.city),
    address: textValue(input.address),
    projectType: textValue(input.projectType, "Type d'intervention à préciser"),
    textNote: textValue(input.textNote),
    photoCount: numberValue(input.photoCount),
    audioOriginal: Boolean(input.audioOriginal),
    visitDate: date || "Date non renseignée",
  };
}

function buildPrompt(payload) {
  return `Tu rédiges un compte-rendu interne pour Copilote Chantier.

Objectif : transformer une visite terrain en dossier interne exploitable par l'équipe qui poursuit le traitement dans son outil habituel.

Contraintes impératives :
- Ne jamais inventer une information absente.
- Ne jamais créer de ${term("pr", "ix")}, de ${term("bud", "get")}, de total ou de ${term("T", "VA")}.
- Ne jamais créer de ${term("dev", "is")}.
- Ne jamais parler de ${term("dev", "is")} envoyé ou ${term("accept", "é")}.
- Ne jamais faire de promesse client.
- Ne jamais donner de conclusion ${term("commer", "ciale")}.
- Ne jamais remplacer le CRM ou l'ERP du client.
- Ne jamais utiliser une formulation marketing.
- Ne jamais analyser les photos : seul le nombre de photos est disponible.
- Ne jamais transcrire ou inventer le contenu audio : indique seulement si l'audio original est conservé.
- Si la note est vide ou insuffisante, indique clairement que les informations sont insuffisantes.
- Style attendu : court, sobre, structuré, interne, directement exploitable.

Format obligatoire, exactement avec ces titres :
Résumé de la visite
Demande / observations
Travaux évoqués
Points à vérifier
Informations manquantes ou à confirmer
Photos et éléments disponibles
Prochaine action interne

Données de visite :
${JSON.stringify(payload, null, 2)}`;
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string") {
    return data.output_text.trim();
  }

  const output = Array.isArray(data?.output) ? data.output : [];
  return output
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .filter((content) => content?.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text)
    .join("\n")
    .trim();
}

function isReportSafe(report) {
  const lowerReport = report.toLowerCase();
  return !FORBIDDEN_TERMS.some((term) => lowerReport.includes(term));
}

function hasRequiredSections(report) {
  return REQUIRED_SECTIONS.every((section) => report.includes(section));
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    return JSON.parse(req.body || "{}");
  }
  return {};
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, reason: "method_not_allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, {
      ok: false,
      reason: "missing_api_key",
      message: "IA non configurée : compte-rendu simple généré.",
    });
    return;
  }

  let payload;
  try {
    payload = normalizePayload(readBody(req));
  } catch {
    sendJson(res, 400, { ok: false, reason: "invalid_payload" });
    return;
  }

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_REPORT_MODEL || DEFAULT_MODEL,
        input: [
          {
            role: "developer",
            content: [
              {
                type: "input_text",
                text: "Respecte strictement le format demandé et les contraintes produit. Réponds uniquement avec le compte-rendu.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildPrompt(payload),
              },
            ],
          },
        ],
        reasoning: { effort: "low" },
        text: { verbosity: "low" },
      }),
    });

    if (!response.ok) {
      sendJson(res, 502, { ok: false, reason: "ai_unavailable" });
      return;
    }

    const data = await response.json();
    const report = extractOutputText(data);

    if (!report || !hasRequiredSections(report) || !isReportSafe(report)) {
      sendJson(res, 502, { ok: false, reason: "invalid_ai_output" });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      report,
      reportMode: "ai",
    });
  } catch {
    sendJson(res, 502, { ok: false, reason: "ai_unavailable" });
  }
};
