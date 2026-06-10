const STORAGE_KEY = "copiloteChantier.visites.v1";
const LEGACY_STORAGE_KEY = "copiloteChantier.dossiers.v1";
const DEFAULT_PHOTO = "assets/chantier-renovation.png";
const MAX_PHOTOS_PER_VISIT = 8;
const PHOTO_MAX_DIMENSION = 1400;
const PHOTO_JPEG_QUALITY = 0.72;

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

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const visitTypeLabels = {
  renovation: "Rénovation",
  plomberie: "Plomberie",
  peinture: "Peinture",
};

const statusLabels = {
  draft: "Brouillon",
  sent: "Devis envoyé",
  accepted: "Accepté",
  declined: "Refusé",
};

const DEFAULT_PROJECT_TYPE = "renovation";
const DEFAULT_VISIT_STATUS = "draft";

const visitPresets = {
  renovation: {
    detected: [
      "Dépose meuble vasque",
      "Reprise évacuation",
      "Carrelage mural",
      "Peinture plafond",
      "Protection logement",
    ],
    rows: [
      {
        label: "Protection et préparation chantier",
        detail: "Sol, ascenseur, circulation appartement occupé",
        qty: "1",
        total: 340,
      },
      {
        label: "Dépose meuble vasque et évacuation",
        detail: "Retrait propre, mise en sacs, dépôt gravats",
        qty: "1",
        total: 420,
      },
      {
        label: "Reprise plomberie sous vasque",
        detail: "Alimentation, évacuation, raccords et test étanchéité",
        qty: "1",
        total: 680,
      },
      {
        label: "Pose carrelage mural",
        detail: "Support à reprendre, fourniture standard incluse",
        qty: "8 m²",
        total: 1120,
      },
      {
        label: "Peinture plafond et finitions",
        detail: "Préparation, sous-couche, deux passes",
        qty: "1",
        total: 520,
      },
      {
        label: "Provision ajustements",
        detail: "Petites reprises découvertes après dépose",
        qty: "1",
        total: 310,
      },
    ],
    materials: [
      ["Bâches et adhésifs de protection", "1 lot"],
      ["Raccords PER/cuivre et siphon", "1 kit"],
      ["Carrelage mural", "8 m²"],
      ["Colle, joints et primaire", "1 lot"],
      ["Peinture pièce humide", "2,5 L"],
    ],
  },
  plomberie: {
    detected: [
      "Fuite probable",
      "Remplacement siphon",
      "Raccords à reprendre",
      "Test pression",
    ],
    rows: [
      {
        label: "Diagnostic et déplacement",
        detail: "Contrôle visuel, accès sous vasque, recherche fuite",
        qty: "1",
        total: 120,
      },
      {
        label: "Dépose ancien raccordement",
        detail: "Démontage siphon, flexible et joints usés",
        qty: "1",
        total: 165,
      },
      {
        label: "Remplacement évacuation vasque",
        detail: "Siphon, bonde, raccords, étanchéité",
        qty: "1",
        total: 310,
      },
      {
        label: "Reprise alimentations",
        detail: "Flexibles, vannes d'arrêt, mise en pression",
        qty: "2",
        total: 260,
      },
      {
        label: "Essais et nettoyage",
        detail: "Test écoulement, contrôle fuite, remise propre",
        qty: "1",
        total: 95,
      },
    ],
    materials: [
      ["Siphon gain de place", "1"],
      ["Bonde clic-clac", "1"],
      ["Flexibles inox", "2"],
      ["Joints et téflon", "1 lot"],
      ["Vannes d'arrêt", "2"],
    ],
  },
  peinture: {
    detected: [
      "Plafond pièce humide",
      "Support à reprendre",
      "Angles fissurés",
      "Protection mobilier",
    ],
    rows: [
      {
        label: "Protection appartement",
        detail: "Bâchage, masquage, circulation",
        qty: "1",
        total: 180,
      },
      {
        label: "Préparation supports",
        detail: "Lessivage, rebouchage, ponçage local",
        qty: "18 m²",
        total: 540,
      },
      {
        label: "Sous-couche isolante",
        detail: "Plafond et zones humides",
        qty: "18 m²",
        total: 360,
      },
      {
        label: "Peinture finition satinée",
        detail: "Deux couches, pièce humide",
        qty: "18 m²",
        total: 610,
      },
      {
        label: "Nettoyage et reprise",
        detail: "Retrait masquage, retouches, évacuation",
        qty: "1",
        total: 120,
      },
    ],
    materials: [
      ["Enduit de rebouchage", "2 kg"],
      ["Abrasifs", "1 lot"],
      ["Sous-couche anti-humidité", "5 L"],
      ["Peinture satinée", "5 L"],
      ["Masquage et bâches", "1 lot"],
    ],
  },
};

