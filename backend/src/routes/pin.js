const express = require('express');
const { body } = require('express-validator');
const crypto = require('crypto');
const router = express.Router();

const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/authenticate');
const { otpRateLimiter } = require('../middleware/rateLimiter');
const { validateRequest } = require('../middleware/validateRequest');
const { sendOtpEmail } = require('../services/emailService');

const prisma = new PrismaClient();

// POST /pin/reset — step 1: request OTP
router.post('/reset',
  authenticate,
  authorize('CUSTOMER'),
  otpRateLimiter,
  async (req, res, next) => {
    try {
      const user = req.user;

      // Generate 6-digit OTP
      const otp = crypto.randomInt(100000, 999999).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Invalidate old OTPs for this user + action
      await prisma.otpCode.updateMany({
        where: { userId: user.id, action: 'PIN_RESET', used: false },
        data: { used: true },
      });

      await prisma.otpCode.create({
        data: { userId: user.id, code: otp, action: 'PIN_RESET', expiresAt },
      });

      await sendOtpEmail(user, otp, 'PIN Reset');

      res.json({ message: 'OTP sent to your registered email address. It expires in 5 minutes.' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /pin/verify-otp — step 2: verify OTP
router.post('/verify-otp',
  authenticate,
  authorize('CUSTOMER'),
  [
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit OTP required'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { otp } = req.body;
      const userId = req.user.id;

      const record = await prisma.otpCode.findFirst({
        where: { userId, code: otp, action: 'PIN_RESET', used: false },
        orderBy: { createdAt: 'desc' },
      });

      if (!record || record.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Invalid or expired OTP.' });
      }

      await prisma.otpCode.update({ where: { id: record.id }, data: { used: true } });

      res.json({ message: 'OTP verified. Proceed with your PIN reset.', verified: true });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
