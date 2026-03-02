const { google } = require("googleapis");
const User = require("../models/User");

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function requireGoogleEnv(req, res) {
  const oauth2 = getOAuthClient();
  if (!oauth2) {
    res.status(500).json({ message: "Integração Google não configurada (faltam GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)." });
    return null;
  }
  return oauth2;
}

async function getStatus(req, res) {
  const me = await User.findById(req.user?.sub).select("google.connected google.email");
  if (!me) return res.status(404).json({ message: "Usuário não encontrado." });
  return res.json({ connected: !!me.google?.connected, email: me.google?.email || "" });
}

async function getAuthUrl(req, res) {
  const oauth2 = requireGoogleEnv(req, res);
  if (!oauth2) return;

  const scopes = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email"
  ];

  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // garante refresh_token na primeira vez
    scope: scopes,
    state: String(req.user?.sub || "")
  });

  return res.json({ url });
}

async function oauthCallback(req, res) {
  const oauth2 = requireGoogleEnv(req, res);
  if (!oauth2) return;

  const code = String(req.query.code || "");
  const state = String(req.query.state || ""); // userId
  if (!code || !state) {
    return res.status(400).send("Missing code/state");
  }

  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  // pega email do Gmail
  const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
  const me = await oauth2Api.userinfo.get();
  const email = me?.data?.email || "";

  // salva tokens
  const user = await User.findById(state).select("google");
  if (!user) return res.status(404).send("User not found");

  user.google = {
    connected: true,
    email,
    accessToken: tokens.access_token || user.google?.accessToken || "",
    refreshToken: tokens.refresh_token || user.google?.refreshToken || "",
    scope: tokens.scope || user.google?.scope || "",
    tokenType: tokens.token_type || user.google?.tokenType || "",
    expiryDate: tokens.expiry_date || user.google?.expiryDate || 0
  };

  await user.save();

  // Redireciona para a agenda do usuário (fechável)
  return res.redirect("/user/agenda.html?google=connected");
}

async function disconnect(req, res) {
  const user = await User.findById(req.user?.sub).select("google");
  if (!user) return res.status(404).json({ message: "Usuário não encontrado." });
  user.google = {
    connected: false,
    email: "",
    accessToken: "",
    refreshToken: "",
    scope: "",
    tokenType: "",
    expiryDate: 0
  };
  await user.save();
  return res.json({ ok: true });
}

module.exports = { getStatus, getAuthUrl, oauthCallback, disconnect, getOAuthClient };
