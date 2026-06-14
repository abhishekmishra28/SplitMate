const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");
const groupMemberMiddleware = require("../middleware/groupMemberMiddleware");

const {
  getGroupAnalytics
} = require("../controllers/analyticsController");

router.use(protect);

router.get(
  "/:groupId/analytics",
  groupMemberMiddleware,
  getGroupAnalytics
);

module.exports = router;