import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  FileText,
  Receipt,
  Layers,
  TrendingUp,
  DollarSign,
  Users,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LeadsPage } from './LeadsPage';
import { QuotationsPage } from './QuotationsPage';
import { InvoicesPage } from './InvoicesPage';
import { crmService, type Lead, type Quotation, type Invoice } from '../../services/crmService';

export const CrmHubPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Metrics state
  const [stats, setStats] = useState({
    totalPipeline: 0,
    activeLeadsCount: 0,
    quotationsValue: 0,
    quotationsCount: 0,
    invoicedRevenue: 0,
    pendingReceivables: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Determine active tab from pathname
  const getActiveTab = () => {
    const path = location.pathname.toLowerCase();
    if (path.includes('/quotations')) return 'quotations';
    if (path.includes('/invoices')) return 'invoices';
    return 'leads';
  };

  const activeTab = getActiveTab();

  const handleTabChange = (tabId: string) => {
    navigate(`/crm/${tabId}`);
  };

  // Load high-level executive CRM metrics
  useEffect(() => {
    const fetchCrmStats = async () => {
      try {
        setLoadingStats(true);
        const [leads, quotes, invoices]: [Lead[], Quotation[], Invoice[]] = await Promise.all([
          crmService.getLeads().catch(() => []),
          crmService.getQuotations().catch(() => []),
          crmService.getInvoices().catch(() => []),
        ]);

        const pipelineVal = leads.reduce((sum: number, l) => sum + (Number(l.estimatedValue) || 0), 0);
        const activeLeads = leads.filter((l) => l.status !== 'LOST' && l.status !== 'WON').length;
        const quotesVal = quotes.reduce((sum: number, q) => sum + (Number(q.totalAmount) || 0), 0);
        const invRevenue = invoices.reduce((sum: number, inv) => sum + (Number(inv.amountPaid) || 0), 0);
        const receivables = invoices.reduce((sum: number, inv) => sum + (Number(inv.balanceDue) || 0), 0);

        setStats({
          totalPipeline: pipelineVal,
          activeLeadsCount: activeLeads,
          quotationsValue: quotesVal,
          quotationsCount: quotes.length,
          invoicedRevenue: invRevenue,
          pendingReceivables: receivables,
        });
      } catch (err) {
        console.error('Error fetching CRM overview metrics:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchCrmStats();
  }, [location.pathname]);

  const tabs = [
    {
      id: 'leads',
      label: 'Leads & Pipeline',
      badge: stats.activeLeadsCount ? `${stats.activeLeadsCount} Active` : undefined,
      icon: Sparkles,
      tag: 'Acquisition & Inquiries',
    },
    {
      id: 'quotations',
      label: 'Quotations & Estimates',
      badge: stats.quotationsCount ? `${stats.quotationsCount} Proposals` : undefined,
      icon: FileText,
      tag: 'Pro-forma & GST Proposals',
    },
    {
      id: 'invoices',
      label: 'Tax Invoices & Billing',
      badge: stats.pendingReceivables > 0 ? `₹${(stats.pendingReceivables / 1000).toFixed(0)}k Due` : undefined,
      icon: Receipt,
      tag: 'GST Invoicing & Payments',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner with Executive KPI stats */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-brand-950 to-indigo-950 p-6 md:p-8 rounded-3xl border border-brand-800 shadow-2xl text-white">
        {/* Glow ambient background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-extrabold text-amber-400 uppercase tracking-widest">
                <Layers className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Enterprise CRM Suite</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mt-1">
                Client Relationship & Revenue Pipeline
              </h1>
              <p className="text-xs md:text-sm text-brand-300 max-w-2xl mt-1">
                Unified end-to-end sales lifecycle: lead capturing, automated estimate quotations, and official GST tax invoicing with real-time audit trail.
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-amber-500/30 transition-all">
              <div className="flex items-center justify-between text-xs text-brand-300 font-semibold mb-1">
                <span>Active Pipeline Value</span>
                <TrendingUp className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-xl md:text-2xl font-black text-white">
                {loadingStats ? '...' : `₹${stats.totalPipeline.toLocaleString('en-IN')}`}
              </p>
              <p className="text-[11px] text-amber-300/80 mt-0.5">{stats.activeLeadsCount} active prospects</p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-indigo-500/30 transition-all">
              <div className="flex items-center justify-between text-xs text-brand-300 font-semibold mb-1">
                <span>Proposals Generated</span>
                <FileText className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-xl md:text-2xl font-black text-white">
                {loadingStats ? '...' : `₹${stats.quotationsValue.toLocaleString('en-IN')}`}
              </p>
              <p className="text-[11px] text-indigo-300/80 mt-0.5">{stats.quotationsCount} quotation drafts</p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-emerald-500/30 transition-all">
              <div className="flex items-center justify-between text-xs text-brand-300 font-semibold mb-1">
                <span>Collected Revenue</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xl md:text-2xl font-black text-emerald-400">
                {loadingStats ? '...' : `₹${stats.invoicedRevenue.toLocaleString('en-IN')}`}
              </p>
              <p className="text-[11px] text-emerald-300/80 mt-0.5">Paid into company account</p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-rose-500/30 transition-all">
              <div className="flex items-center justify-between text-xs text-brand-300 font-semibold mb-1">
                <span>Receivables Outstanding</span>
                <Clock className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-xl md:text-2xl font-black text-rose-400">
                {loadingStats ? '...' : `₹${stats.pendingReceivables.toLocaleString('en-IN')}`}
              </p>
              <p className="text-[11px] text-rose-300/80 mt-0.5">Pending client payments</p>
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
                  ? 'text-white shadow-lg shadow-amber-600/20'
                  : 'text-slate-600 dark:text-brand-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-800/60'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeCrmTab"
                  className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 rounded-xl -z-0"
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
          {activeTab === 'leads' && <LeadsPage />}
          {activeTab === 'quotations' && <QuotationsPage />}
          {activeTab === 'invoices' && <InvoicesPage />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default CrmHubPage;
