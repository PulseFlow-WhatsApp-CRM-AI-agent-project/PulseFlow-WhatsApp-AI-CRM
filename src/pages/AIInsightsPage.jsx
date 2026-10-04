import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Bot,
  AlertTriangle,
  CheckCircle2,
  BrainCircuit,
  MessageSquare,
  Sliders,
  Play,
  RefreshCw,
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';

export const AIInsightsPage = () => {
  const navigate = useNavigate();
  const {
    conversations = [],
    contacts = [],
    leads = [],
    aiSettings = {},
    currentUser,
    pushToast,
  } = useCRM();

  const [confidenceFilter, setConfidenceFilter] = useState(0);
  const [simulatorInput, setSimulatorInput] = useState(
    'Hi team, we need an e-commerce website with payment gateway and mobile app by next month. Budget is around ₹1,20,000.'
  );
  const [simulatedResult, setSimulatedResult] = useState({
    intent: 'Custom Web & Mobile App Development',
    leadStatus: 'HOT',
    leadScore: 92,
    confidence: 96,
    extractedEntities: {
      teamSize: 'Confirmed ₹1,20,000 Budget',
      timeline: 'Next Month (< 30 Days)',
      productFit: 'E-Commerce + Mobile App',
    },
    suggestedReply:
      'Hello! Thank you for reaching out. With your confirmed budget of ₹1,20,000 and a 30-day timeline, we can build a full React & Node.js e-commerce platform with Razorpay integration. Would you like to schedule a quick 15-minute discovery call tomorrow?',
    handoffTriggered: true,
    handoffReason: 'Lead Score >= 81 (HOT Lead Threshold)',
  });
  const [isSimulating, setIsSimulating] = useState(false);

  const enrichedConversations = useMemo(() => {
    return conversations.map((c) => {
      const contact = contacts.find((cnt) => cnt.id === c.contactId) || {};
      const lead = leads.find((l) => l.id === c.leadId || l.contactId === c.contactId) || {};
      return {
        ...c,
        contactName: contact.name || c.contactName || 'WhatsApp Customer',
        company: contact.company || c.company || 'Inbound Business',
        leadStatus: lead.leadType || c.leadStatus || 'WARM',
        leadScore: lead.leadScore ?? c.leadScore ?? 70,
        intent: lead.interestedService || c.keyFinding || 'Service Inquiry',
        aiSummary:
          lead.aiSummary ||
          c.keyFinding ||
          'Customer inquiry analyzed by PulseFlow AI qualification engine.',
        leadId: lead.id || c.leadId || 'lead-1',
      };
    });
  }, [conversations, contacts, leads]);

  const handleRunSimulation = async (e) => {
    e.preventDefault();
    if (!simulatorInput.trim()) return;
    setIsSimulating(true);

    const targetConvId = conversations[0]?.id || 'conv-1';
    try {
      const response = await fetch(`/api/conversations/${targetConvId}/incoming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: simulatorInput,
          languageHint: 'English',
        }),
      });

      if (!response.ok) throw new Error('Simulation request failed');
      const data = await response.json();
      const st = data.aiStructured || {};
      const score = st.leadScore ?? 88;
      const type = st.leadType || (score >= 81 ? 'HOT' : 'WARM');

      setSimulatedResult({
        intent: st.service || st.intent || 'Product & Pricing Inquiry',
        leadStatus: type,
        leadScore: score,
        confidence: Math.round((st.confidence || 0.92) * 100),
        extractedEntities: {
          teamSize: st.budget || 'Detected from message',
          timeline: st.timeline || 'Active Evaluation',
          productFit: st.service || 'WhatsApp AI CRM',
        },
        suggestedReply:
          data.aiMsg?.content ||
          'Thank you for your inquiry! Our team has logged your requirements and will share a tailored proposal.',
        handoffTriggered: Boolean(st.needsHuman || score >= 81),
        handoffReason:
          st.needsHuman || score >= 81
            ? `Score ${score}/100 meets priority threshold`
            : 'Autonomous AI Agent Handling',
      });
      setIsSimulating(false);
      if (pushToast) {
        pushToast(
          'AI Qualification Executed',
          `Scored ${score}/100 (${type})`,
          'success'
        );
      }
    } catch {
      setIsSimulating(false);
    }
  };

  const filteredInsights = useMemo(() => {
    return enrichedConversations.filter((c) => c.leadScore >= confidenceFilter);
  }, [enrichedConversations, confidenceFilter]);

  const intentDistribution = [
    { label: 'Custom Web & Mobile App Development', count: 38, pct: 36, color: 'bg-indigo-600' },
    { label: 'WhatsApp AI Automation & CRM Integration', count: 31, pct: 29, color: 'bg-emerald-600' },
    { label: 'Pricing & Milestone Quotations', count: 20, pct: 19, color: 'bg-amber-500' },
    { label: 'General Service & Timeline Inquiry', count: 11, pct: 10, color: 'bg-sky-500' },
    { label: 'Direct Manager Handoff Request', count: 6, pct: 6, color: 'bg-rose-500' },
  ];

  const providerLabel = String(aiSettings?.provider || 'GEMINI').toUpperCase();
  const modelLabel = aiSettings?.model || 'gemini-3.5-flash-lite';
  const hotThreshold = aiSettings?.scoreThresholds?.hotMin || 81;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="glass-panel rounded-3xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-800 border border-indigo-400/40 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Engine: {providerLabel} ({modelLabel})
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/15 text-emerald-800 border border-emerald-400/40 backdrop-blur-md">
              HOT Lead Threshold: Score &ge; {hotThreshold}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-2">
            AI Lead Qualification & Intent Intelligence
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Inspect how PulseFlow AI scores WhatsApp conversations, extracts BANT signals, and triggers human handoffs.
          </p>
        </div>

        {currentUser?.role === 'ADMIN' && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/ai-settings')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/80 bg-white/75 text-xs font-semibold text-slate-700 hover:bg-white shadow-2xs transition-all backdrop-blur-md cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              Configure AI Prompts & Thresholds
            </button>
          </div>
        )}
      </div>

      {/* Interactive AI Qualification Sandbox + Intent Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Prompt & Qualification Simulator */}
        <div className="lg:col-span-2 glass-panel rounded-3xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-white/60 bg-indigo-500/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Interactive AI Qualification & Scoring Sandbox
                </h2>
                <p className="text-xs text-slate-600">
                  Test any inbound customer WhatsApp message to preview real-time AI scoring, entity extraction, and auto-reply
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold text-indigo-800 bg-white/80 px-3 py-1 rounded-xl border border-white">
              LIVE TESTER
            </span>
          </div>

          <div className="p-6 space-y-5">
            <form onSubmit={handleRunSimulation} className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Simulated Inbound Customer WhatsApp Message
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <textarea
                  rows={2}
                  value={simulatorInput}
                  onChange={(e) => setSimulatorInput(e.target.value)}
                  placeholder="Type a sample WhatsApp message from a prospect..."
                  className="flex-1 p-3.5 text-xs bg-white/80 border border-white/90 rounded-2xl focus:outline-none focus:bg-white focus:border-indigo-500 shadow-inner"
                />
                <button
                  type="submit"
                  disabled={isSimulating}
                  className="px-5 py-3 rounded-2xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 shrink-0 shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  {isSimulating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Scoring...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Run AI Analyzer
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Output Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-white/70 border border-white/90 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Classified Status & Score</span>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${
                      simulatedResult.leadStatus === 'HOT'
                        ? 'bg-rose-500/15 text-rose-800 border border-rose-300'
                        : simulatedResult.leadStatus === 'WARM'
                        ? 'bg-amber-500/15 text-amber-800 border border-amber-300'
                        : 'bg-slate-200/70 text-slate-700'
                    }`}
                  >
                    {simulatedResult.leadStatus} • {simulatedResult.leadScore}/100
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    ({simulatedResult.confidence}% conf)
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-800 mt-2.5">
                  Intent: {simulatedResult.intent}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/70 border border-white/90 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Extracted Signals</span>
                <div className="space-y-1.5 mt-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Budget:</span>
                    <span className="font-semibold text-slate-900">{simulatedResult.extractedEntities.teamSize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Timeline:</span>
                    <span className="font-semibold text-slate-900">{simulatedResult.extractedEntities.timeline}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Service:</span>
                    <span className="font-semibold text-slate-900">{simulatedResult.extractedEntities.productFit}</span>
                  </div>
                </div>
              </div>

              <div
                className={`p-4 rounded-2xl border ${
                  simulatedResult.handoffTriggered
                    ? 'bg-amber-500/15 border-amber-300/80'
                    : 'bg-emerald-500/15 border-emerald-300/80'
                }`}
              >
                <span className="text-[10px] font-bold uppercase text-slate-700">Routing Decision</span>
                <div className="flex items-center gap-1.5 mt-2">
                  {simulatedResult.handoffTriggered ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-slate-900">
                    {simulatedResult.handoffTriggered ? 'Priority Alert Triggered' : 'Autonomous AI Mode'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 mt-1.5">{simulatedResult.handoffReason}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/95 text-white border border-white/15 shadow-md">
              <div className="flex items-center justify-between text-[11px] text-indigo-300 font-mono mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-indigo-400" />
                  GENERATED WHATSAPP AUTO-REPLY
                </span>
                <span>LATENCY: 420ms</span>
              </div>
              <p className="text-xs text-slate-100 leading-relaxed">{simulatedResult.suggestedReply}</p>
            </div>
          </div>
        </div>

        {/* Detected Intent Breakdown */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Inbound Intent Classification</h2>
            <p className="text-xs text-slate-600 mt-0.5 mb-5">
              Primary buyer intents detected across WhatsApp conversations
            </p>

            <div className="space-y-4">
              {intentDistribution.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-800">{item.label}</span>
                    <span className="font-mono font-bold text-slate-600">
                      {item.count} ({item.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/60 flex items-center justify-between text-xs">
            <span className="text-slate-600">Knowledge Base Grounding</span>
            <span className="font-mono font-bold text-emerald-700">99.4% Grounded</span>
          </div>
        </div>
      </div>

      {/* Live Conversation Qualification Audit Log */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/60 bg-white/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Live Conversation AI Qualification Log
            </h2>
            <p className="text-xs text-slate-600">
              Real-time BANT summaries and scores for active WhatsApp threads
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Min Score Filter:</span>
            {[0, 50, 80].map((min) => (
              <button
                key={min}
                onClick={() => setConfidenceFilter(min)}
                className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                  confidenceFilter === min
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white/70 text-slate-600 hover:bg-white'
                }`}
              >
                {min === 0 ? 'ALL' : `>= ${min}`}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-white/50">
          {filteredInsights.map((conv) => (
            <div
              key={conv.id}
              className="p-5 hover:bg-white/45 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-sm font-bold text-slate-900">{conv.contactName}</span>
                  <span className="text-xs text-slate-500">• {conv.company}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                      conv.leadStatus === 'HOT'
                        ? 'bg-rose-500/15 text-rose-800 border border-rose-300'
                        : conv.leadStatus === 'WARM'
                        ? 'bg-amber-500/15 text-amber-800 border border-amber-300'
                        : 'bg-white/70 text-slate-700'
                    }`}
                  >
                    {conv.leadStatus} • Score {conv.leadScore}/100
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-800 border border-indigo-300">
                    Service: {conv.intent}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{conv.aiSummary}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => navigate(`/leads/${conv.leadId}`)}
                  className="px-3.5 py-2 rounded-xl border border-white/80 bg-white/75 text-xs font-semibold text-slate-700 hover:bg-white shadow-2xs cursor-pointer"
                >
                  Lead Profile
                </button>
                <button
                  onClick={() => navigate(`/inbox?convId=${conv.id}`)}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Inspect Chat
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
