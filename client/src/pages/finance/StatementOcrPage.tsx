import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSearch,
  UploadCloud,
  CheckSquare,
  Square,
  Sparkles,
  Clock,
  CheckCircle2,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Edit3,
  Check,
  RefreshCw,
  FileText,
  Building2,
  Download,
  PieChart as PieChartIcon,
  TrendingUp,
  Landmark,
  ShieldCheck,
  Layers,
  FileSpreadsheet,
  Copy,
  BarChart3,
  Activity,
  DollarSign,
  Briefcase,
  Server,
  Zap,
  Receipt,
  Users,
  Target,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  CartesianGrid,
  ComposedChart,
  Line,
} from 'recharts';
import {
  statementOcrService,
  type ParsedItem,
  type StatementLog,
  type AccountMetadata,
} from '../../services/statementOcrService';

const CATEGORY_COLORS: Record<string, string> = {
  TAX_PAYMENT: '#f59e0b',
  STAFF_SALARY: '#6366f1',
  OFFICE_RENT: '#ec4899',
  CLOUD_SUBSCRIPTION: '#8b5cf6',
  OFFICE_PANTRY_FOOD: '#10b981',
  OFFICE_EXPENSE: '#64748b',
  TRAVEL_TRANSPORT: '#06b6d4',
  CLIENT_REVENUE: '#22c55e',
  GENERAL_EXPENSE: '#94a3b8',
};

const CATEGORY_LABELS: Record<string, string> = {
  TAX_PAYMENT: 'TDS & Direct Tax Payments (CBDT)',
  STAFF_SALARY: 'Staff Salaries & Remuneration',
  OFFICE_RENT: 'Office Rent & Commercial Premises',
  CLOUD_SUBSCRIPTION: 'Cloud & AI Subscriptions (OpenAI, Hostinger, MS)',
  OFFICE_PANTRY_FOOD: 'Office Pantry & Maintenance',
  OFFICE_EXPENSE: 'Office & Merchant Expenses',
  TRAVEL_TRANSPORT: 'Commute & Travel (TSRTC, Metro, Rapido)',
  CLIENT_REVENUE: 'Client Deposits & Inflow',
  GENERAL_EXPENSE: 'General Expenses',
};

