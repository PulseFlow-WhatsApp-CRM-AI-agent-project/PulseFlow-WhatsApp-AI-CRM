import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MessageSquare,
  Bot,
  UserCheck,
  Building2,
  ArrowUpRight,
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';

export const ConversationsPage = () => {
  const navigate = useNavigate();
  const {
    conversations = [],
    contacts = [],
    leads = [],
    teamMembers = [],
    messagesByConv = {},
    takeOverConversation,
    returnConversationToAI,
    markConversationRead,
  } = useCRM();

  const [modeFilter, setModeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Enrich conversations with contact, lead, and messagesByConv
  const enrichedConversations = useMemo(() => {
    return conversations.map((c) => {
      const contact = contacts.find((cnt) => cnt.id === c.contactId) || {};
      const lead = leads.find((l) => l.id === c.leadId || l.contactId === c.contactId) || {};
      const assignedRep =
        teamMembers.find((m) => m.id === c.assignedAgentId) ||
        teamMembers[0] || { name: 'Binil B' };
      const msgs = messagesByConv[c.id] || c.messages || [];
      const contactName = contact.name || c.contactName || 'WhatsApp Customer';
      const company = contact.company || c.company || 'Inbound Business';
      const phone = contact.phone || c.phone || '—';
      const avatar = contactName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      return {
        ...c,
        contactName,
        company,
        phone,
        avatar,
        leadStatus: lead.leadType || c.leadStatus || 'WARM',
        leadScore: lead.leadScore ?? c.leadScore ?? 70,
        intent: lead.interestedService || c.keyFinding || 'Service Inquiry',
        assignedAgent: assignedRep.name,
        unread: c.unreadCount ?? c.unread ?? 0,
        messageCount: msgs.length,
        isAiActive: c.aiEnabled && !c.humanTakeoverActive,
      };
    });
  }, [conversations, contacts, leads, teamMembers, messagesByConv]);

  const filteredConversations = useMemo(() => {
    return enrichedConversations.filter((c) => {
      if (modeFilter === 'AI' && !c.isAiActive) return false;
      if (modeFilter === 'HUMAN' && c.isAiActive) return false;
      if (modeFilter === 'UNREAD' && c.unread === 0) return false;
      if (
        searchQuery &&
        !c.contactName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !c.company.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !c.intent.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [enrichedConversations, modeFilter, searchQuery]);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Conversation Audit & Routing Directory
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Monitor all active WhatsApp threads, switch between AI and Human modes, or jump into the live inbox
          </p>
        </div>
        <button
          onClick={() => navigate('/inbox')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-semibold hover:from-emerald-500 hover:to-teal-400 transition-all shadow-md shadow-emerald-600/20 w-fit cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          Launch Split-Pane WhatsApp Inbox
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'ALL', label: 'All Threads', count: enrichedConversations.length },
            {
              id: 'AI',
              label: 'AI Auto-Reply Active',
              count: enrichedConversations.filter((c) => c.isAiActive).length,
            },
            {
              id: 'HUMAN',
              label: 'Human Agent Takeover',
              count: enrichedConversations.filter((c) => !c.isAiActive).length,
            },
            {
              id: 'UNREAD',
              label: 'Unread Messages',
              count: enrichedConversations.filter((c) => c.unread > 0).length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setModeFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                modeFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white/60 text-slate-700 hover:bg-white border border-white/75'
              }`}
            >
              {tab.label}
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  modeFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by customer, company, or intent..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-white/75 border border-white/80 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-500 backdrop-blur-md"
          />
        </div>
      </div>

      {/* Conversation Cards List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredConversations.map((conv) => (
          <div
            key={conv.id}
            className="glass-panel rounded-3xl p-5 hover:bg-white/75 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                {conv.avatar}
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{conv.contactName}</h3>
                  <span className="text-xs text-slate-600 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {conv.company}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                      conv.leadStatus === 'HOT'
                        ? 'bg-rose-500/15 text-rose-800 border border-rose-300'
                        : conv.leadStatus === 'WARM'
                        ? 'bg-amber-500/15 text-amber-800 border border-amber-300'
                        : 'bg-white/70 text-slate-700 border border-white'
                    }`}
                  >
                    {conv.leadStatus} • {conv.leadScore}/100
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
                      conv.isAiActive
                        ? 'bg-indigo-500/15 text-indigo-800 border border-indigo-300'
                        : 'bg-amber-500/15 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {conv.isAiActive ? (
                      <>
                        <Bot className="w-3 h-3" /> AI Auto-Reply ON
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3 h-3" /> Human Agent Mode
                      </>
                    )}
                  </span>
                  {conv.unread > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-mono font-bold">
                      {conv.unread} Unread
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-700">
                  Latest Message: <strong className="text-slate-900">"{conv.lastMessage}"</strong>
                </p>

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                  <span className="font-mono">{conv.phone}</span>
                  <span>•</span>
                  <span>Detected Intent: <strong className="text-slate-800">{conv.intent}</strong></span>
                  <span>•</span>
                  <span>Assigned Rep: <strong className="text-slate-800">{conv.assignedAgent}</strong></span>
                  <span>•</span>
                  <span>Total Messages: <strong className="font-mono text-slate-800">{conv.messageCount}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-white/60">
              <button
                onClick={() =>
                  conv.isAiActive
                    ? takeOverConversation(conv.id)
                    : returnConversationToAI(conv.id)
                }
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  conv.isAiActive
                    ? 'bg-amber-500/15 text-amber-900 hover:bg-amber-500/25 border border-amber-300'
                    : 'bg-indigo-500/15 text-indigo-900 hover:bg-indigo-500/25 border border-indigo-300'
                }`}
              >
                {conv.isAiActive ? 'Pause AI & Take Over' : 'Enable AI Auto-Reply'}
              </button>

              <button
                onClick={() => {
                  markConversationRead(conv.id);
                  navigate(`/inbox?convId=${conv.id}`);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                Open Thread
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