const elements = {
  homeView: document.querySelector("#homeView"),
  detailView: document.querySelector("#detailView"),
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
  detailStatus: document.querySelector("#detailStatus"),
  detailStatusPill: document.querySelector("#detailStatusPill"),
  voiceNote: document.querySelector("#voiceNote"),
  detectedList: document.querySelector("#detectedList"),
  quoteRows: document.querySelector("#quoteRows"),
  addQuoteRow: document.querySelector("#addQuoteRow"),
  subtotalValue: document.querySelector("#subtotalValue"),
  totalValue: document.querySelector("#totalValue"),
  vatRate: document.querySelector("#vatRate"),
  clientMessage: document.querySelector("#clientMessage"),
  whatsappMessage: document.querySelector("#whatsappMessage"),
  prepareEmailButton: document.querySelector("#prepareEmailButton"),
  copyWhatsappButton: document.querySelector("#copyWhatsappButton"),
  materialsList: document.querySelector("#materialsList"),
  reportCard: document.querySelector("#reportCard"),
  toast: document.querySelector("#toast"),
  mainPhoto: document.querySelector("#mainPhoto"),
  photoCount: document.querySelector("#photoCount"),
  photoGallery: document.querySelector("#photoGallery"),
  photoInput: document.querySelector("#photoInput"),
  autoFollowup: document.querySelector("#autoFollowup"),
  followupJ3: document.querySelector("#followupJ3"),
  followupJ7: document.querySelector("#followupJ7"),
  lastUpdateValue: document.querySelector("#lastUpdateValue"),
  nextAction: document.querySelector("#nextAction"),
};

