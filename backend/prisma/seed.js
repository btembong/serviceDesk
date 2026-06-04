require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const adminPassword = await bcrypt.hash('Admin@123!', 12);
  const agentPassword = await bcrypt.hash('Agent@123!', 12);
  const customerPassword = await bcrypt.hash('Customer@123!', 12);

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ubfinance.com' },
    update: {},
    create: {
      email: 'admin@ubfinance.com',
      password: adminPassword,
      firstName: 'System',
      lastName: 'Admin',
      role: 'ADMIN',
      gdprConsent: true,
      gdprConsentAt: new Date(),
    },
  });

  // Agent
  const agent = await prisma.user.upsert({
    where: { email: 'agent@ubfinance.com' },
    update: {},
    create: {
      email: 'agent@ubfinance.com',
      password: agentPassword,
      firstName: 'Support',
      lastName: 'Agent',
      role: 'AGENT',
      gdprConsent: true,
      gdprConsentAt: new Date(),
    },
  });

  // Demo customer
  const customer = await prisma.user.upsert({
    where: { email: 'customer@demo.com' },
    update: {},
    create: {
      email: 'customer@demo.com',
      password: customerPassword,
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'CUSTOMER',
      accountNumber: '1234567890',
      phone: '+2348012345678',
      gdprConsent: true,
      gdprConsentAt: new Date(),
    },
  });

  console.log('Seed complete.');
  console.log('Admin:', admin.email, '| Password: Admin@123!');
  console.log('Agent:', agent.email, '| Password: Agent@123!');
  console.log('Customer:', customer.email, '| Password: Customer@123!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
