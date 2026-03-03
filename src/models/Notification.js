const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // EVENT_CREATED | EVENT_UPDATED | EVENT_DELETED | INVITE | REMINDER | SYSTEM
    type: { type: String, required: true, index: true },

    title: { type: String, default: "", trim: true },
    message: { type: String, default: "", trim: true },

    // Contexto
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", default: null, index: true },
    reminderMinutes: { type: Number, default: undefined },

    meta: { type: Object, default: {} },

    isRead: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

// Evita duplicar lembrete do mesmo evento (por usuário e por minutos)
notificationSchema.index(
  { userId: 1, type: 1, eventId: 1, reminderMinutes: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
