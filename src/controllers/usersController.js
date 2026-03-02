const User = require("../models/User");

function pickUser(u) {
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt
  };
}

async function listUsers(req, res) {
  const users = await User.find({})
    .sort({ createdAt: -1 })
    .select("name email role isActive lastLoginAt createdAt");
  res.json({ users: users.map(pickUser) });
}

async function createUser(req, res) {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Informe Nome, E-mail e Senha." });
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) return res.status(409).json({ message: "Já existe usuário com esse e-mail." });

  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    password: String(password),
    role: role || "USER"
  });

  res.status(201).json({ user: pickUser(user) });
}

async function updateUser(req, res) {
  const { id } = req.params;
  const { name, email, role } = req.body;

  const user = await User.findById(id).select("name email role isActive lastLoginAt createdAt");
  if (!user) return res.status(404).json({ message: "Usuário não encontrado." });

  if (email && String(email).toLowerCase().trim() !== user.email) {
    const normalizedEmail = String(email).toLowerCase().trim();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ message: "E-mail já está em uso." });
    user.email = normalizedEmail;
  }

  if (name) user.name = String(name).trim();
  if (role) user.role = role;

  await user.save();
  res.json({ user: pickUser(user) });
}

async function setActive(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;

  const user = await User.findById(id).select("name email role isActive lastLoginAt createdAt");
  if (!user) return res.status(404).json({ message: "Usuário não encontrado." });

  user.isActive = Boolean(isActive);
  await user.save();

  res.json({ user: pickUser(user) });
}

async function resetPassword(req, res) {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || String(password).length < 6) {
    return res.status(400).json({ message: "A nova senha deve ter no mínimo 6 caracteres." });
  }

  const user = await User.findById(id).select("+password name email role isActive lastLoginAt createdAt");
  if (!user) return res.status(404).json({ message: "Usuário não encontrado." });

  user.password = String(password);
  await user.save();

  res.json({ ok: true });
}

async function deleteUser(req, res) {
  const { id } = req.params;

  const user = await User.findById(id).select("role");
  if (!user) return res.status(404).json({ message: "Usuário não encontrado." });

  if (user.role === "ADMIN") {
    const admins = await User.countDocuments({ role: "ADMIN" });
    if (admins <= 1) return res.status(400).json({ message: "Não é possível excluir o último ADMIN." });
  }

  await User.deleteOne({ _id: id });
  res.json({ ok: true });
}

// ✅ usado pela Agenda: lista membros ativos para selecionar participantes
async function listMembers(req, res) {
  const users = await User.find({ isActive: true })
    .sort({ name: 1 })
    .select("name email role");

  res.json({
    members: users.map(u => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role
    }))
  });
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  setActive,
  resetPassword,
  deleteUser,
  listMembers
};