const prisma = require("../config/prisma");

exports.getGroupRecords = async (req, res) => {
  try {

    const { groupId } = req.params;

    const expenses =
      await prisma.expense.findMany({
        where: {
          groupId
        },

        include: {
          paidBy: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

    const settlements =
      await prisma.settlement.findMany({
        where: {
          groupId
        },

        include: {
          fromUser: {
            select: {
              id: true,
              name: true
            }
          },

          toUser: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

    const records = [
      ...expenses.map(expense => ({
        id: expense.id,
        type: "expense",

        description:
          expense.description,

        amount:
          expense.amountInr,

        paidBy:
          expense.paidBy.name,

        splitType:
          expense.splitType,

        date:
          expense.expenseDate
      })),

      ...settlements.map(settlement => ({
        id: settlement.id,

        type: "settlement",

        amount:
          settlement.amount,

        fromUser:
          settlement.fromUser.name,

        toUser:
          settlement.toUser.name,

        date:
          settlement.settledAt
      }))
    ];

    records.sort(
      (a, b) =>
        new Date(b.date) -
        new Date(a.date)
    );

    res.json({
      success: true,
      records
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false
    });
  }
};