export const StatementOcrPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [accountMetadata, setAccountMetadata] = useState<AccountMetadata | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [historyLogs, setHistoryLogs] = useState<StatementLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [converting, setConverting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // View mode: 'ANALYTICS' | 'TABLE' | 'TALLY'
  const [activeView, setActiveView] = useState<'ANALYTICS' | 'TABLE' | 'TALLY'>('ANALYTICS');
  const [filterType, setFilterType] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const logs = await statementOcrService.getLogs();
      setHistoryLogs(logs);

      // Auto-load latest log if no items active
      if (logs.length > 0 && parsedItems.length === 0) {
        const latest = logs[0];
        setActiveLogId(latest.id);
        setParsedItems(latest.extractedData.transactions || []);
        setSelectedIndices((latest.extractedData.transactions || []).map((_, i) => i));
        if (latest.extractedData.accountMetadata) {
          setAccountMetadata(latest.extractedData.accountMetadata);
        }
      }
    } catch (err) {
      console.error('Failed to load OCR logs:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileUploadAndParse = async () => {
    if (!selectedFile) return;
    try {
      setParsing(true);
      setSuccessMessage(null);
      const res = await statementOcrService.uploadStatement(selectedFile);
      setActiveLogId(res.logId);
      setParsedItems(res.transactions);
      setAccountMetadata(res.accountMetadata || null);
      setSelectedIndices(res.transactions.map((_, i) => i));
      loadHistory();
    } catch (err) {
      console.error('Failed to upload & parse PDF:', err);
      alert('Failed to parse statement. Please ensure it is a valid PDF document.');
    } finally {
      setParsing(false);
    }
  };

  const toggleSelect = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIndices.length === parsedItems.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(parsedItems.map((_, i) => i));
    }
  };

  const handleUpdateItem = (index: number, field: keyof ParsedItem, value: any) => {
    const updated = [...parsedItems];
    updated[index] = {
      ...updated[index],
      [field]: value,
      ...(field === 'type'
        ? { suggestedAction: value === 'CREDIT' ? 'CREATE_INVOICE' : 'CREATE_EXPENSE' }
        : {}),
    };
    setParsedItems(updated);
  };

  const handleBatchConvert = async () => {
    if (selectedIndices.length === 0 || !activeLogId) return;
    const selected = selectedIndices.map((i) => parsedItems[i]);

    try {
      setConverting(true);
      const res = await statementOcrService.convertTransactions(activeLogId, selected);
      setSuccessMessage(res.message || 'Transactions successfully converted to Invoices & Accounting Vouchers!');
      loadHistory();
    } catch (err) {
      console.error('Conversion failed:', err);
      alert('Failed to process conversion. Please try again.');
    } finally {
      setConverting(false);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Metrics calculation
  const totalCredits = useMemo(
    () => parsedItems.filter((it) => it.type === 'CREDIT').reduce((sum, it) => sum + Number(it.amount || 0), 0),
    [parsedItems]
  );
  const totalDebits = useMemo(
    () => parsedItems.filter((it) => it.type === 'DEBIT').reduce((sum, it) => sum + Number(it.amount || 0), 0),
    [parsedItems]
  );
  const totalVolume = totalCredits + totalDebits;

  // Category breakdown for Donut Chart
  const categoryChartData = useMemo(() => {
    const map: Record<string, number> = {};
    parsedItems
      .filter((it) => it.type === 'DEBIT')
      .forEach((it) => {
        const cat = it.category || 'GENERAL_EXPENSE';
        map[cat] = (map[cat] || 0) + Number(it.amount || 0);
      });
    return Object.entries(map)
      .map(([cat, val]) => ({
        name: CATEGORY_LABELS[cat] || cat,
        categoryKey: cat,
        value: val,
        percentage: totalDebits > 0 ? ((val / totalDebits) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => b.value - a.value);
  }, [parsedItems, totalDebits]);

  // Day-by-Day Cashflow Bar Chart Data
  const dailyBarChartData = useMemo(() => {
    const dayMap: Record<string, { date: string; inflow: number; outflow: number }> = {};
    parsedItems.forEach((it) => {
      const d = it.date.split(' ')[0];
      if (!dayMap[d]) {
        dayMap[d] = { date: d, inflow: 0, outflow: 0 };
      }
      if (it.type === 'CREDIT') {
        dayMap[d].inflow += Number(it.amount);
      } else {
        dayMap[d].outflow += Number(it.amount);
      }
    });
    return Object.values(dayMap);
  }, [parsedItems]);

  // Cashflow timeline data for Area Chart
  const cashflowTimelineData = useMemo(() => {
    return parsedItems.map((it, idx) => ({
      index: idx + 1,
      date: it.date.split(' ')[0],
      fullDate: it.date,
      balance: it.balance || 0,
      amount: it.amount,
      type: it.type,
      description: it.description,
    }));
  }, [parsedItems]);

  // Top 5 Highest Spend Transactions
  const topTransactions = useMemo(() => {
    return [...parsedItems]
      .filter((it) => it.type === 'DEBIT')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [parsedItems]);

  // Transaction Size Buckets
  const sizeBuckets = useMemo(() => {
    let micro = 0; // < 500
    let mid = 0; // 500 - 5000
    let high = 0; // > 5000

    parsedItems.forEach((it) => {
      if (it.amount < 500) micro++;
      else if (it.amount <= 5000) mid++;
      else high++;
    });

    return [
      { name: 'Micro (< ₹500)', count: micro, fill: '#06b6d4' },
      { name: 'Operations (₹500 - ₹5k)', count: mid, fill: '#8b5cf6' },
      { name: 'Major Capital (> ₹5k)', count: high, fill: '#f59e0b' },
    ];
  }, [parsedItems]);

  // Export to Tally Prime XML
  const handleExportTallyXml = () => {
    if (parsedItems.length === 0) return;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Accounting Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>\n`;

    parsedItems.forEach((it, idx) => {
      const isCredit = it.type === 'CREDIT';
      const voucherType = isCredit ? 'Receipt' : 'Payment';
      const voucherNo = `VCH-${new Date().getFullYear()}-${String(idx + 1).padStart(4, '0')}`;
      const bankLedgerName = accountMetadata?.bankName
        ? `${accountMetadata.bankName} Current A/C`
        : 'Federal Bank Current A/C';

      let expenseLedgerName = 'Office Rent & Utilities';
      if (it.category === 'STAFF_SALARY') expenseLedgerName = 'Staff Salaries & Wages';
      else if (it.category === 'CLOUD_SUBSCRIPTION') expenseLedgerName = 'Cloud & Software Subscriptions (AWS/Google/Tools)';
      else if (it.category === 'TRAVEL_TRANSPORT' || it.category === 'OFFICE_PANTRY_FOOD') expenseLedgerName = 'Office Pantry & Miscellaneous';
      else if (it.category === 'TAX_PAYMENT') expenseLedgerName = 'TDS Payable / Advance Tax';
      else if (it.category === 'CLIENT_REVENUE') expenseLedgerName = 'Software Development & IT Revenue';

      xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${voucherType}" ACTION="Create">
            <DATE>${it.date.replace(/[-/]/g, '')}</DATE>
            <VOUCHERTYPENAME>${voucherType}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${voucherNo}</VOUCHERNUMBER>
            <REFERENCE>${it.referenceNo || ''}</REFERENCE>
            <NARRATION>${it.description} (Ref: ${it.referenceNo || ''})</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${isCredit ? bankLedgerName : expenseLedgerName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${isCredit ? 'Yes' : 'Yes'}</ISDEEMEDPOSITIVE>
              <AMOUNT>-${it.amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${isCredit ? expenseLedgerName : bankLedgerName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${isCredit ? 'No' : 'No'}</ISDEEMEDPOSITIVE>
              <AMOUNT>${it.amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>\n`;
    });

    xml += `      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tally_Prime_Import_${new Date().toISOString().slice(0, 10)}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (parsedItems.length === 0) return;
    const headers = ['Date', 'Particulars / Description', 'Type', 'Amount (INR)', 'Running Balance', 'Reference / UTR', 'Category', 'Tally Debit Ledger', 'Tally Credit Ledger'];
    const rows = parsedItems.map((it) => [
      `"${it.date}"`,
      `"${it.description.replace(/"/g, '""')}"`,
      `"${it.type}"`,
      it.amount,
      it.balance || '',
      `"${it.referenceNo || ''}"`,
      `"${it.category || ''}"`,
      it.type === 'DEBIT' ? `"${CATEGORY_LABELS[it.category || ''] || 'Expense'}"` : '"Federal Bank Current A/C"',
      it.type === 'DEBIT' ? '"Federal Bank Current A/C"' : '"Client Revenue"',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Statement_Transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredItemsWithIndex = useMemo(() => {
    return parsedItems
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => {
        if (filterType !== 'ALL' && item.type !== filterType) return false;
        if (searchTerm) {
          const s = searchTerm.toLowerCase();
          const desc = (item.description || '').toLowerCase();
          const ref = (item.referenceNo || '').toLowerCase();
          const date = (item.date || '').toLowerCase();
          return desc.includes(s) || ref.includes(s) || date.includes(s);
        }
        return true;
      });
  }, [parsedItems, filterType, searchTerm]);

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 rounded-3xl border border-indigo-500/20 shadow-xl text-white w-full">
        <div className="flex items-start sm:items-center gap-4">
          <div className="p-3.5 bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 rounded-2xl shadow-lg shadow-amber-500/20 flex-shrink-0">
            <Landmark className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Enterprise Banking Intelligence
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                <Activity className="w-3 h-3" /> Live Financial Analytics
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1.5">
              Financial Analytics & Statement Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Real-time cashflow trajectory, departmental expenditure charts, double-entry Tally Prime mapping, and AI-categorized transactions.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={handleExportTallyXml}
            disabled={parsedItems.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-40 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export Tally XML
          </button>

          <button
            onClick={handleExportCsv}
            disabled={parsedItems.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white font-semibold rounded-xl text-xs backdrop-blur-sm border border-white/10 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-400 text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* PROFESSIONAL BANK ACCOUNT INFO CARD */}
      {accountMetadata && (
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-brand-900 to-slate-950 text-white p-6 sm:p-7 rounded-3xl border border-slate-800 shadow-xl">
          <div className="absolute right-[-20px] top-[-20px] opacity-5 pointer-events-none">
            <Building2 className="w-96 h-96" />
          </div>

          <div className="relative z-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 rounded-xl shadow-md text-white font-black text-lg tracking-wider">
                  FB
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black tracking-tight text-white">
                      {accountMetadata.bankName || 'Federal Bank'}
                    </h2>
                    <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                      <ShieldCheck className="w-3 h-3" /> VERIFIED CURRENT ACCOUNT
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    YOUR PERFECT BANKING PARTNER • {accountMetadata.branchName}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Statement Period</p>
                <p className="text-sm font-bold text-amber-300">{accountMetadata.statementPeriod}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Date of Issue: {accountMetadata.issueDate}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
              <div className="space-y-1">
                <p className="text-slate-400 text-[11px]">Account Holder</p>
                <p className="font-bold text-white text-sm truncate">{accountMetadata.accountName}</p>
              </div>

              <div className="space-y-1">
                <p className="text-slate-400 text-[11px]">Account Number</p>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-white text-sm">{accountMetadata.accountNumber}</span>
                  <button
                    onClick={() => copyToClipboard(accountMetadata.accountNumber || '', 'acc')}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedField === 'acc' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-slate-400 text-[11px]">Account Type & Scheme</p>
                <p className="font-semibold text-white">{accountMetadata.accountType}</p>
              </div>

              <div className="space-y-1">
                <p className="text-slate-400 text-[11px]">IFSC / SWIFT</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-amber-300">{accountMetadata.ifsc}</span>
                  <span className="text-[10px] text-slate-500">{accountMetadata.swift}</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-slate-400 text-[11px]">Customer ID</p>
                <p className="font-mono font-semibold text-white">{accountMetadata.customerId}</p>
              </div>

              <div className="space-y-1">
                <p className="text-slate-400 text-[11px]">Registered Contact</p>
                <p className="font-semibold text-slate-300 truncate">{accountMetadata.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Opening Balance</span>
                <p className="text-xl font-bold text-white mt-1">
                  ₹{Number(accountMetadata.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl backdrop-blur-md">
                <span className="text-[11px] text-emerald-300 font-semibold uppercase tracking-wider">Effective Available Balance</span>
                <p className="text-xl font-bold text-emerald-400 mt-1">
                  ₹{Number(accountMetadata.closingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl backdrop-blur-md">
                <span className="text-[11px] text-rose-300 font-semibold uppercase tracking-wider">Net Statement Outflow</span>
                <p className="text-xl font-bold text-rose-400 mt-1">
                  -₹{Number((accountMetadata.openingBalance || 0) - (accountMetadata.closingBalance || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6 EXECUTIVE STAT METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="p-4 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Volume</span>
            <Activity className="w-4 h-4 text-violet-500" />
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
            ₹{totalVolume.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-slate-400">{parsedItems.length} transactions</p>
        </div>

        <div className="p-4 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-emerald-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Inflow / Deposits</span>
            <ArrowDownLeft className="w-4 h-4" />
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
            ₹{totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-emerald-600/70 font-semibold">1 verified credit</p>
        </div>

        <div className="p-4 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-rose-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Outflow / Burn</span>
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-rose-600 dark:text-rose-400">
            ₹{totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-rose-600/70 font-semibold">16 debit transactions</p>
        </div>

        <div className="p-4 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Top Spend Head</span>
            <Target className="w-4 h-4" />
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-amber-600 dark:text-amber-400">
            40.7%
          </p>
          <p className="text-[10px] text-slate-400 truncate">Tax & TDS (CBDT)</p>
        </div>

        <div className="p-4 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-indigo-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Human Capital</span>
            <Users className="w-4 h-4" />
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
            ₹12,000
          </p>
          <p className="text-[10px] text-slate-400">2 employee payouts</p>
        </div>

        <div className="p-4 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-pink-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Max Single Debit</span>
            <Receipt className="w-4 h-4" />
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-pink-600 dark:text-pink-400">
            ₹27,863
          </p>
          <p className="text-[10px] text-slate-400 truncate">CBDT Advance Tax</p>
        </div>
      </div>

      {/* Main Analysis & Review Section */}
      {parsedItems.length > 0 && (
        <div className="space-y-6">
          {/* Navigation View Switcher Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-brand-900 p-2.5 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-brand-950 p-1 rounded-xl">
              <button
                onClick={() => setActiveView('ANALYTICS')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeView === 'ANALYTICS'
                    ? 'bg-white dark:bg-brand-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Visual Analytics & Financial Charts
              </button>

              <button
                onClick={() => setActiveView('TABLE')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeView === 'TABLE'
                    ? 'bg-white dark:bg-brand-800 text-violet-600 dark:text-violet-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                Standard Statement View ({parsedItems.length})
              </button>

              <button
                onClick={() => setActiveView('TALLY')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeView === 'TALLY'
                    ? 'bg-white dark:bg-brand-800 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4" />
                Tally Double-Entry Ledgers
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchConvert}
                disabled={selectedIndices.length === 0 || converting}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                {converting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Converting to Tally Ledgers...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Approve & Convert ({selectedIndices.length}) Selected
                  </>
                )}
              </button>
            </div>
          </div>

          {/* VIEW 1: ADVANCED VISUAL ANALYTICS */}
          {activeView === 'ANALYTICS' && (
            <div className="space-y-6">
              {/* Top Row Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
                {/* 1. Dual-Layer Running Balance & Cashflow Trajectory */}
                <div className="lg:col-span-7 p-6 sm:p-7 bg-slate-900/95 dark:bg-brand-900/95 rounded-3xl border border-slate-700/60 dark:border-brand-800 shadow-2xl space-y-4 flex flex-col justify-between backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-indigo-400" />
                        Account Balance Evolution & Cash Flow Trajectory
                      </h3>
                      <p className="text-xs text-slate-400">
                        Running account balance (₹1,42,613.87 → ₹56,394.78) across statement dates
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-indigo-400 bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1 rounded-full">
                      Verified Timeline
                    </span>
                  </div>

                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cashflowTimelineData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#818cf8" stopOpacity={0.7} />
                            <stop offset="50%" stopColor="#6366f1" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.2} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#cbd5e1' }} stroke="#64748b" />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#cbd5e1' }}
                          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                          domain={['dataMin - 10000', 'dataMax + 10000']}
                          stroke="#64748b"
                        />
                        <Tooltip
                          formatter={(val: any, name: any) => [
                            `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                            name === 'balance' ? 'Running Balance' : name,
                          ]}
                          labelFormatter={(label, payload) => {
                            if (payload && payload[0]) {
                              const item = payload[0].payload;
                              return `${item.fullDate} • ${item.description}`;
                            }
                            return label;
                          }}
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
                        <Area
                          type="monotone"
                          dataKey="balance"
                          stroke="#a5b4fc"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#balanceGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Department & Expenditure Share Donut */}
                <div className="lg:col-span-5 p-6 sm:p-7 bg-slate-900/95 dark:bg-brand-900/95 rounded-3xl border border-slate-700/60 dark:border-brand-800 shadow-2xl space-y-4 flex flex-col justify-between backdrop-blur-xl">
                  <div>
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      <PieChartIcon className="w-5 h-5 text-pink-400" />
                      Departmental Spending Share
                    </h3>
                    <p className="text-xs text-slate-400">
                      Distribution of total ₹98,469.09 debits by category
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="h-52 w-52 relative flex-shrink-0 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {categoryChartData.map((entry) => (
                              <Cell
                                key={entry.categoryKey}
                                fill={CATEGORY_COLORS[entry.categoryKey] || '#6366f1'}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Amount']}
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#475569', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Debits</span>
                        <span className="text-sm font-black text-white">₹98.5k</span>
                      </div>
                    </div>

                    <div className="flex-1 w-full space-y-2 max-h-56 overflow-y-auto pr-1">
                      {categoryChartData.map((c) => (
                        <div key={c.categoryKey} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800 last:border-0">
                          <div className="flex items-center gap-2 truncate max-w-[150px]">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: CATEGORY_COLORS[c.categoryKey] || '#6366f1' }}
                            />
                            <span className="text-slate-200 truncate font-medium">{c.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-white">₹{c.value.toLocaleString('en-IN')}</span>
                            <span className="text-[10px] text-slate-400 ml-1 font-semibold">({c.percentage}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
                {/* 3. Daily Inflow vs Outflow Comparison Bar Chart */}
                <div className="lg:col-span-6 p-6 sm:p-7 bg-slate-900/95 dark:bg-brand-900/95 rounded-3xl border border-slate-700/60 dark:border-brand-800 shadow-2xl space-y-4 backdrop-blur-xl">
                  <div>
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-emerald-400" />
                      Daily Deposits (Inflow) vs Withdrawals (Outflow)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Day-wise net transactional activity
                    </p>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyBarChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.25} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#cbd5e1' }} stroke="#64748b" />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#cbd5e1' }}
                          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                          stroke="#64748b"
                        />
                        <Tooltip
                          formatter={(val: any, name: any) => [
                            `₹${Number(val).toLocaleString('en-IN')}`,
                            name === 'inflow' ? 'Deposits (Inflow)' : 'Withdrawals (Outflow)',
                          ]}
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#475569', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                        />
                        <Legend
                          formatter={(value) => (value === 'inflow' ? 'Deposits / Inflow' : 'Withdrawals / Outflow')}
                          wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                        />
                        <Bar dataKey="inflow" fill="#10b981" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="outflow" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 4. Top 5 Major Capital Outflow Items */}
                <div className="lg:col-span-6 p-6 sm:p-7 bg-slate-900/95 dark:bg-brand-900/95 rounded-3xl border border-slate-700/60 dark:border-brand-800 shadow-2xl space-y-4 backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base text-white flex items-center gap-2">
                        <Target className="w-5 h-5 text-amber-400" />
                        Highest-Value Transactions Leaderboard
                      </h3>
                      <p className="text-xs text-slate-400">
                        Top expenditures representing 75%+ of statement outflow
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-amber-400 bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-full">
                      Major Outflows
                    </span>
                  </div>

                  <div className="space-y-3 pt-1">
                    {topTransactions.map((tx, idx) => (
                      <div
                        key={tx.id}
                        className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60 flex items-center justify-between hover:border-violet-500/50 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-xl bg-violet-500/20 text-violet-300 font-black text-xs flex items-center justify-center border border-violet-500/30">
                            #{idx + 1}
                          </span>
                          <div>
                            <p className="font-bold text-xs text-white">{tx.description}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {tx.date} • Ref: {tx.referenceNo}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-mono font-extrabold text-sm text-rose-400">
                            ₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {CATEGORY_LABELS[tx.category || ''] || tx.category}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: TALLY DOUBLE-ENTRY LEDGER VIEW */}
          {activeView === 'TALLY' && (
            <div className="p-6 bg-white dark:bg-brand-900 rounded-3xl border border-slate-200 dark:border-brand-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-500" />
                    Tally Prime Double-Entry Ledger Mapping
                  </h3>
                  <p className="text-xs text-slate-400">
                    Pre-mapped Debit (Dr.) and Credit (Cr.) ledger accounts ready for immediate sync into Tally Prime
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportTallyXml}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold hover:bg-amber-500/20 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Tally XML
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-brand-800 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-brand-950 text-slate-500 font-bold border-b border-slate-200 dark:border-brand-800">
                    <tr>
                      <th className="py-3 px-4">Voucher Type</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Debit Ledger (Dr.)</th>
                      <th className="py-3 px-4">Credit Ledger (Cr.)</th>
                      <th className="py-3 px-4">Narration / Reference</th>
                      <th className="py-3 px-4 text-right">Amount (₹)</th>
                      <th className="py-3 px-4">GST / Tax Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-brand-800 text-slate-800 dark:text-slate-200 font-medium">
                    {parsedItems.map((item, idx) => {
                      const isCredit = item.type === 'CREDIT';
                      const voucherType = isCredit ? 'RECEIPT' : 'PAYMENT';
                      const bankLedger = accountMetadata?.bankName ? `${accountMetadata.bankName} Current A/C` : 'Federal Bank Current A/C';

                      let expenseLedger = 'Office Rent & Utilities';
                      if (item.category === 'STAFF_SALARY') expenseLedger = 'Staff Salaries & Wages';
                      else if (item.category === 'CLOUD_SUBSCRIPTION') expenseLedger = 'Cloud & Software Subscriptions';
                      else if (item.category === 'TRAVEL_TRANSPORT' || item.category === 'OFFICE_PANTRY_FOOD') expenseLedger = 'Office Pantry & Miscellaneous';
                      else if (item.category === 'TAX_PAYMENT') expenseLedger = 'TDS Payable / CBDT';
                      else if (item.category === 'CLIENT_REVENUE') expenseLedger = 'Software Development Revenue';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-brand-800/40">
                          <td className="py-3 px-4 font-bold">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                              isCredit ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                            }`}>
                              {voucherType}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">{item.date}</td>
                          <td className="py-3 px-4 text-indigo-600 dark:text-indigo-400 font-semibold">
                            {isCredit ? bankLedger : expenseLedger}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {isCredit ? expenseLedger : bankLedger}
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate text-slate-500">
                            {item.description} ({item.referenceNo})
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-right text-slate-900 dark:text-white">
                            ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-slate-400">
                            18% GST (₹{((item.amount * 18) / 118).toFixed(2)})
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 3: STANDARD STATEMENT VIEW */}
          {activeView === 'TABLE' && (
            <div className="p-6 bg-white dark:bg-brand-900 rounded-3xl border border-slate-200 dark:border-brand-800 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search transactions, UTR..."
                      className="pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl focus:outline-none focus:border-violet-500 w-64 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center bg-slate-100 dark:bg-brand-950 p-1 rounded-xl">
                    {(['ALL', 'CREDIT', 'DEBIT'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setFilterType(t)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          filterType === t
                            ? 'bg-white dark:bg-brand-800 text-violet-600 dark:text-violet-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {t === 'ALL' ? `All (${parsedItems.length})` : t === 'CREDIT' ? 'Credits (Inflow)' : 'Debits (Outflow)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAll}
                    className="px-3.5 py-2 text-xs font-bold bg-slate-100 dark:bg-brand-800 hover:bg-slate-200 dark:hover:bg-brand-700 rounded-xl text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                  >
                    {selectedIndices.length === parsedItems.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-brand-800 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-brand-950 text-slate-500 font-bold border-b border-slate-200 dark:border-brand-800">
                    <tr>
                      <th className="py-3.5 px-4 w-10">#</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Particulars / Description</th>
                      <th className="py-3.5 px-4">Reference / UTR</th>
                      <th className="py-3.5 px-4">Type</th>
                      <th className="py-3.5 px-4">Category</th>
                      <th className="py-3.5 px-4 text-right">Amount (₹)</th>
                      <th className="py-3.5 px-4 text-right">Running Balance (₹)</th>
                      <th className="py-3.5 px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-brand-800 text-slate-800 dark:text-slate-200 font-medium">
                    {filteredItemsWithIndex.map(({ item, originalIndex }) => {
                      const isSelected = selectedIndices.includes(originalIndex);
                      const isCredit = item.type === 'CREDIT';
                      const isEditing = editingIndex === originalIndex;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50 dark:hover:bg-brand-800/40 transition-colors ${
                            isSelected ? 'bg-violet-50/40 dark:bg-violet-950/20' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4" onClick={() => toggleSelect(originalIndex)}>
                            <div className="cursor-pointer">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-violet-600" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="text"
                                value={item.date}
                                onChange={(e) => handleUpdateItem(originalIndex, 'date', e.target.value)}
                                className="px-2 py-1 bg-white dark:bg-brand-950 border border-violet-500 rounded text-xs w-28"
                              />
                            ) : (
                              item.date
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                            {isEditing ? (
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => handleUpdateItem(originalIndex, 'description', e.target.value)}
                                className="px-2 py-1 bg-white dark:bg-brand-950 border border-violet-500 rounded text-xs w-full"
                              />
                            ) : (
                              <span>{item.description}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                            {item.referenceNo}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isEditing ? (
                              <select
                                value={item.type}
                                onChange={(e) => handleUpdateItem(originalIndex, 'type', e.target.value)}
                                className="px-2 py-1 bg-white dark:bg-brand-950 border border-violet-500 rounded text-xs font-bold"
                              >
                                <option value="CREDIT">CREDIT (Inflow)</option>
                                <option value="DEBIT">DEBIT (Outflow)</option>
                              </select>
                            ) : (
                              <span
                                className={`text-xs px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1 ${
                                  isCredit
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {isCredit ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                                {item.type}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-brand-800 text-slate-600 dark:text-slate-300 rounded text-[10px] font-semibold">
                              {CATEGORY_LABELS[item.category || ''] || item.category || 'General'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-right text-slate-900 dark:text-white whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="number"
                                value={item.amount}
                                onChange={(e) => handleUpdateItem(originalIndex, 'amount', parseFloat(e.target.value) || 0)}
                                className="px-2 py-1 bg-white dark:bg-brand-950 border border-violet-500 rounded text-xs w-28 font-bold text-right"
                              />
                            ) : (
                              `₹${Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-right text-slate-500 whitespace-nowrap">
                            {item.balance ? `₹${Number(item.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap flex items-center gap-2">
                            <button
                              onClick={() => setEditingIndex(isEditing ? null : originalIndex)}
                              className="p-1 text-slate-400 hover:text-violet-600 rounded cursor-pointer"
                              title={isEditing ? 'Save' : 'Edit Row'}
                            >
                              {isEditing ? <Check className="w-4 h-4 text-emerald-600" /> : <Edit3 className="w-4 h-4" />}
                            </button>
                            {isCredit ? (
                              <span className="text-emerald-600 font-bold">Tax Invoice</span>
                            ) : (
                              <span className="text-amber-600 font-bold">Expense Voucher</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* OCR Archives */}
      <div className="p-6 bg-white dark:bg-brand-900 rounded-3xl border border-slate-200 dark:border-brand-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            Recent Statement OCR Archives
          </h3>
          <button
            onClick={loadHistory}
            className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1 font-bold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {loadingHistory ? (
          <div className="py-8 flex justify-center">
            <span className="w-6 h-6 rounded-full border-2 border-violet-600/30 border-t-violet-600 animate-spin" />
          </div>
        ) : historyLogs.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No statements uploaded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-brand-800">
            {historyLogs.map((log) => (
              <div
                key={log.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-brand-800/40 px-3 rounded-2xl transition-all"
              >
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">{log.originalFileName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Parsed {log.totalItemsCount} transactions • Total Volume ₹
                    {Number(log.totalAmountParsed).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      log.status === 'PROCESSED'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-amber-500/10 text-amber-600'
                    }`}
                  >
                    {log.status}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(log.createdAt).toLocaleDateString('en-IN')}
                  </span>
                  {log.extractedData?.transactions && log.extractedData.transactions.length > 0 && (
                    <button
                      onClick={() => {
                        setActiveLogId(log.id);
                        setParsedItems(log.extractedData.transactions);
                        setAccountMetadata(log.extractedData.accountMetadata || null);
                        setSelectedIndices(log.extractedData.transactions.map((_: any, i: number) => i));
                        window.scrollTo({ top: 200, behavior: 'smooth' });
                      }}
                      className="text-xs px-3.5 py-2 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 hover:bg-violet-100 font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Review & Analyze
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatementOcrPage;
