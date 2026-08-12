import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

// Increase the interactive transaction timeout to 30 s (default is 5 s).
// The /employees list endpoint calculates per-employee ratings which issue
// multiple DB queries and can exceed the 5 s budget on larger data sets.
export const prisma =
  global.prisma ||
  new PrismaClient({
    transactionOptions: {
      timeout: 30_000, // ms
      maxWait: 10_000, // ms
    },
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
