const AIRTABLE_API_URL = "https://api.airtable.com/v0";

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function getConfig() {
  const apiKey = firstString(process.env.AIRTABLE_API_KEY);
  const baseId = firstString(process.env.AIRTABLE_BASE_ID);
  const table = firstString(process.env.AIRTABLE_LICENSES_TABLE);
  return apiKey && baseId && table ? { apiKey, baseId, table } : null;
}

function licenseMessage(reason) {
  const messages = {
    missing_license_code: "Code d'accès à renseigner.",
    service_not_configured: "Service de licences non configuré.",
    airtable_unavailable: "Service de licences indisponible. Réessayez dans quelques instants.",
    license_not_found: "Code d'accès invalide.",
    license_blocked: "Licence bloquée. Contactez-nous pour réactiver l'accès.",
    license_expired: "Licence expirée. Contactez-nous pour renouveler l'accès.",
    license_inactive: "Licence inactive. Contactez-nous pour vérifier votre accès.",
    quota_exhausted: "Quota IA atteint. Contactez-nous pour acheter une recharge de 100 générations.",
  };

  return messages[reason] || "Licence impossible à vérifier.";
}

function formulaString(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function tableUrl(config, suffix = "") {
  const baseUrl = `${AIRTABLE_API_URL}/${encodeURIComponent(config.baseId)}/${encodeURIComponent(config.table)}`;
  return suffix ? `${baseUrl}/${suffix}` : baseUrl;
}

function airtableHeaders(config) {
  return {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
}

function parseExpiryDate(value) {
  const raw = firstString(value);
  if (!raw) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59.999Z` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isExpired(expiresAt) {
  const expiryDate = parseExpiryDate(expiresAt);
  return expiryDate ? expiryDate.getTime() < Date.now() : false;
}

function normalizeLicenseRecord(record) {
  if (!record?.id || !record.fields) return null;

  const fields = record.fields;
  const quotaTotal = numberValue(fields.quotaTotal);
  const quotaUsed = numberValue(fields.quotaUsed);

  return {
    recordId: record.id,
    licenseCode: firstString(fields.licenseCode),
    type: firstString(fields.type) || "paid",
    customerName: firstString(fields.customerName),
    customerEmail: firstString(fields.customerEmail),
    status: firstString(fields.status).toLowerCase(),
    quotaTotal,
    quotaUsed,
    quotaRemaining: Math.max(0, quotaTotal - quotaUsed),
    expiresAt: firstString(fields.expiresAt),
  };
}

function publicLicensePayload(license) {
  return {
    type: license.type,
    customerName: license.customerName,
    quotaTotal: license.quotaTotal,
    quotaUsed: license.quotaUsed,
    quotaRemaining: license.quotaRemaining,
  };
}

async function findLicenseByCode(licenseCode) {
  const config = getConfig();
  if (!config) {
    return { valid: false, reason: "service_not_configured", message: licenseMessage("service_not_configured") };
  }

  const params = new URLSearchParams({
    maxRecords: "1",
    filterByFormula: `{licenseCode} = ${formulaString(licenseCode)}`,
  });

  let response;
  try {
    response = await fetch(`${tableUrl(config)}?${params.toString()}`, {
      method: "GET",
      headers: airtableHeaders(config),
    });
  } catch {
    return { valid: false, reason: "airtable_unavailable", message: licenseMessage("airtable_unavailable") };
  }

  if (!response.ok) {
    return { valid: false, reason: "airtable_unavailable", message: licenseMessage("airtable_unavailable") };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { valid: false, reason: "airtable_unavailable", message: licenseMessage("airtable_unavailable") };
  }

  const license = normalizeLicenseRecord(Array.isArray(data.records) ? data.records[0] : null);
  if (!license) {
    return { valid: false, reason: "license_not_found", message: licenseMessage("license_not_found") };
  }

  return { valid: true, license };
}

async function validateLicenseCode(licenseCode, options = {}) {
  const normalizedCode = firstString(licenseCode);
  if (!normalizedCode) {
    return { valid: false, reason: "missing_license_code", message: licenseMessage("missing_license_code") };
  }

  const result = await findLicenseByCode(normalizedCode);
  if (!result.valid) return result;

  const { license } = result;
  if (license.status !== "active") {
    const reason = license.status === "blocked"
      ? "license_blocked"
      : license.status === "expired"
        ? "license_expired"
        : "license_inactive";
    return { valid: false, reason, message: licenseMessage(reason), license };
  }

  if (isExpired(license.expiresAt)) {
    return { valid: false, reason: "license_expired", message: licenseMessage("license_expired"), license };
  }

  if (options.requireQuota && license.quotaUsed >= license.quotaTotal) {
    return { valid: false, reason: "quota_exhausted", message: licenseMessage("quota_exhausted"), license };
  }

  return {
    valid: true,
    license,
    ...publicLicensePayload(license),
  };
}

async function incrementLicenseUsage(license) {
  const config = getConfig();
  if (!config) {
    return { ok: false, reason: "service_not_configured", message: licenseMessage("service_not_configured") };
  }

  const quotaUsed = license.quotaUsed + 1;
  let response;
  try {
    response = await fetch(tableUrl(config, encodeURIComponent(license.recordId)), {
      method: "PATCH",
      headers: airtableHeaders(config),
      body: JSON.stringify({
        fields: {
          quotaUsed,
          lastUsedAt: new Date().toISOString(),
        },
      }),
    });
  } catch {
    return { ok: false, reason: "airtable_unavailable", message: licenseMessage("airtable_unavailable") };
  }

  if (!response.ok) {
    return { ok: false, reason: "airtable_unavailable", message: licenseMessage("airtable_unavailable") };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { ok: false, reason: "airtable_unavailable", message: licenseMessage("airtable_unavailable") };
  }

  const updatedLicense = normalizeLicenseRecord(data) || {
    ...license,
    quotaUsed,
    quotaRemaining: Math.max(0, license.quotaTotal - quotaUsed),
  };

  return {
    ok: true,
    license: updatedLicense,
    ...publicLicensePayload(updatedLicense),
  };
}

module.exports = {
  incrementLicenseUsage,
  licenseMessage,
  publicLicensePayload,
  validateLicenseCode,
};