const state = {
  currentId: null,
  visites: loadVisits(),
  visitType: "renovation",
  analyzedAt: new Date(),
  photoQueue: Promise.resolve(),
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
  return visitPresets[value] ? value : DEFAULT_PROJECT_TYPE;
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
  const rows = Array.isArray(rawRows) && rawRows.length > 0 ? rawRows : [];

  return rows.map((row) => ({
    label: row.label || "Poste à préciser",
    detail: row.detail || "",
    qty: row.qty || "1",
    total: Number(row.total) || 0,
  }));
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

function buildReportText(textNote) {
  const note = String(textNote || "").trim() || "Note chantier à compléter.";
  return `Compte-rendu visite\n\n${note}\n\nPoints à confirmer : choix matériaux, quantités, planning, accès, évacuation gravats.`;
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
    city: firstString(overrides.city),
    address: firstString(overrides.address),
    projectType,
    visitStatus,
    textNote,
    photos: normalizePhotos({ photos: overrides.photos }, createdAt),
    voiceNote: overrides.voiceNote && typeof overrides.voiceNote === "object" ? overrides.voiceNote : null,
    voiceTranscript: firstString(overrides.voiceTranscript),
    report: firstString(overrides.report) || buildReportText(textNote),
    pdfGeneratedAt: overrides.pdfGeneratedAt || null,

    quoteRows: normalizeQuoteRows(overrides.quoteRows),
    vatRate: overrides.vatRate || "0.1",
    autoFollowup: overrides.autoFollowup ?? true,
    followupJ3: overrides.followupJ3 ?? true,
    followupJ7: overrides.followupJ7 ?? true,
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
    city: raw.city,
    address: raw.address,
    projectType,
    visitStatus: raw.visitStatus || raw.status,
    textNote,
    photos: normalizePhotos(raw, createdAt),
    voiceNote: raw.voiceNote && typeof raw.voiceNote === "object" ? raw.voiceNote : null,
    voiceTranscript: raw.voiceTranscript,
    report: raw.report || buildReportText(textNote),
    pdfGeneratedAt: raw.pdfGeneratedAt || null,
    quoteRows: normalizeQuoteRows(raw.quoteRows || raw.rows),
  });

  return {
    ...normalized,
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

function currentPreset() {
  return visitPresets[state.visitType] || visitPresets.renovation;
}

function currentQuoteRows() {
  const visite = currentVisit();
  if (visite?.quoteRows?.length) {
    return visite.quoteRows;
  }
  return cloneRows(currentPreset().rows);
}

function storedQuoteRows() {
  return currentVisit()?.quoteRows || [];
}

function sumRows(rows) {
  return rows.reduce((total, row) => total + (Number(row.total) || 0), 0);
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

function addDays(dateLike, days) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function visitTitle(visite) {
  return `Visite chez ${visite.clientName || "Nouveau client"}`;
}

function statusClass(status) {
  return `status-${status || "draft"}`;
}

function parseAmount(value) {
  const normalized = String(value || "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  return Number(normalized) || 0;
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
    draft: state.visites.filter((visite) => visite.visitStatus === "draft").length,
    sent: state.visites.filter((visite) => visite.visitStatus === "sent").length,
    accepted: state.visites.filter((visite) => visite.visitStatus === "accepted").length,
  };

  elements.totalFoldersCount.textContent = totals.total;
  elements.draftFoldersCount.textContent = totals.draft;
  elements.sentFoldersCount.textContent = totals.sent;
  elements.acceptedFoldersCount.textContent = totals.accepted;

  const filter = elements.statusFilter.value;
  const visites = state.visites
    .filter((visite) => filter === "all" || visite.visitStatus === filter)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  elements.emptyState.hidden = visites.length > 0;
  elements.folderList.innerHTML = visites
    .map((visite) => {
      const total = sumRows(visite.quoteRows || []) * (1 + Number(visite.vatRate || "0.1"));
      const contact = [visite.city || "Ville à compléter", visite.phone, visite.email]
        .filter(Boolean)
        .join(" · ");

      return `
        <button class="folder-card" data-folder-id="${visite.id}" type="button">
          <span class="folder-main">
            <span class="folder-kicker">${visitTypeLabels[visite.projectType] || "Rénovation"}</span>
            <strong>${visitTitle(visite)}</strong>
            <small>${contact || "Contact à compléter"} · ${formatDate(visite.updatedAt)}</small>
          </span>
          <span class="folder-meta">
            <span class="status-pill ${statusClass(visite.visitStatus)}">${statusLabels[visite.visitStatus]}</span>
            <strong>${euro.format(total)}</strong>
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
  elements.newClientTrade.value = "renovation";
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

function hydrateDetail(visite) {
  state.visitType = visite.projectType || DEFAULT_PROJECT_TYPE;
  elements.clientName.value = visite.clientName || "";
  elements.clientCity.value = visite.city || "";
  elements.clientPhone.value = visite.phone || "";
  elements.clientEmail.value = visite.email || "";
  elements.detailStatus.value = visite.visitStatus || DEFAULT_VISIT_STATUS;
  elements.voiceNote.value = visite.textNote || "";
  elements.vatRate.value = visite.vatRate || "0.1";
  elements.autoFollowup.checked = visite.autoFollowup ?? true;
  elements.followupJ3.checked = visite.followupJ3 ?? true;
  elements.followupJ7.checked = visite.followupJ7 ?? true;
  renderPhotoGallery(visite.photos);

  document.querySelectorAll(".segment").forEach((item) => {
    item.classList.toggle("active", item.dataset.trade === state.visitType);
  });

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
  const nextActionLabel = visite.followupJ3
    ? `Relance J+3 prévue le ${addDays(visite.updatedAt, 3)}`
    : `Relance J+7 prévue le ${addDays(visite.updatedAt, 7)}`;
  elements.nextAction.innerHTML = `${nextActionLabel}<svg><use href="#icon-chevron"></use></svg>`;
}

function renderPhotoGallery(photos = currentVisit()?.photos || []) {
  const normalizedPhotos = normalizePhotos({ photos }, currentVisit()?.createdAt || nowIso());
  elements.mainPhoto.src = normalizedPhotos[0]?.dataUrl || DEFAULT_PHOTO;
  elements.photoCount.textContent = photoLabel(normalizedPhotos.length);

  if (normalizedPhotos.length === 0) {
    elements.photoGallery.innerHTML = '<div class="photo-empty">Aucune photo ajoutée</div>';
    return;
  }

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

function persistDetailFields() {
  const textNote = elements.voiceNote.value;
  updateVisit({
    clientName: elements.clientName.value.trim() || "Nouveau client",
    phone: elements.clientPhone.value.trim(),
    email: elements.clientEmail.value.trim(),
    city: elements.clientCity.value.trim(),
    projectType: state.visitType,
    visitStatus: elements.detailStatus.value,
    textNote,
    report: buildReportText(textNote),
    vatRate: elements.vatRate.value,
    autoFollowup: elements.autoFollowup.checked,
    followupJ3: elements.followupJ3.checked,
    followupJ7: elements.followupJ7.checked,
    quoteRows: storedQuoteRows(),
    photos: photosForStorage(),
  });
  renderDetailMeta();
}

function renderDetected(preset) {
  elements.detectedList.innerHTML = preset.detected
    .map((item) => `<span>${item}</span>`)
    .join("");
}

function renderQuoteRows(rows) {
  elements.quoteRows.innerHTML = rows
    .map(
      (row, index) => `
        <div class="quote-row quote-row-editable" data-quote-index="${index}">
          <span class="quote-item">
            <input data-quote-field="label" value="${escapeAttr(row.label)}" aria-label="Poste ${index + 1}" />
            <input data-quote-field="detail" value="${escapeAttr(row.detail || "")}" aria-label="Détail poste ${index + 1}" />
          </span>
          <input class="qty" data-quote-field="qty" value="${escapeAttr(row.qty)}" aria-label="Quantité poste ${index + 1}" />
          <input class="line-total" data-quote-field="total" inputmode="decimal" value="${escapeAttr(row.total)}" aria-label="Prix poste ${index + 1}" />
        </div>
      `,
    )
    .join("");
}

function renderTotals(rows = currentQuoteRows()) {
  const subtotal = sumRows(rows);
  const vat = Number(elements.vatRate.value);
  elements.subtotalValue.textContent = euro.format(subtotal);
  elements.totalValue.textContent = euro.format(subtotal * (1 + vat));
}

function renderMaterials(preset) {
  elements.materialsList.innerHTML = preset.materials
    .map(([name, quantity]) => `<li><strong>${name}</strong><span>${quantity}</span></li>`)
    .join("");
}

function getClientFirstName() {
  const raw = elements.clientName.value.trim() || "votre client";
  return raw.replace(/^M\.?\s+|^Mme\.?\s+/i, "");
}

function renderMessages(rows = currentQuoteRows()) {
  const subtotal = sumRows(rows);
  const total = euro.format(subtotal * (1 + Number(elements.vatRate.value)));
  const city = elements.clientCity.value || "votre adresse";
  const email = elements.clientEmail.value.trim();
  const phone = elements.clientPhone.value.trim();
  const confirmedRows = rows
    .slice(0, 4)
    .map((row) => `- ${row.label} : ${row.qty}, ${euro.format(row.total)}`)
    .join("\n");

  elements.clientMessage.value = `Objet : Pré-devis suite à la visite chantier

Bonjour ${getClientFirstName()},

Suite à la visite réalisée à ${city}, je vous transmets le pré-devis PDF en pièce jointe.

Résumé des postes :
${confirmedRows}

Montant estimatif TTC : ${total}

Ce pré-devis reste vérifiable avant validation finale des matériaux, des quantités et du planning.

Coordonnées client :
${email ? `Email : ${email}` : "Email : à compléter"}
${phone ? `Téléphone : ${phone}` : "Téléphone : à compléter"}

Bonne journée.`;

  elements.whatsappMessage.value = `Bonjour ${getClientFirstName()}, je viens de préparer le pré-devis suite à la visite chantier. Je vous l'envoie officiellement par email avec le PDF. Je reste disponible si vous avez une question.`;
}

function renderReport() {
  const note = elements.voiceNote.value.trim() || "Note chantier à compléter.";
  elements.reportCard.innerHTML = `
    <p><strong>Compte-rendu visite</strong></p>
    <p>${escapeAttr(note)}</p>
    <p><strong>Points à confirmer :</strong> choix matériaux, quantités, planning, accès, évacuation gravats.</p>
  `;
}

function renderAll() {
  const preset = currentPreset();
  const rows = currentQuoteRows();
  renderPhotoGallery();
  renderDetected(preset);
  renderQuoteRows(rows);
  renderTotals(rows);
  renderMaterials(preset);
  renderMessages(rows);
  renderReport();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function analyzeVisit() {
  const rows = cloneRows(currentPreset().rows);
  const textNote = elements.voiceNote.value;
  state.analyzedAt = new Date();
  updateVisit({
    projectType: state.visitType,
    textNote,
    report: buildReportText(textNote),
    quoteRows: rows,
    analyzedAt: state.analyzedAt.toISOString(),
  });
  renderAll();
  renderDetailMeta();
  showToast("Visite analysée, pré-devis prêt à vérifier");
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
  updateVisit({ visitStatus: "sent" }, true);
  elements.detailStatus.value = "sent";
  renderDetailMeta();
  copyText(elements.clientMessage.value, elements.clientMessage);
  showToast("Email prêt, PDF ouvert pour export");
  window.print();
}

function updateQuoteRowFromInput(input) {
  const rowElement = input.closest("[data-quote-index]");
  if (!rowElement) return;

  const index = Number(rowElement.dataset.quoteIndex);
  const field = input.dataset.quoteField;
  const rows = currentQuoteRows();
  const row = rows[index];
  if (!row) return;

  row[field] = field === "total" ? parseAmount(input.value) : input.value;
  updateVisit({ quoteRows: rows });
  renderTotals(rows);
  renderMessages(rows);
  renderDetailMeta();
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
    projectType: elements.newClientTrade.value,
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

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".segment").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.visitType = button.dataset.trade;
    analyzeVisit();
  });
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.tab;
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#tab-${target}`).classList.add("active");
  });
});

