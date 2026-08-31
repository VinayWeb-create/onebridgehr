import React, { useState, useEffect } from 'react';
import {
  Bot,
  Activity,
  Cpu,
  Zap,
  ShieldCheck,
  TrendingUp,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Play,
  Clock,
  Sparkles,
  Layers,
  Search,
  ChevronRight,
  UserCheck,
  RefreshCw,
  Terminal,
  BrainCircuit,
  Eye,
  Sliders,
  DollarSign,
  Send,
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import type {
  AiEmployee,
  AiEventItem,
  AiDecisionLogItem,
  AiDiscoveryDoc,
  CeoBriefingData,
} from '../../services/aiService';
import { useDialog } from '../../context/DialogContext';

export const AiCommandCenterPage: React.FC = () => {
  const { alert, confirm } = useDialog();

  const [activeTab, setActiveTab] = useState<'WORKFORCE' | 'EVENT_STREAM' | 'DECISIONS' | 'ORION_STRATEGY'>('WORKFORCE');
  const [workforce, setWorkforce] = useState<AiEmployee[]>([]);
  const [events, setEvents] = useState<AiEventItem[]>([]);
  const [decisions, setDecisions] = useState<AiDecisionLogItem[]>([]);
  const [escalations, setEscalations] = useState<AiDecisionLogItem[]>([]);
  const [discoveryDocs, setDiscoveryDocs] = useState<AiDiscoveryDoc[]>([]);
  const [briefing, setBriefing] = useState<CeoBriefingData | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [selectedDoc, setSelectedDoc] = useState<AiDiscoveryDoc | null>(null);
  const [showSimModal, setShowSimModal] = useState(false);
  const [simForm, setSimForm] = useState({
    clientName: 'Sanjay Deshmukh',
    companyName: 'NexGen Fintech Solutions Pvt Ltd',
    email: 'sanjay.deshmukh@nexgenfin.com',
    phone: '+91 98450 11223',
    serviceOfInterest: 'AI Agents',
    projectDetails: 'We require a multi-agent autonomous enterprise engine to process high-volume customer inquiries and auto-sync invoices into our accounting books.',
    estimatedValue: 480000,
  });
  const [simulating, setSimulating] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [wfData, evtData, decData, escData, docsData, briefData] = await Promise.all([
        aiService.getWorkforceStatus(),
        aiService.getEventStream(),
        aiService.getDecisionLogs(),
        aiService.getPendingEscalations(),
        aiService.getDiscoveryDocuments(),
        aiService.getCeoBriefing(),
      ]);
      setWorkforce(wfData);
      setEvents(evtData);
      setDecisions(decData);
      setEscalations(escData);
      setDiscoveryDocs(docsData);
      setBriefing(briefData);
    } catch (err) {
      console.error('Failed to load AI workforce data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      aiService.getEventStream().then(setEvents).catch(() => null);
      aiService.getDecisionLogs().then(setDecisions).catch(() => null);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSimulating(true);
      const res = await aiService.triggerSimulation(simForm);
      setShowSimModal(false);
      await alert({
        title: 'Autonomous Simulation Triggered',
        message: `Lead #${res.data?.leadNumber} created. The autonomous event bus is executing Ava (Intake) -> Scott (BRD) -> Paige (Proposal) -> Fiona (Invoicing) -> Chase (Cadence). Check the Event Stream tab for live execution logs.`,
      });
      loadData();
    } catch (err: any) {
      await alert({
        title: 'Simulation Error',
        message: err?.response?.data?.message || 'Failed to trigger simulation.',
        variant: 'danger',
      });
    } finally {
      setSimulating(false);
    }
  };

  const handleApproveEscalation = async (logId: string) => {
    const ok = await confirm({
      title: 'Approve AI Commercial Concession',
      message: 'Are you sure you want to approve this commercial proposal and authorize the autonomous counter-offer dispatch?',
      confirmText: 'Approve & Dispatch',
    });
    if (ok) {
      await aiService.approveEscalation(logId, 'Approved by Super Admin');
      await alert({ title: 'Decision Approved', message: 'The AI employee has executed the concession and notified the client.' });
      loadData();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner - HRMS Gradient Style */}
      <div className="bg-gradient-to-r from-brand-900 via-indigo-950 to-brand-950 p-6 md:p-8 rounded-3xl border border-brand-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-full text-xs font-bold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              ⚡ AUTONOMOUS BUSINESS OS ACTIVE
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <BrainCircuit className="w-8 h-8 text-orange-500" />
              AI Workforce Command Center
            </h1>
            <p className="text-slate-300 text-xs md:text-sm max-w-2xl leading-relaxed">
              Autonomous AI Employee workforce running end-to-end qualification, technical scoping, proposal pricing, commercial negotiation, and double-entry accounting.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowSimModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-indigo-600 hover:from-orange-600 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              Run Simulation Pipeline
            </button>
            <button
              onClick={loadData}
              className="p-2.5 bg-brand-800/80 hover:bg-brand-700 text-slate-200 rounded-xl border border-brand-700 transition-all cursor-pointer"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Telemetry Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>AI Active Roster</span>
            <Bot className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">7 AI Employees</div>
          <span className="text-[11px] text-emerald-500 font-medium">● 100% Operational Status</span>
        </div>

        <div className="p-4 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>Decisions Executed</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {workforce.reduce((acc, w) => acc + w.totalActionsTaken, 0) + decisions.length}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Avg. Latency: 420ms</span>
        </div>

        <div className="p-4 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>Confidence Accuracy</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">96.2%</div>
          <span className="text-[11px] text-emerald-500 font-medium">Autonomous Guardrails Intact</span>
        </div>

        <div className="p-4 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>Supervisor Review Queue</span>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{escalations.length} Pending</div>
          <span className="text-[11px] text-orange-400 font-medium">
            {escalations.length > 0 ? 'Requires human signoff' : 'Zero unhandled anomalies'}
          </span>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-brand-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('WORKFORCE')}
          className={`flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'WORKFORCE'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-brand-800'
          }`}
        >
          <Bot className="w-4 h-4" />
          Autonomous Workforce Roster
        </button>

        <button
          onClick={() => setActiveTab('EVENT_STREAM')}
          className={`flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'EVENT_STREAM'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-brand-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          Real-Time Event Stream ({events.length})
        </button>

        <button
          onClick={() => setActiveTab('DECISIONS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'DECISIONS'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-brand-800'
          }`}
        >
          <Terminal className="w-4 h-4" />
          Audit Decision Trail ({decisions.length})
        </button>

        <button
          onClick={() => setActiveTab('ORION_STRATEGY')}
          className={`flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'ORION_STRATEGY'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-brand-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Orion Strategic Executive Deck
        </button>
      </div>

      {/* TAB 1: WORKFORCE ROSTER */}
      {activeTab === 'WORKFORCE' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {workforce.map((agent) => (
              <div
                key={agent.role}
                className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 p-5 shadow-xs hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-all flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-brand-950 flex items-center justify-center text-2xl border border-indigo-100 dark:border-brand-800">
                        {agent.avatar}
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                          {agent.name}
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">{agent.title}</p>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                      {agent.autonomyMode.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-brand-950 rounded-xl text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Actions Run</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{agent.totalActionsTaken}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Response Speed</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{agent.averageLatencyMs} ms</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Autonomous Capabilities
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="px-2 py-0.5 bg-indigo-50/70 dark:bg-brand-800/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-medium rounded-md"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-brand-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Min. Confidence: {(agent.minConfidence * 100).toFixed(0)}%</span>
                  <span className="text-emerald-500 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Autonomous Active
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Generated BRD & Architecture Document Shelf */}
          {discoveryDocs.length > 0 && (
            <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-indigo-500" />
                    AI-Generated Technical BRD & Architecture Documents
                  </h3>
                  <p className="text-xs text-slate-400">
                    Compiled automatically by Scott (AI Solution Architect) from incoming discovery requirements
                  </p>
                </div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {discoveryDocs.length} Total Specifications
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {discoveryDocs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className="p-4 bg-slate-50 dark:bg-brand-950 rounded-xl border border-slate-200 dark:border-brand-800 hover:border-indigo-500/60 transition-all cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {doc.leadNumber}
                      </span>
                      <span className="text-[11px] text-slate-400">{doc.estimatedTimeline}</span>
                    </div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">{doc.clientName}</div>
                    <p className="text-xs text-slate-500 line-clamp-2">{doc.executiveSummary}</p>
                    <div className="flex items-center justify-between text-xs pt-1 text-indigo-600 dark:text-indigo-400 font-semibold">
                      <span>View Full Architecture & Milestones</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REAL-TIME EVENT STREAM */}
      {activeTab === 'EVENT_STREAM' && (
        <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-500" />
                Live Event Bus Dispatch Stream
              </h3>
              <p className="text-xs text-slate-400">
                Autonomous message broker broadcasting business triggers across AI workers
              </p>
            </div>
            <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-lg flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Live Stream Active
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs max-h-[600px] overflow-y-auto">
            {events.map((evt, idx) => (
              <div
                key={evt.eventId || idx}
                className="p-3.5 bg-slate-50 dark:bg-brand-950 rounded-xl border border-slate-200 dark:border-brand-800 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 bg-indigo-100 dark:bg-brand-800 text-indigo-700 dark:text-indigo-300 font-bold rounded text-[11px]">
                    {evt.eventType}
                  </span>
                  <span className="font-sans font-semibold text-slate-800 dark:text-slate-200">
                    Actor: <span className="text-orange-500">{evt.actor}</span>
                  </span>
                  {evt.entityId && (
                    <span className="text-slate-400 text-[11px]">Ref: {evt.entityId.substring(0, 10)}...</span>
                  )}
                </div>
                <div className="text-slate-400 text-[11px]">{new Date(evt.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT DECISION TRAIL & ESCALATIONS */}
      {activeTab === 'DECISIONS' && (
        <div className="space-y-6">
          {/* Pending Escalations Alert Deck */}
          {escalations.length > 0 && (
            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Executive Attention Required: {escalations.length} Decisions Escalated</span>
              </div>
              <div className="space-y-3">
                {escalations.map((esc) => (
                  <div
                    key={esc.id}
                    className="p-4 bg-white dark:bg-brand-900 rounded-xl border border-orange-200 dark:border-orange-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                        {esc.agentName} ({esc.agentRole}): {esc.actionTaken}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{esc.reasoningChain}</p>
                    </div>
                    <button
                      onClick={() => handleApproveEscalation(esc.id)}
                      className="px-4 py-2 bg-gradient-to-r from-orange-500 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer whitespace-nowrap"
                    >
                      Authorize Concession
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Logs Table */}
          <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 dark:border-brand-800 font-bold text-sm text-slate-900 dark:text-white">
              Immutable AI Decision & Reasoning Chain Logs
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-brand-950 text-slate-500 font-semibold border-b border-slate-200 dark:border-brand-800">
                  <tr>
                    <th className="py-3 px-4">Agent</th>
                    <th className="py-3 px-4">Event</th>
                    <th className="py-3 px-4">Action Taken</th>
                    <th className="py-3 px-4">Reasoning Chain</th>
                    <th className="py-3 px-4">Confidence</th>
                    <th className="py-3 px-4">Speed</th>
                    <th className="py-3 px-4 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-brand-800 text-slate-800 dark:text-slate-200">
                  {decisions.map((dec) => (
                    <tr key={dec.id} className="hover:bg-slate-50 dark:hover:bg-brand-800/40">
                      <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">{dec.agentName}</td>
                      <td className="py-3 px-4 font-mono text-[11px]">{dec.eventType}</td>
                      <td className="py-3 px-4 font-medium">{dec.actionTaken}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={dec.reasoningChain}>
                        {dec.reasoningChain}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold rounded">
                          {(dec.confidence * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{dec.executionTimeMs}ms</td>
                      <td className="py-3 px-4 text-right text-slate-400">
                        {new Date(dec.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ORION STRATEGIC EXECUTIVE DECK */}
      {activeTab === 'ORION_STRATEGY' && briefing && (
        <div className="space-y-6">
          {/* Executive Briefing Summary Card */}
          <div className="bg-gradient-to-r from-brand-900 to-indigo-950 text-white p-6 rounded-3xl border border-brand-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔮</span>
              <div>
                <h3 className="font-bold text-lg text-white">Orion CEO Strategic Daily Briefing</h3>
                <p className="text-xs text-indigo-200">Automated multi-variable business telemetry & runway model</p>
              </div>
            </div>
            <div className="p-4 bg-brand-950/60 rounded-2xl border border-brand-800 text-sm leading-relaxed text-slate-200">
              {briefing.dailyBriefingText}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-xs space-y-2">
              <div className="text-xs text-slate-400 font-semibold">Total Pipeline Value</div>
              <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                ₹{briefing.pipelineValue.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-slate-500">Across {briefing.activeDealsCount} qualified opportunities</p>
            </div>

            <div className="p-5 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-xs space-y-2">
              <div className="text-xs text-slate-400 font-semibold">Weighted Revenue Forecast</div>
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                ₹{briefing.weightedRevenueForecast.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-slate-500">Calculated at {briefing.avgWinRate}% win probability</p>
            </div>

            <div className="p-5 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-xs space-y-2">
              <div className="text-xs text-slate-400 font-semibold">Cash Runway Runway</div>
              <div className="text-3xl font-extrabold text-orange-500">{briefing.cashRunwayMonths} Months</div>
              <p className="text-xs text-slate-500">Based on monthly burn rate of ₹4.5L</p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BRD & ARCHITECTURE VIEWER */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-brand-900 w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-brand-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="p-6 bg-gradient-to-r from-brand-900 to-indigo-950 text-white flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-orange-400">
                  {selectedDoc.leadNumber} • {selectedDoc.serviceCategory}
                </span>
                <h3 className="font-bold text-lg text-white">{selectedDoc.clientName} - Technical BRD Specification</h3>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="w-8 h-8 rounded-full bg-brand-800 hover:bg-brand-700 flex items-center justify-center text-slate-300"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs md:text-sm text-slate-700 dark:text-slate-300">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs mb-1">
                  1. Executive Summary
                </h4>
                <p className="leading-relaxed bg-slate-50 dark:bg-brand-950 p-4 rounded-xl border border-slate-100 dark:border-brand-800">
                  {selectedDoc.executiveSummary}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs mb-2">
                  2. Business Objectives
                </h4>
                <ul className="list-disc pl-5 space-y-1">
                  {selectedDoc.businessObjectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs mb-2">
                  3. Recommended Technology Stack
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedDoc.recommendedStack.map((tech) => (
                    <span
                      key={tech}
                      className="px-3 py-1 bg-indigo-50 dark:bg-brand-800 font-bold text-indigo-600 dark:text-indigo-300 rounded-lg"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs mb-2">
                  4. 4-Phase Delivery Milestones
                </h4>
                <div className="space-y-2">
                  {selectedDoc.milestones.map((m, i) => (
                    <div
                      key={i}
                      className="p-3 bg-slate-50 dark:bg-brand-950 rounded-xl border border-slate-100 dark:border-brand-800 flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">{m.phase}</span>
                        <div className="text-[11px] text-slate-400 mt-0.5">{m.deliverables.join(' • ')}</div>
                      </div>
                      <span className="px-2.5 py-1 bg-indigo-100 dark:bg-brand-800 text-indigo-700 dark:text-indigo-300 font-bold rounded-md text-xs">
                        {m.duration}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RUN SIMULATION */}
      {showSimModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-brand-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-brand-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 bg-gradient-to-r from-brand-900 to-indigo-950 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">Trigger Autonomous Multi-Agent Pipeline</h3>
                <p className="text-xs text-indigo-200">Emulates inbound lead & watches all AI workers coordinate</p>
              </div>
              <button
                onClick={() => setShowSimModal(false)}
                className="w-8 h-8 rounded-full bg-brand-800 hover:bg-brand-700 flex items-center justify-center text-slate-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRunSimulation} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Prospect Name *</label>
                <input
                  type="text"
                  required
                  value={simForm.clientName}
                  onChange={(e) => setSimForm({ ...simForm, clientName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Company Name</label>
                <input
                  type="text"
                  value={simForm.companyName}
                  onChange={(e) => setSimForm({ ...simForm, companyName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={simForm.email}
                    onChange={(e) => setSimForm({ ...simForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Est. Budget (₹)</label>
                  <input
                    type="number"
                    value={simForm.estimatedValue}
                    onChange={(e) => setSimForm({ ...simForm, estimatedValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl font-bold text-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Project Scope Details *</label>
                <textarea
                  rows={3}
                  required
                  value={simForm.projectDetails}
                  onChange={(e) => setSimForm({ ...simForm, projectDetails: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-brand-800">
                <button
                  type="button"
                  onClick={() => setShowSimModal(false)}
                  className="px-4 py-2 font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={simulating}
                  className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-indigo-600 hover:from-orange-600 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-2"
                >
                  {simulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                  {simulating ? 'Executing Pipeline...' : 'Launch AI Event Stream'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiCommandCenterPage;
