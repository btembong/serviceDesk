const { PrismaClient } = require('@prisma/client');
const { createNotification } = require('../services/notificationService');

const prisma = new PrismaClient();

// Runs every 5 minutes — finds tickets whose SLA deadline has passed and are not yet escalated/resolved
const checkSlaBreaches = async () => {
  try {
    const breached = await prisma.ticket.findMany({
      where: {
        slaDeadline: { lt: new Date() },
        status: { in: ['OPEN', 'IN_REVIEW'] },
        slaBreach: false,
      },
      include: {
        agent: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (breached.length === 0) return;

    for (const ticket of breached) {
      // Mark as breached + escalate
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          slaBreach: true,
          status: 'ESCALATED',
        },
      });

      // Notify assigned agent if any
      if (ticket.agentId) {
        await createNotification({
          userId: ticket.agentId,
          type: 'SLA_BREACH',
          title: 'SLA Breached',
          body: `Ticket ${ticket.ticketNumber} has breached its SLA deadline and has been escalated.`,
          ticketId: ticket.id,
        });
      }

      // Notify all admins
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true },
      });

      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          type: 'SLA_BREACH',
          title: 'SLA Breach — Action Required',
          body: `Ticket ${ticket.ticketNumber} has breached its SLA and been auto-escalated.`,
          ticketId: ticket.id,
        });
      }

      console.log(`[SLA] Ticket ${ticket.ticketNumber} breached SLA — escalated.`);
    }
  } catch (err) {
    console.error('[SLA] Checker error:', err.message);
  }
};

const startSlaChecker = () => {
  // Run immediately on startup, then every 5 minutes
  checkSlaBreaches();
  setInterval(checkSlaBreaches, 5 * 60 * 1000);
  console.log('[SLA] Breach checker started (interval: 5 min)');
};

module.exports = { startSlaChecker };
