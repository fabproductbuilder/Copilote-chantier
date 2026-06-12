function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function senderDomain(value) {
  const sender = firstString(value);
  const match = sender.match(/<[^@\s<>]+@([^>\s]+)>$/) || sender.match(/^[^@\s<>]+@([^>\s<>]+)$/);
  return match ? match[1].toLowerCase() : "";
}

function maskDomain(domain) {
  if (!domain) return "";
  const parts = domain.split(".");
  const extension = parts.length > 1 ? parts.pop() : "";
  const name = parts.join(".");
  const visible = name.slice(0, 2) || "*";
  return extension ? `${visible}…${extension}` : `${visible}…`;
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { configured: false, hasApiKey: false, hasFrom: false, fromDomain: "" });
    return;
  }

  const hasApiKey = Boolean(process.env.RESEND_API_KEY);
  const from = firstString(process.env.INTERNAL_EMAIL_FROM);
  const hasFrom = Boolean(from);

  sendJson(res, 200, {
    configured: hasApiKey && hasFrom,
    hasApiKey,
    hasFrom,
    fromDomain: maskDomain(senderDomain(from)),
  });
};
