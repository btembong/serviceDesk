const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createNotification = async ({ userId, type, title, body, ticketId }) => {
  try {
    return await prisma.notification.create({
      data: { userId, type, title, body, ticketId: ticketId || null },
    });
  } catch (err) {
    console.error('[Notification] Failed to create notification:', err.message);
  }
};

module.exports = { createNotification };
