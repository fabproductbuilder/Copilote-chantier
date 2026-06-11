const STORAGE_KEY = "copiloteChantier.visites.v1";
const LEGACY_STORAGE_KEY = "copiloteChantier.dossiers.v1";
const DEFAULT_PHOTO = "assets/chantier-renovation.png";
const MAX_PHOTOS_PER_VISIT = 8;
const PHOTO_MAX_DIMENSION = 1400;
const PHOTO_JPEG_QUALITY = 0.72;
const MIN_REPORT_NOTE_LENGTH = 18;

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
  prepareEmailButton: document.querySelector("#prepareEmailButton"),
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

function hasEnoughVisitNote(textNote) {
  return String(textNote || "").trim().replace(/\s+/g, " ").length >= MIN_REPORT_NOTE_LENGTH;
}

function reportPhotoLabel(count) {
  if (count === 0) return "Aucune photo jointe pour le moment.";
  return `${photoLabel(count)} jointe${count > 1 ? "s" : ""} à la visite.`;
}

function voiceNoteLabel(voiceNote) {
  return normalizeVoiceNote(voiceNote) ? "présente" : "non ajoutée";
}

function internalTreatmentInfoText(textNote) {
  const note = String(textNote || "").trim();
  return note || "À compléter à partir de la note de visite.";
}

function writtenNoteLabel(textNote) {
  return String(textNote || "").trim() ? "présente" : "non renseignée";
}

function reportStatusLabel(report) {
  return sanitizeLegacyReportText(report) ? "généré" : "à générer";
}

function contactStatusLabel({ phone, email }) {
  return firstString(phone) && firstString(email) ? "complètes" : "à compléter";
}

