const crypto = require("crypto");

function base64UrlEncode(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signHS256(data, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function parseExpires(expiresIn) {
  const m = String(expiresIn || "7d").match(/^(\d+)([smhd])$/i);
  if (!m) return 7 * 24 * 60 * 60;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[unit] || 86400;
  return n * mult;
}

function signJwt(payload, secret, expiresIn = "7d") {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseExpires(expiresIn);

  const body = { ...payload, iat: now, exp };
  const h = base64UrlEncode(header);
  const p = base64UrlEncode(body);
  const data = `${h}.${p}`;
  const sig = signHS256(data, secret);
  return `${data}.${sig}`;
}

function verifyJwt(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return { ok: false, error: "Token inválido" };

  const [h, p, sig] = parts;
  const data = `${h}.${p}`;
  const expected = signHS256(data, secret);
  if (sig !== expected) return { ok: false, error: "Assinatura inválida" };

  const payload = JSON.parse(
    Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
  );

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return { ok: false, error: "Token expirado" };

  return { ok: true, payload };
}

module.exports = { signJwt, verifyJwt };