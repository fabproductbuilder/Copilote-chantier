const STORAGE_KEY = "copiloteChantier.visites.v1";
const LEGACY_STORAGE_KEY = "copiloteChantier.dossiers.v1";
const DEFAULT_PHOTO = "/assets/chantier-renovation.png";
const MAX_PHOTOS_PER_VISIT = 8;
const PHOTO_MAX_DIMENSION = 1400;
const PHOTO_JPEG_QUALITY = 0.72;
const AI_REPORT_ENDPOINT = "/api/generate-report";
const SEND_DOSSIER_ENDPOINT = "/api/send-dossier";

const visitStorage = {
  read(key) {
    try {
      const items = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(items) ? items : [];
    } catch {
      localStorage.removeItem(key);
      return [];
    }
  },
  save(visites) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visites));
  },
};

const visitTypeLabels = {
  renovation: "Rénovation",
  plomberie: "Plomberie",
  peinture: "Peinture",
};

const statusLabels = {
  draft: "À compléter",
  sent: "Transmis",
  transmitted: "Transmis",
};

const DEFAULT_PROJECT_TYPE = "";
const DEFAULT_VISIT_STATUS = "draft";

const elements = {
  homeView: document.querySelector("#homeView"),
  detailView: document.querySelector("#detailView"),
  brandHomeButton: document.querySelector("#brandHomeButton"),
  homeButton: document.querySelector("#homeButton"),
  topNewFolderButton: document.querySelector("#topNewFolderButton"),
  newFolderButton: document.querySelector("#newFolderButton"),
  newFolderForm: document.querySelector("#newFolderForm"),
  cancelNewFolder: document.querySelector("#cancelNewFolder"),
  newClientName: document.querySelector("#newClientName"),
  newClientPhone: document.querySelector("#newClientPhone"),
  newClientEmail: document.querySelector("#newClientEmail"),
  newClientCity: document.querySelector("#newClientCity"),
  newClientTrade: document.querySelector("#newClientTrade"),
  newClientStatus: document.querySelector("#newClientStatus"),
  folderList: document.querySelector("#folderList"),
  emptyState: document.querySelector("#emptyState"),
  statusFilter: document.querySelector("#statusFilter"),
  totalFoldersCount: document.querySelector("#totalFoldersCount"),
  draftFoldersCount: document.querySelector("#draftFoldersCount"),
  sentFoldersCount: document.querySelector("#sentFoldersCount"),
  acceptedFoldersCount: document.querySelector("#acceptedFoldersCount"),
  intakeTitle: document.querySelector("#intakeTitle"),
  clientName: document.querySelector("#clientName"),
  clientCity: document.querySelector("#clientCity"),
  clientPhone: document.querySelector("#clientPhone"),
  clientEmail: document.querySelector("#clientEmail"),
  officeEmail: document.querySelector("#officeEmail"),
  projectTypeInput: document.querySelector("#projectTypeInput"),
  detailStatus: document.querySelector("#detailStatus"),
  detailStatusPill: document.querySelector("#detailStatusPill"),
  voiceNote: document.querySelector("#voiceNote"),
  clientMessage: document.querySelector("#clientMessage"),
  finalizeDossierButton: document.querySelector("#finalizeDossierButton"),
  handoffResult: document.querySelector("#handoffResult"),
  reportCard: document.querySelector("#reportCard"),
  toast: document.querySelector("#toast"),
  mainPhoto: document.querySelector("#mainPhoto"),
  photoCount: document.querySelector("#photoCount"),
  photoGallery: document.querySelector("#photoGallery"),
  photoInput: document.querySelector("#photoInput"),
  lastUpdateValue: document.querySelector("#lastUpdateValue"),
  internalStatusValue: document.querySelector("#internalStatusValue"),
  nextAction: document.querySelector("#nextAction"),
  voiceRecordButton: document.querySelector("#voiceRecordButton"),
  voiceStopButton: document.querySelector("#voiceStopButton"),
  voiceDeleteButton: document.querySelector("#voiceDeleteButton"),
  voiceAudioPlayer: document.querySelector("#voiceAudioPlayer"),
  voiceRecordStatus: document.querySelector("#voiceRecordStatus"),
  dictateNoteButton: document.querySelector("#dictateNoteButton"),
  stopDictationButton: document.querySelector("#stopDictationButton"),
  dictationStatus: document.querySelector("#dictationStatus"),
  printDossier: document.querySelector("#printDossier"),
  generateButton: document.querySelector("#generateButton"),
};

const state = {
  currentId: null,
  visites: loadVisits(),
  visitType: "renovation",
  analyzedAt: new Date(),
  photoQueue: Promise.resolve(),
  audioRecorder: null,
  audioStream: null,
  audioChunks: [],
  audioStartedAt: null,
  audioVisitId: null,
  audioStatusMessage: "",
  audioStatusKind: "",
  speechRecognition: null,
  dictationActive: false,
  dictationStopRequested: false,
  dictationStatusMessage: "Dictée prête",
  dictationStatusKind: "ready",
};

