const STORAGE_KEY = "copiloteChantier.visites.v1";
const LEGACY_STORAGE_KEY = "copiloteChantier.dossiers.v1";
const DEFAULT_PHOTO = "assets/chantier-renovation.png";

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

function defaultVoiceNote(type) {
  if (type === "plomberie") {
    return "Reprise plomberie sous vasque. Vérifier fuite, raccords, siphon et vannes. Appartement occupé, accès simple.";
  }

  if (type === "peinture") {
    return "Préparation des supports, peinture plafond et murs. Prévoir protection mobilier, rebouchage local et finitions propres.";
  }

  return "Cuisine et petite salle de bain à refaire. Reprise plomberie sous vasque, dépose ancien meuble, carrelage mural sur 8 m², peinture plafond et finitions. Appartement occupé, accès par ascenseur.";
}

function createVisit(overrides = {}) {
  const createdAt = nowIso();
  const type = overrides.type || overrides.trade || "renovation";
  const preset = visitPresets[type] || visitPresets.renovation;

  return {
    id: createId(),
    clientName: overrides.clientName || "M. Martin",
    clientPhone: overrides.clientPhone || "",
    clientEmail: overrides.clientEmail || "",
    city: overrides.city || "Lyon 6e",
    status: overrides.status || "draft",
    type,
    voiceNote: overrides.voiceNote || defaultVoiceNote(type),
    quoteRows: overrides.quoteRows || cloneRows(preset.rows),
    vatRate: overrides.vatRate || "0.1",
    autoFollowup: overrides.autoFollowup ?? true,
    followupJ3: overrides.followupJ3 ?? true,
    followupJ7: overrides.followupJ7 ?? true,
    photoSrc: overrides.photoSrc || DEFAULT_PHOTO,
    createdAt,
    updatedAt: createdAt,
    analyzedAt: overrides.analyzedAt || null,
  };
}

