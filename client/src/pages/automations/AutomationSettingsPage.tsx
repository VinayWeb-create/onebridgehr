import React, { useState, useEffect } from 'react';
import {
  Zap,
  Mail,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Save,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  automationService,
  type AutomationTemplate,
  type CommunicationLog,
} from '../../services/automationService';

export const AutomationSettingsPage: React.FC = () => {
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'TEMPLATES' | 'LOGS'>('TEMPLATES');
  const [channelFilter, setChannelFilter] = useState('ALL');

  // Editing Template State
  const [editingTemplate, setEditingTemplate] = useState<AutomationTemplate | null>(null);
  const [formContent, setFormContent] = useState('');
  const [formSubject, setFormSubject] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [tplData, logData] = await Promise.all([
        automationService.getTemplates(),
        automationService.getLogs(channelFilter),
      ]);
      setTemplates(tplData);
      setLogs(logData);
    } catch (err) {
      console.error('Failed to load automation settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [channelFilter]);

  const handleEdit = (tpl: AutomationTemplate) => {
    setEditingTemplate(tpl);
    setFormSubject(tpl.subject || '');
    setFormContent(tpl.content);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    try {
      await automationService.updateTemplate(editingTemplate.id, {
        subject: formSubject,
        content: formContent,
      });
      setEditingTemplate(null);
      loadData();
    } catch (err) {
      console.error('Failed to update template:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-brand-900 p-6 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-fuchsia-500/10 dark:bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400 rounded-xl">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Email & WhatsApp Automations</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Configure automated client communications, reminder triggers, templates, and view live delivery audit logs
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-brand-800 pb-2">
        <button
          onClick={() => setActiveTab('TEMPLATES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'TEMPLATES'
              ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-brand-800'
          }`}
        >
          <Mail className="w-4 h-4" />
          Message Templates
        </button>

        <button
          onClick={() => setActiveTab('LOGS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'LOGS'
              ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-brand-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          Live Delivery Logs
        </button>
      </div>

      {/* TAB 1: TEMPLATES */}
      {activeTab === 'TEMPLATES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="p-5 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {tpl.channel === 'EMAIL' ? (
                    <span className="p-1.5 bg-blue-500/10 text-blue-600 rounded-lg">
                      <Mail className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg">
                      <MessageSquare className="w-4 h-4" />
                    </span>
                  )}
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{tpl.name}</h4>
                    <p className="text-[11px] text-slate-400">Trigger: {tpl.triggerEvent}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleEdit(tpl)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-brand-800 rounded text-slate-500"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {tpl.subject && (
                <div className="text-xs bg-slate-50 dark:bg-brand-950 p-2 rounded-lg border border-slate-100 dark:border-brand-800">
                  <span className="text-slate-400 font-semibold">Subject: </span>
                  <span className="text-slate-800 dark:text-slate-200">{tpl.subject}</span>
                </div>
              )}

              <div className="text-xs bg-slate-50 dark:bg-brand-950 p-3 rounded-lg border border-slate-100 dark:border-brand-800 text-slate-600 dark:text-slate-300 font-mono whitespace-pre-wrap">
                {tpl.content}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-brand-800">
                <span>Variables: {"{{clientName}}, {{invoiceNumber}}, {{totalAmount}}, {{balanceDue}}"}</span>
                <span className="text-emerald-600 font-bold">Active</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: LIVE AUDIT LOGS */}
      {activeTab === 'LOGS' && (
        <div className="bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-brand-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Communication Dispatch Logs</h3>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-xs"
            >
              <option value="ALL">All Channels</option>
              <option value="EMAIL">Email Dispatches</option>
              <option value="WHATSAPP">WhatsApp Dispatches</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-brand-950 text-slate-500 font-semibold border-b border-slate-200 dark:border-brand-800">
                <tr>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Details / Subject</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-brand-800 text-slate-800 dark:text-slate-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-brand-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          log.channel === 'EMAIL'
                            ? 'bg-blue-500/10 text-blue-600'
                            : 'bg-emerald-500/10 text-emerald-600'
                        }`}
                      >
                        {log.channel}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{log.recipientName || 'Client'}</div>
                      <div className="text-xs text-slate-400">{log.recipient}</div>
                    </td>
                    <td className="py-3 px-4 text-xs max-w-sm truncate text-slate-600 dark:text-slate-300">
                      {log.subject || log.messageBody}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          log.status === 'SENT' || log.status === 'DELIVERED'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-rose-500/10 text-rose-600'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">
                      {new Date(log.sentAt).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400">
                      No communications logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-brand-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-brand-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-fuchsia-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">Edit Template: {editingTemplate.name}</h3>
              <button onClick={() => setEditingTemplate(null)} className="text-fuchsia-200 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {editingTemplate.channel === 'EMAIL' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Message Body / Template Text
                </label>
                <textarea
                  rows={5}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-brand-800">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-semibold rounded-lg text-sm shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationSettingsPage;