document.querySelector("#generateButton").addEventListener("click", analyzeVisit);
document.querySelector("#generateButtonTop").addEventListener("click", analyzeVisit);

elements.addQuoteRow.addEventListener("click", () => {
  const rows = currentQuoteRows();
  rows.push({
    label: "Nouveau poste",
    detail: "À préciser",
    qty: "1",
    total: 0,
  });
  updateVisit({ quoteRows: rows });
  renderQuoteRows(rows);
  renderTotals(rows);
  renderMessages(rows);
  showToast("Poste ajouté");
});

elements.quoteRows.addEventListener("input", (event) => {
  if (!event.target.matches("[data-quote-field]")) return;
  updateQuoteRowFromInput(event.target);
});

elements.vatRate.addEventListener("change", () => {
  renderTotals();
  renderMessages();
  persistDetailFields();
});

elements.detailStatus.addEventListener("change", () => {
  persistDetailFields();
  showToast("Statut mis à jour");
});

elements.autoFollowup.addEventListener("change", () => {
  renderMessages();
  persistDetailFields();
  showToast(elements.autoFollowup.checked ? "Relances activées" : "Relances désactivées");
});

[elements.followupJ3, elements.followupJ7].forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    persistDetailFields();
    showToast("Relances mises à jour");
  });
});

