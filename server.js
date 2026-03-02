const path = require("path");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
require("dotenv").config();

const User = require("./src/models/User");

const authRoutes = require("./src/routes/authRoutes");
const usersRoutes = require("./src/routes/usersRoutes");
const roomsRoutes = require("./src/routes/roomsRoutes");
const eventsRoutes = require("./src/routes/eventsRoutes");

const app = express();

// Middlewares base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

// Helmet (CSP liberando CDNs)
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
        scriptSrcElem: ["'self'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrcElem: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "data:", "https://cdn.jsdelivr.net"],
        connectSrc: ["'self'"]
      }
    }
  })
);

// Static
app.use(express.static(path.join(__dirname, "public")));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/rooms", roomsRoutes);
app.use("/api/events", eventsRoutes);

// Healthcheck
app.get("/health", (req, res) => res.json({ ok: true }));

// Fallback login admin
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin", "login.html"));
});

// DB + Start
async function start() {
  const port = process.env.PORT || 3000;

  if (!process.env.MONGO_URI) {
    console.error("Faltou MONGO_URI no .env");
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) {
    console.error("Faltou JWT_SECRET no .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB conectado ✅");

  // Seed opcional: node server.js --seed-admin
  if (process.argv.includes("--seed-admin")) {
    const email = process.env.SEED_ADMIN_EMAIL || "admin@maximumcalendar.com";
    const password = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";

    const exists = await User.findOne({ email });
    if (!exists) {
      await User.create({
        name: "Administrador",
        email,
        password,
        role: "ADMIN"
      });
      console.log("Admin seed criado ✅", { email, password });
    } else {
      console.log("Admin seed já existe ✅", { email });
    }
  }

  app.listen(port, () => console.log(`Servidor rodando em http://localhost:${port}`));
}

start().catch((err) => {
  console.error("Erro ao iniciar:", err);
  process.exit(1);
});