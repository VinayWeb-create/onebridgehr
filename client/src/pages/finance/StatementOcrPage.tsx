import React, { useState, useEffect } from 'react';
import {
  FileSearch,
  UploadCloud,
  FileCheck,
  CheckSquare,
  Square,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  AlertCircle,
  Clock,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import {
  statementOcrService,
  type ParsedItem,
  type StatementLog,
} from '../../services/statementOcrService';
import { SOCKET_URL } from '../../services/api';

export const StatementOcrPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [historyLogs, setHistoryLogs] = useState<StatementLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [converting, setConverting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const logs = await statementOcrService.getLogs();
      setHistoryLogs(logs);
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
      // Select all by default
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

  const handleBatchConvert = async () => {
    if (selectedIndices.length === 0 || !activeLogId) return;
    const selected = selectedIndices.map((i) => parsedItems[i]);

    try {
      setConverting(true);
      const res = await statementOcrService.convertTransactions(activeLogId, selected);
      setSuccessMessage(res.message || 'Transactions successfully converted to Invoices & Expense Vouchers!');
      setParsedItems([]);
      setSelectedIndices([]);
      setActiveLogId(null);
      loadHistory();
    } catch (err) {
      console.error('Conversion failed:', err);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-brand-900 p-6 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 rounded-xl">
            <FileSearch className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">PDF Statement & OCR Auto-Invoicing</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Upload bank statements, client purchase orders, or vendor bills to automatically extract line items and generate Invoices
            </p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Upload Box */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        className="p-8 bg-white dark:bg-brand-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-brand-800 text-center space-y-4 hover:border-violet-500/60 transition-all"
      >
        <div className="w-16 h-16 mx-auto bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 rounded-2xl flex items-center justify-center">
          <UploadCloud className="w-8 h-8" />
        </div>

        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white">
            {selectedFile ? selectedFile.name : 'Upload PDF Bank Statement or Vendor Bill'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Drag and drop a PDF file here or click to browse (supports statements up to 10MB)
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <label className="cursor-pointer px-4 py-2 bg-slate-100 dark:bg-brand-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs transition-all">
            Choose PDF File
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
            />
          </label>

          {selectedFile && (
            <button
              onClick={handleFileUploadAndParse}
              disabled={parsing}
              className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-lg shadow-violet-500/20 transition-all"
            >
              {parsing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Extracting OCR & Statements...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Run AI OCR & Extract
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Extracted Transactions Review Table */}
      {parsedItems.length > 0 && (
        <div className="p-6 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                Extracted Statement Transactions ({parsedItems.length})
              </h3>
              <p className="text-xs text-slate-400">
                Review parsed credits and debits before auto-generating Invoices and Tally Expense Vouchers
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-brand-800 rounded-lg text-slate-700 dark:text-slate-300"
              >
                {selectedIndices.length === parsedItems.length ? 'Deselect All' : 'Select All'}
              </button>

              <button
                onClick={handleBatchConvert}
                disabled={selectedIndices.length === 0 || converting}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all"
              >
                {converting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Generating Invoices & Vouchers...
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

          <div className="overflow-x-auto border border-slate-100 dark:border-brand-800 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-brand-950 text-slate-500 font-semibold border-b border-slate-200 dark:border-brand-800">
                <tr>
                  <th className="py-3 px-4 w-10">#</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Description / Particulars</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Amount (₹)</th>
                  <th className="py-3 px-4">Auto Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-brand-800 text-slate-800 dark:text-slate-200">
                {parsedItems.map((item, idx) => {
                  const isSelected = selectedIndices.includes(idx);
                  const isCredit = item.type === 'CREDIT';
                  return (
                    <tr
                      key={item.id}
                      onClick={() => toggleSelect(idx)}
                      className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-brand-800/40 transition-colors ${
                        isSelected ? 'bg-violet-50/40 dark:bg-violet-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-violet-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">{item.date}</td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white max-w-sm truncate">
                        {item.description}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                            isCredit
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold">
                        {isCredit ? (
                          <span className="text-emerald-600">Create Tax Invoice</span>
                        ) : (
                          <span className="text-amber-600">Create Expense Voucher</span>
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

      {/* OCR Parsing History */}
      <div className="p-6 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          Recent Statement OCR Uploads
        </h3>

        {loadingHistory ? (
          <div className="py-8 flex justify-center">
            <span className="w-6 h-6 rounded-full border-2 border-violet-600/30 border-t-violet-600 animate-spin" />
          </div>
        ) : historyLogs.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No statements uploaded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-brand-800">
            {historyLogs.map((log) => (
              <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-brand-800/40 px-3 rounded-xl transition-all">
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">{log.originalFileName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Parsed {log.totalItemsCount} transactions • Total ₹{Number(log.totalAmountParsed).toLocaleString('en-IN')}
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
                        setSelectedIndices(log.extractedData.transactions.map((_: any, i: number) => i));
                        window.scrollTo({ top: 200, behavior: 'smooth' });
                      }}
                      className="text-xs px-3 py-1.5 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 hover:bg-violet-100 font-semibold rounded-lg transition-all"
                    >
                      Review & Convert
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
