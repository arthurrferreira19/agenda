const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    password: { type: String, required: true, minlength: 6, select: false },

    role: { type: String, enum: ["ADMIN", "USER", "RESPONSAVEL"], default: "USER" },

    // Preferências do usuário (Etapa 3)
    preferences: {
      timezone: { type: String, default: "America/Sao_Paulo" },
      workHours: {
        start: { type: String, default: "08:00" },
        end: { type: String, default: "18:00" }
      },
      reminders: { type: [Number], default: [15, 30, 60] }
    },

    ui: {
      showKpis: { type: Boolean, default: true },
      showFilters: { type: Boolean, default: true }
    },

    // Google Calendar tokens
    google: {
      connected: { type: Boolean, default: false },
      email: { type: String, default: "" },
      accessToken: { type: String, default: "" },
      refreshToken: { type: String, default: "" },
      scope: { type: String, default: "" },
      tokenType: { type: String, default: "" },
      expiryDate: { type: Number, default: 0 }
    },

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null }
  },
    {
    timestamps: true
  }

);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = function (plain) {
  if (!plain || !this.password) return Promise.resolve(false);
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.models.User || mongoose.model("User", userSchema);