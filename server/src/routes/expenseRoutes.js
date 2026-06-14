const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");
const groupMemberMiddleware = require("../middleware/groupMemberMiddleware");
const validateExpense = require("../middleware/validateExpense");

const {
  createExpense,
  getGroupExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
} = require("../controllers/expenseController");

router.use(protect);

router.post(
  "/",
  groupMemberMiddleware,
  validateExpense,
  createExpense
);

router.get(
  "/group/:groupId",
  groupMemberMiddleware,
  getGroupExpenses
);

router.get(
  "/:expenseId",
  getExpenseById
);

router.put(
  "/:expenseId",
  updateExpense
);

router.delete(
  "/:expenseId",
  deleteExpense
);

module.exports = router;