function createId() {
  return `visit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function cloneRows(rows) {
  return rows.map((row) => ({ ...row }));
}

function normalizeProjectType(value) {
  const projectType = firstString(value);
  if (!projectType) return DEFAULT_PROJECT_TYPE;
  return visitTypeLabels[projectType] || projectType;
}

function projectTypeLabel(value) {
  return firstString(value) || "Type d'intervention à préciser";
}

function normalizeVisitStatus(value) {
  return statusLabels[value] ? value : DEFAULT_VISIT_STATUS;
}

function normalizeDate(value, fallback = nowIso()) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function firstString(...values) {
  const value = values.find((item) => typeof item === "string" && item.trim());
  return value ? value.trim() : "";
}

function normalizeQuoteRows(rawRows) {
  return [];
}

function normalizePhoto(photo, index, createdAt) {
  const dataUrl = typeof photo === "string" ? photo : photo?.dataUrl || photo?.src;
  if (!dataUrl || dataUrl === DEFAULT_PHOTO || dataUrl.includes(DEFAULT_PHOTO)) {
    return null;
  }

  return {
    id: typeof photo === "object" && photo?.id ? photo.id : `photo-${index + 1}-${createdAt}`,
    dataUrl,
    name: typeof photo === "object" && photo?.name ? photo.name : `Photo chantier ${index + 1}`,
    createdAt: normalizeDate(typeof photo === "object" ? photo?.createdAt : null, createdAt),
  };
}

function normalizePhotos(raw = {}, createdAt) {
  const candidates = Array.isArray(raw.photos) ? [...raw.photos] : [];
  if (raw.photoSrc) {
    candidates.unshift(raw.photoSrc);
  }

  return candidates
    .map((photo, index) => normalizePhoto(photo, index, createdAt))
    .filter(Boolean)
    .slice(0, MAX_PHOTOS_PER_VISIT);
}

function normalizeVoiceNote(rawVoiceNote) {
  if (!rawVoiceNote || typeof rawVoiceNote !== "object") {
    return null;
  }

  const dataUrl = firstString(rawVoiceNote.dataUrl);
  if (!dataUrl || !dataUrl.startsWith("data:audio/")) {
    return null;
  }

  const mimeType = firstString(rawVoiceNote.mimeType) || dataUrl.slice(5, dataUrl.indexOf(";")) || "audio/webm";
  const durationSeconds = Number(rawVoiceNote.durationSeconds);

  return {
    dataUrl,
    mimeType,
    createdAt: normalizeDate(rawVoiceNote.createdAt),
    ...(durationSeconds > 0 ? { durationSeconds: Math.round(durationSeconds) } : {}),
  };
}

function photoLabel(count) {
  return count > 1 ? `${count} photos` : `${count} photo`;
}

function createPhotoId() {
  return `photo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

async function compressPhotoFile(file) {
  const originalDataUrl = await readFileAsDataUrl(file);

  try {
    const image = await loadImage(originalDataUrl);
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = longestSide > PHOTO_MAX_DIMENSION ? PHOTO_MAX_DIMENSION / longestSide : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
  } catch {
    return originalDataUrl;
  }
}

function reportPhotoLabel(count) {
  if (count === 0) return "Aucune photo jointe pour le moment.";
  return `${photoLabel(count)} jointe${count > 1 ? "s" : ""} à la visite.`;
}

function audioOriginalLabel(voiceNote) {
  return normalizeVoiceNote(voiceNote) ? "conservé" : "non conservé";
}

function internalTreatmentInfoText(textNote) {
  const note = String(textNote || "").trim();
  return note
    ? "Les informations collectées pendant la visite sont à vérifier par l'équipe interne."
    : "À compléter à partir de la note de visite.";
}

function writtenNoteLabel(textNote) {
  return String(textNote || "").trim() ? "renseignée" : "non renseignée";
}

function reportStatusLabel(report) {
  return sanitizeLegacyReportText(report) ? "généré" : "à générer";
}

function reportModeLabel(value) {
  return value === "ai" ? "IA" : "simple";
}

function contactStatusLabel({ phone, email }) {
  return firstString(phone) && firstString(email) ? "complètes" : "à compléter";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function projectTypeStatusLabel(projectType) {
  return firstString(projectType) ? "renseigné" : "à préciser";
}

function normalizeReportMode(value) {
  return value === "ai" ? "ai" : "simple";
}

function photoCountText(count) {
  return `${count} photo${count > 1 ? "s" : ""}`;
}

function legacyBlockedTerms() {
  return [
    ["Post", "e"].join(""),
    ["Qt", "é"].join(""),
    ["Pr", "ix"].join(""),
    ["Sous", "-total"].join(""),
    ["T", "VA"].join(""),
    ["Total", " TTC"].join(""),
    ["Mat", "ériaux"].join(""),
    ["J", "+3"].join(""),
    ["J", "+7"].join(""),
    ["rel", "ance"].join(""),
    ["dev", "is"].join(""),
    ["bud", "get"].join(""),
    ["éché", "ance"].join(""),
    ["Accept", "é"].join(""),
    ["Refus", "é"].join(""),
    ["Whats", "App"].join(""),
    ["pré", "-dev", "is"].join(""),
  ].map((term) => term.toLowerCase());
}

function sanitizeLegacyReportText(report) {
  const rawReport = String(report || "").trim();
  if (!rawReport) return "";

  const blockedTerms = legacyBlockedTerms();
  let skipLegacyRows = false;

  return rawReport
    .replace(/^Demande du client$/gim, "Demande / observations")
    .replace(/^Chantier\s*:/gim, "Type d'intervention / chantier :")
    .replace(/^Photos prises en compte\s*:/gim, "Nombre de photos :")
    .replace(new RegExp(`^${["Note", " vocale"].join("")}\\s*:`, "gim"), "Audio original :")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      const lowerLine = trimmed.toLowerCase();
      const startsSafeSection = /^(Résumé de la visite|Demande du client|Demande \/ observations|Travaux évoqués|Points à vérifier|Informations manquantes ou à confirmer|Photos et éléments disponibles|Éléments collectés|Photos jointes|Informations pour traitement interne|Prochaine action|Prochaine action interne)$/i.test(
        trimmed,
      );

      if (blockedTerms.some((term) => lowerLine.includes(term))) {
        skipLegacyRows = true;
        return false;
      }

      if (skipLegacyRows && startsSafeSection) {
        skipLegacyRows = false;
      } else if (skipLegacyRows && trimmed) {
        return false;
      }

      return !/[€]/.test(line);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function comparableText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function polishReportText(report) {
  const cleanedReport = sanitizeLegacyReportText(report);
  if (!cleanedReport) return "";

  const blocks = cleanedReport.split(/\n{2,}/);
  const demandBlock = blocks.find((block) => /^Demande \/ observations/i.test(block.trim()));
  const demandText = demandBlock ? demandBlock.split("\n").slice(1).join(" ") : "";

  return blocks
    .map((block) => {
      const lines = block.split("\n");
      const title = lines[0]?.trim() || "";
      const content = lines.slice(1).join(" ");

      if (
        /^Informations pour traitement interne$/i.test(title) &&
        comparableText(content) &&
        comparableText(content) === comparableText(demandText)
      ) {
        return `${title}\n${internalTreatmentInfoText(content)}`;
      }

      return block;
    })
    .join("\n\n")
    .trim();
}

function isCurrentReportFormat(report) {
  const cleanedReport = polishReportText(report);
  const simpleSections = [
    "Résumé de la visite",
    "Demande / observations",
    "Éléments collectés",
    "Nombre de photos :",
    "Note de visite :",
    "Audio original :",
    "Photos jointes",
    "Informations pour traitement interne",
    "Prochaine action",
  ];
  const aiSections = [
    "Résumé de la visite",
    "Demande / observations",
    "Travaux évoqués",
    "Points à vérifier",
    "Informations manquantes ou à confirmer",
    "Photos et éléments disponibles",
    "Prochaine action interne",
  ];

  return [simpleSections, aiSections].some((sections) => sections.every((term) => cleanedReport.includes(term)));
}

function buildReportText(visit = {}) {
  const note = String(visit.textNote || "").trim();
  const clientName = firstString(visit.clientName) || "Client à compléter";
  const city = firstString(visit.city) || "Ville à compléter";
  const address = firstString(visit.address);
  const phone = firstString(visit.phone) || "Téléphone à compléter";
  const email = firstString(visit.email) || "Email à compléter";
  const projectType = projectTypeLabel(visit.projectType);
  const photos = Array.isArray(visit.photos) ? visit.photos : [];
  const noteStatus = writtenNoteLabel(note);
  const audioStatus = audioOriginalLabel(visit.voiceNote);
  const nextAction = "Finaliser le dossier pour traitement interne.";
  const demandText = note || "Informations insuffisantes : ajoutez une note de visite pour préciser les observations terrain.";
  const summaryText = note
    ? `Visite ${projectType.toLowerCase()} pour ${clientName}.`
    : "Informations insuffisantes pour établir un résumé détaillé de la visite.";

  return `Résumé de la visite
${summaryText}

Demande / observations
${demandText}

Travaux évoqués
Type d'intervention / chantier : ${projectType}
Se référer à la note de visite pour les éléments explicitement relevés sur place.

Points à vérifier
À vérifier par l'équipe interne à partir des informations collectées pendant la visite.

Informations manquantes ou à confirmer
${note ? "À compléter si nécessaire pendant le traitement interne du dossier." : "Note de visite insuffisante ou non renseignée."}

Photos et éléments disponibles
Client : ${clientName}
Localisation : ${address ? `${address}, ${city}` : city}
Contact : ${phone} / ${email}
Nombre de photos : ${photos.length}
Note de visite : ${noteStatus}
Audio original : ${audioStatus}

Prochaine action interne
${nextAction}`;
}

function createVisit(overrides = {}) {
  const createdAt = normalizeDate(overrides.createdAt);
  const projectType = normalizeProjectType(overrides.projectType || overrides.type || overrides.trade);
  const visitStatus = normalizeVisitStatus(overrides.visitStatus || overrides.status);
  const textNote = firstString(overrides.textNote);

  return {
    id: overrides.id || createId(),
    createdAt,
    updatedAt: overrides.updatedAt || createdAt,
    clientName: firstString(overrides.clientName) || "Nouveau client",
    phone: firstString(overrides.phone, overrides.clientPhone),
    email: firstString(overrides.email, overrides.clientEmail),
    officeEmail: firstString(overrides.officeEmail),
    city: firstString(overrides.city),
    address: firstString(overrides.address),
    projectType,
    visitStatus,
    textNote,
    photos: normalizePhotos({ photos: overrides.photos }, createdAt),
    voiceNote: normalizeVoiceNote(overrides.voiceNote),
    voiceTranscript: firstString(overrides.voiceTranscript),
    report: sanitizeLegacyReportText(firstString(overrides.report)),
    reportMode: normalizeReportMode(overrides.reportMode),
    pdfGeneratedAt: overrides.pdfGeneratedAt || null,
    finalizedAt: overrides.finalizedAt || null,
    sentAt: overrides.sentAt || null,

    analyzedAt: overrides.analyzedAt || null,
  };
}

function normalizeVisit(raw = {}) {
  const createdAt = normalizeDate(raw.createdAt);
  const projectType = normalizeProjectType(raw.projectType || raw.type || raw.trade);
  const textNote = firstString(raw.textNote, typeof raw.voiceNote === "string" ? raw.voiceNote : "");
  const normalized = createVisit({
    ...raw,
    id: raw.id,
    createdAt,
    updatedAt: normalizeDate(raw.updatedAt, createdAt),
    clientName: raw.clientName,
    phone: raw.phone || raw.clientPhone,
    email: raw.email || raw.clientEmail,
    officeEmail: raw.officeEmail,
    city: raw.city,
    address: raw.address,
    projectType,
    visitStatus: raw.visitStatus || raw.status,
    textNote,
    photos: normalizePhotos(raw, createdAt),
    voiceNote: normalizeVoiceNote(raw.voiceNote),
    voiceTranscript: raw.voiceTranscript,
    report: sanitizeLegacyReportText(firstString(raw.report)),
    reportMode: normalizeReportMode(raw.reportMode),
    pdfGeneratedAt: raw.pdfGeneratedAt || null,
    finalizedAt: raw.finalizedAt || null,
    sentAt: raw.sentAt || null,
  });

  const report = normalized.report && !isCurrentReportFormat(normalized.report)
    ? buildReportText(normalized)
    : normalized.report;

  return {
    ...normalized,
    report,
    createdAt,
    updatedAt: normalizeDate(raw.updatedAt, createdAt),
  };
}

function loadVisits() {
  const stored = visitStorage.read(STORAGE_KEY);
  if (stored.length > 0) {
    return stored.map(normalizeVisit);
  }

  const legacy = visitStorage.read(LEGACY_STORAGE_KEY);
  if (legacy.length > 0) {
    return legacy.map(normalizeVisit);
  }

  return [];
}

function saveVisits() {
  try {
    visitStorage.save(state.visites);
  } catch {
    showToast("Stockage local plein");
  }
}

function currentVisit() {
  return state.visites.find((visite) => visite.id === state.currentId) || null;
}

function formatDate(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "Aujourd'hui";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPrintDate(dateLike = new Date()) {
  const date = new Date(dateLike);
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(validDate);
}

function formatShortDate(dateLike = new Date()) {
  const date = new Date(dateLike);
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(validDate);
}

function visitTitle(visite) {
  return `Visite chez ${visite.clientName || "Nouveau client"}`;
}

function statusClass(status) {
  return `status-${status || "draft"}`;
}

function dossierStatus(visite = {}) {
  if (visite.sentAt) {
    return {
      key: "sent",
      label: "Dossier envoyé à l'équipe interne",
      className: "status-sent",
    };
  }

  if (visite.transmittedAt || visite.visitStatus === "transmitted") {
    return {
      key: "sent",
      label: "Dossier envoyé à l'équipe interne",
      className: "status-sent",
    };
  }

  if (visite.finalizedAt) {
    return {
      key: "finalized",
      label: "Prêt pour traitement interne",
      className: "status-ready",
    };
  }

  if (visite.report) {
    return {
      key: "ready",
      label: "Prêt à finaliser",
      className: "status-ready",
    };
  }

  return {
    key: "incomplete",
    label: "À compléter",
    className: "status-draft",
  };
}

function internalTrackingState(visite = {}) {
  if (visite.sentAt) {
    return {
      status: "Dossier envoyé à l'équipe interne",
      nextStep: "Traitement par l'équipe interne",
    };
  }

  if (visite.finalizedAt) {
    return {
      status: "Prêt pour traitement interne",
      nextStep: "Traitement par l'équipe interne",
    };
  }

  if (visite.report) {
    return {
      status: "Prêt à finaliser",
      nextStep: "Finaliser le dossier pour traitement interne",
    };
  }

  return {
    status: "À compléter",
    nextStep: "Compte-rendu à générer avant finalisation",
  };
}

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderHome() {
  const totals = {
    total: state.visites.length,
    incomplete: state.visites.filter((visite) => dossierStatus(visite).key === "incomplete").length,
    ready: state.visites.filter((visite) => dossierStatus(visite).key === "ready").length,
    sent: state.visites.filter((visite) => dossierStatus(visite).key === "sent").length,
  };

  elements.totalFoldersCount.textContent = totals.total;
  elements.draftFoldersCount.textContent = totals.incomplete;
  elements.sentFoldersCount.textContent = totals.ready;
  elements.acceptedFoldersCount.textContent = totals.sent;

  const filter = elements.statusFilter.value;
  const visites = state.visites
    .filter((visite) => filter === "all" || dossierStatus(visite).key === filter)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  elements.emptyState.hidden = visites.length > 0;
  elements.folderList.innerHTML = visites
    .map((visite) => {
      const contact = [visite.city || "Ville à compléter", visite.phone, visite.email]
        .filter(Boolean)
        .join(" · ");
      const progressLabel = visite.report ? "Compte-rendu prêt" : photoLabel((visite.photos || []).length);
      const status = dossierStatus(visite);

      return `
        <button class="folder-card" data-folder-id="${visite.id}" type="button">
          <span class="folder-main">
            <span class="folder-kicker">${projectTypeLabel(visite.projectType)}</span>
            <strong>${visitTitle(visite)}</strong>
            <small>${contact || "Contact à compléter"} · ${formatDate(visite.updatedAt)}</small>
          </span>
          <span class="folder-meta">
            <span class="status-pill ${status.className}">${status.label}</span>
            <strong>${progressLabel}</strong>
          </span>
        </button>
      `;
    })
    .join("");
}

function setView(view) {
  document.body.dataset.view = view;
  elements.homeView.hidden = view !== "home";
  elements.detailView.hidden = view !== "detail";

  if (view === "home") {
    renderHome();
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function showCreationForm() {
  setView("home");
  elements.newFolderForm.hidden = false;
  elements.newClientName.value = "";
  elements.newClientPhone.value = "";
  elements.newClientEmail.value = "";
  elements.newClientCity.value = "";
  elements.newClientTrade.value = "";
  elements.newClientStatus.value = "draft";
  elements.newClientName.focus();
}

function hideCreationForm() {
  elements.newFolderForm.hidden = true;
}

function openVisit(id) {
  const visite = state.visites.find((item) => item.id === id);
  if (!visite) return;

  state.currentId = visite.id;
  hydrateDetail(visite);
  setView("detail");
}

function updateVisit(patch, shouldRenderHome = false) {
  const visite = currentVisit();
  if (!visite) return;
  const index = state.visites.findIndex((item) => item.id === visite.id);

  Object.assign(visite, patch, { updatedAt: nowIso() });
  if (index >= 0) {
    state.visites[index] = normalizeVisit(visite);
  }
  saveVisits();

  if (shouldRenderHome) {
    renderHome();
  }
}

function updateVisitById(id, patch) {
  const index = state.visites.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const updatedVisit = normalizeVisit({
    ...state.visites[index],
    ...patch,
    updatedAt: nowIso(),
  });
  state.visites[index] = updatedVisit;
  saveVisits();
  return updatedVisit;
}

function hydrateDetail(visite) {
  if (state.dictationActive) {
    stopDictation();
  }
  if (state.audioRecorder?.state === "recording") {
    stopVoiceRecording();
  }
  state.audioStatusMessage = "";
  state.audioStatusKind = "";
  state.visitType = visite.projectType || DEFAULT_PROJECT_TYPE;
  elements.clientName.value = visite.clientName || "";
  elements.clientCity.value = visite.city || "";
  elements.clientPhone.value = visite.phone || "";
  elements.clientEmail.value = visite.email || "";
  elements.officeEmail.value = visite.officeEmail || "";
  if (elements.handoffResult) {
    elements.handoffResult.hidden = true;
  }
  elements.projectTypeInput.value = projectTypeLabel(visite.projectType) === "Type d'intervention à préciser" ? "" : projectTypeLabel(visite.projectType);
  elements.detailStatus.value = visite.visitStatus || DEFAULT_VISIT_STATUS;
  elements.voiceNote.value = visite.textNote || "";
  renderPhotoGallery(visite.photos);

  renderAll();
  renderDetailMeta();
}

function renderDetailMeta() {
  const visite = currentVisit();
  if (!visite) return;

  elements.intakeTitle.textContent = visitTitle(visite);
  elements.detailStatusPill.textContent = statusLabels[visite.visitStatus] || statusLabels.draft;
  elements.detailStatusPill.className = `status-pill ${statusClass(visite.visitStatus)}`;
  elements.lastUpdateValue.textContent = formatDate(visite.updatedAt);
  const tracking = internalTrackingState(visite);
  elements.internalStatusValue.textContent = tracking.status;
  elements.nextAction.textContent = tracking.nextStep;
  renderPrintDossier();
}

function renderPhotoGallery(photos = currentVisit()?.photos || []) {
  const normalizedPhotos = normalizePhotos({ photos }, currentVisit()?.createdAt || nowIso());
  const mediaCard = elements.mainPhoto.closest(".media-card");
  elements.photoCount.textContent = photoLabel(normalizedPhotos.length);

  if (normalizedPhotos.length === 0) {
    if (mediaCard) mediaCard.hidden = true;
    elements.mainPhoto.removeAttribute("src");
    elements.photoGallery.innerHTML = '<div class="photo-empty">Aucune photo ajoutée pour cette visite.</div>';
    return;
  }

  if (mediaCard) mediaCard.hidden = false;
  elements.mainPhoto.src = normalizedPhotos[0].dataUrl;
  elements.photoGallery.innerHTML = normalizedPhotos
    .map((photo, index) => `
      <figure class="photo-thumb" data-photo-id="${escapeAttr(photo.id)}">
        <img src="${escapeAttr(photo.dataUrl)}" alt="${escapeAttr(photo.name)}" />
        <figcaption>Photo ${index + 1}</figcaption>
        <button class="photo-delete" data-photo-delete="${escapeAttr(photo.id)}" type="button" aria-label="Supprimer ${escapeAttr(photo.name)}">X</button>
      </figure>
    `)
    .join("");
}

function photosForStorage() {
  return currentVisit()?.photos || [];
}

function speechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function isDictationSupported() {
  return Boolean(speechRecognitionConstructor());
}

function setDictationStatus(message, kind = "") {
  state.dictationStatusMessage = message;
  state.dictationStatusKind = kind;
  elements.dictationStatus.textContent = message;
  elements.dictationStatus.dataset.state = kind;
}

function renderDictationControls() {
  const isSupported = isDictationSupported();
  const isActive = state.dictationActive;

  elements.dictateNoteButton.disabled = isActive || !isSupported;
  elements.stopDictationButton.disabled = !isActive;

  if (!isSupported) {
    setDictationStatus(
      "Dictée non disponible sur ce navigateur. Vous pouvez écrire la note ou conserver un audio original.",
      "unsupported",
    );
    return;
  }

  if (isActive) {
    setDictationStatus("Dictée en cours…", "recording");
    return;
  }

  setDictationStatus(state.dictationStatusMessage || "Dictée prête", state.dictationStatusKind || "ready");
}

function appendDictatedText(transcript) {
  const text = String(transcript || "").trim().replace(/\s+/g, " ");
  if (!text) return;

  const currentText = elements.voiceNote.value.trimEnd();
  const separator = currentText ? "\n" : "";
  elements.voiceNote.value = `${currentText}${separator}${text}`;
  persistDetailFields();
  renderMessages();
  renderReport();
  renderPrintDossier();
  setDictationStatus("Texte ajouté à la note", "saved");
}

function startDictation() {
  if (!currentVisit()) {
    showToast("Créez une visite avant de dicter la note");
    return;
  }

  const Recognition = speechRecognitionConstructor();
  if (!Recognition) {
    setDictationStatus(
      "Dictée non disponible sur ce navigateur. Vous pouvez écrire la note ou conserver un audio original.",
      "unsupported",
    );
    renderDictationControls();
    return;
  }

  try {
    const recognition = new Recognition();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    state.speechRecognition = recognition;
    state.dictationActive = true;
    state.dictationStopRequested = false;
    state.dictationHadError = false;
    renderDictationControls();

    recognition.addEventListener("result", (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((result) => result.isFinal)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();

      appendDictatedText(transcript);
    });

    recognition.addEventListener("error", (event) => {
      state.dictationHadError = true;
      state.dictationActive = false;
      state.speechRecognition = null;

      const microError = ["audio-capture", "not-allowed", "service-not-allowed"].includes(event.error);
      setDictationStatus(
        microError ? "Micro refusé ou indisponible" : "Dictée arrêtée",
        microError ? "error" : "stopped",
      );
      renderDictationControls();
    });

    recognition.addEventListener("end", () => {
      const stoppedByUser = state.dictationStopRequested;
      const hadError = state.dictationHadError;
      state.dictationActive = false;
      state.dictationStopRequested = false;
      state.dictationHadError = false;
      state.speechRecognition = null;

      if (!hadError) {
        setDictationStatus(stoppedByUser ? "Dictée arrêtée" : "Dictée prête", stoppedByUser ? "stopped" : "ready");
      }
      renderDictationControls();
    });

    recognition.start();
  } catch {
    state.dictationActive = false;
    state.speechRecognition = null;
    setDictationStatus("Micro refusé ou indisponible", "error");
    renderDictationControls();
  }
}

function stopDictation() {
  if (!state.speechRecognition || !state.dictationActive) return;

  state.dictationStopRequested = true;
  try {
    state.speechRecognition.stop();
  } catch {
    state.dictationActive = false;
    state.speechRecognition = null;
    setDictationStatus("Dictée arrêtée", "stopped");
    renderDictationControls();
  }
}

function isAudioRecordingSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

function preferredAudioMimeType() {
  if (!window.MediaRecorder?.isTypeSupported) {
    return "";
  }

  return (
    [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/aac",
    ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || ""
  );
}

function setVoiceRecordStatus(message, kind = "") {
  state.audioStatusMessage = message;
  state.audioStatusKind = kind;
  elements.voiceRecordStatus.textContent = message;
  elements.voiceRecordStatus.dataset.state = kind;
}

function stopAudioStream() {
  state.audioStream?.getTracks().forEach((track) => track.stop());
  state.audioStream = null;
}

function renderVoiceNote() {
  const voiceNote = normalizeVoiceNote(currentVisit()?.voiceNote);
  const isRecording = state.audioRecorder?.state === "recording";
  const isSupported = isAudioRecordingSupported();

  elements.voiceRecordButton.disabled = isRecording || !isSupported;
  elements.voiceStopButton.disabled = !isRecording;
  elements.voiceDeleteButton.hidden = !voiceNote || isRecording;
  elements.voiceAudioPlayer.hidden = !voiceNote;

  if (voiceNote) {
    elements.voiceAudioPlayer.src = voiceNote.dataUrl;
  } else {
    elements.voiceAudioPlayer.removeAttribute("src");
    elements.voiceAudioPlayer.load();
  }

  if (!isSupported) {
    setVoiceRecordStatus(
      "L'enregistrement audio n'est pas disponible sur ce navigateur. Vous pouvez utiliser la note de visite.",
      "unsupported",
    );
    return;
  }

  if (isRecording) {
    setVoiceRecordStatus("Enregistrement en cours…", "recording");
    return;
  }

  if (state.audioStatusMessage) {
    setVoiceRecordStatus(state.audioStatusMessage, state.audioStatusKind);
    return;
  }

  setVoiceRecordStatus(voiceNote ? "Audio original enregistré." : "Prêt à enregistrer", voiceNote ? "saved" : "ready");
}

async function startVoiceRecording() {
  if (!currentVisit()) {
    showToast("Créez une visite avant d'enregistrer un audio original");
    return;
  }

  if (!isAudioRecordingSupported()) {
    setVoiceRecordStatus(
      "L'enregistrement audio n'est pas disponible sur ce navigateur. Vous pouvez utiliser la note de visite.",
      "unsupported",
    );
    renderVoiceNote();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = preferredAudioMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    state.audioStream = stream;
    state.audioRecorder = recorder;
    state.audioChunks = [];
    state.audioStartedAt = Date.now();
    state.audioVisitId = currentVisit()?.id || null;
    state.audioStatusMessage = "";
    state.audioStatusKind = "";

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size > 0) {
        state.audioChunks.push(event.data);
      }
    });

    recorder.addEventListener("stop", async () => {
      const chunks = [...state.audioChunks];
      const durationSeconds = state.audioStartedAt ? (Date.now() - state.audioStartedAt) / 1000 : undefined;
      const recordedMimeType = recorder.mimeType || mimeType || chunks[0]?.type || "audio/webm";

      stopAudioStream();
      state.audioRecorder = null;
      state.audioChunks = [];
      state.audioStartedAt = null;
      const audioVisitId = state.audioVisitId;
      state.audioVisitId = null;

      if (chunks.length === 0) {
        setVoiceRecordStatus("Erreur pendant l'enregistrement. Réessayez ou utilisez la note de visite.", "error");
        renderVoiceNote();
        return;
      }

      try {
        const audioBlob = new Blob(chunks, { type: recordedMimeType });
        const dataUrl = await readFileAsDataUrl(audioBlob);
        const voiceNote = {
          dataUrl,
          mimeType: recordedMimeType,
          createdAt: nowIso(),
          ...(durationSeconds ? { durationSeconds } : {}),
        };
        const updatedVisit = updateVisitById(audioVisitId, { voiceNote });
        if (!updatedVisit) {
          throw new Error("Visit not found for voice note");
        }
        if (audioVisitId === currentVisit()?.id) {
          renderDetailMeta();
          state.audioStatusMessage = "Audio original enregistré.";
          state.audioStatusKind = "saved";
          renderVoiceNote();
          renderMessages();
          renderPrintDossier();
          showToast("Audio original enregistré.");
        } else {
          state.audioStatusMessage = "";
          state.audioStatusKind = "";
        }
      } catch {
        setVoiceRecordStatus("Erreur pendant l'enregistrement. Réessayez ou utilisez la note de visite.", "error");
        renderVoiceNote();
      }
    });

    recorder.addEventListener("error", () => {
      stopAudioStream();
      state.audioRecorder = null;
      state.audioVisitId = null;
      setVoiceRecordStatus("Erreur pendant l'enregistrement. Réessayez ou utilisez la note de visite.", "error");
      renderVoiceNote();
    });

    recorder.start();
    renderVoiceNote();
  } catch (error) {
    stopAudioStream();
    state.audioRecorder = null;
    state.audioVisitId = null;
    const denied = ["NotAllowedError", "SecurityError", "PermissionDeniedError"].includes(error?.name);
    setVoiceRecordStatus(
      denied
        ? "Accès au micro non autorisé. Autorisez le micro dans les réglages du navigateur ou utilisez la note de visite."
        : "Erreur pendant l'enregistrement. Réessayez ou utilisez la note de visite.",
      denied ? "denied" : "error",
    );
    renderVoiceNote();
  }
}
function stopVoiceRecording() {
  if (state.audioRecorder?.state === "recording") {
    state.audioRecorder.stop();
    elements.voiceStopButton.disabled = true;
  }
}

function deleteVoiceNote() {
  if (state.audioRecorder?.state === "recording") {
    stopVoiceRecording();
  }

  updateVisit({ voiceNote: null });
  state.audioStatusMessage = "";
  state.audioStatusKind = "";
  renderVoiceNote();
  renderMessages();
  renderPrintDossier();
  showToast("Audio original supprimé");
}

function persistDetailFields() {
  const textNote = elements.voiceNote.value;
  const projectType = normalizeProjectType(elements.projectTypeInput.value);
  state.visitType = projectType;
  updateVisit({
    clientName: elements.clientName.value.trim() || "Nouveau client",
    phone: elements.clientPhone.value.trim(),
    email: elements.clientEmail.value.trim(),
    officeEmail: elements.officeEmail.value.trim(),
    city: elements.clientCity.value.trim(),
    projectType,
    visitStatus: elements.detailStatus.value,
    textNote,
    photos: photosForStorage(),
  });
  renderDetailMeta();
}

function getClientFirstName() {
  const raw = elements.clientName.value.trim() || "votre client";
  return raw.replace(/^M\.?\s+|^Mme\.?\s+/i, "");
}

function internalReportText(report) {
  const cleanedReport = polishReportText(report);
  if (!cleanedReport) {
    return "Compte-rendu de visite : à générer avant envoi.";
  }

  return `Compte-rendu de visite :\n${cleanedReport}`;
}

function renderMessages() {
  const clientName = elements.clientName.value.trim() || "Client à compléter";
  const email = elements.clientEmail.value.trim();
  const phone = elements.clientPhone.value.trim();
  const visit = currentVisit();
  const textNote = elements.voiceNote.value.trim();
  const photos = photosForStorage();
  const projectType = projectTypeLabel(elements.projectTypeInput.value.trim() || visit?.projectType);
  const city = elements.clientCity.value.trim() || visit?.city || "Localisation à compléter";
  const address = firstString(visit?.address);
  const location = address ? `${address}, ${city}` : city;
  const audioStatus = audioOriginalLabel(visit?.voiceNote);
  const report = polishReportText(visit?.report) || "Compte-rendu à générer avant envoi.";

  elements.clientMessage.value = `Objet : Dossier de visite à traiter - ${clientName}

Bonjour,

Un dossier de visite a été finalisé pour traitement interne.

Client : ${clientName}
Localisation : ${location}
Type d'intervention / chantier : ${projectType}
Téléphone : ${phone || "Téléphone à compléter"}
Email : ${email || "Email à compléter"}

Éléments disponibles :
- compte-rendu de visite : ${reportStatusLabel(visit?.report)} ;
- mode compte-rendu : ${reportModeLabel(visit?.reportMode)} ;
- note de visite : ${writtenNoteLabel(textNote)} ;
- photos : ${photoCountText(photos.length)} ;
- audio original : ${audioStatus === "conservé" ? "conservé localement" : "non conservé"}.

Compte-rendu de visite :
${report}

Prochaine action :
Vérifier les informations collectées et poursuivre le traitement du dossier dans l'outil habituel de l'entreprise.

Ce message a été généré automatiquement par Copilote Chantier.`;
}

function showHandoffResult(title = "Dossier prêt pour traitement interne", message = "Message interne préparé — à copier ou à utiliser avec le dossier.") {
  if (!elements.handoffResult) return;
  elements.handoffResult.innerHTML = `
    <strong>${escapeAttr(title)}</strong>
    <span>${escapeAttr(message)}</span>
  `;
  elements.handoffResult.hidden = false;
}

function renderReport() {
  const visit = currentVisit();
  const report = visit?.report && !isCurrentReportFormat(visit.report)
    ? buildReportText(visit)
    : polishReportText(visit?.report);
  if (!report) {
    elements.reportCard.innerHTML = `
      <p><strong>Compte-rendu de visite</strong></p>
      <p>Ajoutez une note de visite, puis cliquez sur Générer le compte-rendu.</p>
    `;
    return;
  }

  elements.reportCard.innerHTML = report
    .split(/\n{2,}/)
    .map((block) => {
      const [title, ...lines] = block.split("\n");
      const content = lines.map((line) => escapeAttr(line)).join("<br />");
      return `
        <p>
          <strong>${escapeAttr(title)}</strong>
          ${content ? `<br />${content}` : ""}
        </p>
      `;
    })
    .join("");
}

function renderReportNotice(message) {
  elements.reportCard.innerHTML = `
    <p><strong>Compte-rendu de visite</strong></p>
    <p>${escapeAttr(message)}</p>
  `;
}

function printableReportHtml(visite) {
  const report = visite?.report && !isCurrentReportFormat(visite.report)
    ? buildReportText(visite)
    : polishReportText(visite?.report);

  if (!report) {
    return `
      <div class="print-block print-report-block">
        <h2 class="print-section-title">Compte-rendu de visite</h2>
        <p>Compte-rendu de visite : à générer avant impression finale.</p>
      </div>
    `;
  }

  return `
    <div class="print-block print-report-block">
      <h2 class="print-section-title">Compte-rendu de visite</h2>
      ${report
        .split(/\n{2,}/)
        .map((block) => {
          const [title, ...lines] = block.split("\n");
          const content = lines.map((line) => escapeAttr(line)).join("<br />");
          return `
            <section class="print-report-section">
              <h3>${escapeAttr(title)}</h3>
              ${content ? `<p>${content}</p>` : ""}
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}

function printablePhotosHtml(visite) {
  const photos = normalizePhotos({ photos: visite?.photos || [] }, visite?.createdAt || nowIso());

  if (photos.length === 0) {
    return `
      <div class="print-block print-photos-block">
        <h2 class="print-section-title">Photos de visite</h2>
        <p>Aucune photo ajoutée pour cette visite.</p>
      </div>
    `;
  }

  return `
    <div class="print-block print-photos-block">
      <h2 class="print-section-title">Photos de visite</h2>
      <div class="print-photo-grid">
        ${photos
          .map(
            (photo, index) => `
              <figure>
                <img src="${escapeAttr(photo.dataUrl)}" alt="Photo de visite ${index + 1}" />
                <figcaption>Photo ${index + 1}</figcaption>
              </figure>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderPrintDossier() {
  const visite = currentVisit();
  if (!visite || !elements.printDossier) {
    if (elements.printDossier) elements.printDossier.innerHTML = "";
    return;
  }

  const status = dossierStatus(visite);
  const clientName = firstString(visite.clientName) || "Client à compléter";
  const phone = firstString(visite.phone) || "Téléphone à compléter";
  const email = firstString(visite.email) || "Email à compléter";
  const city = firstString(visite.city) || "Ville à compléter";
  const address = firstString(visite.address);
  const location = address ? `${address}, ${city}` : city;
  const projectType = projectTypeLabel(visite.projectType);
  const dossierDate = formatShortDate(visite.createdAt || visite.updatedAt || new Date());
  const tracking = internalTrackingState(visite);

  elements.printDossier.innerHTML = `
    <header class="print-header">
      <div>
        <p class="print-brand">COPILOTE CHANTIER</p>
        <h1>Dossier de visite chantier</h1>
        <p class="print-subtitle">Dossier : ${escapeAttr(clientName)} — ${escapeAttr(location)} — ${escapeAttr(dossierDate)}</p>
        <p>Document interne pour traitement du dossier.</p>
      </div>
      <div class="print-date">
        <span>Date de génération</span>
        <strong>${escapeAttr(formatPrintDate())}</strong>
      </div>
    </header>

    <section class="print-block">
      <h2>Informations client</h2>
      <dl class="print-info-grid">
        <div><dt>Client</dt><dd>${escapeAttr(clientName)}</dd></div>
        <div><dt>Téléphone</dt><dd>${escapeAttr(phone)}</dd></div>
        <div><dt>Email</dt><dd>${escapeAttr(email)}</dd></div>
        <div><dt>Ville / adresse</dt><dd>${escapeAttr(location)}</dd></div>
        <div><dt>Type d'intervention / chantier</dt><dd>${escapeAttr(projectType)}</dd></div>
        <div><dt>Note de visite</dt><dd>${escapeAttr(`Note de visite : ${writtenNoteLabel(visite.textNote)}`)}</dd></div>
        <div><dt>Audio original</dt><dd>${escapeAttr(`Audio original : ${audioOriginalLabel(visite.voiceNote)}`)}</dd></div>
      </dl>
    </section>

    ${printableReportHtml(visite)}
    ${printablePhotosHtml(visite)}

    <section class="print-block">
      <h2>Suivi interne</h2>
      <dl class="print-info-grid">
        <div><dt>Statut du dossier</dt><dd>${escapeAttr(tracking.status || status.label)}</dd></div>
        <div><dt>Prochaine étape</dt><dd>${escapeAttr(tracking.nextStep)}</dd></div>
      </dl>
    </section>
  `;
}

function renderAll() {
  renderPhotoGallery();
  renderDictationControls();
  renderVoiceNote();
  renderMessages();
  renderReport();
  renderPrintDossier();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function buildReportVisitSnapshot(textNote) {
  return {
    ...currentVisit(),
    clientName: elements.clientName.value.trim() || "Nouveau client",
    phone: elements.clientPhone.value.trim(),
    email: elements.clientEmail.value.trim(),
    city: elements.clientCity.value.trim(),
    projectType: normalizeProjectType(elements.projectTypeInput.value),
    visitStatus: elements.detailStatus.value,
    textNote,
    photos: photosForStorage(),
  };
}

function buildAiReportPayload(visit) {
  return {
    dossierType: "Chantier / travaux",
    clientName: firstString(visit.clientName),
    phone: firstString(visit.phone),
    email: firstString(visit.email),
    city: firstString(visit.city),
    address: firstString(visit.address),
    projectType: projectTypeLabel(visit.projectType),
    textNote: firstString(visit.textNote),
    photoCount: Array.isArray(visit.photos) ? visit.photos.length : 0,
    audioOriginal: Boolean(normalizeVoiceNote(visit.voiceNote)),
    visitDate: firstString(visit.createdAt || visit.updatedAt),
  };
}

function setReportGenerationLoading(isLoading) {
  elements.generateButton.disabled = isLoading;
  elements.generateButton.innerHTML = isLoading
    ? `<svg><use href="#icon-zap"></use></svg>Génération en cours…`
    : `<svg><use href="#icon-zap"></use></svg>Générer le compte-rendu`;
}

async function requestAiReport(visit) {
  const response = await fetch(AI_REPORT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildAiReportPayload(visit)),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok || !data.ok || !data.report) {
    const error = new Error(data.message || "AI report unavailable");
    error.reason = data.reason || "ai_unavailable";
    throw error;
  }

  return sanitizeLegacyReportText(data.report);
}

function buildSendDossierPayload(visit) {
  const photos = photosForStorage();
  const textNote = elements.voiceNote.value.trim();
  const projectType = normalizeProjectType(elements.projectTypeInput.value);

  return {
    to: elements.officeEmail.value.trim(),
    clientName: elements.clientName.value.trim() || visit.clientName || "Nouveau client",
    phone: elements.clientPhone.value.trim(),
    clientEmail: elements.clientEmail.value.trim(),
    city: elements.clientCity.value.trim(),
    address: firstString(visit.address),
    projectType: projectTypeLabel(projectType || visit.projectType),
    textNote,
    report: polishReportText(visit.report),
    reportMode: normalizeReportMode(visit.reportMode),
    photoCount: photos.length,
    photos: photos.map((photo) => ({
      dataUrl: photo.dataUrl,
      name: photo.name,
    })),
    audioOriginal: Boolean(normalizeVoiceNote(visit.voiceNote)),
    visitDate: firstString(visit.createdAt || visit.updatedAt),
    status: internalTrackingState(visit).status,
  };
}

function setDossierSendingLoading(isLoading) {
  elements.finalizeDossierButton.disabled = isLoading;
  elements.finalizeDossierButton.innerHTML = isLoading
    ? `<svg><use href="#icon-send"></use></svg>Envoi en cours…`
    : `<svg><use href="#icon-send"></use></svg>Envoyer le dossier à l'équipe interne`;
}

async function requestSendDossier(payload) {
  const response = await fetch(SEND_DOSSIER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok || !data.ok) {
    const error = new Error(data.message || "Envoi impossible. Le dossier reste prêt pour traitement interne.");
    error.reason = data.reason || "send_failed";
    error.userMessage = data.message;
    throw error;
  }

  return data;
}

function aiFallbackToast(reason) {
  return reason === "missing_api_key"
    ? "IA non configurée : compte-rendu simple généré."
    : "Compte-rendu simple généré. L'IA n'est pas disponible pour le moment.";
}

async function analyzeVisit() {
  const textNote = elements.voiceNote.value.trim();

  persistDetailFields();

  state.analyzedAt = new Date();
  const visitSnapshot = buildReportVisitSnapshot(textNote);
  let report = "";
  let reportMode = "simple";
  let toastMessage = "Compte-rendu IA généré";

  renderReportNotice("Génération du compte-rendu IA en cours…");
  setReportGenerationLoading(true);

  try {
    report = await requestAiReport(visitSnapshot);
    if (!report) throw Object.assign(new Error("Empty AI report"), { reason: "invalid_ai_output" });
    reportMode = "ai";
  } catch (error) {
    report = buildReportText(visitSnapshot);
    reportMode = "simple";
    toastMessage = aiFallbackToast(error.reason);
  } finally {
    setReportGenerationLoading(false);
  }

  updateVisit({
    projectType: normalizeProjectType(elements.projectTypeInput.value),
    textNote,
    report,
    reportMode,
    analyzedAt: state.analyzedAt.toISOString(),
    finalizedAt: null,
    sentAt: null,
  });
  renderAll();
  renderDetailMeta();
  showToast(toastMessage);
}

async function copyText(text, fallbackElement) {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API unavailable");
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (fallbackElement) {
      fallbackElement.select();
      return Boolean(document.execCommand?.("copy"));
    }
    return false;
  }
}

async function finalizeDossierForInternalTreatment() {
  persistDetailFields();
  const visit = currentVisit();
  if (!visit?.report) {
    renderMessages();
    renderDetailMeta();
    showToast("Compte-rendu à générer avant finalisation");
    return;
  }

  const recipientEmail = elements.officeEmail.value.trim();
  if (!recipientEmail) {
    showToast("Adresse email interne à renseigner.");
    return;
  }

  if (!isValidEmail(recipientEmail)) {
    showToast("Adresse email interne invalide.");
    return;
  }

  showHandoffResult("Préparation du dossier…", "Les informations de visite sont préparées pour l'équipe interne.");
  showToast("Préparation du dossier…");
  setDossierSendingLoading(true);

  try {
    const payload = buildSendDossierPayload(visit);
    showHandoffResult("Envoi du dossier en cours…", "Le dossier est transmis à l'équipe interne.");
    showToast("Envoi du dossier en cours…");
    const result = await requestSendDossier(payload);
    const sentAt = nowIso();

    updateVisit({
      officeEmail: recipientEmail,
      finalizedAt: sentAt,
      sentAt,
    });
    renderMessages();
    renderDetailMeta();
    renderHome();

    const photoMessage = result.photosSkipped
      ? "Dossier envoyé. Les photos n'ont pas été jointes car leur taille dépasse la limite prévue pour l'envoi email."
      : "Dossier envoyé avec les éléments de visite disponibles.";
    showHandoffResult("Dossier envoyé à l'équipe interne", photoMessage);
    showToast("Dossier envoyé à l'équipe interne.");
  } catch (error) {
    const finalizedAt = nowIso();
    updateVisit({
      officeEmail: recipientEmail,
      finalizedAt,
    });
    renderMessages();
    renderDetailMeta();
    renderHome();

    const message = error.reason === "service_not_configured"
      ? "Service d'envoi non configuré. Le dossier reste prêt pour traitement interne."
      : error.userMessage || "Envoi impossible. Le dossier reste prêt pour traitement interne.";
    showHandoffResult("Dossier prêt pour traitement interne", message);
    showToast(message);
  } finally {
    setDossierSendingLoading(false);
  }
}

function printVisitDossier() {
  persistDetailFields();
  renderAll();
  renderDetailMeta();
  window.print();
}

async function photoFromFile(file) {
  const dataUrl = await compressPhotoFile(file);
  return {
    id: createPhotoId(),
    dataUrl,
    name: file.name || `Photo chantier ${new Date().toLocaleTimeString("fr-FR")}`,
    createdAt: nowIso(),
  };
}

async function addPhotoFiles(fileList) {
  if (!currentVisit()) {
    showToast("Créez une visite avant d'ajouter des photos");
    return;
  }

  const files = Array.from(fileList || []).filter((file) => (file.type || "").startsWith("image/"));
  if (files.length === 0) return;

  const existingPhotos = currentVisit()?.photos || [];
  const availableSlots = MAX_PHOTOS_PER_VISIT - existingPhotos.length;
  if (availableSlots <= 0) {
    showToast(`Maximum ${MAX_PHOTOS_PER_VISIT} photos par visite`);
    return;
  }

  const selectedFiles = files.slice(0, availableSlots);
  const addedPhotos = [];

  for (const file of selectedFiles) {
    try {
      addedPhotos.push(await photoFromFile(file));
    } catch {
      showToast("Une photo n'a pas pu être ajoutée");
    }
  }

  if (addedPhotos.length === 0) return;

  const latestPhotos = currentVisit()?.photos || [];
  const remainingSlots = MAX_PHOTOS_PER_VISIT - latestPhotos.length;
  if (remainingSlots <= 0) {
    showToast(`Maximum ${MAX_PHOTOS_PER_VISIT} photos par visite`);
    return;
  }

  const photosToSave = [...latestPhotos, ...addedPhotos.slice(0, remainingSlots)];
  updateVisit({ photos: photosToSave });
  const savedPhotos = currentVisit()?.photos || [];
  renderPhotoGallery(savedPhotos);
  renderPrintDossier();

  if (files.length > selectedFiles.length || addedPhotos.length > remainingSlots) {
    showToast(`Photos ajoutées, limite ${MAX_PHOTOS_PER_VISIT} atteinte`);
    return;
  }

  showToast(photoLabel(addedPhotos.length) + " ajoutée" + (addedPhotos.length > 1 ? "s" : ""));
}

function removePhoto(photoId) {
  const visite = currentVisit();
  if (!visite) return;

  const photos = (visite.photos || []).filter((photo) => photo.id !== photoId);
  updateVisit({ photos });
  renderPhotoGallery(currentVisit()?.photos || []);
  renderPrintDossier();
  showToast("Photo supprimée");
}

elements.homeButton.addEventListener("click", () => setView("home"));
elements.brandHomeButton.addEventListener("click", () => setView("home"));
elements.topNewFolderButton.addEventListener("click", showCreationForm);
elements.newFolderButton.addEventListener("click", showCreationForm);
elements.cancelNewFolder.addEventListener("click", hideCreationForm);
elements.statusFilter.addEventListener("change", renderHome);

elements.newFolderForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const visite = createVisit({
    clientName: elements.newClientName.value.trim() || "Nouveau client",
    phone: elements.newClientPhone.value.trim(),
    email: elements.newClientEmail.value.trim(),
    city: elements.newClientCity.value.trim(),
    projectType: elements.newClientTrade.value.trim(),
    visitStatus: elements.newClientStatus.value,
  });

  state.visites.unshift(visite);
  saveVisits();
  hideCreationForm();
  openVisit(visite.id);
  showToast("Visite créée");
});

elements.folderList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-folder-id]");
  if (!card) return;
  openVisit(card.dataset.folderId);
});

