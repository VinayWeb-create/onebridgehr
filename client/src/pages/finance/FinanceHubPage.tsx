import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FileSearch,
  LayoutDashboard,
  TrendingUp,
  CreditCard,
  PieChart as PieChartIcon,
  ShieldCheck,
  Download,
  Calendar,
  Filter,
  FileText,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TallyFinancePage } from './TallyFinancePage';
import { StatementOcrPage } from './StatementOcrPage';
import { caFinanceService } from '../../services/caFinanceService';
import type { AccountingSummary } from '../../services/caFinanceService';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

const COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444', '#f59e0b'];

export const FinanceHubPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [summaryData, setSummaryData] = useState<AccountingSummary | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [timeFilter, setTimeFilter] = useState('This Month');

  const getActiveTab = () => {
    const path = location.pathname.toLowerCase();
    if (path.includes('/statement-ocr') || path.includes('/statement')) return 'statement-ocr';
    if (path.includes('/tally')) return 'tally';
    return 'dashboard';
  };

  const activeTab = getActiveTab();

  const handleTabChange = (tabId: string) => {
    if (tabId === 'dashboard') {
      navigate(`/finance`);
    } else {
      navigate(`/finance/${tabId}`);
    }
  };

  useEffect(() => {
    const fetchFinanceSummary = async () => {
      try {
        setLoadingStats(true);
        const res = await caFinanceService.getAccountingSummary();
        if (res) {
          setSummaryData(res);
        }
      } catch (err) {
        console.error('Error loading finance metrics:', err);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchFinanceSummary();
  }, [location.pathname]);

  const tabs = [
    {
      id: 'dashboard',
      label: 'Financial & Analytics Tracker',
      badge: 'Overview',
      icon: LayoutDashboard,
      tag: 'KPIs, Charts & Trends',
    },
    {
      id: 'tally',
      label: 'CA & Tally Accounting',
      badge: 'Day Book',
      icon: BookOpen,
      tag: 'Ledger heads & Double-entry',
    },
    {
      id: 'statement-ocr',
      label: 'PDF Statement OCR',
      badge: 'AI Parser',
      icon: FileSearch,
      tag: 'Bank to Vouchers',
    },
  ];

  const handleExport = (type: string) => {
    // Stub export action
    if (type === 'tally') {
      window.open(caFinanceService.getExportUrl(), '_blank');
    } else {
      alert(`Exporting ${type}... (Simulation)`);
    }
  };

  const renderDashboard = () => {
    if (!summaryData) return <div className="p-8 text-center text-slate-500">Loading Dashboard...</div>;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Filters and Export Actions */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-brand-900 p-4 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Quick Filters:</span>
            <div className="flex gap-2">
              {['This Month', 'Last Quarter', 'FY 2026-27'].map((f) => (
                <button
                  key={f}
                  onClick={() => setTimeFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    timeFilter === f
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-brand-800 text-slate-600 dark:text-brand-300 hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-600'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleExport('pdf')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-brand-800 hover:bg-slate-200 dark:hover:bg-brand-700 text-slate-700 dark:text-white rounded-lg text-xs font-bold transition-all">
              <FileText className="w-3.5 h-3.5" /> PDF Report
            </button>
            <button onClick={() => handleExport('excel')} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-800/50 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold transition-all border border-emerald-200 dark:border-emerald-800">
              <Download className="w-3.5 h-3.5" /> Audit Excel
            </button>
            <button onClick={() => handleExport('tally')} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/50 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-bold transition-all border border-indigo-200 dark:border-indigo-800">
              <Download className="w-3.5 h-3.5" /> Tally CSV
            </button>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-brand-900 p-6 rounded-3xl border border-slate-200 dark:border-brand-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              Revenue vs Expenses (Monthly)
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summaryData.monthlyTrends || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `₹${(val / 1000)}k`} />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9', opacity: 0.1 }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
                  <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-brand-900 p-6 rounded-3xl border border-slate-200 dark:border-brand-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-indigo-500" />
              Expense Categorization
            </h3>
            <div className="h-72 flex items-center justify-center">
              {summaryData.expenseBreakdown && summaryData.expenseBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summaryData.expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {summaryData.expenseBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => `₹${Number(value || 0).toLocaleString()}`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} layout="vertical" verticalAlign="middle" align="right" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-slate-400 text-sm">No expense data available</div>
              )}
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="bg-white dark:bg-brand-900 p-6 rounded-3xl border border-slate-200 dark:border-brand-800 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            Cash Flow & Profit Margin Trendline
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summaryData.monthlyTrends || []}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `₹${(val / 1000)}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="profit" name="Net Profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Executive Finance KPI stats */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 p-6 md:p-8 rounded-3xl border border-brand-800 shadow-2xl text-white">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-extrabold text-orange-400 uppercase tracking-widest">
                <LayoutDashboard className="w-4 h-4 text-orange-400 animate-pulse" />
                <span>Financial & Analytics Tracker</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mt-1">
                Executive Finance Dashboard
              </h1>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-emerald-500/30 transition-all group">
              <div className="flex items-center justify-between text-xs text-brand-300 font-semibold mb-1">
                <span>Gross Revenue</span>
                <TrendingUp className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-xl md:text-2xl font-black text-white">
                {loadingStats || !summaryData ? '...' : `₹${summaryData.summary.totalSalesRevenue.toLocaleString('en-IN')}`}
              </p>
              <div className="flex items-center gap-1 mt-1 text-[10px] font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Incomes Generated
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-rose-500/30 transition-all group">
              <div className="flex items-center justify-between text-xs text-brand-300 font-semibold mb-1">
                <span>Total Expenses</span>
                <CreditCard className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-xl md:text-2xl font-black text-white">
                {loadingStats || !summaryData ? '...' : `₹${summaryData.summary.totalAllExpenses.toLocaleString('en-IN')}`}
              </p>
              <div className="flex items-center gap-1 mt-1 text-[10px] font-medium text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-full w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                Payroll + Ops + Software
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-indigo-500/30 transition-all group">
              <div className="flex items-center justify-between text-xs text-brand-300 font-semibold mb-1">
                <span>Net Operating Profit</span>
                <PieChartIcon className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              </div>
              <p
                className={`text-xl md:text-2xl font-black ${
                  summaryData && summaryData.summary.netProfit >= 0 ? 'text-indigo-400' : 'text-rose-400'
                }`}
              >
                {loadingStats || !summaryData ? '...' : `₹${summaryData.summary.netProfit.toLocaleString('en-IN')}`}
              </p>
              <div className="flex items-center gap-1 mt-1 text-[10px] font-medium text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-full w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                Pre-Tax Margin
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-amber-500/30 transition-all group">
              <div className="flex items-center justify-between text-xs text-brand-300 font-semibold mb-1">
                <span>Net GST Payable</span>
                <ShieldCheck className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-xl md:text-2xl font-black text-amber-400">
                {loadingStats || !summaryData ? '...' : `₹${summaryData.summary.netGstPayable.toLocaleString('en-IN')}`}
              </p>
              <div className="flex items-center gap-1 mt-1 text-[10px] font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Tax Ledgers Recon
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subpage Tabs Navigation */}
      <div className="bg-white dark:bg-brand-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm flex flex-col sm:flex-row gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`relative flex-1 flex items-center justify-between px-4 py-3.5 rounded-xl font-bold transition-all duration-300 cursor-pointer ${
                isActive
                  ? 'text-white shadow-lg shadow-orange-600/20'
                  : 'text-slate-600 dark:text-brand-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-800/60'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeFinanceTab"
                  className="absolute inset-0 bg-gradient-to-r from-orange-500 via-orange-600 to-indigo-600 rounded-xl -z-0"
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
              <div className="relative z-10 flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-brand-800 text-slate-500 dark:text-brand-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold leading-tight">{tab.label}</div>
                  <div className="text-[10px] font-medium opacity-80 mt-0.5">{tab.tag}</div>
                </div>
              </div>
              {tab.badge && (
                <span
                  className={`relative z-10 text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                    isActive
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-brand-100 dark:bg-brand-800 text-brand-600 dark:text-brand-300 border border-brand-200/50 dark:border-brand-700/50'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content Sub-Pages with Smooth Crossfade */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'tally' && <TallyFinancePage />}
          {activeTab === 'statement-ocr' && <StatementOcrPage />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default FinanceHubPage;
