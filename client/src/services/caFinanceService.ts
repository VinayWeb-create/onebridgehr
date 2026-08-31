import { api, SOCKET_URL } from './api';

export interface FinanceLedger {
  id: string;
  code: string;
  name: string;
  group: 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'EQUITY';
  openingBalance: number;
  currentBalance: number;
  description?: string;
  isSystem: boolean;
}

export interface FinanceVoucher {
  id: string;
  voucherNumber: string;
  voucherType: 'PAYMENT' | 'RECEIPT' | 'JOURNAL' | 'CONTRA' | 'SALES' | 'PURCHASE';
  date: string;
  debitLedgerId: string;
  creditLedgerId: string;
  debitLedger: { id: string; name: string; code: string; group: string };
  creditLedger: { id: string; name: string; code: string; group: string };
  amount: number;
  narration: string;
  referenceNo?: string;
  isGstApplicable: boolean;
  gstRate?: number;
  gstAmount?: number;
  verifiedByCA: boolean;
}

export interface AccountingSummary {
  summary: {
    totalSalesRevenue: number;
    totalDirectExpenses: number;
    totalPayrollExpense: number;
    totalAllExpenses: number;
    netProfit: number;
    totalGstCollected: number;
    totalInputGst: number;
    netGstPayable: number;
  };
  expenseBreakdown: { name: string; value: number }[];
  monthlyTrends: { month: string; revenue: number; expense: number; profit: number }[];
  recentVouchers: FinanceVoucher[];
}

export const caFinanceService = {
  getLedgers: async () => {
    const res = await api.get('/ca-finance/ledgers');
    return res.data.data as FinanceLedger[];
  },
  createLedger: async (data: { name: string; group: string; openingBalance?: number; description?: string }) => {
    const res = await api.post('/ca-finance/ledgers', data);
    return res.data.data as FinanceLedger;
  },
  initLedgers: async () => {
    const res = await api.post('/ca-finance/ledgers/init');
    return res.data.data as FinanceLedger[];
  },
  getVouchers: async (params?: { voucherType?: string; startDate?: string; endDate?: string; ledgerId?: string }) => {
    const res = await api.get('/ca-finance/vouchers', { params });
    return res.data.data as FinanceVoucher[];
  },
  createVoucher: async (data: any) => {
    const res = await api.post('/ca-finance/vouchers', data);
    return res.data.data as FinanceVoucher;
  },
  getAccountingSummary: async () => {
    const res = await api.get('/ca-finance/summary');
    return res.data.data as AccountingSummary;
  },
  getExportUrl: () => {
    return `${SOCKET_URL}/api/ca-finance/export-tally`;
  },
};
