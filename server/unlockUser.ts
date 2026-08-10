import { prisma } from './src/config/db'; 
import * as dotenv from 'dotenv';
dotenv.config();

async function unlock() { 
  await prisma.user.updateMany({ 
    where: { employeeId: 'OBI0006' }, 
    data: { failedLoginAttempts: 0, lockedUntil: null } 
  }); 
  console.log('User OBI0006 unlocked'); 
} 
unlock().catch(console.error).finally(() => prisma.$disconnect());
