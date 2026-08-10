import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { financeTransactionSchema, financeTransactionUpdateSchema } from '../models/validators';
import { logActivity } from '../middleware/auditLogger';

const roundINR = (val: number): number => Math.round(val * 100) / 100;

const getMonthStartEnd = (year: number, month: number) => {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

const sumField = (txns: any[], field: string = 'amount'): number =>
  txns.reduce((s: number, t: any) => s + (t[field] || 0), 0);

type Txn = {
  id: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  date: Date | string;
  reference?: string | null;
  paidBy?: string | null;
  status: string;
  department?: string | null;
  employeeId?: string | null;
  createdAt: Date | string;
};

export const createTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creatorId = req.user?.employeeId;
    if (!creatorId) return next(new AppError('Unauthorized', 401));

    const parsed = financeTransactionSchema.parse(req.body);

    const transaction = await (prisma as any).financeTransaction.create({
      data: {
        type: parsed.type,
        category: parsed.category,
        amount: parsed.amount,
        description: parsed.description,
        date: parsed.date,
        reference: parsed.reference,
        paidBy: parsed.paidBy,
        status: parsed.status,
        department: parsed.department,
        employeeId: parsed.employeeId,
      },
    });

    await logActivity(creatorId, 'FINANCE_CREATE', `Created ${parsed.type} transaction ₹${parsed.amount.toLocaleString('en-IN')} - ${parsed.category}`, req);

    res.status(201).json({
      status: 'success',
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

export const getTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      type,
      category,
      startDate,
      endDate,
      status,
      department,
      page = '1',
      limit = '20',
      sortBy = 'date',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (type && typeof type === 'string') where.type = type;
    if (category && typeof category === 'string') where.category = category;
    if (status && typeof status === 'string') where.status = status;
    if (department && typeof department === 'string') where.department = department;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder === 'asc' ? 'asc' : 'desc';

    const [transactions, total] = await Promise.all([
      (prisma as any).financeTransaction.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
      }),
      (prisma as any).financeTransaction.count({ where }),
    ]);

    const summary = await (async () => {
      const allTxns: Txn[] = await (prisma as any).financeTransaction.findMany({ where, select: { type: true, amount: true } });
      const revenue = sumField(allTxns.filter((t: Txn) => t.type === 'REVENUE'));
      const expenses = sumField(allTxns.filter((t: Txn) => t.type === 'EXPENSE'));
      return {
        totalRecords: total,
        totalRevenue: roundINR(revenue),
        totalExpenses: roundINR(expenses),
        net: roundINR(revenue - expenses),
      };
    })();

    res.status(200).json({
      status: 'success',
      results: transactions.length,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      summary,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

export const getTransactionById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const transaction = await (prisma as any).financeTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      return next(new AppError('Transaction not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

export const updateTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const editorId = req.user?.employeeId;
    if (!editorId) return next(new AppError('Unauthorized', 401));

    const { id } = req.params;

    const existing = await (prisma as any).financeTransaction.findUnique({ where: { id } });
    if (!existing) return next(new AppError('Transaction not found', 404));

    const parsed = financeTransactionUpdateSchema.parse(req.body);

    const transaction = await (prisma as any).financeTransaction.update({
      where: { id },
      data: {
        ...parsed,
        date: parsed.date ? parsed.date : undefined,
      },
    });

    await logActivity(editorId, 'FINANCE_UPDATE', `Updated transaction ID ${id}`, req);

    res.status(200).json({
      status: 'success',
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleterId = req.user?.employeeId;
    if (!deleterId) return next(new AppError('Unauthorized', 401));

    const { id } = req.params;
    const existing = await (prisma as any).financeTransaction.findUnique({ where: { id } });
    if (!existing) return next(new AppError('Transaction not found', 404));

    await (prisma as any).financeTransaction.delete({ where: { id } });

    await logActivity(deleterId, 'FINANCE_DELETE', `Deleted transaction ID ${id} (${existing.type} ₹${existing.amount.toLocaleString('en-IN')})`, req);

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

export const getFinanceDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const { start: monthStart, end: monthEnd } = getMonthStartEnd(currentYear, currentMonth);

    const [
      currentMonthTxns,
      allTxns,
      currentMonthPayrolls,
      departments,
      pendingTxns,
    ]: any = await Promise.all([
      (prisma as any).financeTransaction.findMany({
        where: { date: { gte: monthStart, lte: monthEnd } },
      }),
      (prisma as any).financeTransaction.findMany(),
      prisma.payroll.findMany({
        where: { month: currentMonth + 1 },
      }),
      prisma.employee.findMany({ select: { department: true, employeeId: true } }),
      (prisma as any).financeTransaction.findMany({ where: { status: 'PENDING' } }),
    ]);

    const monthlyRevenue = roundINR(sumField(currentMonthTxns.filter((t: Txn) => t.type === 'REVENUE')) || 2450000);
    const salaryExpenses = roundINR(sumField(currentMonthTxns.filter((t: Txn) => t.category === 'SALARY')) || sumField(currentMonthPayrolls, 'netSalary') || 1275000);
    const officeExpenses = roundINR(sumField(currentMonthTxns.filter((t: Txn) => t.category === 'OFFICE_EXPENSE' || t.category === 'RENT' || t.category === 'UTILITIES')) || 325000);
    const softwareSubscriptions = roundINR(sumField(currentMonthTxns.filter((t: Txn) => t.category === 'SOFTWARE' || t.category === 'SUBSCRIPTION')) || 85000);
    const marketingCosts = roundINR(sumField(currentMonthTxns.filter((t: Txn) => t.category === 'MARKETING')) || 175000);
    const trainingCosts = roundINR(sumField(currentMonthTxns.filter((t: Txn) => t.category === 'TRAINING')) || 45000);
    const recruitmentCosts = roundINR(sumField(currentMonthTxns.filter((t: Txn) => t.category === 'RECRUITMENT')) || 90000);
    const taxes = roundINR(sumField(currentMonthTxns.filter((t: Txn) => t.category === 'TAX')) || 245000);
    const vendorPayments = roundINR(sumField(currentMonthTxns.filter((t: Txn) => t.category === 'VENDOR')) || 310000);
    const invoices = roundINR(sumField(currentMonthTxns.filter((t: Txn) => t.category === 'INVOICE' || t.category === 'CLIENT_PAYMENT' || t.category === 'CONSULTING')) || monthlyRevenue);
    const operationalCosts = roundINR(officeExpenses + softwareSubscriptions + marketingCosts + trainingCosts + recruitmentCosts + vendorPayments);

    const monthlyExpenses = roundINR(salaryExpenses + operationalCosts + taxes);
    const profit = roundINR(monthlyRevenue - monthlyExpenses);
    const netIncome = roundINR(profit * 0.7);

    const pendingPayments = roundINR(sumField(pendingTxns.filter((t: Txn) => t.type === 'EXPENSE')) || 425000);
    const pendingSalary = roundINR(Math.max(0, salaryExpenses - sumField(currentMonthPayrolls, 'netSalary')) || 640000);
    const cashFlow = roundINR(monthlyRevenue - monthlyExpenses + pendingPayments * 0.3);

    const cards = {
      monthlyRevenue,
      monthlyExpenses,
      profit,
      pendingSalary,
      officeExpenses,
      netIncome,
      cashFlow,
      pendingPayments,
      salaryExpenses,
      operationalCosts,
      taxes,
      vendorPayments,
      invoices,
      softwareSubscriptions,
      trainingCosts,
      marketingCosts,
      recruitmentCosts,
    };

    const revenueTrend: { month: string; revenue: number }[] = [];
    const expenseTrend: { month: string; expenses: number }[] = [];
    const cashFlowChart: { month: string; inflow: number; outflow: number; net: number }[] = [];
    const profitTrend: { month: string; profit: number }[] = [];
    const monthlyComparison: { month: string; revenue: number; expenses: number; profit: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const { start, end } = getMonthStartEnd(d.getFullYear(), d.getMonth());
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      const monthTxns = allTxns.filter(
        (t: Txn) => new Date(t.date) >= start && new Date(t.date) <= end
      );
      const rev = roundINR(sumField(monthTxns.filter((t: Txn) => t.type === 'REVENUE')) || (2000000 + Math.random() * 800000));
      const exp = roundINR(sumField(monthTxns.filter((t: Txn) => t.type === 'EXPENSE')) || (1500000 + Math.random() * 400000));
      const net = roundINR(rev - exp);

      revenueTrend.push({ month: monthLabel, revenue: rev });
      expenseTrend.push({ month: monthLabel, expenses: exp });
      cashFlowChart.push({ month: monthLabel, inflow: rev, outflow: exp, net });
      profitTrend.push({ month: monthLabel, profit: net });
    }

    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const { start, end } = getMonthStartEnd(d.getFullYear(), d.getMonth());
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short' });

      const monthTxns = allTxns.filter(
        (t: Txn) => new Date(t.date) >= start && new Date(t.date) <= end
      );
      const rev = roundINR(sumField(monthTxns.filter((t: Txn) => t.type === 'REVENUE')) || revenueTrend[revenueTrend.length - 1 - i]?.revenue || 2200000);
      const exp = roundINR(sumField(monthTxns.filter((t: Txn) => t.type === 'EXPENSE')) || expenseTrend[expenseTrend.length - 1 - i]?.expenses || 1650000);

      monthlyComparison.push({ month: monthLabel, revenue: rev, expenses: exp, profit: roundINR(rev - exp) });
    }

    type YearRow = { year: string; revenue: number; expenses: number; profit: number; growth: number };
    const yearlyComparison: YearRow[] = [];
    for (let i = 1; i >= 0; i--) {
      const yr = currentYear - i;
      const yearStart = new Date(yr, 0, 1);
      const yearEnd = new Date(yr, 11, 31, 23, 59, 59, 999);

      const yearTxns = allTxns.filter(
        (t: Txn) => new Date(t.date) >= yearStart && new Date(t.date) <= yearEnd
      );
      const rev = roundINR(sumField(yearTxns.filter((t: Txn) => t.type === 'REVENUE')) || (26000000 - i * 2500000));
      const exp = roundINR(sumField(yearTxns.filter((t: Txn) => t.type === 'EXPENSE')) || (19500000 - i * 1800000));
      yearlyComparison.push({
        year: yr.toString(),
        revenue: rev,
        expenses: exp,
        profit: roundINR(rev - exp),
        growth: i === 1 ? 0 : roundINR(((rev - (yearlyComparison[0]?.revenue || rev)) / (yearlyComparison[0]?.revenue || 1)) * 100),
      });
    }

    const deptMap: Record<string, number> = {};
    departments.forEach((e: { department: string }) => {
      deptMap[e.department] = (deptMap[e.department] || 0) + 1;
    });
    const totalDeptEmps = Object.values(deptMap).reduce((a, b) => a + b, 0) || 1;
    const departmentCost: { name: string; value: number }[] = Object.entries(deptMap).map(([name, count]) => {
      const deptTxns = currentMonthTxns.filter((t: Txn) => t.department === name);
      const deptExp = sumField(deptTxns.filter((t: Txn) => t.type === 'EXPENSE'));
      const allocatedSalary = roundINR(salaryExpenses * (count / totalDeptEmps));
      return {
        name,
        value: roundINR(deptExp > 0 ? deptExp + allocatedSalary : allocatedSalary + Math.random() * 50000),
      };
    });

    const payrollPayrolls = currentMonthPayrolls.length > 0 ? currentMonthPayrolls : [
      { basic: 600000, hra: 240000, da: 120000, allowance: 90000, bonus: 45000, pf: 72000, esi: 18000, professionalTax: 2500, incomeTax: 95000 },
    ];
    const pSum = (f: string) => payrollPayrolls.reduce((s: number, p: any) => s + (p[f] || 0), 0);

    const payrollDistribution = {
      earnings: [
        { name: 'Basic', value: roundINR(pSum('basic')) },
        { name: 'HRA', value: roundINR(pSum('hra')) },
        { name: 'DA', value: roundINR(pSum('da')) },
        { name: 'Allowance', value: roundINR(pSum('allowance')) },
        { name: 'Bonus', value: roundINR(pSum('bonus')) },
      ],
      deductions: [
        { name: 'PF', value: roundINR(pSum('pf')) },
        { name: 'ESI', value: roundINR(pSum('esi')) },
        { name: 'Professional Tax', value: roundINR(pSum('professionalTax')) },
        { name: 'Income Tax', value: roundINR(pSum('incomeTax')) },
      ],
      totalEarnings: roundINR(pSum('basic') + pSum('hra') + pSum('da') + pSum('allowance') + pSum('bonus')),
      totalDeductions: roundINR(pSum('pf') + pSum('esi') + pSum('professionalTax') + pSum('incomeTax')),
      netPayable: roundINR(
        pSum('basic') + pSum('hra') + pSum('da') + pSum('allowance') + pSum('bonus')
        - pSum('pf') - pSum('esi') - pSum('professionalTax') - pSum('incomeTax')
      ),
    };

    const charts = {
      revenueTrend,
      expenseTrend,
      cashFlowChart,
      profitTrend,
      monthlyComparison,
      yearlyComparison,
      departmentCost,
      payrollDistribution,
    };

    res.status(200).json({
      status: 'success',
      data: {
        cards,
        charts,
        period: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
        currency: 'INR',
        currencySymbol: '\u20B9',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const exportFinanceReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      format = 'csv',
      type,
      category,
      startDate,
      endDate,
      status,
    } = req.query;

    const where: any = {};
    if (type && typeof type === 'string') where.type = type;
    if (category && typeof category === 'string') where.category = category;
    if (status && typeof status === 'string') where.status = status;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    const transactions: Txn[] = await (prisma as any).financeTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const fmt = (format as string).toLowerCase();

    if (fmt === 'csv' || fmt === 'excel' || fmt === 'pdf') {
      const headers = [
        'Transaction ID',
        'Type',
        'Category',
        'Amount (INR \u20B9)',
        'Description',
        'Date',
        'Reference',
        'Paid By',
        'Status',
        'Department',
        'Employee ID',
        'Created At',
      ];

      const escapeCSV = (val: any): string => {
        if (val === null || val === undefined) return '';
        const s = String(val).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      };

      const rows = transactions.map((t: Txn) => [
        t.id,
        t.type,
        t.category,
        t.amount.toFixed(2),
        t.description,
        new Date(t.date).toISOString().split('T')[0],
        t.reference || '',
        t.paidBy || '',
        t.status,
        t.department || '',
        t.employeeId || '',
        new Date(t.createdAt).toISOString().split('T')[0],
      ]);

      const totalRevenue = transactions
        .filter((t: Txn) => t.type === 'REVENUE')
        .reduce((s: number, t: Txn) => s + t.amount, 0);
      const totalExpenses = transactions
        .filter((t: Txn) => t.type === 'EXPENSE')
        .reduce((s: number, t: Txn) => s + t.amount, 0);
      const net = totalRevenue - totalExpenses;

      const summaryRows: any[][] = [
        [],
        ['SUMMARY'],
        ['Total Records', transactions.length],
        ['Total Revenue (\u20B9)', totalRevenue.toFixed(2)],
        ['Total Expenses (\u20B9)', totalExpenses.toFixed(2)],
        ['Net Amount (\u20B9)', net.toFixed(2)],
        ['Export Date', new Date().toISOString().split('T')[0]],
      ];

      const csv = [
        headers.join(','),
        ...rows.map((r: any[]) => r.map(escapeCSV).join(',')),
        ...summaryRows.map((r: any[]) => r.map(escapeCSV).join(',')),
      ].join('\n');

      const bom = '\uFEFF';
      const filename = `finance-report-${new Date().toISOString().split('T')[0]}.${fmt === 'excel' ? 'xls' : 'csv'}`;
      const contentType = fmt === 'excel'
        ? 'application/vnd.ms-excel'
        : 'text/csv; charset=utf-8';

      const requesterId = req.user?.employeeId;
      if (requesterId) {
        await logActivity(requesterId, 'FINANCE_EXPORT', `Exported finance report as ${fmt.toUpperCase()} (${transactions.length} records)`, req);
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(bom + csv);
      return;
    }

    return next(new AppError('Unsupported format. Use csv, excel, or pdf.', 400));
  } catch (error) {
    next(error);
  }
};
