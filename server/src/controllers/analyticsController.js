const prisma = require("../config/prisma");

exports.getGroupAnalytics = async (req, res) => {
  try {

    const { groupId } = req.params;

    const group = await prisma.group.findUnique({
      where: {
        id: groupId
      },

      include: {
        expenses: {
          include: {
            paidBy: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },

        memberships: {
          where: {
            leftAt: null
          },
          include: {
            user: true
          }
        },

        settlements: true
      }
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found"
      });
    }

    const expenses = group.expenses;

    const totalSpent =
      expenses.reduce(
        (sum, e) => sum + e.amountInr,
        0
      );

    const averageExpense =
      expenses.length
        ? totalSpent / expenses.length
        : 0;

    const activeMembers =
      group.memberships.length;

    const settlementsCount =
      group.settlements.length;

    const monthlyMap = {};

    expenses.forEach(expense => {

      const month =
        new Date(expense.expenseDate)
        .toLocaleString("default", {
          month: "short",
          year: "numeric"
        });

      monthlyMap[month] =
        (monthlyMap[month] || 0)
        + expense.amountInr;
    });

    const monthlySpending =
      Object.entries(monthlyMap).map(
        ([month, amount]) => ({
          month,
          amount
        })
      );

    const contributorMap = {};

    expenses.forEach(expense => {

      contributorMap[
        expense.paidBy.name
      ] =
        (contributorMap[
          expense.paidBy.name
        ] || 0)
        + expense.amountInr;
    });

    const topContributors =
      Object.entries(contributorMap)
        .map(([name, amount]) => ({
          name,
          amount
        }))
        .sort(
          (a, b) =>
            b.amount - a.amount
        );

    res.json({
      success: true,

      analytics: {

        totalSpent:
          Number(totalSpent.toFixed(2)),

        averageExpense:
          Number(
            averageExpense.toFixed(2)
          ),

        activeMembers,

        settlementsCount,

        monthlySpending,

        topContributors
      }
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false
    });
  }
};