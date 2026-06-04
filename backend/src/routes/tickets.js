const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const {
  createTicket, getTicket, updateTicket, getUserTickets,
  getAdminTickets, reopenTicket, mergeTickets, claimTicket, addComment,
} = require('../controllers/ticketController');
const { authenticate, authorize } = require('../middleware/authenticate');
const { ticketCreateRateLimiter } = require('../middleware/rateLimiter');
const { validateRequest } = require('../middleware/validateRequest');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /tickets/validate-account?accountNumber=xxx
// Real-time account number check — returns name if valid and belongs to logged-in user
router.get('/validate-account',
  authenticate,
  authorize('CUSTOMER'),
  async (req, res) => {
    const { accountNumber } = req.query;
    if (!accountNumber) return res.json({ valid: false, error: 'Account number is required.' });

    const ref = await prisma.referenceCustomer.findUnique({ where: { accountNumber: String(accountNumber) } });
    if (!ref) return res.json({ valid: false, error: 'Account number not found in our records.' });

    if ((ref.email || '').toLowerCase() !== (req.user.email || '').toLowerCase()) {
      return res.json({ valid: false, error: 'This account is not linked to your profile.' });
    }

    return res.json({ valid: true, name: `${ref.firstName} ${ref.lastName}` });
  }
);

router.post('/create',
  authenticate,
  authorize('CUSTOMER'),
  ticketCreateRateLimiter,
  [
    body('category').isIn([
      'ACCOUNT_VERIFICATION','PIN_RESET','TRANSACTION_ISSUE',
      'CARD_SERVICES','LOAN_CREDIT','DIGITAL_BANKING','INFO_UPDATE','COMPLAINT_FEEDBACK'
    ]).withMessage('Invalid ticket category'),
    body('subject').trim().isLength({ min: 5, max: 200 }).withMessage('Subject must be 5–200 characters'),
    body('description').trim().isLength({ min: 10, max: 2000 }).withMessage('Description must be 10–2000 characters'),
  ],
  validateRequest,
  createTicket
);

router.get('/admin',
  authenticate,
  authorize('AGENT', 'ADMIN'),
  getAdminTickets
);

router.get('/user/:id',
  authenticate,
  getUserTickets
);

router.get('/:id',
  authenticate,
  getTicket
);

router.patch('/:id',
  authenticate,
  authorize('AGENT', 'ADMIN'),
  [
    body('status').optional().isIn(['OPEN','IN_REVIEW','ESCALATED','RESOLVED','REJECTED','CLOSED']),
    body('priority').optional().isIn(['LOW','NORMAL','HIGH','URGENT']),
  ],
  validateRequest,
  updateTicket
);

router.post('/:id/claim',
  authenticate,
  authorize('AGENT', 'ADMIN'),
  claimTicket
);

router.post('/:id/reopen',
  authenticate,
  authorize('CUSTOMER'),
  reopenTicket
);

router.post('/:id/merge',
  authenticate,
  authorize('AGENT', 'ADMIN'),
  [body('mergeIntoId').notEmpty().withMessage('Target ticket ID required')],
  validateRequest,
  mergeTickets
);

router.post('/:id/comment',
  authenticate,
  [body('body').trim().isLength({ min: 1, max: 2000 }).withMessage('Comment cannot be empty')],
  validateRequest,
  addComment
);

module.exports = router;
