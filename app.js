const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const tradePresets = {
  renovation: {
    confidence: 82,
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
    confidence: 86,
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
    confidence: 79,
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

const state = {
  trade: "renovation",
  generatedAt: new Date(),
};

const elements = {
  clientName: document.querySelector("#clientName"),
  clientCity: document.querySelector("#clientCity"),
  voiceNote: document.querySelector("#voiceNote"),
  detectedList: document.querySelector("#detectedList"),
  quoteRows: document.querySelector("#quoteRows"),
  subtotalValue: document.querySelector("#subtotalValue"),
  totalValue: document.querySelector("#totalValue"),
  vatRate: document.querySelector("#vatRate"),
  confidenceValue: document.querySelector("#confidenceValue"),
  clientMessage: document.querySelector("#clientMessage"),
  materialsList: document.querySelector("#materialsList"),
  reportCard: document.querySelector("#reportCard"),
  toast: document.querySelector("#toast"),
  mainPhoto: document.querySelector("#mainPhoto"),
  autoFollowup: document.querySelector("#autoFollowup"),
};

function currentPreset() {
  return tradePresets[state.trade];
}

function sumRows(rows) {
  return rows.reduce((total, row) => total + row.total, 0);
}

function renderDetected(preset) {
  elements.detectedList.innerHTML = preset.detected
    .map((item) => `<span>${item}</span>`)
    .join("");
}

function renderQuoteRows(preset) {
  elements.quoteRows.innerHTML = preset.rows
    .map(
      (row) => `
        <div class="quote-row">
          <span>
            <strong>${row.label}</strong>
            <small>${row.detail}</small>
          </span>
          <span class="qty">${row.qty}</span>
          <span class="line-total">${euro.format(row.total)}</span>
        </div>
      `,
    )
    .join("");
}

function renderTotals(preset) {
  const subtotal = sumRows(preset.rows);
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

function renderMessage(preset) {
  const subtotal = sumRows(preset.rows);
  const total = euro.format(subtotal * (1 + Number(elements.vatRate.value)));
  const followup = elements.autoFollowup.checked
    ? "Je vous relancerai vendredi matin si cela vous convient."
    : "Je reste disponible pour ajuster le périmètre si besoin.";

  elements.clientMessage.value = `Bonjour ${getClientFirstName()},

Suite à ma visite à ${elements.clientCity.value || "votre adresse"}, je vous envoie une première estimation à ${total} TTC pour les travaux repérés.

Inclus : ${preset.detected.slice(0, 3).join(", ").toLowerCase()}.

Le devis final sera confirmé après validation des quantités et des matériaux. ${followup}

Bonne journée.`;
}

function renderReport(preset) {
  const note = elements.voiceNote.value.trim();
  elements.reportCard.innerHTML = `
    <p><strong>Compte-rendu visite</strong></p>
    <p>${note}</p>
    <p><strong>Points à confirmer :</strong> choix carrelage, créneau chantier, accès ascenseur, évacuation gravats.</p>
  `;
}

function renderConfidence(preset) {
  elements.confidenceValue.textContent = `${preset.confidence}%`;
}

function renderAll() {
  const preset = currentPreset();
  renderDetected(preset);
  renderQuoteRows(preset);
  renderTotals(preset);
  renderMaterials(preset);
  renderMessage(preset);
  renderReport(preset);
  renderConfidence(preset);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function generateQuote() {
  state.generatedAt = new Date();
  renderAll();
  showToast("Pré-devis mis à jour");
}

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".segment").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.trade = button.dataset.trade;
    generateQuote();
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

document.querySelector("#generateButton").addEventListener("click", generateQuote);
document.querySelector("#generateButtonTop").addEventListener("click", generateQuote);

elements.vatRate.addEventListener("change", () => {
  renderTotals(currentPreset());
  renderMessage(currentPreset());
});

elements.autoFollowup.addEventListener("change", () => {
  renderMessage(currentPreset());
  showToast(elements.autoFollowup.checked ? "Relance auto activée" : "Relance auto désactivée");
});

["input", "change"].forEach((eventName) => {
  elements.clientName.addEventListener(eventName, () => renderMessage(currentPreset()));
  elements.clientCity.addEventListener(eventName, () => renderMessage(currentPreset()));
  elements.voiceNote.addEventListener(eventName, () => renderReport(currentPreset()));
});

document.querySelector("#copyMessage").addEventListener("click", async () => {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API unavailable");
    }
    await navigator.clipboard.writeText(elements.clientMessage.value);
    showToast("Message copié");
  } catch {
    elements.clientMessage.select();
    const copied = document.execCommand?.("copy");
    showToast(copied ? "Message copié" : "Message sélectionné");
  }
});

document.querySelector("#sendButton").addEventListener("click", () => {
  showToast("Ouverture WhatsApp simulée");
});

document.querySelector("#printButton").addEventListener("click", () => window.print());

document.querySelector("#resetButton").addEventListener("click", () => {
  elements.clientName.value = "Nouveau client";
  elements.clientCity.value = "";
  elements.voiceNote.value = "";
  state.trade = "renovation";
  document.querySelectorAll(".segment").forEach((item) => {
    item.classList.toggle("active", item.dataset.trade === "renovation");
  });
  renderAll();
  showToast("Nouveau dossier prêt");
});

document.querySelector("#voiceButton").addEventListener("click", () => {
  elements.voiceNote.value =
    "Salle de bain à refaire après dégât des eaux. Prévoir protection escalier, reprise support, plomberie sous vasque, joints et peinture plafond.";
  renderReport(currentPreset());
  showToast("Note vocale simulée");
});

document.querySelector("#pdfInputButton").addEventListener("click", () => {
  showToast("Import de plan simulé");
});

document.querySelector("#nextAction").addEventListener("click", () => {
  showToast("Relance programmée vendredi 9:00");
});

document.querySelector("#photoInput").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    elements.mainPhoto.src = reader.result;
    showToast("Photo ajoutée au dossier");
  };
  reader.readAsDataURL(file);
});

renderAll();
