const prisma = require("../config/prisma");

async function createActivity({
  groupId,
  userId,
  type,
  title,
  description,
  metadata = null
}, tx) {
  const db = tx || prisma;
  return db.activity.create({
    data: {
      groupId,
      userId,
      type,
      title,
      description,
      metadata
    }
  });
}

module.exports = {
  createActivity
};