["input", "change"].forEach((eventName) => {
  [elements.clientName, elements.clientCity, elements.clientPhone, elements.clientEmail].forEach((field) => {
    field.addEventListener(eventName, () => {
      renderMessages();
      persistDetailFields();
    });
  });

  elements.voiceNote.addEventListener(eventName, () => {
    renderReport();
    persistDetailFields();
  });
});

elements.copyWhatsappButton.addEventListener("click", async () => {
  const copied = await copyText(elements.whatsappMessage.value, elements.whatsappMessage);
  showToast(copied ? "Message WhatsApp copié" : "Message WhatsApp sélectionné");
});

elements.prepareEmailButton.addEventListener("click", prepareEmailAndPdf);
document.querySelector("#printButton").addEventListener("click", () => window.print());

document.querySelector("#voiceButton").addEventListener("click", () => {
  elements.voiceNote.value =
    "Salle de bain à refaire après dégât des eaux. Prévoir protection escalier, reprise support, plomberie sous vasque, joints et peinture plafond.";
  renderReport();
  persistDetailFields();
  showToast("Note dictée simulée");
});

document.querySelector("#pdfInputButton").addEventListener("click", () => {
  showToast("Import de plan simulé");
});

document.querySelector("#nextAction").addEventListener("click", () => {
  showToast("Relance prête à copier");
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
