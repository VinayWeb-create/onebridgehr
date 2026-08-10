require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const o = await prisma.onboarding.findUnique({
    where: { token: '8a509f1463c0f88114268ee4f2e5c213530a401076bf3f6874bbdfcb41186661' },
    select: { id: true, status: true, candidateId: true, updatedAt: true },
  });
  console.log(JSON.stringify(o, null, 2));
  await prisma.$disconnect();
})();
