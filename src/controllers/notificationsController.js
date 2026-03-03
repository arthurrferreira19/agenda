const Notification = require("../models/Notification");
const Event = require("../models/Event");

function esc(s) {
  return String(s || "").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function list(req, res) {
  const userId = req.user?.sub;
  if (!userId) return res.status(401).json({ message: "Sessão inválida." });

  const unreadOnly = String(req.query.unreadOnly || "0") === "1";
  const limit = Math.min(parseInt(req.query.limit || "50", 10) || 50, 200);
  const page = Math.max(parseInt(req.query.page || "1", 10) || 1, 1);

  const q = { userId };
  if (unreadOnly) q.isRead = false;

  const [items, total] = await Promise.all([
    Notification.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(q)
  ]);

  res.json({
    items: items.map((n) => ({
      id: String(n._id),
      type: n.type,
      title: n.title,
      message: n.message,
      eventId: n.eventId ? String(n.eventId) : null,
      reminderMinutes: n.reminderMinutes,
      meta: n.meta || {},
      isRead: !!n.isRead,
      createdAt: n.createdAt
    })),
    page,
    limit,
    total
  });
}

async function unreadCount(req, res) {
  const userId = req.user?.sub;
  if (!userId) return res.status(401).json({ message: "Sessão inválida." });
  const count = await Notification.countDocuments({ userId, isRead: false });
  res.json({ count });
}

async function markRead(req, res) {
  const userId = req.user?.sub;
  const { id } = req.params;

  const n = await Notification.findOne({ _id: id, userId });
  if (!n) return res.status(404).json({ message: "Notificação não encontrada." });

  n.isRead = true;
  await n.save();
  res.json({ ok: true });
}

async function markAllRead(req, res) {
  const userId = req.user?.sub;
  if (!userId) return res.status(401).json({ message: "Sessão inválida." });

  await Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });
  res.json({ ok: true });
}

/**
 * ✅ Criar lembrete (self-service) — o próprio usuário pode gerar histórico
 * Body: { eventId, reminderMinutes }
 */
async function createReminder(req, res) {
  const userId = req.user?.sub;
  if (!userId) return res.status(401).json({ message: "Sessão inválida." });

  const { eventId, reminderMinutes } = req.body || {};
  const mins = parseInt(reminderMinutes, 10);

  if (!eventId || !Number.isFinite(mins) || ![15, 30, 60].includes(mins)) {
    return res.status(400).json({ message: "Informe eventId e reminderMinutes (15/30/60)." });
  }

  const ev = await Event.findById(eventId).select("title start end participants createdBy").lean();
  if (!ev) return res.status(404).json({ message: "Evento não encontrado." });

  const isInvolved =
    String(ev.createdBy) === String(userId) ||
    (ev.participants || []).map(String).includes(String(userId));

  if (!isInvolved) return res.status(403).json({ message: "Você não participa deste evento." });

  try {
    const created = await Notification.create({
      userId,
      type: "REMINDER",
      title: `Lembrete (${mins}min): ${esc(ev.title)}`,
      message: `Seu evento começa em ${mins} minutos.`,
      eventId: ev._id,
      reminderMinutes: mins,
      meta: {
        start: ev.start,
        end: ev.end
      }
    });

    res.status(201).json({ notificationId: String(created._id) });
  } catch (err) {
    // duplicado (unique index)
    if (err && err.code === 11000) return res.json({ ok: true, duplicated: true });
    console.error("createReminder err:", err);
    return res.status(500).json({ message: "Erro ao criar lembrete." });
  }
}

/**
 * Helper: criar notificações para vários usuários (uso interno).
 */
async function createForUsers({ userIds, type, title, message, eventId = null, meta = {} }) {
  const uniq = Array.from(new Set((userIds || []).map(String).filter(Boolean)));
  if (!uniq.length) return;

  const docs = uniq.map((uid) => ({
    userId: uid,
    type,
    title,
    message,
    eventId,
    meta
  }));

  await Notification.insertMany(docs, { ordered: false }).catch((err) => {
    // insertMany pode falhar parcialmente; ignorar duplicados
    if (err && err.code === 11000) return;
    console.error("createForUsers err:", err);
  });
}

module.exports = { list, unreadCount, markRead, markAllRead, createReminder, createForUsers };
