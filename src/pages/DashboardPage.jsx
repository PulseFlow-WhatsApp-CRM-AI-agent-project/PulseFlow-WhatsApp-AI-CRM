import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Flame,
  Bot,
  Clock,
  TrendingUp,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  Sparkles,
  Building2,
  ChevronRight,
  Plus,
  Calendar,
  X,
  Send,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useCRM } from '../context/CRMContext';
import { dailyConversationVolume } from '../data/mockCrmData';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const {
    leads = [],
    contacts = [],
    conversations = [],
    followUps = [],
    teamMembers = [],
    aiSettings = {},
    addContact,
    addLead,
    takeOverConversation,
    returnConversationToAI,
    updateFollowUpStatus,
    addFollowUp,
    sendAgentMessage,
  } = useCRM();

  const [dateRange, setDateRange] = useState('7D');
  const [selectedQueueTab, setSelectedQueueTab] = useState('handoff');
  const [showQuickLeadModal, setShowQuickLeadModal] = useState(false);
  const [showQuickTaskModal, setShowQuickTaskModal] = useState(false);
  const [quickReplyOpenId, setQuickReplyOpenId] = useState(null);
  const [quickReplyText, setQuickReplyText] = useState('');

  // Quick Lead Form State
  const [leadForm, setLeadForm] = useState({
    name: '',
    company: '',
    phone: '+91 ',
    email: '',
    leadScore: 85,
    budget: '₹1,00,000',
    interestedService: 'Custom Web & Mobile App Development',
    aiSummary: '',
  });

  // Quick Task Form State
  const [taskForm, setTaskForm] = useState({
    leadId: leads[0]?.id || 'lead-1',
    note: '',
    date: new Date().toISOString().slice(0, 10),
    time: '15:00',
  });

  const rangeFactor = dateRange === '24H' ? 0.22 : dateRange === '7D' ? 1 : 3.8;

  // Enrich conversations with contact + lead
  const enrichedConversations = useMemo(() => {
    return conversations.map((c) => {
      const contact = contacts.find((cnt) => cnt.id === c.contactId) || {};
      const lead = leads.find((l) => l.id === c.leadId || l.contactId === c.contactId) || {};
      const assignedAgent = teamMembers.find((m) => m.id === c.assignedAgentId) || teamMembers[0] || { name: 'Binil B' };
      const name = contact.name || c.contactName || 'WhatsApp Customer';
      const avatar = name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      return {
        ...c,
        contactName: name,
        company: contact.company || c.company || 'Inbound Prospect',
        phone: contact.phone || c.phone || '—',
        avatar,
        leadType: lead.leadType || c.leadStatus || 'WARM',
        leadScore: lead.leadScore ?? c.leadScore ?? 65,
        intent: lead.interestedService || c.keyFinding || 'Service Inquiry',
        assignedAgentName: assignedAgent.name,
        leadId: lead.id || c.leadId || 'lead-1',
      };
    });
  }, [conversations, contacts, leads, teamMembers]);

  // Enrich leads with contact info
  const enrichedLeads = useMemo(() => {
    return leads.map((l) => {
      const contact = contacts.find((cnt) => cnt.id === l.contactId) || {};
      const type = l.leadType || l.status || 'WARM';
      const score = l.leadScore ?? l.score ?? 70;
      const val = Number(l.estimatedValueInr ?? l.estimatedValue ?? 50000);
      return {
        ...l,
        displayName: contact.name || l.name || 'Prospect',
        displayCompany: contact.company || l.company || 'Organization',
        displayPhone: contact.phone || l.phone || '—',
        displayType: type,
        displayScore: score,
        displayValue: val,
        displaySummary: l.aiSummary || l.notes?.[0]?.content || 'Qualified via WhatsApp AI',
        displayStage: l.leadStatus || l.stage || 'QUALIFIED',
      };
    });
  }, [leads, contacts]);

  const stats = useMemo(() => {
    const hotCount = enrichedLeads.filter((l) => l.displayType === 'HOT').length;
    const warmCount = enrichedLeads.filter((l) => l.displayType === 'WARM').length;
    const coldCount = enrichedLeads.filter((l) => l.displayType === 'COLD').length;
    const handoffCount = enrichedConversations.filter(
      (c) => (c.unreadCount || 0) > 0 || !c.aiEnabled || c.humanTakeoverActive || c.needsHumanAttention
    ).length;
    const aiActiveCount = enrichedConversations.filter((c) => c.aiEnabled && !c.humanTakeoverActive).length;
    const pipelineTotal = enrichedLeads.reduce((acc, l) => acc + (l.displayValue || 0), 0);
    const aiRate =
      enrichedConversations.length > 0
        ? Math.round((aiActiveCount / enrichedConversations.length) * 1000) / 10
        : 85.4;

    return {
      totalConvos: Math.max(enrichedConversations.length, Math.round((enrichedConversations.length + 124) * rangeFactor)),
      hotCount,
      warmCount,
      coldCount,
      handoffCount,
      aiRate,
      pipelineTotal,
      pendingFollowUps: followUps.filter((f) => f.status === 'PENDING').length,
    };
  }, [enrichedLeads, enrichedConversations, followUps, rangeFactor]);

  const chartData = useMemo(() => {
    if (dateRange === '24H') {
      return [
        { day: '00:00', inbound: 18, aiResolved: 16, humanEscalated: 2 },
        { day: '04:00', inbound: 12, aiResolved: 11, humanEscalated: 1 },
        { day: '08:00', inbound: 44, aiResolved: 36, humanEscalated: 8 },
        { day: '12:00', inbound: 68, aiResolved: 54, humanEscalated: 14 },
        { day: '16:00', inbound: 74, aiResolved: 61, humanEscalated: 13 },
        { day: '20:00', inbound: 39, aiResolved: 33, humanEscalated: 6 },
      ];
    }
    if (dateRange === '30D') {
      return dailyConversationVolume.map((d) => ({
        ...d,
        inbound: Math.round(d.inbound * 4.1),
        aiResolved: Math.round(d.aiResolved * 4.1),
        humanEscalated: Math.round(d.humanEscalated * 4.1),
      }));
    }
    return dailyConversationVolume;
  }, [dateRange]);

  const handoffConversations = useMemo(() => {
    const filtered = enrichedConversations.filter(
      (c) => !c.aiEnabled || c.humanTakeoverActive || c.needsHumanAttention || (c.unreadCount || 0) > 0 || c.leadScore >= 80
    );
    return filtered.length > 0 ? filtered : enrichedConversations;
  }, [enrichedConversations]);

  const hotLeadsList = useMemo(() => {
    const hot = enrichedLeads.filter((l) => l.displayType === 'HOT');
    return hot.length > 0 ? hot : enrichedLeads.slice(0, 5);
  }, [enrichedLeads]);

  const handleQuickLeadCreate = (e) => {
    e.preventDefault();
    if (!leadForm.name.trim()) return;

    const createdContact = addContact(
      {
        name: leadForm.name.trim(),
        company: leadForm.company.trim() || 'Inbound Business',
        phone: leadForm.phone.trim() || '+91 98470 11111',
        email: leadForm.email.trim() || 'contact@company.in',
        roleTitle: 'Decision Maker',
        location: 'Kochi, Kerala',
        preferredLanguage: 'English',
        source: 'WhatsApp Inbound',
        tags: [leadForm.interestedService],
      },
      { createLead: false, createConversation: true }
    );

    const score = Number(leadForm.leadScore) || 85;
    const createdLead = addLead({
      contactId: createdContact.id,
      leadStatus: 'QUALIFIED',
      leadType: score >= 81 ? 'HOT' : score >= 50 ? 'WARM' : 'COLD',
      leadScore: score,
      interestedService: leadForm.interestedService,
      budget: leadForm.budget,
      timeline: 'Within 30 days',
      requirements: [leadForm.interestedService],
      source: 'WhatsApp Inbound',
      assignedAgentId: teamMembers[0]?.id || 'admin-1',
      aiSummary: leadForm.aiSummary || `Inbound inquiry for ${leadForm.interestedService} with budget ${leadForm.budget}.`,
      purchaseIntent: true,
    });

    setShowQuickLeadModal(false);
    navigate(`/leads/${createdLead.id}`);
  };

  const handleQuickTaskCreate = (e) => {
    e.preventDefault();
    if (!taskForm.note.trim()) return;
    const targetLead = leads.find((l) => l.id === taskForm.leadId) || leads[0];
    addFollowUp({
      leadId: targetLead?.id || 'lead-1',
      contactId: targetLead?.contactId || 'cnt-1',
      assignedUserId: teamMembers[0]?.id || 'admin-1',
      date: taskForm.date,
      time: taskForm.time,
      note: taskForm.note.trim(),
      status: 'PENDING',
    });
    setShowQuickTaskModal(false);
    setTaskForm({ ...taskForm, note: '' });
  };

  const handleSendQuickReply = (convId) => {
    if (!quickReplyText.trim()) return;
    sendAgentMessage(convId, quickReplyText);
    setQuickReplyText('');
    setQuickReplyOpenId(null);
  };

  const providerLabel = String(aiSettings?.provider || 'GEMINI').toUpperCase();
  const modelLabel = aiSettings?.model || 'gemini-3.5-flash-lite';

  const kpiCards = [
    {
      title: 'WhatsApp Conversations',
      value: stats.totalConvos.toLocaleString(),
      change: '+18.4%',
      subtitle: `${conversations.length} live threads in workspace`,
      icon: MessageSquare,
      accent: 'text-emerald-600 bg-emerald-500/15 border-emerald-300/60',
      onClick: () => navigate('/inbox'),
    },
    {
      title: 'Qualified Hot Leads',
      value: stats.hotCount,
      change: '+24.1%',
      subtitle: `₹${stats.pipelineTotal.toLocaleString('en-IN')} active pipeline value`,
      icon: Flame,
      accent: 'text-rose-600 bg-rose-500/15 border-rose-300/60',
      onClick: () => navigate('/leads?status=HOT'),
    },
    {
      title: 'AI Auto-Resolution Rate',
      value: `${stats.aiRate}%`,
      change: '+6.2%',
      subtitle: `Model: ${modelLabel} (${providerLabel})`,
      icon: Bot,
      accent: 'text-indigo-600 bg-indigo-500/15 border-indigo-300/60',
      onClick: () => navigate('/insights'),
    },
    {
      title: 'First Response SLA',
      value: '1.8s',
      change: '-34.0%',
      subtitle: `${stats.pendingFollowUps} follow-ups queued today`,
      icon: Clock,
      accent: 'text-amber-600 bg-amber-500/15 border-amber-300/60',
      onClick: () => navigate('/follow-ups'),
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Page Header & Action Bar */}
      <div className="glass-panel rounded-3xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-800 border border-emerald-400/40 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Meta Cloud API v20.0 Connected
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-800 border border-indigo-400/40 backdrop-blur-md">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              AI Auto-Qualifier Active
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-2">
            Revenue & WhatsApp Operations Overview
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Real-time telemetry across inbound WhatsApp conversations, Gemini AI qualification, and human sales handoffs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center bg-white/55 border border-white/80 rounded-xl p-1 shadow-xs backdrop-blur-md">
            {['24H', '7D', '30D'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dateRange === range
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowQuickTaskModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/70 border border-white/80 text-xs font-semibold text-slate-700 hover:bg-white shadow-xs transition-all backdrop-blur-md"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-600" />
            Schedule Follow-Up
          </button>

          <button
            onClick={() => setShowQuickLeadModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/70 border border-white/80 text-xs font-semibold text-slate-700 hover:bg-white shadow-xs transition-all backdrop-blur-md"
          >
            <Plus className="w-3.5 h-3.5 text-slate-600" />
            Add Lead
          </button>

          <Link
            to="/inbox"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-semibold hover:from-emerald-500 hover:to-teal-400 transition-all shadow-md shadow-emerald-600/20"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Open Live WhatsApp Inbox
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              onClick={card.onClick}
              className="glass-panel rounded-3xl p-5 hover:bg-white/75 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center backdrop-blur-md ${card.accent}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-400/40 font-mono">
                  <TrendingUp className="w-3 h-3" />
                  {card.change}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {card.title}
                </p>
                <div className="flex items-baseline justify-between mt-1">
                  <p className="text-3xl font-bold text-slate-900 font-mono tracking-tight">
                    {card.value}
                  </p>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
                <p className="text-xs text-slate-600 mt-1.5">{card.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation Volume & AI Resolution Chart */}
        <div className="lg:col-span-2 glass-panel rounded-3xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                WhatsApp Message Volume vs. AI Auto-Resolution ({dateRange})
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Comparing total inbound customer inquiries against autonomous AI replies and human handoffs
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                AI Resolved
              </span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                Total Inbound
              </span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Human Escalated
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '14px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="inbound"
                  name="Total Inbound"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorInbound)"
                />
                <Area
                  type="monotone"
                  dataKey="aiResolved"
                  name="AI Auto-Resolved"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorAi)"
                />
                <Area
                  type="monotone"
                  dataKey="humanEscalated"
                  name="Human Handoff"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={0}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Lead Qualification Distribution */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-slate-900">Lead Scoring Funnel</h2>
              <span className="text-xs font-mono font-semibold text-indigo-700 bg-indigo-500/15 px-2.5 py-0.5 rounded-full border border-indigo-400/40">
                Real-Time Scoring
              </span>
            </div>
            <p className="text-xs text-slate-600 mb-5">
              Distribution of leads classified by AI intent & budget analysis
            </p>

            <div className="space-y-3.5 mb-6">
              <div
                onClick={() => navigate('/leads?status=HOT')}
                className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-300/60 cursor-pointer hover:bg-rose-500/20 transition-colors backdrop-blur-xs"
              >
                <div className="flex items-center justify-between text-xs font-bold text-rose-900 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-rose-600" />
                    HOT LEADS (Score 81–100)
                  </span>
                  <span className="font-mono">{stats.hotCount} Leads</span>
                </div>
                <div className="w-full h-2 bg-rose-200/70 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-600 rounded-full"
                    style={{ width: `${Math.min(100, (stats.hotCount / Math.max(1, leads.length)) * 100)}%` }}
                  />
                </div>
              </div>

              <div
                onClick={() => navigate('/leads?status=WARM')}
                className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-300/60 cursor-pointer hover:bg-amber-500/20 transition-colors backdrop-blur-xs"
              >
                <div className="flex items-center justify-between text-xs font-bold text-amber-900 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                    WARM LEADS (Score 31–80)
                  </span>
                  <span className="font-mono">{stats.warmCount} Leads</span>
                </div>
                <div className="w-full h-2 bg-amber-200/70 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${Math.min(100, (stats.warmCount / Math.max(1, leads.length)) * 100)}%` }}
                  />
                </div>
              </div>

              <div
                onClick={() => navigate('/leads?status=COLD')}
                className="p-3.5 rounded-2xl bg-white/55 border border-white/80 cursor-pointer hover:bg-white/80 transition-colors backdrop-blur-xs"
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                  <span>COLD LEADS (Score 0–30)</span>
                  <span className="font-mono">{stats.coldCount} Leads</span>
                </div>
                <div className="w-full h-2 bg-slate-200/70 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-500 rounded-full"
                    style={{ width: `${Math.min(100, (stats.coldCount / Math.max(1, leads.length)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/60 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Total Qualified Pipeline</p>
              <p className="text-lg font-bold text-slate-900 font-mono">
                ₹{stats.pipelineTotal.toLocaleString('en-IN')}
              </p>
            </div>
            <Link
              to="/leads"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Open Pipeline Board
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Operational Row: Handoff Triage Queue + Follow-Up Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Triage Queue */}
        <div className="lg:col-span-2 glass-panel rounded-3xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-white/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white/30">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedQueueTab('handoff')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedQueueTab === 'handoff'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white/60 text-slate-600 hover:bg-white'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Priority Handoff & High-Intent Queue ({handoffConversations.length})
              </button>
              <button
                onClick={() => setSelectedQueueTab('hot_leads')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedQueueTab === 'hot_leads'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white/60 text-slate-600 hover:bg-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                Hot Leads Ready to Close ({hotLeadsList.length})
              </button>
            </div>
            <Link
              to={selectedQueueTab === 'handoff' ? '/inbox' : '/leads'}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              View All
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {selectedQueueTab === 'handoff' ? (
            <div className="divide-y divide-white/50">
              {handoffConversations.map((conv) => {
                const isAiActive = conv.aiEnabled && !conv.humanTakeoverActive;
                return (
                  <div key={conv.id} className="p-5 hover:bg-white/45 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                          {conv.avatar}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to={`/leads/${conv.leadId}`}
                              className="text-sm font-bold text-slate-900 hover:text-emerald-700 transition-colors"
                            >
                              {conv.contactName}
                            </Link>
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {conv.company}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                                conv.leadType === 'HOT'
                                  ? 'bg-rose-500/15 text-rose-800 border border-rose-300'
                                  : 'bg-amber-500/15 text-amber-800 border border-amber-300'
                              }`}
                            >
                              {conv.leadType} • {conv.leadScore}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
                                isAiActive
                                  ? 'bg-indigo-500/15 text-indigo-800 border border-indigo-300'
                                  : 'bg-amber-500/15 text-amber-800 border border-amber-300'
                              }`}
                            >
                              {isAiActive ? (
                                <>
                                  <Bot className="w-3 h-3" /> AI Active
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3 h-3" /> Human Takeover
                                </>
                              )}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 mt-1 line-clamp-1">
                            "{conv.lastMessage}"
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500">
                            <span className="font-mono">{conv.phone}</span>
                            <span>•</span>
                            <span>Service: <strong className="text-slate-800">{conv.intent}</strong></span>
                            <span>•</span>
                            <span>Owner: <strong className="text-slate-800">{conv.assignedAgentName}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() =>
                            setQuickReplyOpenId(quickReplyOpenId === conv.id ? null : conv.id)
                          }
                          className="px-3 py-1.5 rounded-xl border border-white/80 bg-white/70 text-xs font-semibold text-slate-700 hover:bg-white transition-colors shadow-2xs"
                        >
                          Quick Reply
                        </button>
                        <button
                          onClick={() =>
                            isAiActive
                              ? takeOverConversation(conv.id)
                              : returnConversationToAI(conv.id)
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                            isAiActive
                              ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-xs'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                          }`}
                        >
                          {isAiActive ? 'Take Over' : 'Resume AI'}
                        </button>
                        <button
                          onClick={() => navigate(`/inbox?convId=${conv.id}`)}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                        >
                          Open Thread
                        </button>
                      </div>
                    </div>

                    {quickReplyOpenId === conv.id && (
                      <div className="mt-3 pt-3 border-t border-white/60 flex items-center gap-2">
                        <input
                          type="text"
                          value={quickReplyText}
                          onChange={(e) => setQuickReplyText(e.target.value)}
                          placeholder={`Send instant WhatsApp message to ${conv.contactName}...`}
                          className="flex-1 px-3.5 py-2 text-xs bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendQuickReply(conv.id);
                          }}
                        />
                        <button
                          onClick={() => handleSendQuickReply(conv.id)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Send Now
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="divide-y divide-white/50">
              {hotLeadsList.map((lead) => (
                <div key={lead.id} className="p-5 hover:bg-white/45 transition-colors flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/leads/${lead.id}`}
                        className="text-sm font-bold text-slate-900 hover:text-emerald-700"
                      >
                        {lead.displayName}
                      </Link>
                      <span className="text-xs text-slate-600">• {lead.displayCompany}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-500/15 text-rose-800 border border-rose-300">
                        Score {lead.displayScore}/100
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{lead.displaySummary}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-bold font-mono text-slate-900">
                        ₹{lead.displayValue.toLocaleString('en-IN')}
                      </p>
                      <p className="text-[11px] text-slate-500">{lead.displayStage}</p>
                    </div>
                    <Link
                      to={`/leads/${lead.id}`}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                    >
                      Inspect
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Follow-Ups */}
        <div className="glass-panel rounded-3xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-4 border-b border-white/60 flex items-center justify-between bg-white/30">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Scheduled Follow-Ups</h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  {stats.pendingFollowUps} pending tasks require completion
                </p>
              </div>
              <Link
                to="/follow-ups"
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
              >
                All Tasks
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-white/50 max-h-[360px] overflow-y-auto glass-scrollbar">
              {followUps.slice(0, 5).map((item) => {
                const contact = contacts.find((c) => c.id === item.contactId) || {};
                const lead = leads.find((l) => l.id === item.leadId) || {};
                const leadName = item.leadName || contact.name || 'Customer';
                const companyName = item.company || contact.company || 'Inbound Lead';
                const taskDesc = item.task || item.note || 'Follow up with customer';
                const dueLabel = item.dueTime || `${item.date || 'Today'} · ${item.time || '11:00'}`;

                return (
                  <div key={item.id} className="p-4 hover:bg-white/45 transition-colors flex items-start gap-3">
                    <button
                      onClick={() =>
                        updateFollowUpStatus(
                          item.id,
                          item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
                        )
                      }
                      className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        item.status === 'COMPLETED'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-400 bg-white/70 hover:border-emerald-500'
                      }`}
                      title="Toggle Follow-Up Status"
                    >
                      {item.status === 'COMPLETED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          to={`/leads/${item.leadId || lead.id || 'lead-1'}`}
                          className={`text-xs font-bold hover:text-emerald-700 truncate ${
                            item.status === 'COMPLETED' ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {leadName} ({companyName})
                        </Link>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-800">
                          {item.status}
                        </span>
                      </div>
                      <p
                        className={`text-xs mt-1 ${
                          item.status === 'COMPLETED' ? 'line-through text-slate-400' : 'text-slate-600'
                        }`}
                      >
                        {taskDesc}
                      </p>
                      <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                        <span className="font-mono">{dueLabel}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-white/30 border-t border-white/60">
            <button
              onClick={() => setShowQuickTaskModal(true)}
              className="w-full py-2 rounded-xl border border-white/80 bg-white/75 text-xs font-semibold text-slate-700 hover:bg-white transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Create New Follow-Up Task
            </button>
          </div>
        </div>
      </div>

      {/* Quick Add Lead Modal */}
      {showQuickLeadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-strong rounded-3xl max-w-md w-full p-6 shadow-2xl border border-white/80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Create New WhatsApp Lead</h3>
              <button
                onClick={() => setShowQuickLeadModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleQuickLeadCreate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                  placeholder="e.g., Vikramaditya Rao"
                  className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company *</label>
                  <input
                    type="text"
                    required
                    value={leadForm.company}
                    onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })}
                    placeholder="Apex Cloud Ltd"
                    className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Phone *</label>
                  <input
                    type="text"
                    required
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                    placeholder="+91 98470 55412"
                    className="w-full px-3.5 py-2 text-sm font-mono bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial AI Score (0-100)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={leadForm.leadScore}
                    onChange={(e) => setLeadForm({ ...leadForm, leadScore: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 text-sm font-mono bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Budget</label>
                  <input
                    type="text"
                    value={leadForm.budget}
                    onChange={(e) => setLeadForm({ ...leadForm, budget: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm font-mono bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Qualification Summary</label>
                <textarea
                  rows={2}
                  value={leadForm.aiSummary}
                  onChange={(e) => setLeadForm({ ...leadForm, aiSummary: e.target.value })}
                  placeholder="Key buyer requirements or WhatsApp inquiry context..."
                  className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickLeadModal(false)}
                  className="px-4 py-2 rounded-xl border border-white/80 bg-white/60 text-xs font-semibold text-slate-600 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 shadow-sm"
                >
                  Create Lead & Thread
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Schedule Follow-Up Modal */}
      {showQuickTaskModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-strong rounded-3xl max-w-md w-full p-6 shadow-2xl border border-white/80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Schedule Follow-Up Task</h3>
              <button
                onClick={() => setShowQuickTaskModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleQuickTaskCreate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Lead</label>
                <select
                  value={taskForm.leadId}
                  onChange={(e) => setTaskForm({ ...taskForm, leadId: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                >
                  {enrichedLeads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.displayName} — {lead.displayCompany} ({lead.displayType})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Action Description *</label>
                <input
                  type="text"
                  required
                  value={taskForm.note}
                  onChange={(e) => setTaskForm({ ...taskForm, note: e.target.value })}
                  placeholder="e.g., Send enterprise security compliance PDF on WhatsApp"
                  className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={taskForm.date}
                    onChange={(e) => setTaskForm({ ...taskForm, date: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={taskForm.time}
                    onChange={(e) => setTaskForm({ ...taskForm, time: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickTaskModal(false)}
                  className="px-4 py-2 rounded-xl border border-white/80 bg-white/60 text-xs font-semibold text-slate-600 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 shadow-sm"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
