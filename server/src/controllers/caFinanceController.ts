import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';

const db = prisma as any;

// Default Tally-compatible Chart of Accounts (Ledger heads)
const DEFAULT_LEDGERS = [
  { code: 'ACC-1001', name: 'HDFC Bank Current A/C', group: 'ASSET', openingBalance: 500000, isSystem: true },
  { code: 'ACC-1002', name: 'Petty Cash', group: 'ASSET', openingBalance: 25000, isSystem: true },
  { code: 'ACC-1003', name: 'Client Accounts Receivable', group: 'ASSET', openingBalance: 0, isSystem: true },
  { code: 'ACC-2001', name: 'GST Output Liability (Sales)', group: 'LIABILITY', openingBalance: 0, isSystem: true },
  { code: 'ACC-2002', name: 'TDS Payable', group: 'LIABILITY', openingBalance: 0, isSystem: true },
  { code: 'ACC-2003', name: 'Vendor Accounts Payable', group: 'LIABILITY', openingBalance: 0, isSystem: true },
  { code: 'ACC-3001', name: 'Software Development & IT Revenue', group: 'INCOME', openingBalance: 0, isSystem: true },
  { code: 'ACC-3002', name: 'Consulting & Service Income', group: 'INCOME', openingBalance: 0, isSystem: true },
  { code: 'ACC-4001', name: 'Staff Salaries & Wages', group: 'EXPENSE', openingBalance: 0, isSystem: true },
  { code: 'ACC-4002', name: 'Office Rent & Utilities', group: 'EXPENSE', openingBalance: 0, isSystem: true },
  { code: 'ACC-4003', name: 'Cloud & Software Subscriptions (AWS/Google/Tools)', group: 'EXPENSE', openingBalance: 0, isSystem: true },
  { code: 'ACC-4004', name: 'Marketing & Digital Ads', group: 'EXPENSE', openingBalance: 0, isSystem: true },
  { code: 'ACC-4005', name: 'Hardware & IT Infrastructure', group: 'EXPENSE', openingBalance: 0, isSystem: true },
  { code: 'ACC-4006', name: 'CA, Legal & Professional Fees', group: 'EXPENSE', openingBalance: 0, isSystem: true },
  { code: 'ACC-4007', name: 'Office Pantry & Miscellaneous', group: 'EXPENSE', openingBalance: 0, isSystem: true },
  { code: 'ACC-4008', name: 'Input GST (Expenses & Purchases)', group: 'ASSET', openingBalance: 0, isSystem: true },
];

/**
 * Initialize default Chart of Accounts / Ledgers if empty
 */
export const initializeChartOfAccounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existingCount = await db.financeLedger.count();
    if (existingCount === 0) {
      for (const ledger of DEFAULT_LEDGERS) {
        await db.financeLedger.create({
          data: {
            code: ledger.code,
            name: ledger.name,
            group: ledger.group as any,
            openingBalance: ledger.openingBalance,
            currentBalance: ledger.openingBalance,
            isSystem: ledger.isSystem,
          },
        });
      }
    }
    const ledgers = await db.financeLedger.findMany({ orderBy: { code: 'asc' } });
    res.status(200).json({ status: 'success', message: 'Chart of Accounts initialized', data: ledgers });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all Ledgers (Chart of Accounts)
 */
export const getLedgers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let ledgers = await db.financeLedger.findMany({
      orderBy: { code: 'asc' },
    });

    if (ledgers.length === 0) {
      // Auto seed
      for (const ledger of DEFAULT_LEDGERS) {
        await db.financeLedger.create({
          data: {
            code: ledger.code,
            name: ledger.name,
            group: ledger.group as any,
            openingBalance: ledger.openingBalance,
            currentBalance: ledger.openingBalance,
            isSystem: ledger.isSystem,
          },
        });
      }
      ledgers = await db.financeLedger.findMany({ orderBy: { code: 'asc' } });
    }

    res.status(200).json({ status: 'success', data: ledgers });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new custom Ledger head
 */
