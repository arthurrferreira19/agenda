const router = require("express").Router();
const { authRequired, requireRole } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/roomsController");

// ✅ Para Agenda: qualquer usuário logado pode listar salas ativas
router.get("/active", authRequired, ctrl.listActiveRooms);

// ✅ CRUD de salas: somente ADMIN
router.use(authRequired, requireRole("ADMIN"));

router.get("/", ctrl.listRooms);
router.post("/", ctrl.createRoom);
router.put("/:id", ctrl.updateRoom);
router.patch("/:id/active", ctrl.setActive);
router.delete("/:id", ctrl.deleteRoom);

module.exports = router;