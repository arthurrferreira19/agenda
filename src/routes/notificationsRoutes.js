const router = require("express").Router();
const { authRequired } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/notificationsController");

router.get("/", authRequired, ctrl.list);
router.get("/unread-count", authRequired, ctrl.unreadCount);

router.post("/mark-all-read", authRequired, ctrl.markAllRead);
router.post("/:id/read", authRequired, ctrl.markRead);

router.post("/reminder", authRequired, ctrl.createReminder);

module.exports = router;