function normalizeVisit(raw = {}) {
  const type = raw.type || raw.trade || "renovation";
  const preset = visitPresets[type] || visitPresets.renovation;
  const quoteRows = Array.isArray(raw.quoteRows) && raw.quoteRows.length > 0
    ? raw.quoteRows.map((row) => ({
        label: row.label || "Poste à préciser",
        detail: row.detail || "",
        qty: row.qty || "1",
        total: Number(row.total) || 0,
      }))
    : cloneRows(raw.rows || preset.rows);

  return {
    ...createVisit({
      clientName: raw.clientName,
      clientPhone: raw.clientPhone,
      clientEmail: raw.clientEmail,
      city: raw.city,
      type,
    }),
    ...raw,
    type,
    quoteRows,
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

  return [
    createVisit({
      clientName: "M. Martin",
      city: "Lyon 6e",
      status: "draft",
      type: "renovation",
    }),
  ];
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
    draft: state.visites.filter((visite) => visite.status === "draft").length,
    sent: state.visites.filter((visite) => visite.status === "sent").length,
    accepted: state.visites.filter((visite) => visite.status === "accepted").length,
  };

  elements.totalFoldersCount.textContent = totals.total;
  elements.draftFoldersCount.textContent = totals.draft;
  elements.sentFoldersCount.textContent = totals.sent;
  elements.acceptedFoldersCount.textContent = totals.accepted;

  const filter = elements.statusFilter.value;
  const visites = state.visites
    .filter((visite) => filter === "all" || visite.status === filter)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  elements.emptyState.hidden = visites.length > 0;
  elements.folderList.innerHTML = visites
    .map((visite) => {
      const total = sumRows(visite.quoteRows || []) * (1 + Number(visite.vatRate || "0.1"));
      const contact = [visite.city || "Ville à compléter", visite.clientPhone, visite.clientEmail]
        .filter(Boolean)
        .join(" · ");

      return `
        <button class="folder-card" data-folder-id="${visite.id}" type="button">
          <span class="folder-main">
            <span class="folder-kicker">${visitTypeLabels[visite.type] || "Rénovation"}</span>
            <strong>${visitTitle(visite)}</strong>
            <small>${contact || "Contact à compléter"} · ${formatDate(visite.updatedAt)}</small>
          </span>
          <span class="folder-meta">
            <span class="status-pill ${statusClass(visite.status)}">${statusLabels[visite.status]}</span>
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

  Object.assign(visite, patch, { updatedAt: nowIso() });
  saveVisits();

  if (shouldRenderHome) {
    renderHome();
  }
}

function hydrateDetail(visite) {
  state.visitType = visite.type || "renovation";
  elements.clientName.value = visite.clientName || "";
  elements.clientCity.value = visite.city || "";
  elements.clientPhone.value = visite.clientPhone || "";
  elements.clientEmail.value = visite.clientEmail || "";
  elements.detailStatus.value = visite.status || "draft";
  elements.voiceNote.value = visite.voiceNote || defaultVoiceNote(state.visitType);
  elements.vatRate.value = visite.vatRate || "0.1";
  elements.autoFollowup.checked = visite.autoFollowup ?? true;
  elements.followupJ3.checked = visite.followupJ3 ?? true;
  elements.followupJ7.checked = visite.followupJ7 ?? true;
  elements.mainPhoto.src = visite.photoSrc || DEFAULT_PHOTO;

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
  elements.detailStatusPill.textContent = statusLabels[visite.status] || statusLabels.draft;
  elements.detailStatusPill.className = `status-pill ${statusClass(visite.status)}`;
  elements.lastUpdateValue.textContent = formatDate(visite.updatedAt);
  const nextActionLabel = visite.followupJ3
    ? `Relance J+3 prévue le ${addDays(visite.updatedAt, 3)}`
    : `Relance J+7 prévue le ${addDays(visite.updatedAt, 7)}`;
  elements.nextAction.innerHTML = `${nextActionLabel}<svg><use href="#icon-chevron"></use></svg>`;
}

function photoSrcForStorage() {
  const src = elements.mainPhoto.getAttribute("src") || DEFAULT_PHOTO;
  if (src.startsWith("data:")) return src;
  return src.includes("assets/chantier-renovation.png") ? DEFAULT_PHOTO : src;
}

function persistDetailFields() {
  updateVisit({
    clientName: elements.clientName.value.trim() || "Nouveau client",
    clientPhone: elements.clientPhone.value.trim(),
    clientEmail: elements.clientEmail.value.trim(),
    city: elements.clientCity.value.trim(),
    status: elements.detailStatus.value,
    type: state.visitType,
    voiceNote: elements.voiceNote.value,
    vatRate: elements.vatRate.value,
    autoFollowup: elements.autoFollowup.checked,
    followupJ3: elements.followupJ3.checked,
    followupJ7: elements.followupJ7.checked,
    quoteRows: currentQuoteRows(),
    photoSrc: photoSrcForStorage(),
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
    <p>${note}</p>
    <p><strong>Points à confirmer :</strong> choix matériaux, quantités, planning, accès, évacuation gravats.</p>
  `;
}

function renderAll() {
  const preset = currentPreset();
  const rows = currentQuoteRows();
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
  state.analyzedAt = new Date();
  updateVisit({
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
  updateVisit({ status: "sent" }, true);
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

elements.homeButton.addEventListener("click", () => setView("home"));
elements.topNewFolderButton.addEventListener("click", showCreationForm);
elements.newFolderButton.addEventListener("click", showCreationForm);
elements.cancelNewFolder.addEventListener("click", hideCreationForm);
elements.statusFilter.addEventListener("change", renderHome);

elements.newFolderForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const visite = createVisit({
    clientName: elements.newClientName.value.trim() || "Nouveau client",
    clientPhone: elements.newClientPhone.value.trim(),
    clientEmail: elements.newClientEmail.value.trim(),
    city: elements.newClientCity.value.trim(),
    type: elements.newClientTrade.value,
    status: elements.newClientStatus.value,
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

document.querySelector("#photoInput").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    elements.mainPhoto.src = reader.result;
    persistDetailFields();
    showToast("Photo ajoutée à la visite");
  };
  reader.readAsDataURL(file);
});

saveVisits();
renderHome();
setView("home");
