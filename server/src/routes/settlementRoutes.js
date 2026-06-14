const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");
const groupMemberMiddleware = require("../middleware/groupMemberMiddleware");
const validateSettlement = require("../middleware/validateSettlement");

const {
  createSettlement,
  getGroupSettlements,
  deleteSettlement
} = require("../controllers/settlementController");

router.use(protect);

router.post(
  "/",
  groupMemberMiddleware,
  validateSettlement,
  createSettlement
);

router.get(
  "/group/:groupId",
  groupMemberMiddleware,
  getGroupSettlements
);

router.delete(
  "/:settlementId",
  deleteSettlement
);

module.exports = router;