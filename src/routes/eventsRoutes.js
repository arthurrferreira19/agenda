const router = require("express").Router();
const { authRequired } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/eventsController");

router.use(authRequired);

router.get("/", ctrl.listEvents);
router.post("/", ctrl.createEvent);
router.put("/:id", ctrl.updateEvent);
router.delete("/:id", ctrl.deleteEvent);

module.exports = router;