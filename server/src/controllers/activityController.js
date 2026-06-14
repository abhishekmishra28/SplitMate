const prisma = require("../config/prisma");

exports.getGroupActivity = async (req, res) => {
  try {

    const { groupId } = req.params;

    const activities =
      await prisma.activity.findMany({

        where: {
          groupId
        },

        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        },

        orderBy: {
          createdAt: "desc"
        },

        take: 50
      });

    res.json({
      success: true,
      activities
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false
    });
  }
};