const Room = require("../models/Room");

function pickRoom(r) {
  return {
    id: r._id,
    name: r.name,
    floor: r.floor,
    capacity: r.capacity,
    color: r.color,
    features: r.features,
    isActive: r.isActive,
    createdAt: r.createdAt
  };
}

async function listRooms(req, res) {
  const rooms = await Room.find({}).sort({ createdAt: -1 });
  res.json({ rooms: rooms.map(pickRoom) });
}

async function listActiveRooms(req, res) {
  const rooms = await Room.find({ isActive: true }).sort({ name: 1 }).select("name floor capacity color isActive");
  res.json({
    rooms: rooms.map(r => ({
      id: r._id,
      name: r.name,
      floor: r.floor,
      capacity: r.capacity,
      color: r.color,
      isActive: r.isActive
    }))
  });
}

async function createRoom(req, res) {
  const { name, floor, capacity, color, features } = req.body;

  if (!name || !floor || !capacity || !color) {
    return res.status(400).json({ message: "Informe Nome, Andar, Capacidade e Cor." });
  }

  const cap = Number(capacity);
  if (!Number.isFinite(cap) || cap < 1) {
    return res.status(400).json({ message: "Capacidade inválida." });
  }

  const room = await Room.create({
    name: String(name).trim(),
    floor: String(floor).trim(),
    capacity: cap,
    color: String(color).toLowerCase().trim(),
    features: {
      tv: Boolean(features?.tv),
      computer: Boolean(features?.computer),
      speakers: Boolean(features?.speakers),
      microphone: Boolean(features?.microphone),
      minibar: Boolean(features?.minibar)
    }
  });

  res.status(201).json({ room: pickRoom(room) });
}

async function updateRoom(req, res) {
  const { id } = req.params;
  const { name, floor, capacity, color, features } = req.body;

  const room = await Room.findById(id);
  if (!room) return res.status(404).json({ message: "Sala não encontrada." });

  if (name) room.name = String(name).trim();
  if (floor) room.floor = String(floor).trim();

  if (capacity !== undefined) {
    const cap = Number(capacity);
    if (!Number.isFinite(cap) || cap < 1) {
      return res.status(400).json({ message: "Capacidade inválida." });
    }
    room.capacity = cap;
  }

  if (color) room.color = String(color).toLowerCase().trim();

  if (features) {
    room.features = {
      tv: Boolean(features.tv),
      computer: Boolean(features.computer),
      speakers: Boolean(features.speakers),
      microphone: Boolean(features.microphone),
      minibar: Boolean(features.minibar)
    };
  }

  await room.save();
  res.json({ room: pickRoom(room) });
}

async function setActive(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;

  const room = await Room.findById(id);
  if (!room) return res.status(404).json({ message: "Sala não encontrada." });

  room.isActive = Boolean(isActive);
  await room.save();

  res.json({ room: pickRoom(room) });
}

async function deleteRoom(req, res) {
  const { id } = req.params;
  const room = await Room.findById(id);
  if (!room) return res.status(404).json({ message: "Sala não encontrada." });

  await Room.deleteOne({ _id: id });
  res.json({ ok: true });
}

module.exports = {
  listRooms,
  listActiveRooms,
  createRoom,
  updateRoom,
  setActive,
  deleteRoom
};