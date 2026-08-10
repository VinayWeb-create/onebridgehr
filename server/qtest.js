const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const onboardings = await prisma.onboarding.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      token: true,
      candidateId: true,
      status: true,
      tokenExpiresAt: true,
      offerLetter: { select: { candidateName: true, candidateEmail: true } },
    },
  });
  for (const o of onboardings) {
    console.log(JSON.stringify(o));
  }
  await prisma.$disconnect();
}
run();
