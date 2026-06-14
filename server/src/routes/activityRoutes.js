const express = require("express");

const router = express.Router();

const protect =
require("../middleware/authMiddleware");

const groupMemberMiddleware =
require("../middleware/groupMemberMiddleware");

const {
  getGroupActivity
} =
require("../controllers/activityController");

router.use(protect);

router.get(
  "/:groupId/activity",
  groupMemberMiddleware,
  getGroupActivity
);

module.exports = router;