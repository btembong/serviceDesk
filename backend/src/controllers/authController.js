const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { sendPasswordResetEmail, sendOtpEmail } = require('../services/emailService');
const { sendOtpSms } = require('../services/smsService');
const { blacklistToken } = require('../services/redisService');

const prisma = new PrismaClient();

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;

// ─── Helper: find reference customer by email or phone ────────────────────────
const findReference = async (identifier) => {
  const isEmail = identifier.includes('@');
  return prisma.referenceCustomer.findFirst({
    where: isEmail
      ? { email: identifier.toLowerCase() }
      : { phone: identifier },
  });
};

// ─── Helper: normalise identifier ─────────────────────────────────────────────
const normaliseIdentifier = (identifier) => identifier.trim().toLowerCase();

// POST /auth/check-flow
// Determines whether the identifier should go through OTP (customer) or password (staff)
const checkFlow = async (req, res, next) => {
  try {
    const identifier = normaliseIdentifier(req.body.identifier || '');
    if (!identifier) return res.status(400).json({ error: 'Email or phone number required.' });

    // 1. Check reference_customers → bank customer
    const ref = await findReference(identifier);
    if (ref) {
      // Check if they already have a portal account with a password set
      const isEmail = identifier.includes('@');
      const existing = await prisma.user.findFirst({
        where: isEmail ? { email: identifier } : { phone: identifier },
      });

      if (existing && existing.password) {
        return res.json({ flow: 'password', name: existing.firstName });
      }
      // No account yet, or account with no password → OTP
      return res.json({ flow: 'otp', name: ref.firstName });
    }

    // 2. Not a bank customer — check for staff account (AGENT/ADMIN)
    const isEmail = identifier.includes('@');
    const staffUser = await prisma.user.findFirst({
      where: isEmail
        ? { email: identifier, role: { in: ['AGENT', 'ADMIN'] } }
        : { phone: identifier, role: { in: ['AGENT', 'ADMIN'] } },
    });

    if (staffUser) {
      return res.json({ flow: 'password', name: staffUser.firstName });
    }

    return res.status(404).json({ error: 'No account found. Please contact your branch.' });
  } catch (err) {
    next(err);
  }
};

// POST /auth/send-otp
// Sends login OTP to a verified bank customer
const sendLoginOtp = async (req, res, next) => {
  try {
    const identifier = normaliseIdentifier(req.body.identifier || '');
    if (!identifier) return res.status(400).json({ error: 'Email or phone number required.' });

    const ref = await findReference(identifier);
    if (!ref) return res.status(404).json({ error: 'No account found.' });

    if (!ref.email) return res.status(400).json({ error: 'No email address on file. Please contact your branch.' });

    // Invalidate previous login OTPs
    await prisma.otpCode.updateMany({
      where: { action: 'LOGIN', used: false,
        user: { OR: [{ email: ref.email }, { phone: ref.phone || undefined }] },
      },
      data: { used: true },
    });

    // Generate OTP — store against email regardless of how they identified
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Find or create a placeholder user to attach OTP to
    let user = await prisma.user.findFirst({ where: { email: ref.email } });
    if (!user) {
      // Create account shell — no password yet
      user = await prisma.user.create({
        data: {
          email: ref.email,
          firstName: ref.firstName,
          lastName: ref.lastName,
          phone: ref.phone || null,
          accountNumber: ref.accountNumber || null,
          password: null,
          gdprConsent: false,
        },
      });
    }

    await prisma.otpCode.create({
      data: { userId: user.id, code: otp, action: 'LOGIN', expiresAt },
    });

    await sendOtpEmail(user, otp, 'Login Verification');
    await sendOtpSms(user, otp);

    // Mask email for display
    const [localPart, domain] = ref.email.split('@');
    const masked = `${localPart.slice(0, 2)}****@${domain}`;

    res.json({ message: `Verification code sent to ${masked}. It expires in 5 minutes.`, email: masked });
  } catch (err) {
    next(err);
  }
};

