import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Scale,
  FileSpreadsheet,
  Receipt,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  CheckCircle2,
  PieChart as PieIcon,
  RefreshCw,
} from 'lucide-react';
import {
  caFinanceService,
  type AccountingSummary,
  type FinanceLedger,
  type FinanceVoucher,
} from '../../services/caFinanceService';
import { useDialog } from '../../context/DialogContext';

export const TallyFinancePage: React.FC = () => {
  const { confirm } = useDialog();

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'DAYBOOK' | 'PNL' | 'GST' | 'LEDGERS'>('DASHBOARD');
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [ledgers, setLedgers] = useState<FinanceLedger[]>([]);
  const [vouchers, setVouchers] = useState<FinanceVoucher[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for Day Book
  const [voucherFilter, setVoucherFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Add Voucher Modal
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherForm, setVoucherForm] = useState({
    voucherType: 'PAYMENT' as FinanceVoucher['voucherType'],
    date: new Date().toISOString().split('T')[0],
    debitLedgerId: '',
    creditLedgerId: '',
    amount: 0,
    narration: '',
    referenceNo: '',
    isGstApplicable: true,
    gstRate: 18,
  });

  // Add Ledger Modal
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerForm, setLedgerForm] = useState({
    name: '',
    group: 'EXPENSE',
    openingBalance: 0,
    description: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumData, ledData, vchData] = await Promise.all([
        caFinanceService.getAccountingSummary(),
        caFinanceService.getLedgers(),
        caFinanceService.getVouchers({ voucherType: voucherFilter, startDate, endDate }),
      ]);
      setSummary(sumData);
      setLedgers(ledData);
      setVouchers(vchData);

      // Pre-set default debit & credit in voucher form if available
      if (ledData.length >= 2 && !voucherForm.debitLedgerId) {
        const expense = ledData.find((l) => l.group === 'EXPENSE') || ledData[0];
        const bank = ledData.find((l) => l.name.includes('Bank')) || ledData[1];
        setVoucherForm((prev) => ({
          ...prev,
          debitLedgerId: expense.id,
          creditLedgerId: bank.id,
        }));
      }
    } catch (err) {
      console.error('Failed to load CA Finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [voucherFilter, startDate, endDate]);

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await caFinanceService.createVoucher(voucherForm);
      setShowVoucherModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to create voucher:', err);
    }
  };

  const handleCreateLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await caFinanceService.createLedger(ledgerForm);
      setShowLedgerModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to create ledger:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-brand-900 p-6 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">CA & Tally Accounting Suite</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Double-entry books, Day Book, P&L, GST Ledgers, and 1-Click Tally / CA Audit exports
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={caFinanceService.getExportUrl()}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-brand-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Export Tally CSV
          </a>

          <button
            onClick={() => setShowVoucherModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/20 transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            New Voucher
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-brand-800 pb-2 overflow-x-auto">
        {[
          { id: 'DASHBOARD', label: 'Financial Overview', icon: Scale },
          { id: 'DAYBOOK', label: 'Day Book & Journal', icon: BookOpen },
          { id: 'PNL', label: 'Profit & Loss (P&L)', icon: TrendingUp },
          { id: 'GST', label: 'GST & Tax Summary', icon: Receipt },
          { id: 'LEDGERS', label: 'Chart of Accounts', icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-brand-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: EXECUTIVE FINANCIAL OVERVIEW */}
      {activeTab === 'DASHBOARD' && (
        <div className="space-y-6">
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gross Sales Revenue</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    ₹{summary.summary.totalSalesRevenue.toLocaleString('en-IN')}
                  </span>
                  <ArrowUpRight className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-xs text-slate-400 mt-1">From Invoices & Collections</p>
              </div>

              <div className="p-5 bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Expenses + Payroll</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                    ₹{summary.summary.totalAllExpenses.toLocaleString('en-IN')}
                  </span>
                  <ArrowDownRight className="w-5 h-5 text-rose-500" />
                </div>
                <p className="text-xs text-slate-400 mt-1">Includes ₹{summary.summary.totalPayrollExpense.toLocaleString('en-IN')} HRMS payroll</p>
              </div>

              <div className="p-5 bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Net Operating Profit</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className={`text-2xl font-bold ${summary.summary.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                    ₹{summary.summary.netProfit.toLocaleString('en-IN')}
                  </span>
                  <Scale className="w-5 h-5 text-indigo-500" />
                </div>
                <p className="text-xs text-slate-400 mt-1">Revenue minus All Operating Costs</p>
              </div>

              <div className="p-5 bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Net GST Tax Payable</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    ₹{summary.summary.netGstPayable.toLocaleString('en-IN')}
                  </span>
                  <Receipt className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-xs text-slate-400 mt-1">Output GST minus Input GST Credit</p>
              </div>
            </div>
          )}

          {/* Expense Breakdown */}
          {summary && summary.expenseBreakdown.length > 0 && (
            <div className="p-6 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm space-y-4">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-indigo-500" />
                Company Expense Categorization
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {summary.expenseBreakdown.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-brand-950 rounded-xl border border-slate-200 dark:border-brand-800 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-xs text-slate-800 dark:text-slate-200">{item.name}</p>
                      <p className="text-[11px] text-slate-400">Company ledger account</p>
                    </div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      ₹{item.value.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DAY BOOK & JOURNAL VOUCHERS */}
      {activeTab === 'DAYBOOK' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-brand-900 p-4 rounded-xl border border-slate-200 dark:border-brand-800">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={voucherFilter}
                onChange={(e) => setVoucherFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
              >
                <option value="ALL">All Voucher Types</option>
                <option value="PAYMENT">Payment (PMT)</option>
                <option value="RECEIPT">Receipt (RCT)</option>
                <option value="JOURNAL">Journal (JRN)</option>
                <option value="CONTRA">Contra (CTR)</option>
                <option value="SALES">Sales (SLS)</option>
                <option value="PURCHASE">Purchase (PUR)</option>
              </select>

              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                placeholder="From Date"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                placeholder="To Date"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-mono">
                <thead className="bg-slate-50 dark:bg-brand-950 text-slate-500 font-sans font-semibold border-b border-slate-200 dark:border-brand-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Vch No.</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Particulars / Debit (By)</th>
                    <th className="py-3 px-4">Credit (To)</th>
                    <th className="py-3 px-4">Narration</th>
                    <th className="py-3 px-4 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-brand-800 text-slate-800 dark:text-slate-200">
                  {vouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-brand-800/40 transition-colors">
                      <td className="py-3 px-4 text-xs font-sans">
                        {new Date(v.date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-xs font-bold text-amber-600 dark:text-amber-400">
                        {v.voucherNumber}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[11px] px-2 py-0.5 rounded font-sans font-bold bg-slate-100 dark:bg-brand-800">
                          {v.voucherType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-sans font-semibold text-slate-900 dark:text-white">
                        {v.debitLedger?.name || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs font-sans text-slate-500">
                        {v.creditLedger?.name || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs font-sans text-slate-400 truncate max-w-xs">
                        {v.narration}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                        ₹{Number(v.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {vouchers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400 font-sans">
                        No transactions found in this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROFIT & LOSS */}
      {activeTab === 'PNL' && summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Revenue Side */}
          <div className="bg-white dark:bg-brand-900 p-6 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-brand-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-emerald-500" />
                Income / Revenue
              </h3>
              <span className="font-bold text-emerald-600">
                ₹{summary.summary.totalSalesRevenue.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-50 dark:border-brand-800/50">
                <span className="text-slate-600 dark:text-slate-400">Software Development & Services</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  ₹{summary.summary.totalSalesRevenue.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Expense Side */}
          <div className="bg-white dark:bg-brand-900 p-6 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-brand-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-rose-500" />
                Operating Expenses
              </h3>
              <span className="font-bold text-rose-600">
                ₹{summary.summary.totalAllExpenses.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-brand-800/50 font-semibold text-indigo-600 dark:text-indigo-400">
                <span>Employee Salaries (Synced from HRMS)</span>
                <span>₹{summary.summary.totalPayrollExpense.toLocaleString('en-IN')}</span>
              </div>
              {summary.expenseBreakdown
                .filter((e) => !e.name.includes('Payroll'))
                .map((e, idx) => (
                  <div key={idx} className="flex justify-between py-1.5 border-b border-slate-50 dark:border-brand-800/50 text-slate-600 dark:text-slate-400">
                    <span>{e.name}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">₹{e.value.toLocaleString('en-IN')}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GST & TAX SUMMARY */}
      {activeTab === 'GST' && summary && (
        <div className="p-6 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-brand-800">
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">GST Summary & CA Reconciliation</h3>
              <p className="text-xs text-slate-400">GSTR-1 Outward sales tax liability vs GSTR-3B Input tax credit</p>
            </div>
            <span className="text-xs px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full font-bold">
              GSTN Compliant
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-brand-950 rounded-xl border border-slate-200 dark:border-brand-800">
              <span className="text-xs text-slate-400 font-semibold uppercase">Output GST (Collected)</span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                ₹{summary.summary.totalGstCollected.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">From Invoiced Client Sales</p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-brand-950 rounded-xl border border-slate-200 dark:border-brand-800">
              <span className="text-xs text-slate-400 font-semibold uppercase">Input GST (Tax Credit)</span>
              <p className="text-xl font-bold text-emerald-600 mt-1">
                ₹{summary.summary.totalInputGst.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">From Eligible Vendor & Cloud Bills</p>
            </div>

            <div className="p-4 bg-amber-500/10 dark:bg-amber-500/20 rounded-xl border border-amber-500/30">
              <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold uppercase">Net Tax Payable to Govt</span>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                ₹{summary.summary.netGstPayable.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">To be remitted before monthly return</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CHART OF ACCOUNTS (LEDGERS) */}
      {activeTab === 'LEDGERS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Chart of Accounts (Ledger Master)</h3>
            <button
              onClick={() => setShowLedgerModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Account Head
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ledgers.map((ldg) => (
              <div
                key={ldg.id}
                className="p-4 bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 shadow-sm space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                      {ldg.code}
                    </span>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">{ldg.name}</h4>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-slate-100 dark:bg-brand-800 text-slate-600 dark:text-slate-300">
                    {ldg.group}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-brand-800 flex justify-between text-xs">
                  <span className="text-slate-400">Current Balance:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₹{Number(ldg.currentBalance || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Voucher Modal */}
      {showVoucherModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-brand-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-brand-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-amber-600 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">New Accounting Voucher (Double Entry)</h3>
                <p className="text-xs text-amber-100">Updates Ledger balances automatically</p>
              </div>
              <button onClick={() => setShowVoucherModal(false)} className="text-amber-200 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Voucher Type *
                  </label>
                  <select
                    value={voucherForm.voucherType}
                    onChange={(e) => setVoucherForm({ ...voucherForm, voucherType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                  >
                    <option value="PAYMENT">Payment Voucher</option>
                    <option value="RECEIPT">Receipt Voucher</option>
                    <option value="JOURNAL">Journal Voucher</option>
                    <option value="CONTRA">Contra (Bank / Cash)</option>
                    <option value="SALES">Sales Voucher</option>
                    <option value="PURCHASE">Purchase Voucher</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={voucherForm.date}
                    onChange={(e) => setVoucherForm({ ...voucherForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Debit Ledger (By Account) *
                  </label>
                  <select
                    required
                    value={voucherForm.debitLedgerId}
                    onChange={(e) => setVoucherForm({ ...voucherForm, debitLedgerId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-xs"
                  >
                    {ledgers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Credit Ledger (To Account) *
                  </label>
                  <select
                    required
                    value={voucherForm.creditLedgerId}
                    onChange={(e) => setVoucherForm({ ...voucherForm, creditLedgerId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-xs"
                  >
                    {ledgers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={voucherForm.amount}
                    onChange={(e) => setVoucherForm({ ...voucherForm, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ref / Cheque / UTR
                  </label>
                  <input
                    type="text"
                    value={voucherForm.referenceNo}
                    onChange={(e) => setVoucherForm({ ...voucherForm, referenceNo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                    placeholder="e.g. UTR89712984"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Narration / Description *
                </label>
                <textarea
                  rows={2}
                  required
                  value={voucherForm.narration}
                  onChange={(e) => setVoucherForm({ ...voucherForm, narration: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                  placeholder="Being amount paid for office rent for Aug 2026..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-brand-800">
                <button
                  type="button"
                  onClick={() => setShowVoucherModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-sm shadow-md"
                >
                  Post Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Ledger Modal */}
      {showLedgerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-brand-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-brand-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-indigo-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">Add Account Head / Ledger</h3>
              <button onClick={() => setShowLedgerModal(false)} className="text-indigo-200 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateLedger} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ledger Name *
                </label>
                <input
                  type="text"
                  required
                  value={ledgerForm.name}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                  placeholder="e.g. AWS Cloud Hosting"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Group Category *
                </label>
                <select
                  value={ledgerForm.group}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, group: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                >
                  <option value="EXPENSE">Expense Account</option>
                  <option value="INCOME">Income / Revenue Account</option>
                  <option value="ASSET">Asset / Bank / Cash</option>
                  <option value="LIABILITY">Liability / Tax / Payable</option>
                  <option value="EQUITY">Capital / Equity</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Opening Balance (₹)
                </label>
                <input
                  type="number"
                  value={ledgerForm.openingBalance}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, openingBalance: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-brand-800">
                <button
                  type="button"
                  onClick={() => setShowLedgerModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm shadow-md"
                >
                  Save Ledger Head
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TallyFinancePage;
