const rateLimit = require('express-rate-limit');

const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
  skipSuccessfulRequests: true,
});

const otpRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests. Please wait 10 minutes and try again.' },
});

const ticketCreateRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Daily ticket limit reached. You can submit up to 10 tickets per day.' },
  keyGenerator: (req) => req.user?.id || req.ip,
});

const kycUploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Maximum KYC upload attempts reached for this session.' },
  keyGenerator: (req) => `${req.user?.id}-${req.params.ticketId}`,
});

module.exports = {
  globalRateLimiter,
  loginRateLimiter,
  otpRateLimiter,
  ticketCreateRateLimiter,
  kycUploadRateLimiter,
};
