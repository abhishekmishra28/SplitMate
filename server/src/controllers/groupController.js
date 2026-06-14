const prisma = require("../config/prisma");

const { createActivity } = require("../services/activityService");
const ACTIVITY = require("../constants/activityTypes");

exports.createGroup = async (req, res) => {
  try {
    const {
      name,
      description,
      currency = "INR",
      memberIds = [],
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Group name is required",
      });
    }

    const userId = req.user.id;

    const group = await prisma.$transaction(async (tx) => {
      const newGroup = await tx.group.create({
        data: {
          name: name.trim(),
          description,
          currency,
          createdById: userId,
        },
      });
      await createActivity({
        groupId: newGroup.id,
        userId: req.user.id,

        type: ACTIVITY.GROUP_CREATED,

        title: "Group Created",

        description: `${req.user.name} created group ${newGroup.name}`
        }, tx);
      const uniqueMemberIds = [
        userId,
        ...memberIds.filter((id) => id !== userId),
      ];

      const existingUsers = await tx.user.findMany({
        where: {
          id: {
            in: uniqueMemberIds,
          },
        },
        select: {
          id: true,
        },
      });

      await tx.membership.createMany({
        data: existingUsers.map((user) => ({
          groupId: newGroup.id,
          userId: user.id,
        })),
      });

      return newGroup;
    });

    res.status(201).json({
      success: true,
      group,
    });
  } catch (error) {
    console.error("Create Group Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create group",
    });
  }
};

exports.getGroups = async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      where: {
        memberships: {
          some: {
            userId: req.user.id,
            leftAt: null,
          },
        },
      },

      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        _count: {
          select: {
            memberships: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedGroups = groups.map((group) => ({
      ...group,
      memberCount: group._count.memberships,
    }));

    res.json({
      success: true,
      groups: formattedGroups,
    });
  } catch (error) {
    console.error("Get Groups Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch groups",
    });
  }
};

exports.getGroupById = async (req, res) => {
  try {
    const { groupId } = req.params;

    const membership = await prisma.membership.findFirst({
      where: {
        groupId,
        userId: req.user.id,
        leftAt: null,
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const group = await prisma.group.findUnique({
      where: {
        id: groupId,
      },

      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        memberships: {
          where: {
            leftAt: null,
          },

          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    res.json({
      success: true,
      group,
    });
  } catch (error) {
    console.error("Get Group Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch group",
    });
  }
};

exports.addMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found"
      });
    }

    const existingMembership =
      await prisma.membership.findFirst({
        where: {
          groupId,
          userId
        }
      });

    let membership;

    if (existingMembership) {
      if (existingMembership.leftAt === null) {
        return res.status(400).json({
          success: false,
          message: "User already in group"
        });
      }

      membership = await prisma.membership.update({
        where: { id: existingMembership.id },
        data: { leftAt: null }
      });
    } else {
      membership =
        await prisma.membership.create({
          data: {
            groupId,
            userId
          }
        });
    }
    await createActivity({
        groupId,
        userId: req.user.id,

        type: ACTIVITY.MEMBER_ADDED,

        title: "Member Added",

        description: "A member joined the group"
    });

    res.status(201).json({
      success: true,
      membership
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to add member"
    });
  }
};

exports.addGuestMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { guestName } = req.body;

    if (!guestName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Guest name required"
      });
    }

    const guest =
      await prisma.membership.create({
        data: {
          groupId,
          isGuest: true,
          guestName: guestName.trim()
        }
      });
    await createActivity({
        groupId,
        userId: req.user.id,

        type: ACTIVITY.GUEST_ADDED,

        title: "Guest Added",

        description: `${guestName.trim()} added as guest`
    });

    res.status(201).json({
      success: true,
      guest
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false
    });
  }
};




exports.getGroupMembers = async (req, res) => {
  try {

    const { groupId } = req.params;

    const members =
      await prisma.membership.findMany({
        where: {
          groupId,
          leftAt: null
        },

        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

    res.json({
      success: true,
      members
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false
    });
  }
};

exports.removeMember = async (req, res) => {
  try {

    const { groupId, userId } = req.params;

    const membership =
      await prisma.membership.findFirst({
        where: {
          groupId,
          userId,
          leftAt: null
        }
      });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Member not found"
      });
    }

    await prisma.membership.update({
      where: {
        id: membership.id
      },
      data: {
        leftAt: new Date()
      }
    });
    await createActivity({
        groupId,
        userId: req.user.id,

        type: ACTIVITY.MEMBER_REMOVED,

        title: "Member Removed",

        description: "Member removed from group"
    });

    res.json({
      success: true,
      message: "Member removed"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false
    });
  }
};

exports.leaveGroup = async (req, res) => {
  try {

    const { groupId } = req.params;

    const membership =
      await prisma.membership.findFirst({
        where: {
          groupId,
          userId: req.user.id,
          leftAt: null
        }
      });

    if (!membership) {
      return res.status(404).json({
        success: false
      });
    }

    await prisma.membership.update({
      where: {
        id: membership.id
      },
      data: {
        leftAt: new Date()
      }
    });
    await createActivity({
        groupId,
        userId: req.user.id,

        type: ACTIVITY.MEMBER_REMOVED,

        title: "Member Left",

        description: `${req.user.name} left the group`
    });

    res.json({
      success: true,
      message: "Left group successfully"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false
    });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (group.createdById !== userId) {
      return res.status(403).json({ success: false, message: "Only the group admin can delete this group" });
    }

    // Delete in dependency order (Prisma cascade handles splits via onDelete: Cascade on Expense)
    await prisma.importReport.deleteMany({ where: { groupId } });
    await prisma.activity.deleteMany({ where: { groupId } });
    await prisma.settlement.deleteMany({ where: { groupId } });
    await prisma.expense.deleteMany({ where: { groupId } }); // splits cascade
    await prisma.membership.deleteMany({ where: { groupId } });
    await prisma.group.delete({ where: { id: groupId } });

    res.json({ success: true, message: "Group deleted successfully" });
  } catch (error) {
    console.error("deleteGroup error:", error);
    res.status(500).json({ success: false, message: "Failed to delete group" });
  }
};
