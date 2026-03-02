const router = require("express").Router();
const { adminLogin, login } = require("../controllers/authController");

router.post("/admin/login", adminLogin);
router.post("/login", login);

module.exports = router;