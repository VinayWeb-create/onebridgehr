require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const o = await prisma.onboarding.update({
    where: { token: '8a509f1463c0f88114268ee4f2e5c213530a401076bf3f6874bbdfcb41186661' },
    data: { status: 'OFFER_SENT' },
    select: { id: true, status: true, updatedAt: true },
  });
  console.log('status ->', o.status);
  await prisma.$disconnect();
})();
