import jwt from 'jsonwebtoken';

/**
 * Narrow, short-lived tokens embedded in push payloads so the service worker
 * can "Mark complete" / "Snooze" straight from the OS notification without
 * having access to the user's session token. A token is bound to one reminder,
 * one task and one employee, and can only perform planner reminder actions.
 */

const SCOPE = 'planner-reminder-action';
const TTL_SECONDS = 60 * 60 * 72; // 3 days

function secret(): string {
  return `${process.env.JWT_SECRET || 'onebridge_secret_key_123456_super_secure'}::planner-actions`;
}

export interface ActionTokenClaims {
  reminderId: string;
  taskId: string | null;
  employeeId: string;
}

export function signActionToken(claims: ActionTokenClaims): string {
  return jwt.sign({ ...claims, scope: SCOPE }, secret(), { expiresIn: TTL_SECONDS });
}

export function verifyActionToken(token: string): ActionTokenClaims {
  const decoded = jwt.verify(token, secret()) as ActionTokenClaims & { scope?: string };
  if (decoded.scope !== SCOPE || !decoded.reminderId || !decoded.employeeId) {
    throw new Error('Invalid action token');
  }
  return { reminderId: decoded.reminderId, taskId: decoded.taskId ?? null, employeeId: decoded.employeeId };
}
