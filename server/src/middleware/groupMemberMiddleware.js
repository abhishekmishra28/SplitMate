const prisma = require("../config/prisma");

module.exports = async (req, res, next) => {
  try {
    const groupId =
      req.params.groupId ||
      req.body.groupId;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: "Group id required"
      });
    }

    const membership =
      await prisma.membership.findFirst({
        where: {
          groupId,
          userId: req.user.id,
          leftAt: null
        }
      });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    next();

  } catch (error) {
    next(error);
  }
};