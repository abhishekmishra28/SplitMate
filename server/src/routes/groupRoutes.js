const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  createGroup,
  getGroups,
  getGroupById,
  addMember,
  addGuestMember,
  getGroupMembers,
  removeMember,
  leaveGroup,
  deleteGroup
} = require("../controllers/groupController");

router.use(protect);

router.post("/", createGroup);

router.get("/", getGroups);

router.get("/:groupId", getGroupById);

router.get("/:groupId/members", getGroupMembers);

router.post("/:groupId/members", addMember);

router.post("/:groupId/guests", addGuestMember);

router.delete("/:groupId/members/:userId", removeMember);

router.delete("/:groupId/leave", leaveGroup);

router.delete("/:groupId", deleteGroup);

module.exports = router;