import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { billingCompanySchema, billingClientSchema } from '../models/validators';
import { BillingCompanyService, normalizeBankAccounts } from '../services/billingCompanyService';

const OBJECT_ID = /^[a-f0-9]{24}$/i;

const assertId = (id: string, label: string) => {
  if (!OBJECT_ID.test(id)) throw new AppError(`${label} not found`, 404);
};

// -------------------------------------------------------------
// BILLING COMPANIES ("Billed By")
// -------------------------------------------------------------

export const getBillingCompanies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companies = await prisma.billingCompany.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: { _count: { select: { quotations: true, invoices: true } } },
    });
    res.status(200).json({ status: 'success', data: companies });
  } catch (error) {
    next(error);
  }
};

export const createBillingCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { bankAccounts, ...fields } = billingCompanySchema.parse(req.body);
    const data = bankAccounts ? { ...fields, ...normalizeBankAccounts(bankAccounts) } : fields;
    const existingDefault = await BillingCompanyService.getDefault();

    let company = await prisma.billingCompany.create({ data: { ...data, isActive: true } });
    // The first company, or one explicitly marked default, becomes the default.
    if (!existingDefault || req.body.isDefault === true) {
      company = await BillingCompanyService.setDefault(company.id);
    }

    res.status(201).json({ status: 'success', data: company });
  } catch (error) {
    next(error);
  }
};

export const updateBillingCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    assertId(id, 'Company');
    const existing = await prisma.billingCompany.findUnique({ where: { id } });
    if (!existing) throw new AppError('Company not found', 404);

    const { bankAccounts, ...fields } = billingCompanySchema.parse(req.body);
    const data = bankAccounts ? { ...fields, ...normalizeBankAccounts(bankAccounts) } : fields;
    if (existing.isDefault && data.isActive === false) {
      throw new AppError('The default company cannot be deactivated. Make another company default first.', 400);
    }

    const company = await prisma.billingCompany.update({ where: { id }, data });
    res.status(200).json({ status: 'success', data: company });
  } catch (error) {
    next(error);
  }
};

export const setDefaultBillingCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    assertId(id, 'Company');
    const existing = await prisma.billingCompany.findUnique({ where: { id } });
    if (!existing) throw new AppError('Company not found', 404);

    const company = await BillingCompanyService.setDefault(id);
    res.status(200).json({ status: 'success', data: company });
  } catch (error) {
    next(error);
  }
};

export const deleteBillingCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    assertId(id, 'Company');
    const existing = await prisma.billingCompany.findUnique({
      where: { id },
      include: { _count: { select: { quotations: true, invoices: true } } },
    });
    if (!existing) throw new AppError('Company not found', 404);
    if (existing.isDefault) {
      throw new AppError('The default company cannot be deleted. Make another company default first.', 400);
    }

    // Keep companies that appear on documents so old PDFs still show the right details.
    if (existing._count.quotations + existing._count.invoices > 0) {
      const company = await prisma.billingCompany.update({ where: { id }, data: { isActive: false } });
      res.status(200).json({
        status: 'success',
        message: 'Company is used on existing documents, so it was deactivated instead of deleted.',
        data: company,
      });
      return;
    }

    await prisma.billingCompany.delete({ where: { id } });
    res.status(200).json({ status: 'success', message: 'Company deleted' });
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// BILLING CLIENTS ("Billed To")
// -------------------------------------------------------------

export const getBillingClients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { company: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
            { gstin: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const clients = await prisma.billingClient.findMany({ where, orderBy: { name: 'asc' }, take: 200 });
    res.status(200).json({ status: 'success', data: clients });
  } catch (error) {
    next(error);
  }
};

export const createBillingClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = billingClientSchema.parse(req.body);
    const client = await prisma.billingClient.create({ data });
    res.status(201).json({ status: 'success', data: client });
  } catch (error) {
    next(error);
  }
};

export const updateBillingClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    assertId(id, 'Client');
    const existing = await prisma.billingClient.findUnique({ where: { id } });
    if (!existing) throw new AppError('Client not found', 404);

    const data = billingClientSchema.parse(req.body);
    const client = await prisma.billingClient.update({ where: { id }, data });
    res.status(200).json({ status: 'success', data: client });
  } catch (error) {
    next(error);
  }
};

export const deleteBillingClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    assertId(id, 'Client');
    const existing = await prisma.billingClient.findUnique({ where: { id } });
    if (!existing) throw new AppError('Client not found', 404);

    // Documents keep their own copy of the client details, so only the link is removed.
    await prisma.billingClient.delete({ where: { id } });
    res.status(200).json({ status: 'success', message: 'Client deleted' });
  } catch (error) {
    next(error);
  }
};
