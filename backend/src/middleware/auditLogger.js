const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const LOGGED_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];

const auditLogger = async (req, res, next) => {
  if (!LOGGED_METHODS.includes(req.method)) return next();

  const originalJson = res.json.bind(res);

  res.json = async (body) => {
    if (res.statusCode < 400 && req.user) {
      try {
        const entity = deriveEntity(req.path);
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: `${req.method} ${req.path}`,
            entityType: entity.type,
            entityId: entity.id(req, body),
            description: entity.description(req),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || null,
          },
        });
      } catch (err) {
        console.error('[AuditLog] Failed to write audit log:', err.message);
      }
    }
    return originalJson(body);
  };

  next();
};

function deriveEntity(path) {
  if (path.startsWith('/tickets')) return {
    type: 'ticket',
    id: (req, body) => req.params.id || body?.id || null,
    description: (req) => `Ticket action: ${req.method} ${req.path}`,
  };
  if (path.startsWith('/kyc')) return {
    type: 'kyc',
    id: (req, body) => req.params.ticketId || body?.ticketId || null,
    description: (req) => `KYC action: ${req.method} ${req.path}`,
  };
  if (path.startsWith('/auth')) return {
    type: 'auth',
    id: (req, body) => body?.userId || null,
    description: (req) => `Auth action: ${req.path}`,
  };
  return {
    type: 'system',
    id: () => null,
    description: (req) => `${req.method} ${req.path}`,
  };
}

module.exports = { auditLogger };
