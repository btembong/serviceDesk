const { PrismaClient } = require('@prisma/client');
const { generateTicketNumber } = require('../utils/ticketNumber');
const { sendTicketCreatedEmail, sendTicketStatusEmail, sendOutOfHoursEmail } = require('../services/emailService');
const { sendTicketCreatedSms, sendTicketStatusSms } = require('../services/smsService');
const { createNotification } = require('../services/notificationService');

const prisma = new PrismaClient();

const URGENT_CATEGORIES = ['TRANSACTION_ISSUE'];
const SLA_HOURS = { URGENT: 1, HIGH: 4, NORMAL: 24, LOW: 72 };

// Business hours: Mon–Fri 08:00–18:00 in Africa/Douala (WAT, UTC+1)
const isWithinBusinessHours = () => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Douala' }));
  const day = now.getDay(); // 0=Sun, 6=Sat
  const hour = now.getHours();
  return day >= 1 && day <= 5 && hour >= 8 && hour < 18;
};

// Categories that require account number + phone validation against reference_customers
const REFERENCE_VALIDATED_CATEGORIES = ['ACCOUNT_VERIFICATION', 'PIN_RESET'];

// Strip non-digits and take the last 9 characters for phone comparison
const normalisePhone = (phone) => (phone || '').replace(/\D/g, '').slice(-9);

// POST /tickets/create
const createTicket = async (req, res, next) => {
  try {
    const { category, subject, description, metadata } = req.body;
    const customerId = req.user.id;

    // ── Reference validation for account-sensitive categories ─────────────────
    if (REFERENCE_VALIDATED_CATEGORIES.includes(category)) {
      const { accountNumber, oldPhone, registeredPhone } = metadata || {};
      const submittedPhone = oldPhone || registeredPhone;

      if (!accountNumber) {
        return res.status(400).json({ error: 'Account number is required for this request type.' });
      }

      const ref = await prisma.referenceCustomer.findUnique({ where: { accountNumber } });

      if (!ref) {
        return res.status(400).json({
          error: `Account number ${accountNumber} was not found in our records. Please check the number and try again.`,
        });
      }

      // Confirm the account belongs to the logged-in user
      if ((ref.email || '').toLowerCase() !== (req.user.email || '').toLowerCase()) {
        return res.status(403).json({
          error: 'This account number is not linked to your profile. If you believe this is an error, please visit your branch.',
        });
      }

      // Verify phone matches the reference record
      if (submittedPhone && ref.phone) {
        const refPhone = normalisePhone(ref.phone);
        const inputPhone = normalisePhone(submittedPhone);
        if (refPhone && inputPhone && refPhone !== inputPhone) {
          return res.status(400).json({
            error: `The phone number you entered does not match the number registered against account ${accountNumber}. Please use your registered phone number.`,
          });
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const priority = URGENT_CATEGORIES.includes(category) ? 'URGENT' : 'NORMAL';
    const slaHours = SLA_HOURS[priority];
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: generateTicketNumber(),
        category,
        subject,
        description,
        priority,
        slaDeadline,
        customerId,
        metadata: metadata || {},
      },
      include: { customer: true },
    });

    if (isWithinBusinessHours()) {
      await sendTicketCreatedEmail(ticket.customer, ticket);
    } else {
      await sendOutOfHoursEmail(ticket.customer, ticket);
    }
    await sendTicketCreatedSms(ticket.customer, ticket);
    await createNotification({
      userId: customerId,
      type: 'TICKET_CREATED',
      title: 'Ticket Submitted',
      body: `Your ticket ${ticket.ticketNumber} has been received and is being reviewed.`,
      ticketId: ticket.id,
    });

    res.status(201).json({ message: 'Ticket created successfully.', ticket: sanitizeTicket(ticket) });
  } catch (err) {
    next(err);
  }
};

// GET /tickets/:id
const getTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        agent: { select: { id: true, firstName: true, lastName: true, email: true } },
        comments: {
          where: user.role === 'CUSTOMER' ? { isInternal: false } : {},
          include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
        kycRecord: user.role !== 'CUSTOMER',
      },
    });

    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    // Customers can only view their own tickets
    if (user.role === 'CUSTOMER' && ticket.customerId !== user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    res.json({ ticket: sanitizeTicket(ticket) });
  } catch (err) {
    next(err);
  }
};

