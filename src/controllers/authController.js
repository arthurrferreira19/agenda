const jwt = require("jsonwebtoken");
const User = require("../models/User");

function signJwt(payload, secret, expiresIn) {
  return jwt.sign(payload, secret, { expiresIn });
}

async function adminLogin(req, res) {
  try {
    const { email, password, remember } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Informe um e-mail válido." });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ message: "Informe sua senha." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    if (!user) return res.status(401).json({ message: "Credenciais inválidas." });

    if (!user.isActive) return res.status(403).json({ message: "Usuário desativado." });
    if (user.role !== "ADMIN") return res.status(403).json({ message: "Acesso apenas para ADMIN." });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: "Credenciais inválidas." });

    user.lastLoginAt = new Date();
    await user.save();

    const token = signJwt(
      { sub: String(user._id), role: user.role, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      remember ? "30d" : (process.env.JWT_EXPIRES_IN || "7d")
    );

    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno ao autenticar." });
  }
}

// ✅ login geral (USER/RESPONSAVEL/ADMIN) para criar eventos
async function login(req, res) {
  try {
    const { email, password, remember } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Informe um e-mail válido." });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ message: "Informe sua senha." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    if (!user) return res.status(401).json({ message: "Credenciais inválidas." });

    if (!user.isActive) return res.status(403).json({ message: "Usuário desativado." });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: "Credenciais inválidas." });

    user.lastLoginAt = new Date();
    await user.save();

    const token = signJwt(
      { sub: String(user._id), role: user.role, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      remember ? "30d" : (process.env.JWT_EXPIRES_IN || "7d")
    );

    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro interno ao autenticar." });
  }
}

module.exports = { adminLogin, login };