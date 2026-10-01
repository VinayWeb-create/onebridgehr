import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Phone,
  Mail,
  Building2,
  Calendar,
  FileText,
  Trash2,
  Edit2,
  TrendingUp,
  Clock,
  Sparkles,
  ExternalLink,
  Bot,
  Cloud,
  Cpu,
  Shield,
  GitBranch,
  Code2,
  Users,
  Layers,
  Globe,
  HelpCircle,
  Eye,
  X,
  Briefcase,
  LayoutGrid,
  ListFilter,
  CheckCircle2,
  MessageSquare,
  ArrowUpRight,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { crmService, type Lead } from '../../services/crmService';
import { useDialog } from '../../context/DialogContext';
import { CrmNavTabs } from '../../components/CrmNavTabs';

export const ONEBRIDGE_SERVICES = [
  'Cloud Solutions',
  'AI & Automation',
  'DevOps & CI/CD',
  'Cybersecurity',
  'Software Development',
  'Staffing',
  'Digital Transformation',
  'AI Agents',
  'Marketing Cloud',
  'Other',
] as const;

export const TIMELINE_OPTIONS = [
  'Immediate (1 month)',
  '1-3 Months',
  '3-6 Months',
  'Flexible / Exploring',
];

const SERVICE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; badgeBg: string; badgeText: string; border: string; lightBg: string }
> = {
  'Cloud Solutions': {
    label: 'Cloud Solutions',
    icon: <Cloud className="w-3.5 h-3.5" />,
    badgeBg: 'bg-sky-500/10 dark:bg-sky-500/20',
    badgeText: 'text-sky-600 dark:text-sky-400',
    border: 'border-sky-500/30',
    lightBg: 'bg-sky-50 dark:bg-sky-950/30',
  },
  'AI & Automation': {
    label: 'AI & Automation',
    icon: <Cpu className="w-3.5 h-3.5" />,
    badgeBg: 'bg-purple-500/10 dark:bg-purple-500/20',
    badgeText: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500/30',
    lightBg: 'bg-purple-50 dark:bg-purple-950/30',
  },
  'DevOps & CI/CD': {
    label: 'DevOps & CI/CD',
    icon: <GitBranch className="w-3.5 h-3.5" />,
    badgeBg: 'bg-amber-500/10 dark:bg-amber-500/20',
    badgeText: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
    lightBg: 'bg-amber-50 dark:bg-amber-950/30',
  },
  Cybersecurity: {
    label: 'Cybersecurity',
    icon: <Shield className="w-3.5 h-3.5" />,
    badgeBg: 'bg-rose-500/10 dark:bg-rose-500/20',
    badgeText: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/30',
    lightBg: 'bg-rose-50 dark:bg-rose-950/30',
  },
  'Software Development': {
    label: 'Software Development',
    icon: <Code2 className="w-3.5 h-3.5" />,
    badgeBg: 'bg-blue-500/10 dark:bg-blue-500/20',
    badgeText: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/30',
    lightBg: 'bg-blue-50 dark:bg-blue-950/30',
  },
  Staffing: {
    label: 'Staffing',
    icon: <Users className="w-3.5 h-3.5" />,
    badgeBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30',
    lightBg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  'Digital Transformation': {
    label: 'Digital Transformation',
    icon: <Layers className="w-3.5 h-3.5" />,
    badgeBg: 'bg-fuchsia-500/10 dark:bg-fuchsia-500/20',
    badgeText: 'text-fuchsia-600 dark:text-fuchsia-400',
    border: 'border-fuchsia-500/30',
    lightBg: 'bg-fuchsia-50 dark:bg-fuchsia-950/30',
  },
  'AI Agents': {
    label: 'AI Agents',
    icon: <Bot className="w-3.5 h-3.5" />,
    badgeBg: 'bg-indigo-500/15 dark:bg-indigo-500/25',
    badgeText: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-500/30',
    lightBg: 'bg-indigo-50 dark:bg-indigo-950/30',
  },
  'Marketing Cloud': {
    label: 'Marketing Cloud',
    icon: <Globe className="w-3.5 h-3.5" />,
    badgeBg: 'bg-teal-500/10 dark:bg-teal-500/20',
    badgeText: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-500/30',
    lightBg: 'bg-teal-50 dark:bg-teal-950/30',
  },
  Other: {
    label: 'Other',
    icon: <HelpCircle className="w-3.5 h-3.5" />,
    badgeBg: 'bg-slate-500/10 dark:bg-slate-500/20',
    badgeText: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-500/30',
    lightBg: 'bg-slate-50 dark:bg-slate-900',
  },
};

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dotColor: string }
> = {
  NEW: {
    label: 'New Lead',
    bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    text: 'text-blue-600 dark:text-blue-400',
    dotColor: 'bg-blue-500',
  },
  CONTACTED: {
    label: 'Contacted',
    bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    text: 'text-purple-600 dark:text-purple-400',
    dotColor: 'bg-purple-500',
  },
  PROPOSAL_SENT: {
    label: 'Proposal Sent',
    bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    text: 'text-amber-600 dark:text-amber-400',
    dotColor: 'bg-amber-500',
  },
  NEGOTIATING: {
    label: 'Negotiating',
    bg: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    text: 'text-orange-600 dark:text-orange-400',
    dotColor: 'bg-orange-500',
  },
  WON: {
    label: 'Won / Client',
    bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-600 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
  },
  LOST: {
    label: 'Lost',
    bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    text: 'text-rose-600 dark:text-rose-400',
    dotColor: 'bg-rose-500',
  },
};