// PATCH /tickets/:id
const updateTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, priority, agentId, priorityReason } = req.body;
    const user = req.user;

    const ticket = await prisma.ticket.findUnique({ where: { id }, include: { customer: true } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    const previousStatus = ticket.status;
    const updateData = {};

    if (status) updateData.status = status;
    if (status === 'RESOLVED') updateData.resolvedAt = new Date();

    if ((user.role === 'AGENT' || user.role === 'ADMIN') && priority) {
      if (['HIGH', 'URGENT'].includes(priority) && !priorityReason) {
        return res.status(400).json({ error: 'A reason is required when setting HIGH or URGENT priority.' });
      }
      updateData.priority = priority;
    }

    if (user.role === 'ADMIN' && agentId) updateData.agentId = agentId;

    const updated = await prisma.ticket.update({
      where: { id },
      data: updateData,
      include: { customer: true, agent: true },
    });

    if (status && status !== previousStatus) {
      await sendTicketStatusEmail(updated.customer, updated, previousStatus);
      await sendTicketStatusSms(updated.customer, updated);
      await createNotification({
        userId: updated.customerId,
        type: 'TICKET_UPDATED',
        title: 'Ticket Status Updated',
        body: `Your ticket ${updated.ticketNumber} status changed to ${status}.`,
        ticketId: updated.id,
      });
    }

    res.json({ message: 'Ticket updated.', ticket: sanitizeTicket(updated) });
  } catch (err) {
    next(err);
  }
};

// GET /tickets/user/:id
const getUserTickets = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (user.role === 'CUSTOMER' && user.id !== id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const { page = 1, limit = 10, status, category } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { customerId: id };
    if (status) where.status = status;
    if (category) where.category = category;

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: {
          agent: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    res.json({ tickets: tickets.map(sanitizeTicket), total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
};

// GET /tickets/admin
const getAdminTickets = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, category, priority, agentId, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (agentId) where.agentId = agentId;
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        skip,
        take: parseInt(limit),
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, email: true } },
          agent: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    res.json({ tickets: tickets.map(sanitizeTicket), total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
};

// POST /tickets/:id/reopen
const reopenTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    if (ticket.customerId !== user.id) return res.status(403).json({ error: 'Access denied.' });
    if (ticket.status !== 'RESOLVED') return res.status(400).json({ error: 'Only resolved tickets can be reopened.' });
    if (ticket.reopenCount >= 1) return res.status(400).json({ error: 'This ticket has already been reopened once.' });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (ticket.resolvedAt < sevenDaysAgo) {
      return res.status(400).json({ error: 'Tickets can only be reopened within 7 days of resolution.' });
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: { status: 'IN_REVIEW', reopenCount: { increment: 1 }, resolvedAt: null },
    });

    res.json({ message: 'Ticket reopened.', ticket: sanitizeTicket(updated) });
  } catch (err) {
    next(err);
  }
};

// POST /tickets/:id/merge
const mergeTickets = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { mergeIntoId } = req.body;

    if (id === mergeIntoId) return res.status(400).json({ error: 'Cannot merge a ticket into itself.' });

    const [source, target] = await Promise.all([
      prisma.ticket.findUnique({ where: { id } }),
      prisma.ticket.findUnique({ where: { id: mergeIntoId } }),
    ]);

    if (!source || !target) return res.status(404).json({ error: 'One or both tickets not found.' });

    await prisma.ticket.update({
      where: { id },
      data: { mergedIntoId: mergeIntoId, status: 'CLOSED' },
    });

    res.json({ message: `Ticket ${source.ticketNumber} merged into ${target.ticketNumber}.` });
  } catch (err) {
    next(err);
  }
};

// POST /tickets/:id/claim (agent claims ticket from queue)
const claimTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const agentId = req.user.id;

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
    if (ticket.agentId) return res.status(409).json({ error: 'This ticket has already been claimed.' });

    const updated = await prisma.ticket.update({
      where: { id },
      data: { agentId, status: 'IN_REVIEW' },
    });

    res.json({ message: 'Ticket claimed.', ticket: sanitizeTicket(updated) });
  } catch (err) {
    next(err);
  }
};

// POST /tickets/:id/comment
const addComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { body, isInternal } = req.body;
    const user = req.user;

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    if (user.role === 'CUSTOMER' && ticket.customerId !== user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: id,
        authorId: user.id,
        body,
        isInternal: user.role === 'CUSTOMER' ? false : Boolean(isInternal),
      },
      include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });

    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
};

const sanitizeTicket = (ticket) => ticket;

module.exports = { createTicket, getTicket, updateTicket, getUserTickets, getAdminTickets, reopenTicket, mergeTickets, claimTicket, addComment };
