import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function clean() {
  console.log('Cleaning CRM and Finance data...');
  
  try {
    // Finance
    await prisma.financeVoucher.deleteMany({});
    await prisma.financeTransaction.deleteMany({});
    console.log('- Finance data deleted.');

    // CRM
    await prisma.invoice.deleteMany({});
    await prisma.quotation.deleteMany({});
    await prisma.lead.deleteMany({});
    console.log('- CRM data deleted.');

    console.log('Cleanup completed successfully.');
  } catch (error) {
    console.error('Error cleaning data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clean();
