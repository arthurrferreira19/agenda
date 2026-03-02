const router = require("express").Router();
const { authRequired } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/holidaysController");

router.use(authRequired);

// Lista feriados nacionais (BR) por ano, para recorrência em dias úteis.
router.get("/:year", ctrl.listHolidays);

module.exports = router;
