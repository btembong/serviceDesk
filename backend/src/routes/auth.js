const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  checkFlow, sendLoginOtp, verifyLoginOtp, setPassword,
  login, refreshToken, forgotPassword, resetPassword, logout,
} = require('../controllers/authController');

const { loginRateLimiter, otpRateLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/authenticate');
const { validateRequest } = require('../middleware/validateRequest');

// Determine OTP vs password flow
router.post('/check-flow',
  loginRateLimiter,
  [body('identifier').trim().notEmpty().withMessage('Email or phone required')],
  validateRequest,
  checkFlow
);

// Send login OTP (customers only)
router.post('/send-otp',
  otpRateLimiter,
  [body('identifier').trim().notEmpty().withMessage('Email or phone required')],
  validateRequest,
  sendLoginOtp
);

// Verify login OTP
router.post('/verify-otp',
  [
    body('identifier').trim().notEmpty().withMessage('Email or phone required'),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit code required'),
  ],
  validateRequest,
  verifyLoginOtp
);

// First-time password setup
router.post('/set-password',
  [
    body('setupToken').notEmpty().withMessage('Setup token required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('gdprConsent').equals('true').withMessage('You must accept the terms'),
  ],
  validateRequest,
  setPassword
);

// Password login (staff + returning customers)
router.post('/login',
  loginRateLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validateRequest,
  login
);

router.post('/refresh-token',
  [body('refreshToken').notEmpty().withMessage('Refresh token required')],
  validateRequest,
  refreshToken
);

router.post('/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  validateRequest,
  forgotPassword
);

router.post('/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validateRequest,
  resetPassword
);

router.post('/logout', authenticate, logout);

module.exports = router;
