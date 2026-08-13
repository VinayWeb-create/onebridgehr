import { Request } from 'express';
import { prisma } from '../config/db';

export const logActivity = async (
  employeeId: string | null,
  action: string,
  details: string,
  req?: Request
) => {
  const ipAddress = req ? req.ip || req.socket.remoteAddress : undefined;
  const userAgent = req ? req.headers['user-agent'] : undefined;

  // Run database creation in the background (fire-and-forget) to keep request processing fast
  prisma.auditLog.create({
    data: {
      employeeId,
      action,
      details,
      ipAddress,
      userAgent,
    },
  }).then(() => {
    console.log(`[AUDIT LOG] Action: ${action} | Employee: ${employeeId} | ${details}`);
  }).catch((error) => {
    console.error('Audit Log failed to record:', error);
  });
};
