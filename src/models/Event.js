const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },

    start: { type: Date, required: true },
    end: { type: Date, required: true },

    eventType: { type: String, enum: ["MAXIMUM", "PRESENCIAL", "ONLINE"], required: true },

    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },

    clientAddress: { type: String, default: "", trim: true },

    meetLink: { type: String, default: "", trim: true },

    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Etapa 3: status de convite/participação
    participantStatus: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      status: { type: String, enum: ["PENDING", "ACCEPTED", "DECLINED"], default: "PENDING" },
      respondedAt: { type: Date, default: null }
    }],

    // Etapa 3: comentários por evento
    comments: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      text: { type: String, required: true, trim: true },
      createdAt: { type: Date, default: Date.now }
    }],

    // Etapa 3: histórico de alterações
    history: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      action: { type: String, required: true },
      at: { type: Date, default: Date.now },
      changes: { type: Object, default: {} }
    }],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

eventSchema.index({ start: 1, end: 1 });
eventSchema.index({ roomId: 1, start: 1, end: 1 });

module.exports = mongoose.models.Event || mongoose.model("Event", eventSchema);