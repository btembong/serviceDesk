const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/authenticate');

const prisma = new PrismaClient();

// GET /notifications/:userId
router.get('/:userId', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (req.user.role === 'CUSTOMER' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = notifications.filter(n => !n.read).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
});

// PATCH /notifications/:id/read
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification) return res.status(404).json({ error: 'Notification not found.' });
    if (notification.userId !== req.user.id) return res.status(403).json({ error: 'Access denied.' });

    await prisma.notification.update({ where: { id }, data: { read: true } });
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    next(err);
  }
});

// PATCH /notifications/read-all/:userId
router.patch('/read-all/:userId', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (req.user.id !== userId) return res.status(403).json({ error: 'Access denied.' });

    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
