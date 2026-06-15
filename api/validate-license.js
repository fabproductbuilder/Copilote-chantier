const { publicLicensePayload, validateLicenseCode } = require("./_airtable-license");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { valid: false, reason: "method_not_allowed", message: "Méthode non autorisée." });
    return;
  }

  let body;
  try {
    body = readBody(req);
  } catch {
    sendJson(res, 400, { valid: false, reason: "invalid_payload", message: "Requête invalide." });
    return;
  }

  const result = await validateLicenseCode(body.licenseCode);
  const statusCode = ["service_not_configured", "airtable_unavailable"].includes(result.reason) ? 503 : 200;

  if (!result.valid) {
    sendJson(res, statusCode, {
      valid: false,
      reason: result.reason,
      message: result.message,
      ...(result.license ? publicLicensePayload(result.license) : {}),
    });
    return;
  }

  sendJson(res, 200, {
    valid: true,
    ...publicLicensePayload(result.license),
  });
};
