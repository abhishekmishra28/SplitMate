const prisma = require("../config/prisma");

const {
  calculateBalances,
  simplifyDebts,
} = require("../services/balanceService");

exports.getBalances = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group =
      await prisma.group.findUnique({
        where: {
          id: groupId,
        },

        include: {
          memberships: {
            where: {
              leftAt: null,
            },

            include: {
              user: true,
            },
          },

          expenses: {
            include: {
              splits: true,
            },
          },

          settlements: true,
        },
      });

    const memberIds = group.memberships.map(m => m.userId);
    const memberMap = group.memberships.reduce((acc, m) => {
      acc[m.userId] = m.user.name;
      return acc;
    }, {});

    const balances = calculateBalances(
      group.expenses,
      group.settlements,
      memberIds,
      memberMap
    );

    res.json({
      success: true,
      balances,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
    });
  }
};

exports.getDebts = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group =
      await prisma.group.findUnique({
        where: {
          id: groupId,
        },

        include: {
          memberships: {
            where: {
              leftAt: null,
            },

            include: {
              user: true,
            },
          },

          expenses: {
            include: {
              splits: true,
            },
          },

          settlements: true,
        },
      });

    const memberIds = group.memberships.map(m => m.userId);
    const memberMap = group.memberships.reduce((acc, m) => {
      acc[m.userId] = m.user.name;
      return acc;
    }, {});

    const balances = calculateBalances(
      group.expenses,
      group.settlements,
      memberIds,
      memberMap
    );

    const debts = simplifyDebts(
      balances
    );

    res.json({
      success: true,
      debts,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
    });
  }
};