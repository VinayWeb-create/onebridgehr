import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Download,
  Calendar,
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
  Landmark,
  FileText,
  Activity,
  Briefcase,
  DollarSign,
  BarChart3,
  Filter,
  Check,
  Building2,
  Wallet,
  Coins,
  ArrowRightLeft,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  caFinanceService,
  type AccountingSummary,
  type FinanceLedger,
  type FinanceVoucher,
} from '../../services/caFinanceService';
import { useDialog } from '../../context/DialogContext';

const LEDGER_GROUP_COLORS: Record<string, string> = {
  EXPENSE: '#f43f5e',
  REVENUE: '#10b981',
  ASSET: '#6366f1',
  LIABILITY: '#f59e0b',
  EQUITY: '#8b5cf6',
};

export const TallyFinancePage: React.FC = () => {
  const { confirm } = useDialog();

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'DAYBOOK' | 'PNL' | 'GST' | 'LEDGERS'>('DASHBOARD');
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [ledgers, setLedgers] = useState<FinanceLedger[]>([]);
  const [vouchers, setVouchers] = useState<FinanceVoucher[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for Day Book & Ledgers
  const [voucherFilter, setVoucherFilter] = useState('ALL');
  const [ledgerGroupFilter, setLedgerGroupFilter] = useState('ALL');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);

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

  // Visual Analytics Data Computations
  const ledgerGroupChartData = useMemo(() => {
    const map: Record<string, number> = {};
    ledgers.forEach((l) => {
      const g = l.group || 'EXPENSE';
      map[g] = (map[g] || 0) + Math.abs(Number(l.currentBalance || 0));
    });
    return Object.entries(map).map(([group, val]) => ({
      name: group,
      value: val,
      color: LEDGER_GROUP_COLORS[group] || '#6366f1',
    }));
  }, [ledgers]);

  const voucherTypeBreakdown = useMemo(() => {
    const map: Record<string, { count: number; totalAmount: number }> = {
      PAYMENT: { count: 0, totalAmount: 0 },
      RECEIPT: { count: 0, totalAmount: 0 },
      JOURNAL: { count: 0, totalAmount: 0 },
      CONTRA: { count: 0, totalAmount: 0 },
      SALES: { count: 0, totalAmount: 0 },
      PURCHASE: { count: 0, totalAmount: 0 },
    };
    vouchers.forEach((v) => {
      const t = v.voucherType || 'PAYMENT';
      if (!map[t]) map[t] = { count: 0, totalAmount: 0 };
      map[t].count += 1;
      map[t].totalAmount += Number(v.amount || 0);
    });
    return Object.entries(map).map(([type, stats]) => ({
      type,
      count: stats.count,
      amount: stats.totalAmount,
    }));
  }, [vouchers]);

  const daybookTimelineData = useMemo(() => {
    const dayMap: Record<string, { date: string; debits: number; credits: number }> = {};
    vouchers.forEach((v) => {
      const d = new Date(v.date).toISOString().slice(5, 10);
      if (!dayMap[d]) dayMap[d] = { date: d, debits: 0, credits: 0 };
      if (v.voucherType === 'RECEIPT' || v.voucherType === 'SALES') {
        dayMap[d].credits += Number(v.amount);
      } else {
        dayMap[d].debits += Number(v.amount);
      }
    });
    return Object.values(dayMap);
  }, [vouchers]);

  const filteredLedgers = useMemo(() => {
    return ledgers.filter((l) => {
      if (ledgerGroupFilter !== 'ALL' && l.group !== ledgerGroupFilter) return false;
      if (ledgerSearch) {
        const s = ledgerSearch.toLowerCase();
        return (
          l.name.toLowerCase().includes(s) ||
          (l.code || '').toLowerCase().includes(s) ||
          (l.description || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [ledgers, ledgerGroupFilter, ledgerSearch]);

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 p-6 sm:p-8 rounded-3xl border border-amber-500/20 shadow-2xl text-white w-full">
        <div className="flex items-start sm:items-center gap-4">
          <div className="p-3.5 bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 rounded-2xl shadow-lg shadow-amber-500/20 flex-shrink-0">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Tally Prime & ERP 9 Engine
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Double-Entry Audit Ready
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1.5">
              Tally Accounting & Double-Entry Ledgers
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Multi-dimensional ledger heads, real-time Day Book journal entries, P&L statements, and 1-Click Tally XML/CSV sync.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <a
            href={caFinanceService.getExportUrl()}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-xs backdrop-blur-sm border border-white/10 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            Export Tally CSV
          </a>

          <button
            onClick={() => setShowLedgerModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs border border-slate-700 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            Add Ledger Head
          </button>

          <button
            onClick={() => setShowVoucherModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Double-Entry Voucher
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full">
          <div className="p-5 bg-slate-900/95 dark:bg-brand-900/95 rounded-3xl border border-slate-700/60 dark:border-brand-800 shadow-xl space-y-2 backdrop-blur-xl">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Gross Sales Revenue</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-white">
              ₹{summary.summary.totalSalesRevenue.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-emerald-400/80 font-semibold">From Invoiced Client Sales</p>
          </div>

          <div className="p-5 bg-slate-900/95 dark:bg-brand-900/95 rounded-3xl border border-slate-700/60 dark:border-brand-800 shadow-xl space-y-2 backdrop-blur-xl">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Operating Costs</span>
              <ArrowDownRight className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-rose-400">
              ₹{summary.summary.totalAllExpenses.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-400">Includes ₹{summary.summary.totalPayrollExpense.toLocaleString('en-IN')} payroll</p>
          </div>

          <div className="p-5 bg-slate-900/95 dark:bg-brand-900/95 rounded-3xl border border-slate-700/60 dark:border-brand-800 shadow-xl space-y-2 backdrop-blur-xl">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Net Operating Margin</span>
              <Scale className="w-4 h-4 text-indigo-400" />
            </div>
            <p className={`text-xl sm:text-2xl font-black ${summary.summary.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{summary.summary.netProfit.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-400">Revenue minus All Operating Costs</p>
          </div>

          <div className="p-5 bg-slate-900/95 dark:bg-brand-900/95 rounded-3xl border border-slate-700/60 dark:border-brand-800 shadow-xl space-y-2 backdrop-blur-xl">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Net GST Liability</span>
              <Receipt className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-amber-400">
              ₹{summary.summary.netGstPayable.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-400">Output GST minus Input Tax Credit</p>
          </div>
        </div>
      )}

      {/* Navigation View Switcher Tabs */}
      <div className="flex items-center gap-2 bg-slate-900/95 dark:bg-brand-900/95 p-2 rounded-2xl border border-slate-700/60 dark:border-brand-800 shadow-xl overflow-x-auto w-full">
        {[
          { id: 'DASHBOARD', label: 'Accounting Intelligence & Visuals', icon: BarChart3 },
          { id: 'LEDGERS', label: `Chart of Accounts (${ledgers.length})`, icon: Layers },
          { id: 'DAYBOOK', label: `Day Book Journal (${vouchers.length})`, icon: BookOpen },
          { id: 'PNL', label: 'Profit & Loss Statement', icon: TrendingUp },
          { id: 'GST', label: 'GST & Tax Reconciliations', icon: Receipt },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: VISUAL ACCOUNTING INTELLIGENCE */}
      {activeTab === 'DASHBOARD' && (
        <div className="space-y-6 w-full">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
            {/* 1. Day Book Inflow vs Outflow Timeline */}
            <div className="lg:col-span-7 p-6 sm:p-7 bg-slate-900/95 dark:bg-brand-900/95 rounded-3xl border border-slate-700/60 dark:border-brand-800 shadow-2xl space-y-4 flex flex-col justify-between backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    Double-Entry Transaction Flow (Debits vs Credits)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Day-by-day financial postings across Payment and Receipt vouchers
                  </p>
                </div>
                <span className="text-[11px] font-bold text-indigo-400 bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1 rounded-full">
                  Live Postings
                </span>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daybookTimelineData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.25} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#cbd5e1' }} stroke="#64748b" />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#cbd5e1' }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      stroke="#64748b"
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                        name === 'credits' ? 'Credits / Inflows' : 'Debits / Outflows',
                      ]}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#475569',
                        borderRadius: '16px',
                        color: '#fff',
                        fontSize: '12px',
                        boxShadow: '0 20px 30px rgba(0,0,0,0.5)',
                        padding: '12px',
                      }}
                    />
                    <Legend
                      formatter={(val) => (val === 'credits' ? 'Credits / Inflows (Receipts)' : 'Debits / Outflows (Payments)')}
                      wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    />
                    <Bar dataKey="credits" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="debits" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Chart of Accounts Balance Distribution Donut */}
            <div className="lg:col-span-5 p-6 sm:p-7 bg-slate-900/95 dark:bg-brand-900/95 rounded-3xl border border-slate-700/60 dark:border-brand-800 shadow-2xl space-y-4 flex flex-col justify-between backdrop-blur-xl">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <PieIcon className="w-5 h-5 text-amber-400" />
                  Ledger Group Capital Distribution
                </h3>
                <p className="text-xs text-slate-400">
                  Total ledger balances grouped by accounting classifications
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="h-52 w-52 relative flex-shrink-0 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ledgerGroupChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {ledgerGroupChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Balance']}
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#475569', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ledgers</span>
                    <span className="text-sm font-black text-white">{ledgers.length} Heads</span>
                  </div>
                </div>

                <div className="flex-1 w-full space-y-2 max-h-56 overflow-y-auto pr-1">
                  {ledgerGroupChartData.map((g) => (
                    <div key={g.name} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                        <span className="text-slate-200 font-bold">{g.name}</span>
                      </div>
                      <span className="font-bold text-white">₹{g.value.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Voucher Types Matrix & Expense Heads */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
            {voucherTypeBreakdown.map((item) => (
              <div
                key={item.type}
                className="p-5 bg-slate-900/95 dark:bg-brand-900/95 rounded-3xl border border-slate-700/60 dark:border-brand-800 shadow-xl flex items-center justify-between backdrop-blur-xl"
              >
                <div>
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    {item.type} Vouchers
                  </span>
                  <p className="font-extrabold text-lg text-white mt-2">
                    ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-slate-400">{item.count}</span>
                  <p className="text-[10px] text-slate-500 font-semibold">Entries</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: CHART OF ACCOUNTS (LEDGERS) */}
      {activeTab === 'LEDGERS' && (
        <div className="space-y-4 w-full">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/95 dark:bg-brand-900/95 p-4 rounded-3xl border border-slate-700/60 dark:border-brand-800 shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  placeholder="Search ledger accounts..."
                  className="pl-9 pr-4 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-500 w-64 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="flex items-center bg-slate-800 p-1 rounded-xl">
                {(['ALL', 'ASSET', 'LIABILITY', 'EXPENSE', 'REVENUE'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setLedgerGroupFilter(g)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      ledgerGroupFilter === g
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowLedgerModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Ledger Head
            </button>
          </div>

          {/* Ledgers Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
            {filteredLedgers.map((ldg) => (
              <div
                key={ldg.id}
                className="p-5 bg-slate-900/95 dark:bg-brand-900/95 rounded-3xl border border-slate-700/60 dark:border-brand-800 shadow-xl space-y-3 backdrop-blur-xl hover:border-amber-500/40 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[11px] text-amber-400 font-bold">
                      {ldg.code}
                    </span>
                    <h4 className="font-bold text-sm text-white mt-0.5">{ldg.name}</h4>
                  </div>
                  <span
                    className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase"
                    style={{
                      backgroundColor: `${LEDGER_GROUP_COLORS[ldg.group] || '#6366f1'}20`,
                      color: LEDGER_GROUP_COLORS[ldg.group] || '#6366f1',
                      border: `1px solid ${LEDGER_GROUP_COLORS[ldg.group] || '#6366f1'}40`,
                    }}
                  >
                    {ldg.group}
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-1">{ldg.description || 'General accounting head'}</p>

                <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Current Balance:</span>
                  <span className="font-bold text-sm text-white font-mono">
                    ₹{Number(ldg.currentBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: DAY BOOK & JOURNAL VOUCHERS */}
      {activeTab === 'DAYBOOK' && (
        <div className="space-y-4 w-full">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/95 dark:bg-brand-900/95 p-4 rounded-3xl border border-slate-700/60 dark:border-brand-800 shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={voucherFilter}
                onChange={(e) => setVoucherFilter(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none"
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
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <div className="bg-slate-900/95 dark:bg-brand-900/95 rounded-3xl border border-slate-700/60 dark:border-brand-800 overflow-hidden shadow-2xl backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-800/80 text-slate-400 font-sans font-bold border-b border-slate-700/60">
                  <tr>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Voucher No</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Debit Ledger (Dr.)</th>
                    <th className="py-3.5 px-4">Credit Ledger (Cr.)</th>
                    <th className="py-3.5 px-4">Narration</th>
                    <th className="py-3.5 px-4 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {vouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 text-xs font-sans text-slate-400">
                        {new Date(v.date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-bold text-amber-400">
                        {v.voucherNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-sans font-bold ${
                          v.voucherType === 'RECEIPT' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {v.voucherType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-sans font-semibold text-indigo-400">
                        {v.debitLedger?.name || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-sans text-slate-400">
                        {v.creditLedger?.name || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-sans text-slate-400 truncate max-w-xs">
                        {v.narration}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-white">
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

      {/* TAB 4: PROFIT & LOSS */}
      {activeTab === 'PNL' && summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          <div className="bg-slate-900/95 dark:bg-brand-900/95 p-6 sm:p-7 rounded-3xl border border-slate-700/60 dark:border-brand-800 shadow-2xl space-y-4 backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                Operating Revenue & Income
              </h3>
              <span className="font-bold text-emerald-400">
                ₹{summary.summary.totalSalesRevenue.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400">Software Development & IT Revenue</span>
                <span className="font-semibold text-white">
                  ₹{summary.summary.totalSalesRevenue.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/95 dark:bg-brand-900/95 p-6 sm:p-7 rounded-3xl border border-slate-700/60 dark:border-brand-800 shadow-2xl space-y-4 backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-rose-400" />
                Operational Expenses
              </h3>
              <span className="font-bold text-rose-400">
                ₹{summary.summary.totalAllExpenses.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800/60 font-semibold text-indigo-400">
                <span>Employee Salaries (Synced from HRMS)</span>
                <span>₹{summary.summary.totalPayrollExpense.toLocaleString('en-IN')}</span>
              </div>
              {summary.expenseBreakdown
                .filter((e) => !e.name.includes('Payroll'))
                .map((e, idx) => (
                  <div key={idx} className="flex justify-between py-1.5 border-b border-slate-800/60 text-slate-400">
                    <span>{e.name}</span>
                    <span className="font-semibold text-white">₹{e.value.toLocaleString('en-IN')}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: GST & TAX RECONCILIATIONS */}
      {activeTab === 'GST' && summary && (
        <div className="p-6 sm:p-7 bg-slate-900/95 dark:bg-brand-900/95 rounded-3xl border border-slate-700/60 dark:border-brand-800 shadow-2xl space-y-6 backdrop-blur-xl w-full">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-lg text-white">GST Summary & CA Reconciliation</h3>
              <p className="text-xs text-slate-400">GSTR-1 Outward sales tax liability vs GSTR-3B Input tax credit</p>
            </div>
            <span className="text-xs px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full font-bold border border-emerald-500/30">
              GSTN Compliant
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/60">
              <span className="text-xs text-slate-400 font-semibold uppercase">Output GST (Collected)</span>
              <p className="text-xl font-bold text-white mt-1">
                ₹{summary.summary.totalGstCollected.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">From Invoiced Client Sales</p>
            </div>

            <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/60">
              <span className="text-xs text-slate-400 font-semibold uppercase">Input GST (Tax Credit)</span>
              <p className="text-xl font-bold text-emerald-400 mt-1">
                ₹{summary.summary.totalInputGst.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">From Eligible Vendor & Cloud Bills</p>
            </div>

            <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/30">
              <span className="text-xs text-amber-300 font-semibold uppercase">Net Tax Payable to Govt</span>
              <p className="text-xl font-bold text-amber-400 mt-1">
                ₹{summary.summary.netGstPayable.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-amber-400/80 mt-1">To be remitted before monthly return</p>
            </div>
          </div>
        </div>
      )}

      {/* New Voucher Modal */}
      {showVoucherModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-white">
            <div className="p-5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">New Accounting Voucher (Double Entry)</h3>
                <p className="text-xs text-slate-900 font-medium">Updates Ledger balances automatically</p>
              </div>
              <button onClick={() => setShowVoucherModal(false)} className="text-slate-900 font-bold hover:text-black cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Voucher Type *
                  </label>
                  <select
                    value={voucherForm.voucherType}
                    onChange={(e) => setVoucherForm({ ...voucherForm, voucherType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={voucherForm.date}
                    onChange={(e) => setVoucherForm({ ...voucherForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Debit Ledger (By Account) *
                  </label>
                  <select
                    required
                    value={voucherForm.debitLedgerId}
                    onChange={(e) => setVoucherForm({ ...voucherForm, debitLedgerId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    {ledgers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.group})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Credit Ledger (To Account) *
                  </label>
                  <select
                    required
                    value={voucherForm.creditLedgerId}
                    onChange={(e) => setVoucherForm({ ...voucherForm, creditLedgerId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    {ledgers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.group})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={voucherForm.amount || ''}
                  onChange={(e) => setVoucherForm({ ...voucherForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white font-mono"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Narration / Remarks
                </label>
                <textarea
                  rows={2}
                  value={voucherForm.narration}
                  onChange={(e) => setVoucherForm({ ...voucherForm, narration: e.target.value })}
                  placeholder="Payment details or invoice reference..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowVoucherModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  Post Voucher Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Ledger Modal */}
      {showLedgerModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 w-full max-w-md rounded-3xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-white">
            <div className="p-5 bg-indigo-600 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Add Account Head (Ledger)</h3>
                <p className="text-xs text-indigo-100">Create new Tally Chart of Accounts entity</p>
              </div>
              <button onClick={() => setShowLedgerModal(false)} className="text-indigo-200 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLedger} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ledger Name *
                </label>
                <input
                  type="text"
                  required
                  value={ledgerForm.name}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, name: e.target.value })}
                  placeholder="e.g. AWS Cloud Services / Office Stationery"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ledger Group *
                </label>
                <select
                  value={ledgerForm.group}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, group: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-bold"
                >
                  <option value="EXPENSE">Expense (Indirect / Operating)</option>
                  <option value="REVENUE">Revenue / Direct Income</option>
                  <option value="ASSET">Asset (Bank / Cash / Receivables)</option>
                  <option value="LIABILITY">Liability (GST / Tax / Payables)</option>
                  <option value="EQUITY">Capital / Equity Account</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Opening Balance (₹)
                </label>
                <input
                  type="number"
                  value={ledgerForm.openingBalance || ''}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, openingBalance: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLedgerModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-indigo-600/20"
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
