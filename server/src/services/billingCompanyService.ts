import crypto from 'crypto';
import type { BillingCompany } from '@prisma/client';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';

export type CompanyProfile = Omit<BillingCompany, 'id' | 'createdAt' | 'updatedAt'> & { id: string | null };

// Used on documents until Billing Settings are saved — matches what the PDFs printed before settings existed.
export const FALLBACK_COMPANY: CompanyProfile = {
  id: null,
  name: 'Onebridge Infotech Pvt Ltd',
  gstin: '36AAGCG6536J2ZA',
  pan: 'AAGCG6536J',
  email: 'info@onebridgeinfotech.com',
  phone: '+91 40 4006 1641',
  website: null,
  addressLine1: 'Satyabhama complex, 202, Bhagya Nagar Colony',
  addressLine2: 'KPHB',
  city: 'Hyderabad',
  state: 'Telangana',
  stateCode: '36',
  pincode: '500072',
  country: 'India',
  logoDataUrl: null,
  signatureDataUrl: null,
  stampDataUrl: null,
  bankAccountName: 'Onebridge Infotech Private Limited',
  bankName: 'Federal Bank',
  bankAccountNumber: '15690200004936',
  bankIfsc: 'FDRL0001569',
  bankBranch: null,
  bankSwift: 'FDRLINBBIBD',
  upiId: null,
  quotationTerms: null,
  invoiceTerms: null,
  defaultNotes: null,
  bankAccounts: null,
  emailCc: null,
  isDefault: true,
  isActive: true,
};

export interface BankAccount {
  id: string;
  label: string | null;
  accountName: string | null;
  bankName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  branch: string | null;
  swift: string | null;
  isDefault: boolean;
}

/** Value of a document's bankAccountId that hides bank details on it. */
export const NO_BANK = 'NONE';

/** A company's bank accounts. Companies saved before multi-account support expose their single flat account. */
export const listBankAccounts = (company: CompanyProfile): BankAccount[] => {
  const stored = Array.isArray(company.bankAccounts) ? (company.bankAccounts as unknown as BankAccount[]) : [];
  if (stored.length) return stored;
  if (!company.bankAccountNumber && !company.bankName) return [];
  return [
    {
      id: 'primary',
      label: null,
      accountName: company.bankAccountName,
      bankName: company.bankName,
      accountNumber: company.bankAccountNumber,
      ifsc: company.bankIfsc,
      branch: company.bankBranch,
      swift: company.bankSwift,
      isDefault: true,
    },
  ];
};

/** Bank account to print on a document: the chosen one, else the company default; null hides bank details. */
export const resolveBankAccount = (company: CompanyProfile, bankAccountId?: string | null): BankAccount | null => {
  if (bankAccountId === NO_BANK) return null;
  const accounts = listBankAccounts(company);
  return accounts.find((a) => a.id === bankAccountId) || accounts.find((a) => a.isDefault) || accounts[0] || null;
};

/**
 * Give every account an id, make exactly one the default, and return the flat bank* fields
 * mirroring that default (so anything reading the flat fields stays correct).
 */
export const normalizeBankAccounts = (input: (Omit<Partial<BankAccount>, 'id'> & { id?: string | null })[] | undefined | null) => {
  const accounts: BankAccount[] = (input || [])
    .filter((a) => a && (a.accountNumber || a.bankName))
    .map((a) => ({
      id: a.id || crypto.randomUUID(), // keeps 'primary' so documents already pointing at it still match
      label: a.label || null,
      accountName: a.accountName || null,
      bankName: a.bankName || null,
      accountNumber: a.accountNumber || null,
      ifsc: a.ifsc || null,
      branch: a.branch || null,
      swift: a.swift || null,
      isDefault: !!a.isDefault,
    }));
  const defaultIdx = Math.max(0, accounts.findIndex((a) => a.isDefault));
  accounts.forEach((a, i) => (a.isDefault = i === defaultIdx));
  const d = accounts[defaultIdx];
  return {
    bankAccounts: accounts as any,
    bankAccountName: d?.accountName ?? null,
    bankName: d?.bankName ?? null,
    bankAccountNumber: d?.accountNumber ?? null,
    bankIfsc: d?.ifsc ?? null,
    bankBranch: d?.branch ?? null,
    bankSwift: d?.swift ?? null,
  };
};

export class BillingCompanyService {
  /** Company printed on a document: its own, else the default, else the built-in fallback. */
  public static async getForDocument(companyId?: string | null): Promise<CompanyProfile> {
    const company =
      (companyId ? await prisma.billingCompany.findUnique({ where: { id: companyId } }).catch(() => null) : null) ||
      (await this.getDefault());
    return company || FALLBACK_COMPANY;
  }

  public static async getDefault() {
    return (
      (await prisma.billingCompany.findFirst({ where: { isDefault: true, isActive: true } })) ||
      (await prisma.billingCompany.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }))
    );
  }

  /**
   * Company to stamp on a new/updated document: the requested one if valid,
   * otherwise the default. Returns null when no company has been set up yet,
   * so documents keep working before Billing Settings are filled in.
   */
  public static async resolveCompanyId(requestedId?: string | null, currentCompanyId?: string | null): Promise<string | null> {
    if (requestedId) {
      const company = await prisma.billingCompany.findUnique({ where: { id: requestedId } }).catch(() => null);
      // A deactivated company may stay on documents it already issued, but can't be picked for new ones.
      if (!company || (!company.isActive && company.id !== currentCompanyId)) {
        throw new AppError('Selected company was not found or is inactive', 400);
      }
      return company.id;
    }
    const fallback = await this.getDefault();
    return fallback ? fallback.id : null;
  }

  public static async setDefault(id: string) {
    await prisma.billingCompany.updateMany({ where: { isDefault: true, NOT: { id } }, data: { isDefault: false } });
    return prisma.billingCompany.update({ where: { id }, data: { isDefault: true, isActive: true } });
  }
}