document.querySelector("#generateButton").addEventListener("click", analyzeVisit);

elements.detailStatus.addEventListener("change", () => {
  persistDetailFields();
  showToast("Statut mis à jour");
});

["input", "change"].forEach((eventName) => {
  [
    elements.clientName,
    elements.clientCity,
    elements.clientPhone,
    elements.clientEmail,
    elements.officeEmail,
    elements.projectTypeInput,
  ].forEach((field) => {
    field.addEventListener(eventName, () => {
      renderMessages();
      persistDetailFields();
    });
  });

  elements.voiceNote.addEventListener(eventName, () => {
    renderMessages();
    renderReport();
    persistDetailFields();
  });
});

elements.finalizeDossierButton.addEventListener("click", finalizeDossierForInternalTreatment);
document.querySelector("#printButton").addEventListener("click", printVisitDossier);

elements.dictateNoteButton.addEventListener("click", startDictation);
elements.stopDictationButton.addEventListener("click", stopDictation);
elements.voiceRecordButton.addEventListener("click", startVoiceRecording);
elements.voiceStopButton.addEventListener("click", stopVoiceRecording);
elements.voiceDeleteButton.addEventListener("click", deleteVoiceNote);

elements.photoGallery.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-photo-delete]");
  if (!deleteButton) return;
  removePhoto(deleteButton.dataset.photoDelete);
});

elements.photoInput.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []);
  event.target.value = "";
  state.photoQueue = state.photoQueue
    .then(() => addPhotoFiles(files))
    .catch(() => showToast("Les photos n'ont pas pu être ajoutées"));
  await state.photoQueue;
});

saveVisits();
renderHome();
setView("home");
