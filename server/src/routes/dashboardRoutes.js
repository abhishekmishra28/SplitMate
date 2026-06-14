const express = require("express");

const router = express.Router();

const protect =
require("../middleware/authMiddleware");

const {
  getDashboard,
  getPendingSettlements,
  getRecentActivity
} = require("../controllers/dashboardController");

router.use(protect);

router.get(
  "/summary",
  getDashboard
);

router.get(
  "/pending-settlements",
  getPendingSettlements
);

router.get(
  "/activity",
  getRecentActivity
);

module.exports = router;