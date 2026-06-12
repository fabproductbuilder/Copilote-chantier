const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const MAX_BODY_BYTES = 15 * 1024 * 1024;
const MAX_PHOTO_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function textValue(value, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 12000);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:image\/(?:jpeg|jpg|png|webp);base64,([\s\S]+)$/i);
  return match ? match[1].replace(/\s/g, "") : "";
}

function base64ByteLength(base64) {
  const clean = base64.replace(/=+$/, "");
  return Math.floor((clean.length * 3) / 4);
}

function normalizeReportMode(value) {
  return value === "ai" ? "IA" : "simple";
}

function noteStatus(value) {
  return firstString(value) ? "renseignée" : "non renseignée";
}

function normalizePayload(input = {}) {
  const photos = Array.isArray(input.photos) ? input.photos.slice(0, 8) : [];
  return {
    to: firstString(input.to, input.officeEmail, process.env.INTERNAL_EMAIL_TO),
    clientName: firstString(input.clientName) || "Client à compléter",
    phone: firstString(input.phone) || "Téléphone à compléter",
    clientEmail: firstString(input.clientEmail, input.email) || "Email à compléter",
    city: firstString(input.city),
    address: firstString(input.address),
    projectType: firstString(input.projectType) || "Type d'intervention à préciser",
    textNote: textValue(input.textNote),
    report: textValue(input.report, "Compte-rendu à compléter."),
    reportMode: normalizeReportMode(input.reportMode),
    photoCount: Number.isFinite(Number(input.photoCount)) ? Math.max(0, Number(input.photoCount)) : photos.length,
    photos,
    audioOriginal: Boolean(input.audioOriginal),
    visitDate: firstString(input.visitDate),
    status: firstString(input.status) || "Prêt pour traitement interne",
  };
}

function locationLabel(payload) {
  if (payload.address && payload.city) return `${payload.address}, ${payload.city}`;
  return payload.address || payload.city || "Localisation à compléter";
}

function photoLabel(count) {
  return `${count} photo${count > 1 ? "s" : ""}`;
}

function buildAttachments(photos) {
  const parsedPhotos = photos
    .map((photo) => stripDataUrl(photo?.dataUrl || photo))
    .filter(Boolean)
    .map((base64) => ({
      base64,
      bytes: base64ByteLength(base64),
    }));

  const totalBytes = parsedPhotos.reduce((total, photo) => total + photo.bytes, 0);
  if (totalBytes > MAX_PHOTO_ATTACHMENT_BYTES) {
    return {
      attachments: [],
      photosSkipped: true,
    };
  }

  return {
    attachments: parsedPhotos.map((photo, index) => ({
      filename: `photo-${index + 1}.jpg`,
      content: photo.base64,
    })),
    photosSkipped: false,
  };
}

function buildEmailText(payload, photosSkipped) {
  const location = locationLabel(payload);
  const photoWarning = photosSkipped
    ? "\n\nAttention : les photos n'ont pas été jointes car leur taille dépasse la limite prévue pour l'envoi email."
    : "";

  return `Bonjour,

Un dossier de visite a été finalisé pour traitement interne.

Client : ${payload.clientName}
Localisation : ${location}
Type d'intervention / chantier : ${payload.projectType}
Téléphone : ${payload.phone}
Email : ${payload.clientEmail}

Éléments disponibles :

- compte-rendu de visite : généré ;
- mode compte-rendu : ${payload.reportMode} ;
- note de visite : ${noteStatus(payload.textNote)} ;
- photos : ${photoLabel(payload.photoCount)} ;
- audio original : ${payload.audioOriginal ? "conservé localement" : "non conservé"}.
${photoWarning}

Compte-rendu de visite :
${payload.report}

Prochaine action :
Vérifier les informations collectées et poursuivre le traitement du dossier dans l'outil habituel de l'entreprise.

Ce message a été généré automatiquement par Copilote Chantier.`;
}

function buildEmailHtml(payload, photosSkipped) {
  const text = buildEmailText(payload, photosSkipped);
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#17202a;">
    ${escapeHtml(text).replace(/\n/g, "<br>")}
  </div>`;
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readStreamBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
        reject(new Error("body_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(raw ? JSON.parse(raw) : {}));
    req.on("error", reject);
  });
}

async function readBody(req) {
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString("utf8") || "{}");
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return readStreamBody(req);
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

  const contentLength = Number(req.headers?.["content-length"] || 0);
  if (contentLength > MAX_BODY_BYTES) {
    sendJson(res, 413, { ok: false, reason: "body_too_large", message: "Envoi impossible. Le dossier reste prêt pour traitement interne." });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = firstString(process.env.INTERNAL_EMAIL_FROM);
  if (!apiKey || !from) {
    sendJson(res, 503, {
      ok: false,
      reason: "service_not_configured",
      message: "Service d'envoi non configuré. Le dossier reste prêt pour traitement interne.",
    });
    return;
  }

  let payload;
  try {
    payload = normalizePayload(await readBody(req));
  } catch (error) {
    sendJson(res, error.message === "body_too_large" ? 413 : 400, {
      ok: false,
      reason: error.message === "body_too_large" ? "body_too_large" : "invalid_payload",
      message: "Envoi impossible. Le dossier reste prêt pour traitement interne.",
    });
    return;
  }

  if (!payload.to) {
    sendJson(res, 400, { ok: false, reason: "missing_recipient", message: "Adresse email interne à renseigner." });
    return;
  }

  if (!isValidEmail(payload.to)) {
    sendJson(res, 400, { ok: false, reason: "invalid_recipient", message: "Adresse email interne invalide." });
    return;
  }

  const location = locationLabel(payload);
  const { attachments, photosSkipped } = buildAttachments(payload.photos);

  try {
    const response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: `Dossier de visite à traiter - ${payload.clientName} - ${location}`,
        text: buildEmailText(payload, photosSkipped),
        html: buildEmailHtml(payload, photosSkipped),
        attachments,
      }),
    });

    if (!response.ok) {
      sendJson(res, 502, { ok: false, reason: "send_failed", message: "Envoi impossible. Le dossier reste prêt pour traitement interne." });
      return;
    }

    const data = await response.json();
    sendJson(res, 200, {
      ok: true,
      id: data?.id || null,
      photosAttached: attachments.length,
      photosSkipped,
      message: "Dossier envoyé à l'équipe interne.",
    });
  } catch {
    sendJson(res, 502, { ok: false, reason: "send_failed", message: "Envoi impossible. Le dossier reste prêt pour traitement interne." });
  }
};
