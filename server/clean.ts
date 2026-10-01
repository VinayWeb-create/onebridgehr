import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function clean() {
  console.log('Cleaning CRM, Finance, and Accounts data...');
  
  try {
    // 1. CRM - Autonomous AI / Followup / Logs
    await prisma.autonomousFollowupTask.deleteMany({});
    await prisma.aiDiscoveryDocument.deleteMany({});
    await prisma.aiNegotiationLog.deleteMany({});
    await prisma.aiDecisionLog.deleteMany({});
    await prisma.communicationLog.deleteMany({});

    // 2. CRM - Core
    await prisma.invoice.deleteMany({});
    await prisma.quotation.deleteMany({});
    await prisma.lead.deleteMany({});

    // 3. Finance & Accounts
    await prisma.financeVoucher.deleteMany({});
    await prisma.financeTransaction.deleteMany({});
    await prisma.parsedStatementLog.deleteMany({});
    await prisma.financeLedger.deleteMany({});

    console.log('Cleanup completed successfully. All CRM, Finance, and Accounts data removed.');
  } catch (error) {
    console.error('Error cleaning data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clean();

