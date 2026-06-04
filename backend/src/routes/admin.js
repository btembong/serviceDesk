const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/authenticate');
const { sendKycResultEmail, sendPasswordResetEmail } = require('../services/emailService');
const { createNotification } = require('../services/notificationService');

const prisma = new PrismaClient();

// GET /admin/stats — dashboard overview
router.get('/stats', authenticate, authorize('ADMIN', 'AGENT'), async (req, res, next) => {
  try {
    const [
      totalOpen,
      totalInReview,
      totalResolved,
      totalUrgent,
      totalToday,
      kycPending,
    ] = await Promise.all([
      prisma.ticket.count({ where: { status: 'OPEN' } }),
      prisma.ticket.count({ where: { status: 'IN_REVIEW' } }),
      prisma.ticket.count({ where: { status: 'RESOLVED' } }),
      prisma.ticket.count({ where: { priority: 'URGENT', status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED'] } } }),
      prisma.ticket.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      prisma.kycRecord.count({ where: { status: 'MANUAL_REVIEW' } }),
    ]);

    res.json({ totalOpen, totalInReview, totalResolved, totalUrgent, totalToday, kycPending });
  } catch (err) {
    next(err);
  }
});

// GET /admin/analytics — ticket trends by category
router.get('/analytics', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const byCategory = await prisma.ticket.groupBy({
      by: ['category'],
      _count: { id: true },
    });

    const byStatus = await prisma.ticket.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const byPriority = await prisma.ticket.groupBy({
      by: ['priority'],
      _count: { id: true },
    });

    // Agent performance: tickets resolved per agent
    const agentPerformance = await prisma.ticket.groupBy({
      by: ['agentId'],
      where: { status: 'RESOLVED', agentId: { not: null } },
      _count: { id: true },
    });

    res.json({ byCategory, byStatus, byPriority, agentPerformance });
  } catch (err) {
    next(err);
  }
});

// GET /admin/users — list all users
router.get('/users', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = role ? { role } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, isActive: true, createdAt: true,
          _count: { select: { tickets: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

// POST /admin/users — create a new staff account (AGENT or ADMIN)
router.post('/users', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, role } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'First name, last name and email are required.' });
    }
    if (!['AGENT', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Role must be AGENT or ADMIN.' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    // Generate a temporary password — user must reset via forgot-password flow
    const tempPassword = crypto.randomBytes(10).toString('hex');
    const hashed = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone: phone || null,
        password: hashed,
        role,
        gdprConsent: true,
        gdprConsentAt: new Date(),
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
    });

    // Send password reset email so the new staff member sets their own password
    const { v4: uuidv4 } = require('uuid');
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });
    const resetLink = `${process.env.FRONTEND_URL}/auth/reset-password?token=${token}`;
    await sendPasswordResetEmail(user, resetLink);

    res.status(201).json({ message: 'Staff account created. A password setup link has been sent to their email.', user });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/users/:id — update user (activate/deactivate, change role)
router.patch('/users/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive, role } = req.body;

    const updateData = {};
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (role) updateData.role = role;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, role: true, isActive: true },
    });

    res.json({ message: 'User updated.', user });
  } catch (err) {
    next(err);
  }
});

// GET /admin/leaderboard — agent performance stats
router.get('/leaderboard', authenticate, authorize('ADMIN', 'AGENT'), async (req, res, next) => {
  try {
    const agents = await prisma.user.findMany({
      where: { role: { in: ['AGENT', 'ADMIN'] }, isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true },
    });

    const stats = await Promise.all(agents.map(async (agent) => {
      const [resolved, inReview, avgResolutionMs] = await Promise.all([
        prisma.ticket.count({ where: { agentId: agent.id, status: 'RESOLVED' } }),
        prisma.ticket.count({ where: { agentId: agent.id, status: 'IN_REVIEW' } }),
        prisma.ticket.aggregate({
          where: { agentId: agent.id, status: 'RESOLVED', resolvedAt: { not: null } },
          _avg: { },
        }),
      ]);

      // Average resolution time in hours
      const resolvedTickets = await prisma.ticket.findMany({
        where: { agentId: agent.id, status: 'RESOLVED', resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      });

      const avgHours = resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum, t) => sum + (new Date(t.resolvedAt) - new Date(t.createdAt)), 0)
          / resolvedTickets.length / 3600000
        : null;

      return {
        agent,
        resolved,
        inReview,
        avgResolutionHours: avgHours !== null ? parseFloat(avgHours.toFixed(1)) : null,
      };
    }));

    // Sort by resolved desc
    stats.sort((a, b) => b.resolved - a.resolved);

    res.json({ leaderboard: stats });
  } catch (err) {
    next(err);
  }
});

// GET /admin/audit-logs
router.get('/audit-logs', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { page = 1, limit = 50, userId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = userId ? { userId } : {};

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

// GET /admin/kyc-queue — manual review queue
router.get('/kyc-queue', authenticate, authorize('AGENT', 'ADMIN'), async (req, res, next) => {
  try {
    const records = await prisma.kycRecord.findMany({
      where: { status: 'MANUAL_REVIEW' },
      include: {
        ticket: { select: { id: true, ticketNumber: true, category: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ records });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/kyc/:id — agent manually approves/rejects KYC
router.patch('/kyc/:id', authenticate, authorize('AGENT', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { decision, reason } = req.body;

    if (!['VERIFIED', 'FAILED'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be VERIFIED or FAILED.' });
    }

    const record = await prisma.kycRecord.update({
      where: { id },
      data: {
        status: decision,
        failureReason: decision === 'FAILED' ? reason : null,
        verifiedAt: decision === 'VERIFIED' ? new Date() : null,
      },
      include: { user: true },
    });

    // Notify customer of manual KYC decision
    await sendKycResultEmail(record.user, decision, reason);
    await createNotification({
      userId: record.userId,
      type: decision === 'VERIFIED' ? 'KYC_VERIFIED' : 'KYC_FAILED',
      title: decision === 'VERIFIED' ? 'Identity Verified' : 'Identity Verification Failed',
      body: decision === 'VERIFIED'
        ? 'Your identity has been verified by an agent. Your ticket is being processed.'
        : `Your identity verification was rejected. ${reason ? `Reason: ${reason}` : 'Please contact support.'}`,
    });

    res.json({ message: `KYC ${decision.toLowerCase()}.`, record });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
