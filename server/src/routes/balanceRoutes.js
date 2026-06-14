const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");
const groupMemberMiddleware = require("../middleware/groupMemberMiddleware");

const {
  getBalances,
  getDebts,
} = require("../controllers/balanceController");

router.use(protect);

router.get(
  "/:groupId/balances",
  groupMemberMiddleware,
  getBalances
);

router.get(
  "/:groupId/debts",
  groupMemberMiddleware,
  getDebts
);

module.exports = router;