const Event = require("../models/Event");
const Room = require("../models/Room");
const { createForUsers } = require("./notificationsController");

function pickEvent(e) {
  return {
    id: e._id,
    title: e.title,
    description: e.description,
    start: e.start,
    end: e.end,
    eventType: e.eventType,
    roomId: e.roomId,
    clientAddress: e.clientAddress,
    meetLink: e.meetLink,
    participants: e.participants || [],
    createdBy: e.createdBy,
    createdAt: e.createdAt
  };
}

function isValidDate(d) {
  const dt = new Date(d);
  return Number.isFinite(dt.getTime());
}

function genMeetLikeLink() {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const rand = (n) => Array.from({ length: n }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  return `https://meet.google.com/${rand(3)}-${rand(4)}-${rand(3)}`;
}

function uniqStrings(arr) {
  return Array.from(new Set((arr || []).map(x => String(x))));
}

function intersect(a, b) {
  const bs = new Set(b.map(String));
  return a.map(String).filter(x => bs.has(String(x)));
}

function fmtISO(dt) {
  return new Date(dt).toISOString();
}

/**
 * ✅ Conflito de participantes:
 * procura eventos que intersectam [start,end] e que o usuário está como participante OU criador.
 * retorna lista de conflitos: { memberId, eventId, title, start, end }
 */
async function findMemberConflicts({ start, end, memberIds, excludeEventId = null }) {
  const ids = uniqStrings(memberIds);
  if (!ids.length) return [];

  const q = {
    start: { $lt: end },
    end: { $gt: start },
    $or: [
      { participants: { $in: ids } },
      { createdBy: { $in: ids } }
    ]
  };

  if (excludeEventId) q._id = { $ne: excludeEventId };

  const events = await Event.find(q)
    .select("title start end participants createdBy")
    .lean();

  const conflicts = [];
  for (const ev of events) {
    const involved = uniqStrings([
      ...(ev.participants || []).map(String),
      String(ev.createdBy)
    ]);

    const overlapMembers = intersect(ids, involved);
    for (const mid of overlapMembers) {
      conflicts.push({
        memberId: mid,
        eventId: String(ev._id),
        title: ev.title,
        start: fmtISO(ev.start),
        end: fmtISO(ev.end)
      });
    }
  }

  // remove duplicados (mesmo memberId + eventId)
  const key = (c) => `${c.memberId}::${c.eventId}`;
  const seen = new Set();
  return conflicts.filter(c => {
    const k = key(c);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function listEvents(req, res) {
  const { from, to } = req.query;

  if (!from || !to || !isValidDate(from) || !isValidDate(to)) {
    return res.status(400).json({ message: "Informe from e to válidos (ISO)." });
  }

  const fromDt = new Date(from);
  const toDt = new Date(to);

  const baseQuery = {
    start: { $lt: toDt },
    end: { $gt: fromDt }
  };

  // ✅ Visibilidade (ajuste solicitado):
  // Qualquer usuário autenticado enxerga todos os eventos no intervalo.
  const events = await Event.find(baseQuery).sort({ start: 1 });

  res.json({ events: events.map(pickEvent) });
}

async function createEvent(req, res) {
  const {
    title,
    description,
    start,
    end,
    eventType,
    roomId,
    clientAddress,
    participants,
    confirmConflicts
  } = req.body;

  if (!title || !start || !end || !eventType) {
    return res.status(400).json({ message: "Informe título, start, end e tipo." });
  }
  if (!isValidDate(start) || !isValidDate(end)) {
    return res.status(400).json({ message: "Datas inválidas." });
  }

  const s = new Date(start);
  const e = new Date(end);
  if (e <= s) return res.status(400).json({ message: "Fim precisa ser maior que início." });

  const createdBy = req.user?.sub;
  if (!createdBy) return res.status(401).json({ message: "Sessão inválida." });

  const type = String(eventType).toUpperCase();
  if (!["MAXIMUM", "PRESENCIAL", "ONLINE"].includes(type)) {
    return res.status(400).json({ message: "Tipo inválido." });
  }

  const part = Array.isArray(participants) ? uniqStrings(participants) : [];

  // ✅ conflito de participantes (inclui o criador também — evita ele marcar 2 coisas ao mesmo tempo)
  const memberIdsToCheck = uniqStrings([...part, String(createdBy)]);
  const memberConflicts = await findMemberConflicts({ start: s, end: e, memberIds: memberIdsToCheck });
  if (memberConflicts.length && !confirmConflicts) {
    return res.status(409).json({
      message: "Um ou mais participantes já possuem evento neste horário.",
      memberConflicts
    });
  }

  let finalRoomId = null;
  let finalAddress = "";
  let finalMeet = "";
  let finalDesc = String(description || "").trim();

  if (type === "MAXIMUM") {
    if (!roomId) return res.status(400).json({ message: "Selecione uma sala (Maximum)." });

    const room = await Room.findById(roomId).select("isActive");
    if (!room) return res.status(404).json({ message: "Sala não encontrada." });
    if (!room.isActive) return res.status(400).json({ message: "Sala desativada." });

    // conflito de sala
    const conflict = await Event.findOne({
      roomId: roomId,
      start: { $lt: e },
      end: { $gt: s }
    }).select("title start end");

    if (conflict && !confirmConflicts) {
      return res.status(409).json({
        message: "Sala ocupada neste intervalo.",
        conflict: { title: conflict.title, start: conflict.start, end: conflict.end }
      });
    }

    finalRoomId = roomId;
  }

  if (type === "PRESENCIAL") {
    if (!clientAddress || !String(clientAddress).trim()) {
      return res.status(400).json({ message: "Informe o endereço do cliente (Presencial)." });
    }
    finalAddress = String(clientAddress).trim();
  }

  if (type === "ONLINE") {
    finalMeet = genMeetLikeLink();
    finalDesc = finalDesc
      ? `${finalDesc}\n\nLink da reunião: ${finalMeet}`
      : `Link da reunião: ${finalMeet}`;
  }

  const participantStatus = [
    { userId: createdBy, status: "ACCEPTED", respondedAt: new Date() },
    ...part.filter(pid => String(pid) !== String(createdBy)).map(pid => ({ userId: pid, status: "PENDING", respondedAt: null }))
  ];

  const ev = await Event.create({
    title: String(title).trim(),
    description: finalDesc,
    start: s,
    end: e,
    eventType: type,
    roomId: finalRoomId,
    clientAddress: finalAddress,
    meetLink: finalMeet,
    participants: part,
    participantStatus,
    createdBy
  });


  // 🔔 Notificações: evento criado (criador + participantes)
  {
    const targets = uniqStrings([String(createdBy), ...part]);
    await createForUsers({
      userIds: targets,
      type: "EVENT_CREATED",
      title: "Novo evento criado",
      message: `“${String(ev.title)}” foi agendado.`,
      eventId: ev._id,
      meta: { start: ev.start, end: ev.end, eventType: ev.eventType }
    });
  }

  res.status(201).json({ event: pickEvent(ev) });
}

async function updateEvent(req, res) {
  const { id } = req.params;
  const {
    title,
    description,
    start,
    end,
    eventType,
    roomId,
    clientAddress,
    participants,
    confirmConflicts
  } = req.body;

  const ev = await Event.findById(id);
  if (!ev) return res.status(404).json({ message: "Evento não encontrado." });

  const isAdmin = req.user?.role === "ADMIN";
  const isOwner = String(ev.createdBy) === String(req.user?.sub);
  if (!isAdmin && !isOwner) return res.status(403).json({ message: "Sem permissão." });
  const before = {
    title: ev.title,
    start: ev.start,
    end: ev.end,
    eventType: ev.eventType,
    roomId: ev.roomId ? String(ev.roomId) : null,
    participants: (ev.participants || []).map(String)
  };



  if (title !== undefined) ev.title = String(title).trim();
  if (description !== undefined) ev.description = String(description || "").trim();

  if (start !== undefined) {
    if (!isValidDate(start)) return res.status(400).json({ message: "start inválido." });
    ev.start = new Date(start);
  }
  if (end !== undefined) {
    if (!isValidDate(end)) return res.status(400).json({ message: "end inválido." });
    ev.end = new Date(end);
  }
  if (ev.end <= ev.start) return res.status(400).json({ message: "Fim precisa ser maior que início." });

  if (eventType !== undefined) {
    const type = String(eventType).toUpperCase();
    if (!["MAXIMUM", "PRESENCIAL", "ONLINE"].includes(type)) {
      return res.status(400).json({ message: "Tipo inválido." });
    }
    ev.eventType = type;
  }

  if (participants !== undefined) {
    ev.participants = Array.isArray(participants) ? uniqStrings(participants) : [];
  }

  // ✅ conflito de participantes (ignora o próprio evento)
  {
    const memberIdsToCheck = uniqStrings([...(ev.participants || []).map(String), String(ev.createdBy)]);
    const memberConflicts = await findMemberConflicts({
      start: ev.start,
      end: ev.end,
      memberIds: memberIdsToCheck,
      excludeEventId: ev._id
    });

    if (memberConflicts.length && !confirmConflicts) {
      return res.status(409).json({
        message: "Um ou mais participantes já possuem evento neste horário.",
        memberConflicts
      });
    }
  }

  // Ajustes por tipo + conflito de sala
  if (ev.eventType === "MAXIMUM") {
    if (roomId !== undefined) ev.roomId = roomId || null;
    if (!ev.roomId) return res.status(400).json({ message: "Selecione uma sala (Maximum)." });

    const room = await Room.findById(ev.roomId).select("isActive");
    if (!room) return res.status(404).json({ message: "Sala não encontrada." });
    if (!room.isActive) return res.status(400).json({ message: "Sala desativada." });

    const conflict = await Event.findOne({
      _id: { $ne: ev._id },
      roomId: ev.roomId,
      start: { $lt: ev.end },
      end: { $gt: ev.start }
    }).select("title start end");

    if (conflict && !confirmConflicts) {
      return res.status(409).json({
        message: "Sala ocupada neste intervalo.",
        conflict: { title: conflict.title, start: conflict.start, end: conflict.end }
      });
    }

    ev.clientAddress = "";
    ev.meetLink = "";
  }

  if (ev.eventType === "PRESENCIAL") {
    if (clientAddress !== undefined) ev.clientAddress = String(clientAddress || "").trim();
    if (!ev.clientAddress) return res.status(400).json({ message: "Informe o endereço do cliente." });

    ev.roomId = null;
    ev.meetLink = "";
  }

  if (ev.eventType === "ONLINE") {
    if (!ev.meetLink) {
      ev.meetLink = genMeetLikeLink();
      ev.description = ev.description
        ? `${ev.description}\n\nLink da reunião: ${ev.meetLink}`
        : `Link da reunião: ${ev.meetLink}`;
    }
    ev.roomId = null;
    ev.clientAddress = "";
  }

  await ev.save();

  // 🔔 Notificações: evento atualizado (criador + participantes atuais + participantes anteriores)
  {
    const targets = uniqStrings([String(ev.createdBy), ...(ev.participants || []).map(String), ...(before.participants || [])]);
    const changed = [];
    if (before.title !== ev.title) changed.push("título");
    if (+new Date(before.start) !== +new Date(ev.start) || +new Date(before.end) !== +new Date(ev.end)) changed.push("horário");
    if (before.eventType !== ev.eventType) changed.push("tipo");
    if (before.roomId !== (ev.roomId ? String(ev.roomId) : null)) changed.push("sala");

    await createForUsers({
      userIds: targets,
      type: "EVENT_UPDATED",
      title: "Evento atualizado",
      message: changed.length
        ? `“${String(ev.title)}” foi atualizado (${changed.join(", ")}).`
        : `“${String(ev.title)}” foi atualizado.`,
      eventId: ev._id,
      meta: { start: ev.start, end: ev.end, eventType: ev.eventType, changed }
    });
  }

  res.json({ event: pickEvent(ev) });
}

async function deleteEvent(req, res) {
  const { id } = req.params;

  const ev = await Event.findById(id);
  if (!ev) return res.status(404).json({ message: "Evento não encontrado." });

  const isAdmin = req.user?.role === "ADMIN";
  const isOwner = String(ev.createdBy) === String(req.user?.sub);
  if (!isAdmin && !isOwner) return res.status(403).json({ message: "Sem permissão." });


  // 🔔 Notificações: evento cancelado (criador + participantes)
  {
    const targets = uniqStrings([String(ev.createdBy), ...(ev.participants || []).map(String)]);
    await createForUsers({
      userIds: targets,
      type: "EVENT_DELETED",
      title: "Evento cancelado",
      message: `“${String(ev.title)}” foi cancelado.`,
      eventId: ev._id,
      meta: { start: ev.start, end: ev.end, eventType: ev.eventType }
    });
  }

  await Event.deleteOne({ _id: id });
  res.json({ ok: true });
}


async function listInvites(req, res) {
  const userId = String(req.user?.sub || "");
  const now = new Date();
  const events = await Event.find({
    participantStatus: { $elemMatch: { userId: userId, status: "PENDING" } },
    end: { $gt: now }
  }).sort({ start: 1 });

  res.json({ events: events.map(pickEvent) });
}

async function respondInvite(req, res) {
  const { id } = req.params;
  const { response } = req.body || {}; // ACCEPTED | DECLINED
  const userId = String(req.user?.sub || "");
  if (!["ACCEPTED", "DECLINED"].includes(String(response || ""))) {
    return res.status(400).json({ message: "Resposta inválida." });
  }

  const ev = await Event.findById(id);
  if (!ev) return res.status(404).json({ message: "Evento não encontrado." });

  const ps = Array.isArray(ev.participantStatus) ? ev.participantStatus : [];
  const idx = ps.findIndex(x => String(x.userId) === userId);
  if (idx === -1) return res.status(403).json({ message: "Você não está convidado neste evento." });

  ps[idx].status = response;
  ps[idx].respondedAt = new Date();
  ev.participantStatus = ps;

  if (response === "DECLINED") {
    ev.participants = (ev.participants || []).filter(p => String(p) !== userId);
  } else {
    // garante participante
    const set = new Set((ev.participants || []).map(String));
    set.add(userId);
    ev.participants = Array.from(set);
  }

  ev.history = Array.isArray(ev.history) ? ev.history : [];
  ev.history.push({ userId, action: "INVITE_RESPONSE", changes: { response } });

  await ev.save();

  // notifica o criador
  await createForUsers({
    userIds: [String(ev.createdBy)],
    type: "INVITE_RESPONSE",
    title: "Resposta de convite",
    message: `Um participante respondeu: ${response === "ACCEPTED" ? "Aceitou" : "Recusou"} (“${ev.title}”).`,
    eventId: ev._id
  });

  res.json({ ok: true });
}

async function listComments(req, res) {
  const { id } = req.params;
  const ev = await Event.findById(id).select("comments");
  if (!ev) return res.status(404).json({ message: "Evento não encontrado." });
  res.json({ comments: ev.comments || [] });
}

async function addComment(req, res) {
  const { id } = req.params;
  const { text } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ message: "Informe um comentário." });

  const ev = await Event.findById(id);
  if (!ev) return res.status(404).json({ message: "Evento não encontrado." });

  const userId = req.user?.sub;
  ev.comments = Array.isArray(ev.comments) ? ev.comments : [];
  ev.comments.push({ userId, text: String(text).trim(), createdAt: new Date() });

  ev.history = Array.isArray(ev.history) ? ev.history : [];
  ev.history.push({ userId, action: "COMMENT_ADDED", changes: {} });

  await ev.save();

  // notifica criador + participantes
  const targets = uniqStrings([String(ev.createdBy), ...(ev.participants || []).map(String)]);
  await createForUsers({
    userIds: targets,
    type: "EVENT_COMMENT",
    title: "Novo comentário em evento",
    message: `Comentário adicionado em “${ev.title}”.`,
    eventId: ev._id
  });

  res.status(201).json({ ok: true });
}


module.exports = {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  // Etapa 3
  listInvites,
  respondInvite,
  listComments,
  addComment,
};