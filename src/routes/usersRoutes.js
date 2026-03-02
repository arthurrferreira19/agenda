const router = require("express").Router();
const { authRequired, requireRole } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/usersController");

// ✅ PARA AGENDA: qualquer logado pode ver membros ativos
router.get("/members", authRequired, ctrl.listMembers);

// ✅ CRUD de usuários: só ADMIN
router.use(authRequired, requireRole("ADMIN"));

router.get("/", ctrl.listUsers);
router.post("/", ctrl.createUser);
router.put("/:id", ctrl.updateUser);
router.patch("/:id/active", ctrl.setActive);
router.patch("/:id/password", ctrl.resetPassword);
router.delete("/:id", ctrl.deleteUser);

module.exports = router;