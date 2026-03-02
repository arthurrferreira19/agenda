const router = require("express").Router();
const { authRequired } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/googleController");

router.get("/status", authRequired, ctrl.getStatus);
router.get("/auth/url", authRequired, ctrl.getAuthUrl);
router.post("/disconnect", authRequired, ctrl.disconnect);

// Callback do OAuth (sem auth — usa state com userId)
router.get("/oauth/callback", ctrl.oauthCallback);

module.exports = router;
