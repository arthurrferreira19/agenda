const router = require("express").Router();
const { authRequired } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/eventsController");

router.use(authRequired);

router.get("/", ctrl.listEvents);

// Etapa 3: convites
router.get("/invites", ctrl.listInvites);
router.post("/:id/respond", ctrl.respondInvite);

// Etapa 3: comentários
router.get("/:id/comments", ctrl.listComments);
router.post("/:id/comments", ctrl.addComment);
router.post("/", ctrl.createEvent);
router.put("/:id", ctrl.updateEvent);
router.delete("/:id", ctrl.deleteEvent);

module.exports = router;