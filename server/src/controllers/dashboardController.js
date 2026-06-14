const prisma = require("../config/prisma");

const {
  calculateBalances,
  simplifyDebts
} = require("../services/balanceService");

exports.getDashboard = async (req, res) => {
  try {

    const userId = req.user.id;

    const memberships =
      await prisma.membership.findMany({
        where: {
          userId,
          leftAt: null
        },
        include: {
          group: {
            include: {
              expenses: {
                include: {
                  splits: true
                }
              },
              settlements: true,
              memberships: true
            }
          }
        }
      });

    let youOwe = 0;
    let youAreOwed = 0;
    let totalExpenses = 0;

    const groups = [];

    for (const membership of memberships) {

      const group = membership.group;

      totalExpenses += group.expenses.length;

      const memberIds =
        group.memberships
          .filter(m => !m.leftAt)
          .map(m => m.userId)
          .filter(Boolean);

      const memberMap = {};

      const users =
        await prisma.user.findMany({
          where: {
            id: {
              in: memberIds
            }
          }
        });

      users.forEach(user => {
        memberMap[user.id] = user.name;
      });

      const balances =
        calculateBalances(
          group.expenses,
          group.settlements,
          memberIds,
          memberMap
        );

      const me =
        balances.find(
          b => b.userId === userId
        );

      if (me) {

        if (me.netBalance > 0)
          youAreOwed += me.netBalance;

        if (me.netBalance < 0)
          youOwe += Math.abs(me.netBalance);

        groups.push({
          id: group.id,
          name: group.name,
          memberCount:
            group.memberships.length,
          balance:
            me.netBalance
        });
      }
    }

    res.json({
      success: true,

      summary: {

        youAreOwed:
          Number(youAreOwed.toFixed(2)),

        youOwe:
          Number(youOwe.toFixed(2)),

        netBalance:
          Number(
            (youAreOwed - youOwe)
            .toFixed(2)
          ),

        totalExpenses
      },

      groups
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false
    });
  }
};

exports.getPendingSettlements =
async (req, res) => {

  try {

    const userId = req.user.id;

    const memberships =
      await prisma.membership.findMany({
        where: {
          userId,
          leftAt: null
        },
        include: {
          group: {
            include: {
              expenses: {
                include: {
                  splits: true
                }
              },
              settlements: true,
              memberships: {
                include: {
                  user: true
                }
              }
            }
          }
        }
      });

    const pending = [];

    for (const membership of memberships) {

      const group = membership.group;

      const memberIds =
        group.memberships
          .map(m => m.userId)
          .filter(Boolean);

      const memberMap = {};

      group.memberships.forEach(m => {
        if (m.user) {
          memberMap[m.user.id] =
            m.user.name;
        }
      });

      const balances =
        calculateBalances(
          group.expenses,
          group.settlements,
          memberIds,
          memberMap
        );

      const debts =
        simplifyDebts(balances);

      debts.forEach(debt => {

        if (
          debt.fromUserId === userId ||
          debt.toUserId === userId
        ) {

          pending.push({
            groupId: group.id,
            groupName: group.name,
            ...debt
          });
        }
      });
    }

    res.json({
      success: true,
      pending
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false
    });
  }
};

exports.getRecentActivity =
async (req, res) => {

  try {

    const userId = req.user.id;

    const memberships =
      await prisma.membership.findMany({
        where: {
          userId,
          leftAt: null
        }
      });

    const groupIds =
      memberships.map(
        m => m.groupId
      );

    const expenses =
      await prisma.expense.findMany({

        where: {
          groupId: {
            in: groupIds
          }
        },

        include: {
          paidBy: {
            select: {
              name: true
            }
          },

          group: {
            select: {
              name: true
            }
          }
        },

        orderBy: {
          expenseDate: "desc"
        },

        take: 10
      });

    res.json({
      success: true,
      activity: expenses
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false
    });
  }
};