export const createLedger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, group, openingBalance = 0, description } = req.body;
    const count = await db.financeLedger.count();
    const code = `ACC-${String(1000 + count + 1)}`;

    const ledger = await db.financeLedger.create({
      data: {
        code,
        name,
        group,
        openingBalance: Number(openingBalance),
        currentBalance: Number(openingBalance),
        description,
      },
    });

    res.status(201).json({ status: 'success', data: ledger });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a Double-Entry Finance Voucher (Payment, Receipt, Journal, Contra, Sales, Purchase)
 */
export const createVoucher = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      voucherType = 'PAYMENT',
      date,
      debitLedgerId,
      creditLedgerId,
      amount,
      narration,
      referenceNo,
      invoiceId,
      documentUrl,
      isGstApplicable = false,
      gstRate = 18,
      gstType = 'CGST_SGST',
    } = req.body;

    const count = await db.financeVoucher.count();
    const prefix = voucherType.substring(0, 3).toUpperCase();
    const voucherNumber = `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const numAmount = Number(amount);
    let gstAmount = 0;
    if (isGstApplicable && gstRate) {
      gstAmount = (numAmount * Number(gstRate)) / (100 + Number(gstRate));
    }

    const voucher = await db.financeVoucher.create({
      data: {
        voucherNumber,
        voucherType,
        date: date ? new Date(date) : new Date(),
        debitLedgerId,
        creditLedgerId,
        amount: numAmount,
        narration,
        referenceNo,
        invoiceId,
        documentUrl,
        isGstApplicable,
        gstRate: Number(gstRate),
        gstType,
        gstAmount,
      },
      include: {
        debitLedger: true,
        creditLedger: true,
      },
    });

    // Update Ledger Balances
    await db.financeLedger.update({
      where: { id: debitLedgerId },
      data: { currentBalance: { increment: numAmount } },
    });

    await db.financeLedger.update({
      where: { id: creditLedgerId },
      data: { currentBalance: { decrement: numAmount } },
    });

    res.status(201).json({ status: 'success', data: voucher });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Vouchers with filtering (Daybook, Date range, Ledger)
 */
export const getVouchers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { voucherType, startDate, endDate, ledgerId } = req.query;
    const filter: any = {};

    if (voucherType && voucherType !== 'ALL') {
      filter.voucherType = voucherType;
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.gte = new Date(String(startDate));
      if (endDate) filter.date.lte = new Date(String(endDate));
    }

    if (ledgerId) {
      filter.OR = [{ debitLedgerId: String(ledgerId) }, { creditLedgerId: String(ledgerId) }];
    }

    const vouchers = await db.financeVoucher.findMany({
      where: filter,
      orderBy: { date: 'desc' },
      include: {
        debitLedger: { select: { id: true, name: true, code: true, group: true } },
        creditLedger: { select: { id: true, name: true, code: true, group: true } },
      },
    });

    res.status(200).json({ status: 'success', data: vouchers });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Comprehensive CA Accounting Overview (Day Book, P&L, GST Ledger, Company Balance)
 */
export const getCaAccountingSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Total Invoiced Revenue
    const paidInvoices = await db.invoice.findMany({
      where: { paymentStatus: { in: ['PAID', 'PARTIALLY_PAID'] } },
    });
    const totalSalesRevenue = paidInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.amountPaid) || Number(inv.totalAmount) || 0), 0);
    const totalGstCollected = paidInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.taxAmount) || 0), 0);

    // 2. All Expense Vouchers
    const expenseVouchers = await db.financeVoucher.findMany({
      where: {
        OR: [
          { voucherType: 'PAYMENT' },
          { debitLedger: { group: 'EXPENSE' } },
        ],
      },
      include: { debitLedger: true, creditLedger: true },
    });
    const totalDirectExpenses = expenseVouchers.reduce((sum: number, v: any) => sum + Number(v.amount), 0);
    const totalInputGst = expenseVouchers.reduce((sum: number, v: any) => sum + (Number(v.gstAmount) || 0), 0);

    // 3. HRMS Payroll Expenses
    const payrollRecords = await db.payroll.findMany({
      where: { status: 'PAID' },
    });
    const totalPayrollExpense = payrollRecords.reduce((sum: number, p: any) => sum + (Number(p.netSalary) || 0), 0);

    // 4. Net Profit & GST Liability Calculation
    const totalAllExpenses = totalDirectExpenses + totalPayrollExpense;
    const netProfit = totalSalesRevenue - totalAllExpenses;
    const netGstPayable = Math.max(0, totalGstCollected - totalInputGst);

    // 5. Recent Daybook Entries
    const recentVouchers = await db.financeVoucher.findMany({
      take: 15,
      orderBy: { date: 'desc' },
      include: { debitLedger: true, creditLedger: true },
    });

    // 6. Expense Breakdown by Category
    const categoryMap: Record<string, number> = {};
    expenseVouchers.forEach((v: any) => {
      const catName = v.debitLedger?.name || 'General Office Expense';
      categoryMap[catName] = (categoryMap[catName] || 0) + Number(v.amount);
    });
    if (totalPayrollExpense > 0) {
      categoryMap['Employee Payroll & Salaries'] = totalPayrollExpense;
    }

    const expenseBreakdown = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

    // 7. Monthly Trends (Last 6 Months)
    const monthlyTrendsMap: Record<string, { month: string; revenue: number; expense: number; profit: number }> = {};
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      monthlyTrendsMap[monthStr] = { month: monthStr, revenue: 0, expense: 0, profit: 0 };
    }

    paidInvoices.forEach((inv: any) => {
      if (!inv.issueDate) return;
      const d = new Date(inv.issueDate);
      if (d >= new Date(today.getFullYear(), today.getMonth() - 5, 1)) {
        const m = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        if (monthlyTrendsMap[m]) {
          monthlyTrendsMap[m].revenue += (Number(inv.amountPaid) || Number(inv.totalAmount) || 0);
        }
      }
    });

    expenseVouchers.forEach((v: any) => {
      if (!v.date) return;
      const d = new Date(v.date);
      if (d >= new Date(today.getFullYear(), today.getMonth() - 5, 1)) {
        const m = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        if (monthlyTrendsMap[m]) {
          monthlyTrendsMap[m].expense += Number(v.amount);
        }
      }
    });

    payrollRecords.forEach((p: any) => {
      if (!p.createdAt) return;
      const d = new Date(p.createdAt);
      if (d >= new Date(today.getFullYear(), today.getMonth() - 5, 1)) {
        const m = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        if (monthlyTrendsMap[m]) {
          monthlyTrendsMap[m].expense += Number(p.netSalary) || 0;
        }
      }
    });

    const monthlyTrends = Object.values(monthlyTrendsMap).map(t => {
      t.profit = t.revenue - t.expense;
      return t;
    });

    res.status(200).json({
      status: 'success',
      data: {
        summary: {
          totalSalesRevenue,
          totalDirectExpenses,
          totalPayrollExpense,
          totalAllExpenses,
          netProfit,
          totalGstCollected,
          totalInputGst,
          netGstPayable,
        },
        expenseBreakdown,
        monthlyTrends,
        recentVouchers,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export Accounting Ledger for Tally / CA Audit in CSV / Tabular format
 */
export const exportTallyReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const vouchers = await db.financeVoucher.findMany({
      orderBy: { date: 'asc' },
      include: { debitLedger: true, creditLedger: true },
    });

    let csv = 'Voucher Number,Date,Voucher Type,Debit Ledger (By),Credit Ledger (To),Amount (INR),GST Amount,Narration,Ref No\n';
    vouchers.forEach((v: any) => {
      const dateStr = new Date(v.date).toISOString().split('T')[0];
      const narration = `"${(v.narration || '').replace(/"/g, '""')}"`;
      const debitName = v.debitLedger?.name || 'Debit A/C';
      const creditName = v.creditLedger?.name || 'Credit A/C';
      csv += `${v.voucherNumber},${dateStr},${v.voucherType},"${debitName}","${creditName}",${v.amount},${v.gstAmount || 0},${narration},"${v.referenceNo || ''}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=OneBridge_Tally_DayBook_${new Date().toISOString().split('T')[0]}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};