const STATUS_TABS = [
  { key: 'PIPELINE', label: 'Active Pipeline' },
  { key: 'NEW', label: 'New Leads', color: 'text-blue-600 dark:text-blue-400' },
  { key: 'CONTACTED', label: 'Contacted', color: 'text-purple-600 dark:text-purple-400' },
];

export const LeadsPage: React.FC = () => {
  const navigate = useNavigate();
  const { confirm, alert } = useDialog();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('PIPELINE');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');

  // Modals & Drawers
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);

  const [formData, setFormData] = useState({
    clientName: '',
    companyName: '',
    email: '',
    phone: '',
    serviceOfInterest: 'AI Agents',
    projectDetails: '',
    timeline: '1-3 Months',
    source: 'WEBSITE',
    status: 'NEW' as Lead['status'],
    estimatedValue: 250000,
    notes: '',
    followUpDate: '',
    autoSendEmail: true,
  });

  const loadLeads = async () => {
    try {
      setLoading(true);
      const data = await crmService.getLeads(statusFilter, serviceFilter, search);
      setLeads(data);
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [statusFilter, serviceFilter, search]);

  const handleOpenModal = (lead?: Lead) => {
    if (lead) {
      setEditingLead(lead);
      setFormData({
        clientName: lead.clientName,
        companyName: lead.companyName || '',
        email: lead.email,
        phone: lead.phone,
        serviceOfInterest: lead.serviceOfInterest || 'Other',
        projectDetails: lead.projectDetails || '',
        timeline: lead.timeline || 'Flexible / Exploring',
        source: lead.source || 'WEBSITE',
        status: lead.status,
        estimatedValue: lead.estimatedValue || 0,
        notes: lead.notes || '',
        followUpDate: lead.followUpDate ? lead.followUpDate.split('T')[0] : '',
        autoSendEmail: false,
      });
    } else {
      setEditingLead(null);
      setFormData({
        clientName: '',
        companyName: '',
        email: '',
        phone: '',
        serviceOfInterest: 'AI Agents',
        projectDetails: '',
        timeline: '1-3 Months',
        source: 'WEBSITE',
        status: 'NEW',
        estimatedValue: 300000,
        notes: '',
        followUpDate: '',
        autoSendEmail: true,
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLead) {
        await crmService.updateLead(editingLead.id, formData);
      } else {
        await crmService.createLead(formData);
      }
      setShowModal(false);
      loadLeads();
    } catch (err) {
      console.error('Failed to save lead:', err);
    }
  };

  const handleQuickStatusChange = async (leadId: string, newStatus: Lead['status']) => {
    try {
      await crmService.updateLead(leadId, { status: newStatus });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)));
    } catch (err) {
      console.error('Failed to update lead status:', err);
    }
  };

  const handleSendLeadEmail = async (lead: Lead) => {
    try {
      setSendingEmailId(lead.id);
      const res = await crmService.sendLeadEmail(lead.id);
      await alert({
        title: 'Auto Email Dispatched',
        message: res?.message || `Personalized discovery & welcome acknowledgement email successfully sent to ${lead.email}`,
      });
    } catch (err: any) {
      await alert({
        title: 'Email Dispatch Notice',
        message: err?.response?.data?.message || 'Email logged to system audit trail. Make sure SMTP credentials are set in .env for external relay.',
      });
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Lead',
      message: 'Are you sure you want to permanently delete this lead and its inquiry history?',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (ok) {
      await crmService.deleteLead(id);
      loadLeads();
    }
  };

  const totalValue = leads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);
  const wonValue = leads.filter((l) => l.status === 'WON').reduce((sum, l) => sum + (l.estimatedValue || 0), 0);

  return (
    <div className="space-y-6">
      {/* Sub-Page Navigation Tabs */}
      <CrmNavTabs />

      {/* Header Banner matching HRMS Module Theme */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-brand-900 to-indigo-950 p-6 rounded-3xl border border-brand-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-2">
              <Sparkles className="text-orange-400" size={24} />
              Leads & Inquiries Pipeline
            </h1>
            <span className="flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Website Live Inquiries
            </span>
          </div>
          <p className="text-xs text-brand-300 mt-1 font-medium">
            Manage enterprise inquiries received from{' '}
            <a
              href="https://www.onebridgeinfotech.com/contact"
              target="_blank"
              rel="noreferrer"
              className="text-orange-400 hover:underline font-bold inline-flex items-center gap-1"
            >
              onebridgeinfotech.com/contact
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-indigo-600 hover:from-orange-600 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Enterprise Lead
          </button>
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200/80 dark:border-brand-800 shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Active Leads</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{leads.length}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
              Active Pipeline
            </span>
          </div>
        </div>
        <div className="p-5 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200/80 dark:border-brand-800 shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estimated Pipeline Value</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              ₹{totalValue.toLocaleString('en-IN')}
            </span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
        </div>
        <div className="p-5 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200/80 dark:border-brand-800 shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Closed Won Revenue</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              ₹{wonValue.toLocaleString('en-IN')}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
              Converted
            </span>
          </div>
        </div>
        <div className="p-5 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200/80 dark:border-brand-800 shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">In Active Proposals</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {leads.filter((l) => l.status === 'PROPOSAL_SENT' || l.status === 'NEGOTIATING').length}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
              High Priority
            </span>
          </div>
        </div>
      </div>

      {/* Easy-to-use Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-brand-800">
        {STATUS_TABS.map((tab) => {
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-white dark:bg-brand-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-brand-800 border border-slate-200/80 dark:border-brand-800'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search, Service Filter & View Switcher Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-brand-900 p-4 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by client, company, service..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Service Dropdown Filter */}
          <div className="relative">
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Services (10)</option>
              {ONEBRIDGE_SERVICES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Mode Toggle: Modern Cards vs Table */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-brand-950 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('CARDS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'CARDS'
                ? 'bg-white dark:bg-brand-800 text-indigo-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Cards Feed
          </button>
          <button
            onClick={() => setViewMode('TABLE')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'TABLE'
                ? 'bg-white dark:bg-brand-800 text-indigo-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            Table View
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <span className="w-8 h-8 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin" />
          <p className="text-xs text-slate-400">Loading leads...</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="py-20 text-center bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 p-8">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-brand-950 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">No leads found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Try adjusting your search criteria or add a new enterprise inquiry.
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl cursor-pointer"
          >
            + Create New Lead
          </button>
        </div>
      ) : viewMode === 'CARDS' ? (
        /* User-friendly Rich Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {leads.map((lead) => {
            const srv = SERVICE_CONFIG[lead.serviceOfInterest || 'Other'] || SERVICE_CONFIG['Other'];
            const st = STATUS_CONFIG[lead.status] || STATUS_CONFIG.NEW;

            return (
              <div
                key={lead.id}
                className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-200/80 dark:border-brand-800/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative group"
              >
                {/* Card Top Row */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    {/* Service Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl ${srv.badgeBg} ${srv.badgeText}`}
                    >
                      {srv.icon}
                      {lead.serviceOfInterest || 'General Inquiry'}
                    </span>

                    {/* Quick Status Selector Dropdown */}
                    <div className="relative">
                      <select
                        value={lead.status}
                        onChange={(e) => handleQuickStatusChange(lead.id, e.target.value as any)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-full border cursor-pointer appearance-none pr-6 focus:outline-none ${st.bg}`}
                      >
                        <option value="NEW">New Lead</option>
                        <option value="CONTACTED">Contacted</option>
                        <option value="PROPOSAL_SENT">Proposal Sent</option>
                        <option value="NEGOTIATING">Negotiating</option>
                        <option value="WON">Won / Client</option>
                        <option value="LOST">Lost</option>
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                    </div>
                  </div>

                  {/* Client Info & Company */}
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {lead.clientName}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {lead.companyName ? (
                        <span className="flex items-center gap-1 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {lead.companyName}
                        </span>
                      ) : (
                        <span>Individual / Direct Inquiry</span>
                      )}
                      <span>•</span>
                      <span className="font-mono text-[11px] text-slate-400">{lead.leadNumber}</span>
                    </div>
                  </div>

                  {/* Project Details Snippet */}
                  {lead.projectDetails && (
                    <div
                      onClick={() => setViewingLead(lead)}
                      className="p-3 bg-slate-50 dark:bg-brand-950 rounded-xl text-xs text-slate-700 dark:text-slate-300 line-clamp-2 hover:line-clamp-none cursor-pointer border border-slate-100 dark:border-brand-800 transition-all"
                      title="Click to view full inquiry details"
                    >
                      <p className="font-semibold text-[11px] text-slate-400 mb-0.5 uppercase tracking-wider">
                        Requirement Scope:
                      </p>
                      {lead.projectDetails}
                    </div>
                  )}

                  {/* Contact Info Pills */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <a
                      href={`mailto:${lead.email}`}
                      className="flex items-center gap-1.5 p-2 bg-slate-50 dark:bg-brand-950 hover:bg-indigo-50 dark:hover:bg-brand-800 rounded-lg truncate transition-colors"
                      title={`Send email to ${lead.email}`}
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{lead.email}</span>
                    </a>
                    <a
                      href={`tel:${lead.phone}`}
                      className="flex items-center gap-1.5 p-2 bg-slate-50 dark:bg-brand-950 hover:bg-emerald-50 dark:hover:bg-brand-800 rounded-lg transition-colors"
                      title={`Call ${lead.phone}`}
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{lead.phone}</span>
                    </a>
                  </div>

                  {/* Budget & Timeline Meta */}
                  <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Est. Budget</span>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        ₹{(lead.estimatedValue || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {lead.timeline && (
                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 block">Timeline</span>
                        <span className="font-medium text-xs text-slate-700 dark:text-slate-300">
                          ⏳ {lead.timeline}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-brand-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewingLead(lead)}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-slate-100 dark:bg-brand-800 hover:bg-slate-200 dark:hover:bg-brand-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Scope
                    </button>
                    <button
                      onClick={() => handleSendLeadEmail(lead)}
                      disabled={sendingEmailId === lead.id}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-indigo-50 dark:bg-brand-800 hover:bg-indigo-100 dark:hover:bg-brand-700 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                      title="Dispatch Auto Welcome & Discovery Email"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {sendingEmailId === lead.id ? 'Sending...' : 'Email'}
                    </button>
                    <button
                      onClick={() =>
                        navigate('/crm/quotations', {
                          state: {
                            createFromLead: {
                              leadId: lead.id,
                              clientName: lead.clientName,
                              clientCompany: lead.companyName,
                              clientEmail: lead.email,
                              clientPhone: lead.phone,
                              serviceOfInterest: lead.serviceOfInterest,
                              estimatedValue: lead.estimatedValue,
                            },
                          },
                        })
                      }
                      className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-gradient-to-r from-orange-500 to-indigo-600 hover:from-orange-600 hover:to-indigo-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Quote
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenModal(lead)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-brand-800 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      title="Edit Lead"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(lead.id)}
                      className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-rose-500 transition-colors cursor-pointer"
                      title="Delete Lead"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* High-Density Clean Table View */
        <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-brand-950 text-slate-500 font-semibold border-b border-slate-200 dark:border-brand-800">
                <tr>
                  <th className="py-3.5 px-4">Lead #</th>
                  <th className="py-3.5 px-4">Service</th>
                  <th className="py-3.5 px-4">Client & Company</th>
                  <th className="py-3.5 px-4">Contact Info</th>
                  <th className="py-3.5 px-4">Est. Value</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-brand-800 text-slate-800 dark:text-slate-200">
                {leads.map((lead) => {
                  const srv = SERVICE_CONFIG[lead.serviceOfInterest || 'Other'] || SERVICE_CONFIG['Other'];
                  const st = STATUS_CONFIG[lead.status] || STATUS_CONFIG.NEW;

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-brand-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {lead.leadNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-md ${srv.badgeBg} ${srv.badgeText}`}
                        >
                          {srv.icon}
                          {lead.serviceOfInterest || 'General'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{lead.clientName}</div>
                        {lead.companyName && (
                          <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3" />
                            {lead.companyName}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs space-y-0.5 text-slate-500">
                        <div>{lead.email}</div>
                        <div>{lead.phone}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          ₹{(lead.estimatedValue || 0).toLocaleString('en-IN')}
                        </div>
                        {lead.timeline && (
                          <div className="text-[11px] text-slate-400 mt-0.5">⏳ {lead.timeline}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={lead.status}
                          onChange={(e) => handleQuickStatusChange(lead.id, e.target.value as any)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none ${st.bg}`}
                        >
                          <option value="NEW">New</option>
                          <option value="CONTACTED">Contacted</option>
                          <option value="PROPOSAL_SENT">Proposal Sent</option>
                          <option value="NEGOTIATING">Negotiating</option>
                          <option value="WON">Won</option>
                          <option value="LOST">Lost</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewingLead(lead)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-brand-800 rounded text-slate-500 cursor-pointer"
                            title="View Project Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSendLeadEmail(lead)}
                            disabled={sendingEmailId === lead.id}
                            className="p-1.5 hover:bg-indigo-50 dark:hover:bg-brand-800 rounded text-indigo-600 dark:text-indigo-400 cursor-pointer"
                            title="Auto-dispatch Welcome & Discovery Email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              navigate('/crm/quotations', {
                                state: {
                                  createFromLead: {
                                    leadId: lead.id,
                                    clientName: lead.clientName,
                                    clientCompany: lead.companyName,
                                    clientEmail: lead.email,
                                    clientPhone: lead.phone,
                                    serviceOfInterest: lead.serviceOfInterest,
                                    estimatedValue: lead.estimatedValue,
                                  },
                                },
                              })
                            }
                            className="px-2.5 py-1 bg-gradient-to-r from-orange-500 to-indigo-600 hover:from-orange-600 hover:to-indigo-700 text-white rounded text-xs font-bold transition-all cursor-pointer shadow-xs"
                          >
                            + Quote
                          </button>
                          <button
                            onClick={() => handleOpenModal(lead)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-brand-800 rounded text-slate-500 cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(lead.id)}
                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded text-rose-500 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Enterprise Inquiry View Modal / Drawer */}
      {viewingLead && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-brand-900 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-brand-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Briefcase className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Enterprise Inquiry Scope</h3>
                  <p className="text-xs text-slate-300">Lead: {viewingLead.leadNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingLead(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Header Details */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100 dark:border-brand-800">
                <div>
                  <label className="text-xs font-semibold text-slate-400">Full Name</label>
                  <p className="text-base font-bold text-slate-900 dark:text-white">{viewingLead.clientName}</p>
                  {viewingLead.companyName && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5" />
                      {viewingLead.companyName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400">Service of Interest</label>
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-lg">
                      <Sparkles className="w-3.5 h-3.5" />
                      {viewingLead.serviceOfInterest || 'General Inquiry'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-brand-950 p-4 rounded-xl">
                <div>
                  <label className="text-xs font-semibold text-slate-400">Business Email</label>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {viewingLead.email}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400">Phone Number</label>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {viewingLead.phone}
                  </p>
                </div>
              </div>

              {/* Project Details / Challenge / Goals */}
              <div>
                <label className="text-xs font-semibold text-slate-400">Project Scope & Challenge / Goals</label>
                <div className="mt-1.5 p-4 bg-slate-50 dark:bg-brand-950 rounded-xl border border-slate-200/80 dark:border-brand-800 text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {viewingLead.projectDetails || viewingLead.notes || 'No project description provided.'}
                </div>
              </div>

              {/* Additional Meta */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-brand-950 rounded-xl">
                  <span className="text-slate-400 block mb-0.5">Timeline</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {viewingLead.timeline || 'Flexible'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-brand-950 rounded-xl">
                  <span className="text-slate-400 block mb-0.5">Estimated Budget</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    ₹{(viewingLead.estimatedValue || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-brand-950 rounded-xl">
                  <span className="text-slate-400 block mb-0.5">Status</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">{viewingLead.status}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-brand-800">
                <button
                  type="button"
                  onClick={() => {
                    const l = viewingLead;
                    setViewingLead(null);
                    handleOpenModal(l);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 cursor-pointer"
                >
                  Edit Lead Info
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const l = viewingLead;
                    setViewingLead(null);
                    navigate('/crm/quotations', {
                      state: {
                        createFromLead: {
                          leadId: l.id,
                          clientName: l.clientName,
                          clientCompany: l.companyName,
                          clientEmail: l.email,
                          clientPhone: l.phone,
                          serviceOfInterest: l.serviceOfInterest,
                          estimatedValue: l.estimatedValue,
                        },
                      },
                    });
                  }}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow-md cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  Generate Quotation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-brand-900 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-brand-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">{editingLead ? 'Edit Enterprise Lead' : 'Add New Enterprise Lead'}</h3>
                <p className="text-xs text-slate-300">
                  Matches Onebridge Infotech Website Contact Form Fields
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm text-slate-900 dark:text-white"
                    placeholder="e.g. Rahul Sharma"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm text-slate-900 dark:text-white"
                    placeholder="e.g. Acme Tech Solutions"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Business Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm text-slate-900 dark:text-white"
                    placeholder="client@company.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm text-slate-900 dark:text-white"
                    placeholder="+91 939835 5196"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Service of Interest *
                  </label>
                  <select
                    value={formData.serviceOfInterest}
                    onChange={(e) => setFormData({ ...formData, serviceOfInterest: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm font-semibold text-indigo-600 dark:text-indigo-400"
                  >
                    {ONEBRIDGE_SERVICES.map((srv) => (
                      <option key={srv} value={srv}>
                        {srv}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Timeline
                  </label>
                  <select
                    value={formData.timeline}
                    onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm text-slate-900 dark:text-white"
                  >
                    {TIMELINE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Project Details *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formData.projectDetails}
                  onChange={(e) => setFormData({ ...formData, projectDetails: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm text-slate-900 dark:text-white"
                  placeholder="Share your challenge or goal—architecture, scope, tech stack, and objectives..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm text-slate-900 dark:text-white"
                  >
                    <option value="WEBSITE">Website Form</option>
                    <option value="REFERRAL">Referral</option>
                    <option value="LINKEDIN">LinkedIn</option>
                    <option value="COLD_CALL">Cold Outreach</option>
                    <option value="CAMPAIGN">Ad Campaign</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm text-slate-900 dark:text-white"
                  >
                    <option value="NEW">New Lead</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="PROPOSAL_SENT">Proposal Sent</option>
                    <option value="NEGOTIATING">Negotiating</option>
                    <option value="WON">Won / Client</option>
                    <option value="LOST">Lost</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Est. Value (INR)
                  </label>
                  <input
                    type="number"
                    value={formData.estimatedValue}
                    onChange={(e) => setFormData({ ...formData, estimatedValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm font-semibold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Next Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={formData.followUpDate}
                    onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Internal Notes
                  </label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm text-slate-900 dark:text-white"
                    placeholder="Discovery call notes, key decision makers..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3.5 bg-indigo-50/80 dark:bg-brand-950 rounded-xl border border-indigo-200/60 dark:border-indigo-900/60">
                <input
                  type="checkbox"
                  id="autoSendEmail"
                  checked={formData.autoSendEmail}
                  onChange={(e) => setFormData({ ...formData, autoSendEmail: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer accent-orange-500"
                />
                <label htmlFor="autoSendEmail" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  ⚡ Auto-dispatch Welcome & Discovery Email to Client ({formData.email || 'client email'})
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-brand-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-indigo-600 hover:from-orange-600 hover:to-indigo-700 text-white font-bold rounded-xl text-sm shadow-md cursor-pointer"
                >
                  {editingLead ? 'Update Lead' : 'Save Enterprise Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadsPage;
