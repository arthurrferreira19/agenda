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

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

eventSchema.index({ start: 1, end: 1 });
eventSchema.index({ roomId: 1, start: 1, end: 1 });

module.exports = mongoose.models.Event || mongoose.model("Event", eventSchema);