require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const kycRoutes = require('./routes/kyc');
const pinRoutes = require('./routes/pin');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');

const { errorHandler } = require('./middleware/errorHandler');
const { auditLogger } = require('./middleware/auditLogger');
const { globalRateLimiter } = require('./middleware/rateLimiter');
const { startSlaChecker } = require('./jobs/slaChecker');

const app = express();
const PORT = process.env.PORT || 5000;

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Global rate limiter
app.use(globalRateLimiter);

// Audit logging on all state-changing requests
app.use(auditLogger);

// Routes
app.use('/auth', authRoutes);
app.use('/tickets', ticketRoutes);
app.use('/kyc', kycRoutes);
app.use('/pin', pinRoutes);
app.use('/notifications', notificationRoutes);
app.use('/admin', adminRoutes);
app.use('/user', userRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'UBFinance ServiceDesk API', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`UBFinance ServiceDesk API running on port ${PORT}`);
  startSlaChecker();
});

module.exports = app;
