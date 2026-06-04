const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/authenticate');

const prisma = new PrismaClient();

// GET /user/export — full GDPR data export for the authenticated customer
router.get('/export', authenticate, authorize('CUSTOMER', 'AGENT', 'ADMIN'), async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [user, tickets, notifications, auditLogs, kycRecords] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          phone: true, role: true, accountNumber: true,
          gdprConsent: true, gdprConsentAt: true,
          notifyEmail: true, notifySms: true,
          createdAt: true,
        },
      }),
      prisma.ticket.findMany({
        where: { customerId: userId },
        include: {
          comments: {
            where: { isInternal: false },
            select: { body: true, createdAt: true, author: { select: { firstName: true, lastName: true, role: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.kycRecord.findMany({
        where: { userId },
        select: {
          idType: true, ocrName: true, ocrDob: true, ocrIdNumber: true,
          faceMatchScore: true, status: true, verifiedAt: true, createdAt: true,
        },
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: user,
      tickets,
      notifications,
      auditLogs,
      kycRecords,
    };

    res.setHeader('Content-Disposition', `attachment; filename="ubfinance-data-export-${userId}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(exportData);
  } catch (err) {
    next(err);
  }
});

// PATCH /user/preferences — update notification preferences
router.patch('/preferences', authenticate, async (req, res, next) => {
  try {
    const { notifyEmail, notifySms } = req.body;
    const updateData = {};
    if (typeof notifyEmail === 'boolean') updateData.notifyEmail = notifyEmail;
    if (typeof notifySms === 'boolean') updateData.notifySms = notifySms;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: { id: true, notifyEmail: true, notifySms: true },
    });

    res.json({ message: 'Preferences updated.', user });
  } catch (err) {
    next(err);
  }
});

// DELETE /user/account — soft-delete request (marks inactive, schedules purge)
router.delete('/account', authenticate, authorize('CUSTOMER'), async (req, res, next) => {
  try {
    const userId = req.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deletionRequestedAt: new Date(),
      },
    });

    res.json({
      message: 'Account deletion requested. Your account will be deactivated immediately and permanently deleted after 30 days. You can cancel this by contacting support.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
