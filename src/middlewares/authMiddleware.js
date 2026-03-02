const jwt = require("jsonwebtoken");

function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Token ausente." });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { sub, role, name, email, iat, exp }
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido" });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user?.role) return res.status(401).json({ message: "Sessão inválida." });
    if (req.user.role !== role) return res.status(403).json({ message: "Sem permissão." });
    return next();
  };
}

module.exports = { authRequired, requireRole };