// POST /auth/verify-login-otp
// Verifies OTP — returns setupToken if first-time, JWT if returning
const verifyLoginOtp = async (req, res, next) => {
  try {
    const identifier = normaliseIdentifier(req.body.identifier || '');
    const { otp } = req.body;

    if (!identifier || !otp) return res.status(400).json({ error: 'Identifier and OTP required.' });

    const ref = await findReference(identifier);
    if (!ref || !ref.email) return res.status(404).json({ error: 'No account found.' });

    const user = await prisma.user.findFirst({ where: { email: ref.email } });
    if (!user) return res.status(404).json({ error: 'No account found.' });

    const record = await prisma.otpCode.findFirst({
      where: { userId: user.id, code: otp, action: 'LOGIN', used: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    await prisma.otpCode.update({ where: { id: record.id }, data: { used: true } });

    // First time — no password set yet
    if (!user.password) {
      const setupToken = jwt.sign(
        { userId: user.id, purpose: 'set-password' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      return res.json({ status: 'set-password', setupToken, name: user.firstName });
    }

    // Returning customer — log them in
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    res.json({ status: 'ok', accessToken, refreshToken, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
};

// POST /auth/set-password
// First-time customers set their password after OTP verification
const setPassword = async (req, res, next) => {
  try {
    const { setupToken, password, gdprConsent } = req.body;

    if (!setupToken) return res.status(400).json({ error: 'Setup token required.' });
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (!gdprConsent) return res.status(400).json({ error: 'You must accept the privacy policy to continue.' });

    let decoded;
    try {
      decoded = jwt.verify(setupToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ error: 'Setup link has expired. Please start again.' });
    }

    if (decoded.purpose !== 'set-password') {
      return res.status(400).json({ error: 'Invalid setup token.' });
    }

    const hashed = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        password: hashed,
        gdprConsent: true,
        gdprConsentAt: new Date(),
        gdprConsentIp: req.ip,
      },
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      message: 'Account activated successfully.',
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

// POST /auth/login — password-based login (staff + returning customers)
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) return res.status(401).json({ error: 'Invalid email or password.' });

    if (!user.isActive) return res.status(403).json({ error: 'Your account has been deactivated. Please contact support.' });

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil - new Date()) / 60000);
      return res.status(403).json({ error: `Account locked. Try again in ${minutesLeft} minute(s).` });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      const newCount = user.failedLoginCount + 1;
      const updateData = { failedLoginCount: newCount };
      if (newCount >= LOCK_THRESHOLD) {
        updateData.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
        updateData.failedLoginCount = 0;
      }
      await prisma.user.update({ where: { id: user.id }, data: updateData });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({ accessToken, refreshToken, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
};

// POST /auth/refresh-token
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return res.status(400).json({ error: 'Refresh token required.' });

    const decoded = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid token.' });

    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired refresh token.' });
    }
    next(err);
  }
};

// POST /auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });

    const resetLink = `${process.env.FRONTEND_URL}/auth/reset-password?token=${token}`;
    await sendPasswordResetEmail(user, resetLink);

    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

// POST /auth/reset-password
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const record = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!record || record.used || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    }

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: record.userId }, data: { password: hashed } });
    await prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } });

    res.json({ message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    next(err);
  }
};

// POST /auth/logout
const logout = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) await blacklistToken(token, decoded.exp);
    } catch {}
  }
  res.json({ message: 'Logged out successfully.' });
};

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
  role: user.role,
  accountNumber: user.accountNumber,
  notifyEmail: user.notifyEmail,
  notifySms: user.notifySms,
  createdAt: user.createdAt,
});

module.exports = {
  checkFlow, sendLoginOtp, verifyLoginOtp, setPassword,
  login, refreshToken, forgotPassword, resetPassword, logout,
};
