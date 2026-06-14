const prisma = require("../config/prisma");

const {
  createActivity,
} = require("../services/activityService");

const ACTIVITY =
  require("../constants/activityTypes");

exports.createSettlement = async (req, res) => {
  try {
    const {
      groupId,
      fromUserId,
      toUserId,
      amount,
      notes,
    } = req.body;

    const settlement =
      await prisma.settlement.create({
        data: {
          groupId,
          fromUserId,
          toUserId,
          amount,
          notes,
          settledAt: new Date(),
        },
      });

    await createActivity({
      groupId,
      userId: req.user.id,

      type: ACTIVITY.SETTLEMENT_CREATED,

      title: "Settlement Created",

      description: `₹${amount} settled`,
    });

    res.status(201).json({
      success: true,
      settlement,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
    });
  }
};

exports.getGroupSettlements = async (req, res) => {
  try {
    const { groupId } = req.params;

    const settlements =
      await prisma.settlement.findMany({
        where: {
          groupId,
        },

        include: {
          fromUser: {
            select: {
              id: true,
              name: true,
            },
          },

          toUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },

        orderBy: {
          settledAt: "desc",
        },
      });

    res.json({
      success: true,
      settlements,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
    });
  }
};

exports.deleteSettlement = async (req, res) => {
  try {
    const { settlementId } = req.params;

    const settlement =
      await prisma.settlement.findUnique({
        where: {
          id: settlementId,
        },
      });

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: "Settlement not found",
      });
    }

    await createActivity({
      groupId: settlement.groupId,
      userId: req.user.id,

      type: ACTIVITY.SETTLEMENT_DELETED,

      title: "Settlement Deleted",

      description: `₹${settlement.amount} settlement removed`,
    });

    await prisma.settlement.delete({
      where: {
        id: settlementId,
      },
    });

    res.json({
      success: true,
      message: "Settlement deleted",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
    });
  }
};