function projectTypeStatusLabel(projectType) {
  return firstString(projectType) ? "renseigné" : "à préciser";
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
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      const lowerLine = trimmed.toLowerCase();
      const startsSafeSection = /^(Résumé de la visite|Demande du client|Éléments collectés|Photos jointes|Informations pour traitement interne|Prochaine action)$/i.test(
        trimmed,
      );

      if (/^Points/i.test(trimmed) || blockedTerms.some((term) => lowerLine.includes(term))) {
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

function isCurrentReportFormat(report) {
  const cleanedReport = sanitizeLegacyReportText(report);
  return [
    "Résumé de la visite",
    "Demande / observations",
    "Éléments collectés",
    "Nombre de photos :",
    "Note vocale :",
    "Photos jointes",
    "Informations pour traitement interne",
    "Prochaine action",
  ].every((term) => cleanedReport.includes(term));
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
  const nextAction = "Préparer la transmission du dossier pour traitement interne.";

  return `Résumé de la visite
Client : ${clientName}
Type d'intervention / chantier : ${projectType}
Localisation : ${address ? `${address}, ${city}` : city}
Contact : ${phone} / ${email}

Demande / observations
${note}

Éléments collectés
Nombre de photos : ${photos.length}
Note vocale : ${voiceNoteLabel(visit.voiceNote)}

Photos jointes
${reportPhotoLabel(photos.length)}

Informations pour traitement interne
${internalTreatmentInfoText(note)}

Prochaine action
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
    pdfGeneratedAt: overrides.pdfGeneratedAt || null,

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
    pdfGeneratedAt: raw.pdfGeneratedAt || null,
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

function visitTitle(visite) {
  return `Visite chez ${visite.clientName || "Nouveau client"}`;
}

function statusClass(status) {
  return `status-${status || "draft"}`;
}

function dossierStatus(visite = {}) {
  if (visite.transmittedAt || visite.visitStatus === "transmitted") {
    return {
      key: "transmitted",
      label: "Transmis",
      className: "status-sent",
    };
  }

  if (visite.report) {
    return {
      key: "ready",
      label: "Prêt à transmettre",
      className: "status-ready",
    };
  }

  return {
    key: "incomplete",
    label: "À compléter",
    className: "status-draft",
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
    transmitted: state.visites.filter((visite) => dossierStatus(visite).key === "transmitted").length,
  };

  elements.totalFoldersCount.textContent = totals.total;
  elements.draftFoldersCount.textContent = totals.incomplete;
  elements.sentFoldersCount.textContent = totals.ready;
  elements.acceptedFoldersCount.textContent = totals.transmitted;

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
  elements.internalStatusValue.textContent = visite.report ? "Prêt à transmettre" : "À compléter";
  const nextActionLabel = visite.report
    ? "À traiter par l'équipe interne"
    : "Compte-rendu à générer avant transmission";
  elements.nextAction.innerHTML = `${nextActionLabel}<svg><use href="#icon-chevron"></use></svg>`;
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
      "L'enregistrement audio n'est pas disponible sur ce navigateur. Vous pouvez utiliser la note écrite.",
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

  setVoiceRecordStatus(voiceNote ? "Note vocale enregistrée." : "Prêt à enregistrer", voiceNote ? "saved" : "ready");
}

async function startVoiceRecording() {
  if (!currentVisit()) {
    showToast("Créez une visite avant d'enregistrer une note vocale");
    return;
  }

  if (!isAudioRecordingSupported()) {
    setVoiceRecordStatus(
      "L'enregistrement audio n'est pas disponible sur ce navigateur. Vous pouvez utiliser la note écrite.",
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
        setVoiceRecordStatus("Erreur pendant l'enregistrement. Réessayez ou utilisez la note écrite.", "error");
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
          state.audioStatusMessage = "Note vocale enregistrée.";
          state.audioStatusKind = "saved";
          renderVoiceNote();
          renderMessages();
          showToast("Note vocale enregistrée.");
        } else {
          state.audioStatusMessage = "";
          state.audioStatusKind = "";
        }
      } catch {
        setVoiceRecordStatus("Erreur pendant l'enregistrement. Réessayez ou utilisez la note écrite.", "error");
        renderVoiceNote();
      }
    });

    recorder.addEventListener("error", () => {
      stopAudioStream();
      state.audioRecorder = null;
      state.audioVisitId = null;
      setVoiceRecordStatus("Erreur pendant l'enregistrement. Réessayez ou utilisez la note écrite.", "error");
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
        ? "Accès au micro non autorisé. Autorisez le micro dans les réglages du navigateur ou utilisez la note écrite."
        : "Erreur pendant l'enregistrement. Réessayez ou utilisez la note écrite.",
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
  showToast("Note vocale supprimée");
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
  const cleanedReport = sanitizeLegacyReportText(report);
  if (!cleanedReport) {
    return "Compte-rendu de visite : à générer avant transmission.";
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
  const projectType = elements.projectTypeInput.value.trim() || visit?.projectType || "";
  const voiceStatus = voiceNoteLabel(visit?.voiceNote);

  elements.clientMessage.value = `Objet : Dossier de visite à traiter - ${clientName}

Bonjour,

Voici le dossier de visite à traiter pour : ${clientName}.

Éléments disponibles :
- compte-rendu de visite : ${reportStatusLabel(visit?.report)} ;
- note écrite : ${writtenNoteLabel(textNote)} ;
- note vocale : ${voiceStatus} ;
- photos : ${photoCountText(photos.length)} ;
- coordonnées client : ${contactStatusLabel({ phone, email })} ;
- type d'intervention / chantier : ${projectTypeStatusLabel(projectType)}.

Prochaine action :
Vérifier les informations collectées et préparer le traitement interne du dossier.

Le compte-rendu détaillé est disponible dans le bloc "Compte-rendu de visite".`;
}

function renderReport() {
  const visit = currentVisit();
  const report = visit?.report && !isCurrentReportFormat(visit.report)
    ? buildReportText(visit)
    : sanitizeLegacyReportText(visit?.report);
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

function renderAll() {
  renderPhotoGallery();
  renderVoiceNote();
  renderMessages();
  renderReport();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function analyzeVisit() {
  const textNote = elements.voiceNote.value.trim();

  persistDetailFields();

  if (!hasEnoughVisitNote(textNote)) {
    renderReportNotice("Ajoutez une note de visite plus détaillée avant de générer le compte-rendu.");
    showToast("Note de visite à compléter avant génération");
    return;
  }

  state.analyzedAt = new Date();
  const report = buildReportText({
    ...currentVisit(),
    clientName: elements.clientName.value.trim() || "Nouveau client",
    phone: elements.clientPhone.value.trim(),
    email: elements.clientEmail.value.trim(),
    city: elements.clientCity.value.trim(),
    projectType: normalizeProjectType(elements.projectTypeInput.value),
    visitStatus: elements.detailStatus.value,
    textNote,
    photos: photosForStorage(),
  });

  updateVisit({
    projectType: normalizeProjectType(elements.projectTypeInput.value),
    textNote,
    report,
    analyzedAt: state.analyzedAt.toISOString(),
  });
  renderAll();
  renderDetailMeta();
  showToast("Compte-rendu généré, dossier prêt à vérifier");
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

function prepareEmailAndPdf() {
  persistDetailFields();
  renderMessages();
  renderDetailMeta();
  copyText(elements.clientMessage.value, elements.clientMessage);
  showToast("Envoi du dossier préparé à copier");
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

elements.prepareEmailButton.addEventListener("click", prepareEmailAndPdf);
document.querySelector("#printButton").addEventListener("click", () => window.print());

elements.voiceRecordButton.addEventListener("click", startVoiceRecording);
elements.voiceStopButton.addEventListener("click", stopVoiceRecording);
elements.voiceDeleteButton.addEventListener("click", deleteVoiceNote);

document.querySelector("#nextAction").addEventListener("click", () => {
  showToast("Dossier à traiter par l'équipe interne");
});

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
