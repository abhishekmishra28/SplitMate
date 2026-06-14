const express = require("express");

const router = express.Router();

const protect =
require("../middleware/authMiddleware");

const groupMemberMiddleware =
require("../middleware/groupMemberMiddleware");

const {
  getGroupRecords
} = require("../controllers/recordController");

router.use(protect);

router.get(
  "/:groupId/records",
  groupMemberMiddleware,
  getGroupRecords
);

module.exports = router;