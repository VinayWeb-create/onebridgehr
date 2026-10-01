import { Request } from 'express';
import { prisma } from '../config/db';
import { logActivity } from '../middleware/auditLogger';
import { emailService } from './emailService';
import { BankAccount, CompanyProfile, listBankAccounts } from './billingCompanyService';
import { escapeHtml } from './billingFormat';

export const BANK_AUDIT_ACTION = 'BILLING_BANK_DETAILS_CHANGED';

/** Account numbers are never written to the audit log or alert emails in full. */
export const maskAccount = (n?: string | null) => (n ? `••••${n.slice(-4)}` : '—');

const describe = (a: BankAccount) =>
  `${a.label ? `${a.label}: ` : ''}${a.bankName || 'Bank'} ${maskAccount(a.accountNumber)}${a.ifsc ? ` (IFSC ${a.ifsc})` : ''}`;

const FIELDS: [keyof BankAccount, string][] = [
  ['accountNumber', 'account number'],
  ['ifsc', 'IFSC'],
  ['bankName', 'bank'],
  ['accountName', 'account holder'],
  ['branch', 'branch'],
  ['swift', 'SWIFT'],
];

const show = (key: keyof BankAccount, v: unknown) => (key === 'accountNumber' ? maskAccount(v as string) : (v as string) || '—');

/** Human-readable list of bank/UPI changes between two versions of a company. */
export const diffBankDetails = (before: CompanyProfile | null, after: CompanyProfile | null): string[] => {
  const prev = before ? listBankAccounts(before) : [];
  const next = after ? listBankAccounts(after) : [];
  const changes: string[] = [];

  for (const a of next) {
    const old = prev.find((p) => p.id === a.id);
    if (!old) {
      changes.push(`Added ${describe(a)}${a.isDefault ? ' as default' : ''}`);
      continue;
    }
    const fieldChanges = FIELDS.filter(([k]) => (old[k] || '') !== (a[k] || '')).map(
      ([k, label]) => `${label} ${show(k, old[k])} → ${show(k, a[k])}`
    );
    if (fieldChanges.length) changes.push(`Changed ${describe(old)}: ${fieldChanges.join(', ')}`);
    if (!old.isDefault && a.isDefault) changes.push(`Default account is now ${describe(a)}`);
  }
  for (const p of prev) {
    if (!next.some((a) => a.id === p.id)) changes.push(`Removed ${describe(p)}`);
  }

  const oldUpi = before?.upiId || null;
  const newUpi = after?.upiId || null;
  if (oldUpi !== newUpi) changes.push(`UPI ID ${oldUpi || '—'} → ${newUpi || '—'}`);
  return changes;
};


/**
 * Write an audit entry and email every super admin. Never throws: a failed alert must not block the save,
 * but it is logged so it can be noticed.
 */
export const recordBankChanges = async (req: Request, companyId: string, companyName: string, changes: string[]) => {
  if (!changes.length) return;
  const actor = req.user?.email || 'unknown user';
  const at = new Date();

  try {
    logActivity(
      req.user?.employeeId || null,
      BANK_AUDIT_ACTION,
      JSON.stringify({ companyId, companyName, changedBy: actor, changes }),
      req
    );
  } catch (err) {
    console.error('[Billing] Could not write bank-change audit entry:', err);
  }

  // Alerts are sent in the background so a slow or blocked mail server never delays the save.
  void sendBankChangeAlerts(req, companyName, changes, actor, at);
};

const sendBankChangeAlerts = async (req: Request, companyName: string, changes: string[], actor: string, at: Date) => {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'SUPER_ADMIN' }, select: { email: true } });
    const recipients = [...new Set([...admins.map((a) => a.email), process.env.ADMIN_NOTIFY_EMAIL].filter(Boolean) as string[])];
    const when = at.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;color:#334155;line-height:1.6;">
        <h2 style="color:#b91c1c;margin:0 0 12px 0;">Bank details changed</h2>
        <p>The payment details for <strong>${escapeHtml(companyName)}</strong> were changed in the CRM.
        These appear on quotations and invoices sent to clients.</p>
        <table style="font-size:14px;margin:12px 0;">
          <tr><td style="color:#64748b;padding-right:12px;">Changed by</td><td><strong>${escapeHtml(actor)}</strong></td></tr>
          <tr><td style="color:#64748b;padding-right:12px;">When</td><td>${escapeHtml(when)} IST</td></tr>
          <tr><td style="color:#64748b;padding-right:12px;">IP address</td><td>${escapeHtml(ip)}</td></tr>
        </table>
        <ul>${changes.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
        <p style="background:#fef2f2;border:1px solid #fecaca;padding:10px 12px;border-radius:6px;">
          If you did not expect this change, check <strong>CRM → Billing Settings</strong> immediately and correct it
          before any invoice is sent.
        </p>
      </div>`;
    for (const to of recipients) {
      await emailService
        .sendMail(to, `Alert: bank details changed for ${companyName}`, html, [], { fromName: 'OneBridge CRM Security' })
        .catch((err: any) => console.error(`[Billing] Bank-change alert to ${to} failed:`, err?.message || err));
    }
  } catch (err) {
    console.error('[Billing] Could not send bank-change alerts:', err);
  }
};

/** Bank-change history for one company, newest first. */
export const getBankChangeHistory = async (companyId: string) => {
  const rows = await prisma.auditLog.findMany({
    where: { action: BANK_AUDIT_ACTION, details: { contains: `"companyId":"${companyId}"` } },
    orderBy: { timestamp: 'desc' },
    take: 100,
  });
  return rows.map((r) => {
    let parsed: { changedBy?: string; changes?: string[] } = {};
    try {
      parsed = JSON.parse(r.details);
    } catch {
      /* older/malformed entry */
    }
    return { id: r.id, at: r.timestamp, changedBy: parsed.changedBy || 'unknown', changes: parsed.changes || [], ipAddress: r.ipAddress };
  });
};
