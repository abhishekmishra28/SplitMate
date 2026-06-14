const prisma = require("../config/prisma");

const {
  generateSplits,
} = require("../services/splitService");

const {
  createActivity,
} = require("../services/activityService");

const ACTIVITY =
  require("../constants/activityTypes");


exports.createExpense = async (req, res) => {
  try {
    const {
      groupId,
      description,
      paidById,
      amount,
      currency = "INR",
      splitType,
      memberIds,
      customAmounts,
      percentages,
      shares,
      notes,
    } = req.body;

    const splits = generateSplits({
      amount,
      splitType,
      memberIds,
      customAmounts,
      percentages,
      shares,
    });

    const expense = await prisma.$transaction(
      async (tx) => {
        const newExpense = await tx.expense.create({
          data: {
            groupId,
            description,
            paidById,
            amount,
            currency,
            amountInr: amount,
            exchangeRate: 1,
            splitType,
            expenseDate: new Date(),
            notes,
            createdById: req.user.id,
          },
        });

        await tx.expenseSplit.createMany({
          data: splits.map((split) => ({
            expenseId: newExpense.id,
            userId: split.userId,
            amountOwed: split.amountOwed,
            percentage: split.percentage,
            share: split.share,
          })),
        });

        return newExpense;
      }
    );

    await createActivity({
      groupId,
      userId: req.user.id,

      type: ACTIVITY.EXPENSE_CREATED,

      title: "Expense Added",

      description: `${description} - ₹${amount}`,
    });

    res.status(201).json({
      success: true,
      expense,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getGroupExpenses = async (req, res) => {
  try {
    const { groupId } = req.params;

    const expenses = await prisma.expense.findMany({
      where: {
        groupId,
      },
      include: {
        paidBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },

        splits: true,
      },
      orderBy: {
        expenseDate: "desc",
      },
    });

    res.json({
      success: true,
      expenses,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch expenses",
    });
  }
};


exports.getExpenseById = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const expense = await prisma.expense.findUnique({
      where: {
        id: expenseId,
      },
      include: {
        paidBy: true,
        createdBy: true,
        splits: true,
      },
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    res.json({
      success: true,
      expense,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
    });
  }
};




exports.deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const expense =
      await prisma.expense.findUnique({
        where: {
          id: expenseId,
        },
      });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    await createActivity({
      groupId: expense.groupId,
      userId: req.user.id,

      type: ACTIVITY.EXPENSE_DELETED,

      title: "Expense Deleted",

      description:
        expense.description,
    });

    await prisma.expense.delete({
      where: {
        id: expenseId,
      },
    });

    res.json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
    });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const { description, notes } = req.body;

    const existingExpense =
      await prisma.expense.findUnique({
        where: {
          id: expenseId,
        },
      });

    if (!existingExpense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    const expense =
      await prisma.expense.update({
        where: {
          id: expenseId,
        },
        data: {
          description,
          notes,
        },
      });

    await createActivity({
      groupId: expense.groupId,
      userId: req.user.id,

      type: ACTIVITY.EXPENSE_UPDATED,

      title: "Expense Updated",

      description:
        expense.description,
    });

    res.json({
      success: true,
      expense,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
    });
  }
};