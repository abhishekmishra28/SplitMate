const prisma = require("../config/prisma");

exports.searchUsers = async (req, res) => {
  try {
    const query = req.query.q || "";

    if (!query.trim()) {
      return res.json({
        success: true,
        users: [],
      });
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          {
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            email: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },

      select: {
        id: true,
        name: true,
        email: true,
      },

      take: 20,
    });

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Search Users Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to search users",
    });
  }
};