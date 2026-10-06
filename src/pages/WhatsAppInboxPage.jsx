import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Send,
  Paperclip,
  Bot,
  UserCheck,
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  FileText,
  Sparkles,
  ExternalLink,
  ArrowRight,
  X,
  TrendingUp,
  ShieldAlert,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Plus,
  MessageSquare,
  Trash2,
  Phone,
  Globe,
  Smile,
  Clock
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';

const AVATAR_PALETTES = [
  'bg-emerald-500 text-white',
  'bg-slate-800 text-white',
  'bg-teal-600 text-white',
  'bg-violet-600 text-white',
  'bg-indigo-600 text-white',
  'bg-sky-600 text-white'
];

export const WhatsAppInboxPage = () => {
  const {
    conversations,
    contacts,
    leads,
    teamMembers,
    messagesByConv,
    currentUser,
    addContact,
    addLead,
    deleteConversation,
    startOrOpenConversation,
    sendAgentMessage,
    simulateCustomerIncomingMessage,
    takeOverConversation,
    returnConversationToAI,
    markConversationRead,
    updateLead,
    addLeadNote,
    addFollowUp,
    pushToast
  } = useCRM();

  const [searchParams, setSearchParams] = useSearchParams();
  const initialConvId = searchParams.get('convId') || conversations[0]?.id || '';

  const [selectedConvId, setSelectedConvId] = useState(initialConvId);
  const [inboxFilter, setInboxFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [inspectedMsgId, setInspectedMsgId] = useState(null);
  const [showSimBar, setShowSimBar] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [customSimText, setCustomSimText] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [followUpDate, setFollowUpDate] = useState('2026-10-05');
  const [followUpTime, setFollowUpTime] = useState('11:30');
  const [followUpNote, setFollowUpNote] = useState('');
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);

  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [newChatPhone, setNewChatPhone] = useState('+91 ');
  const [newChatService, setNewChatService] = useState('Web Development');
  const [newChatBudget, setNewChatBudget] = useState('₹50,000');

  useEffect(() => {
    const paramId = searchParams.get('convId');
    if (paramId) {
      const match = conversations.find((c) => c.id === paramId);
      if (match) {
        setSelectedConvId((prev) => (prev === paramId ? prev : paramId));
        if (match.unreadCount > 0) {
          markConversationRead(paramId);
        }
      } else if (conversations.length > 0) {
        const fallbackId = conversations[0].id;
        setSelectedConvId(fallbackId);
        setSearchParams({ convId: fallbackId }, { replace: true });
      } else {
        setSelectedConvId('');
        setSearchParams({}, { replace: true });
      }
    } else if (conversations.length > 0) {
      setSelectedConvId((prev) =>
        prev && conversations.some((c) => c.id === prev) ? prev : conversations[0].id
      );
    } else {
      setSelectedConvId((prev) => (prev === '' ? prev : ''));
    }
  }, [searchParams, conversations]);

  const handleCreateNewChat = async (e) => {
    e.preventDefault();
    if (!newChatName.trim() || !newChatPhone.trim()) return;

    const inputDigits = newChatPhone.replace(/[^0-9]/g, '');
    const suffix = inputDigits.slice(-10);
    const existingContact =
      suffix.length >= 7
        ? contacts.find((c) => String(c.phone).replace(/[^0-9]/g, '').endsWith(suffix))
        : null;

    if (existingContact) {
      const existingLead = leads.find((l) => l.contactId === existingContact.id);
      const reopenedConv = await startOrOpenConversation(
        existingContact.id,
        existingLead?.id || ''
      );
      if (reopenedConv?.id) {
        handleSelectConversation(reopenedConv.id);
      }
      setNewChatName('');
      setNewChatPhone('+91 ');
      setShowNewChatModal(false);
      return;
    }

    const createdContact = addContact(
      {
        name: newChatName.trim(),
        phone: newChatPhone.trim(),
        email: '',
        company: 'Direct WhatsApp Inquiry',
        location: '',
        source: 'WhatsApp Inbound',
        tags: ['WhatsApp Lead', newChatService]
      },
      { createLead: false, createConversation: false }
    );
    addLead({
      contactId: createdContact.id,
      leadStatus: 'NEW',
      leadType: 'WARM',
      leadScore: 65,
      interestedService: newChatService,
      budget: newChatBudget,
      timeline: 'This month',
      requirements: [newChatService],
      source: 'WhatsApp Inbound',
      assignedAgentId: currentUser?.id || 'admin-1',
      aiSummary: `WhatsApp chat started with ${newChatName.trim()} for ${newChatService}.`,
      purchaseIntent: true
    });
    setNewChatName('');
    setNewChatPhone('+91 ');
    setShowNewChatModal(false);
  };

  const handleDeleteConversation = (convId) => {
    const remaining = conversations.filter((c) => c.id !== convId);
    const nextConvId = remaining[0]?.id || '';
    deleteConversation(convId);
    if (selectedConvId === convId || activeItem?.conv?.id === convId) {
      setSelectedConvId(nextConvId);
      if (nextConvId) {
        setSearchParams({ convId: nextConvId }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }
  };

  const handleSelectConversation = (convId) => {
    setSelectedConvId(convId);
    if (searchParams.get('convId') !== convId) {
      setSearchParams({ convId }, { replace: true });
    }
    const match = conversations.find((c) => c.id === convId);
    if (match && match.unreadCount > 0) {
      markConversationRead(convId);
    }
  };

  const enrichedConversations = useMemo(() => {
    return conversations.map((conv) => {
      const contact = contacts.find((c) => c.id === conv.contactId);
      const lead = leads.find(
        (l) =>
          (conv.leadId && l.id === conv.leadId) ||
          (conv.contactId && l.contactId === conv.contactId)
      );
      return { conv, contact, lead };
    });
  }, [conversations, contacts, leads]);

  const filterCounts = useMemo(() => {
    return {
      ALL: enrichedConversations.length,
      HUMAN: enrichedConversations.filter(
        ({ conv }) => conv.humanAttentionRecommended || conv.needsHumanAttention
      ).length,
      HOT: enrichedConversations.filter(({ lead }) => lead?.leadType === 'HOT').length,
      UNREAD: enrichedConversations.filter(({ conv }) => (conv.unreadCount || 0) > 0).length
    };
  }, [enrichedConversations]);

  const filteredList = useMemo(() => {
    return enrichedConversations.filter(({ conv, contact, lead }) => {
      if (inboxFilter === 'UNREAD' && conv.unreadCount === 0) return false;
      if (
        inboxFilter === 'HUMAN' &&
        !(conv.humanAttentionRecommended || conv.needsHumanAttention)
      )
        return false;
      if (inboxFilter === 'HOT' && lead?.leadType !== 'HOT') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = contact?.name?.toLowerCase().includes(q);
        const matchPhone = contact?.phone?.toLowerCase().includes(q);
        const matchMsg = conv.lastMessage?.toLowerCase().includes(q);
        return Boolean(matchName || matchPhone || matchMsg);
      }
      return true;
    });
  }, [enrichedConversations, inboxFilter, searchQuery]);

  const activeItem = useMemo(
    () =>
      enrichedConversations.find((item) => item.conv.id === selectedConvId) ||
      enrichedConversations[0],
    [enrichedConversations, selectedConvId]
  );

  const activeMessages = useMemo(
    () => (activeItem ? messagesByConv[activeItem.conv.id] || [] : []),
    [messagesByConv, activeItem]
  );

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyText.trim() || !activeItem) return;
    sendAgentMessage(activeItem.conv.id, replyText);
    setReplyText('');
  };

  const handleAttachDemoDocument = () => {
    if (!activeItem) return;
    sendAgentMessage(
      activeItem.conv.id,
      'Shared attachment: TechNova_Service_Quotation_2026.pdf (420 KB)'
    );
    pushToast('Quotation Sent', 'PDF quotation sent to customer on WhatsApp.', 'success');
  };

  const handleAddQuickFollowUp = (e) => {
    e.preventDefault();
    if (!activeItem?.contact) return;
    addFollowUp({
      leadId: activeItem.lead?.id || '',
      contactId: activeItem.contact.id,
      assignedUserId: activeItem.lead?.assignedAgentId || currentUser?.id || 'admin-1',
      date: followUpDate,
      time: followUpTime,
      note:
        followUpNote ||
        `Follow up with ${activeItem.contact.name} regarding ${
          activeItem.lead?.interestedService || 'WhatsApp inquiry'
        }`,
      status: 'PENDING'
    });
    setFollowUpNote('');
    setShowFollowUpModal(false);
  };

  if (!activeItem) {
    return (
      <div className="p-8 max-w-lg mx-auto my-12 glass-panel rounded-3xl space-y-4">
        <div className="flex items-center gap-2 text-emerald-700 font-semibold text-xs">
          <MessageSquare className="w-4 h-4" />
          <span>WhatsApp Cloud API Connected</span>
        </div>
        <h2 className="text-lg font-bold text-slate-900">
          Start Your First Real WhatsApp Conversation
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Incoming messages sent to your WhatsApp Business number will appear here automatically, or
          you can add a customer below to start a chat now.
        </p>
        <form onSubmit={handleCreateNewChat} className="space-y-3 text-xs pt-2">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Customer Name</label>
            <input
              type="text"
              required
              value={newChatName}
              onChange={(e) => setNewChatName(e.target.value)}
              placeholder="e.g., Akhil Thomas"
              className="w-full px-3.5 py-2 bg-white/90 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">WhatsApp Phone Number</label>
            <input
              type="text"
              required
              value={newChatPhone}
              onChange={(e) => setNewChatPhone(e.target.value)}
              placeholder="+91 98470 00000"
              className="w-full px-3.5 py-2 bg-white/90 border border-slate-200 rounded-xl font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Interested Service</label>
              <input
                type="text"
                value={newChatService}
                onChange={(e) => setNewChatService(e.target.value)}
                className="w-full px-3.5 py-2 bg-white/90 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Estimated Budget</label>
              <input
                type="text"
                value={newChatBudget}
                onChange={(e) => setNewChatBudget(e.target.value)}
                className="w-full px-3.5 py-2 bg-white/90 border border-slate-200 rounded-xl font-mono"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Add Customer & Open WhatsApp Chat
          </button>
        </form>
      </div>
    );
  }

  const { conv, contact, lead } = activeItem;
  const isHumanTakeover = Boolean(conv.humanTakeoverActive) || conv.aiEnabled === false;
  const isHumanAttentionRecommended = Boolean(
    conv.humanAttentionRecommended || conv.needsHumanAttention
  );

  const activeInitials = (contact?.name || 'CU')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const quickReplyPills =
    conv.suggestedReplies && conv.suggestedReplies.length > 0
      ? [
          'Hello! How can we help you today?',
          'Share your expected budget?',
          'Schedule a meeting?',
          'Send our service details'
        ]
      : [];

  return (
    <div className="h-full flex flex-col lg:flex-row gap-3.5 overflow-hidden">
      {/* LEFT FLOATING PANE: WHATSAPP CHATS LIST */}
      <div className="w-full lg:w-80 xl:w-[340px] glass-panel rounded-[26px] flex flex-col shrink-0 h-72 lg:h-full overflow-hidden">
        {/* Top Header + Tabs + Search */}
        <div className="p-4 space-y-3 border-b border-white/70">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-[16px] font-bold text-slate-900 tracking-tight">
              WhatsApp Chats ({filteredList.length})
            </h1>
            <button
              type="button"
              onClick={() => setShowNewChatModal(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>
          </div>

          {/* Filter Pills with Counts */}
          <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-2xl">
            {[
              { id: 'ALL', label: 'All', count: filterCounts.ALL },
              { id: 'HUMAN', label: 'Needs You', count: filterCounts.HUMAN },
              { id: 'HOT', label: 'Hot Leads', count: filterCounts.HOT },
              { id: 'UNREAD', label: 'Unread', count: filterCounts.UNREAD }
            ].map((tab) => {
              const active = inboxFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setInboxFilter(tab.id)}
                  className={`flex-1 py-1.5 px-2 text-[11px] rounded-xl transition-all whitespace-nowrap flex items-center justify-center gap-1 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] font-bold tabular-nums ${
                        active ? 'bg-slate-900 text-white' : 'bg-slate-300/70 text-slate-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer name or phone..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white/85 border border-white rounded-xl focus:outline-none focus:border-emerald-400 shadow-2xs"
            />
          </div>
        </div>

        {/* Conversation Cards List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredList.map(({ conv: itemConv, contact: itemContact, lead: itemLead }, idx) => {
            const isSelected = itemConv.id === conv.id;
            const initials = (itemContact?.name || 'CU')
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            const avatarClass = isSelected
              ? 'bg-emerald-500 text-white'
              : AVATAR_PALETTES[idx % AVATAR_PALETTES.length];

            const leadType = itemLead?.leadType || 'NEW';
            const badgeColor =
              leadType === 'HOT'
                ? 'bg-rose-500 text-white'
                : leadType === 'WARM'
                ? 'bg-amber-500 text-white'
                : leadType === 'COLD'
                ? 'bg-slate-500 text-white'
                : 'bg-sky-500 text-white';

            return (
              <div
                key={itemConv.id}
                onClick={() => handleSelectConversation(itemConv.id)}
                className={`p-3.5 rounded-2xl cursor-pointer transition-all flex items-start gap-3 border ${
                  isSelected
                    ? 'bg-emerald-50/75 border-emerald-300/80 shadow-[0_6px_20px_-4px_rgba(16,185,129,0.14)]'
                    : 'bg-white/80 hover:bg-white/95 border-white/90 shadow-2xs'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${avatarClass}`}
                >
                  {initials}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-slate-900 truncate">
                      {itemContact?.name}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0 tabular-nums">
                      {itemConv.lastMessageTime}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-slate-600 truncate">{itemConv.lastMessage}</p>
                    {itemConv.unreadCount > 0 ? (
                      <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-slate-900 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 tabular-nums">
                        {itemConv.unreadCount}
                      </span>
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Metadata Chips Row matching Reference Image */}
                  <div className="flex items-center justify-between gap-1.5 mt-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase ${badgeColor}`}
                      >
                        {leadType}
                      </span>

                      {itemLead?.budget && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold tabular-nums ${
                            itemLead.budget !== 'Not disclosed'
                              ? 'bg-emerald-100/80 text-emerald-800'
                              : 'bg-slate-200/70 text-slate-600'
                          }`}
                        >
                          {itemLead.budget}
                        </span>
                      )}

                      {itemConv.language && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-700 text-[10px] font-medium">
                          {itemConv.language}
                        </span>
                      )}

                      {(itemConv.humanAttentionRecommended || itemConv.needsHumanAttention) && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>Needs You</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CENTER FLOATING PANE: WHATSAPP CONVERSATION WINDOW */}
      <div className="flex-1 glass-panel rounded-[26px] flex flex-col min-w-0 h-full overflow-hidden">
        {/* Chat Top Header */}
        <div className="px-5 py-3.5 bg-white/60 border-b border-white/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
              {activeInitials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-bold text-slate-900 truncate">
                  {contact?.name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100/90 text-emerald-800 text-[11px] font-semibold">
                  Customer
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="font-mono tabular-nums">{contact?.phone}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                  <Globe className="w-3 h-3 text-slate-400" />
                  <span>Speaks {conv.language}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons on Right of Chat Header */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSimBar((prev) => !prev)}
              className="w-9 h-9 rounded-full bg-white/90 hover:bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-slate-900 shadow-2xs transition-all cursor-pointer"
              title="Simulate Incoming Customer Message"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </button>

            <button
              type="button"
              onClick={() => setShowFollowUpModal(true)}
              className="w-9 h-9 rounded-full bg-white/90 hover:bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-slate-900 shadow-2xs transition-all cursor-pointer"
              title="Schedule Call / Follow-Up"
            >
              <Phone className="w-4 h-4" />
            </button>

            {!isHumanTakeover ? (
              <button
                onClick={() => takeOverConversation(conv.id)}
                className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-full shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                title="Pause AI and reply yourself"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Take Over Chat</span>
              </button>
            ) : (
              <button
                onClick={() => returnConversationToAI(conv.id)}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                title="Turn automatic AI replies back on"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Let AI Reply Again</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleDeleteConversation(conv.id)}
              className="px-3.5 py-2 text-xs font-semibold border border-rose-200/90 rounded-full bg-rose-50/90 hover:bg-rose-100 text-rose-600 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              title="Delete Chat from Inbox (Contact & Lead are preserved)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Chat</span>
            </button>
          </div>
        </div>

        {/* Soft Mint AI Status Banner */}
        <div
          className={`px-5 py-2.5 border-b flex items-center justify-between gap-3 text-xs ${
            !isHumanTakeover
              ? 'bg-emerald-50/85 border-emerald-200/70 text-emerald-900'
              : 'bg-amber-50/90 border-amber-200/80 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            {!isHumanTakeover ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <UserCheck className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span className="font-bold shrink-0">
              {!isHumanTakeover
                ? 'AI Assistant is replying automatically'
                : 'Human is handling this chat (AI paused)'}
            </span>
            {conv.keyFinding && (
              <>
                <span className="text-slate-300 shrink-0">|</span>
                <span className="text-slate-600 truncate">{conv.keyFinding}</span>
              </>
            )}
          </div>

          {!isHumanTakeover && isHumanAttentionRecommended && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100/90 px-2.5 py-0.5 rounded-full shrink-0">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>Needs Human Review</span>
            </span>
          )}
        </div>

        {/* Friendly 1-Click Customer Message Simulator Bar */}
        {showSimBar && (
          <div className="bg-slate-900/95 backdrop-blur-xl text-white px-5 py-3 border-b border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400">
                Simulate an incoming customer message to test AI reply & live lead scoring:
              </span>
              <button
                onClick={() => setShowSimBar(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() =>
                  simulateCustomerIncomingMessage(
                    conv.id,
                    'Website undakkanam. E-commerce with payment gateway rate ethra aanu? Budget ₹100000 undu, next month thudangam.',
                    'Manglish'
                  )
                }
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 transition-colors cursor-pointer"
              >
                1. Test Manglish Budget Inquiry
              </button>
              <button
                type="button"
                onClick={() =>
                  simulateCustomerIncomingMessage(
                    conv.id,
                    'ഞങ്ങൾക്ക് വെബ്സൈറ്റും ഡിജിറ്റൽ മാർക്കറ്റിംഗും ചെയ്യണം. ഇന്ന് സംസാരിക്കാൻ പറ്റുമോ?',
                    'Malayalam'
                  )
                }
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 transition-colors cursor-pointer"
              >
                2. Test Malayalam Inquiry
              </button>
              <button
                type="button"
                onClick={() =>
                  simulateCustomerIncomingMessage(
                    conv.id,
                    'I have a billing complaint and need to speak with a human manager immediately.',
                    'English'
                  )
                }
                className="px-2.5 py-1 text-xs bg-rose-900/80 hover:bg-rose-800 rounded-lg text-rose-100 transition-colors cursor-pointer"
              >
                3. Test "Ask for Human Manager"
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!customSimText.trim()) return;
                simulateCustomerIncomingMessage(conv.id, customSimText);
                setCustomSimText('');
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={customSimText}
                onChange={(e) => setCustomSimText(e.target.value)}
                placeholder="Or type any customer message here (English, Manglish, or Malayalam)..."
                className="flex-1 px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl whitespace-nowrap cursor-pointer"
              >
                Send as Customer
              </button>
            </form>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
          {/* Today Pill Indicator */}
          <div className="flex justify-center">
            <span className="px-3.5 py-1 rounded-full bg-slate-200/70 text-slate-600 text-[11px] font-semibold">
              Today
            </span>
          </div>

          {activeMessages.map((msg) => {
            if (msg.senderType === 'SYSTEM') {
              return (
                <div key={msg.id} className="flex justify-center my-1.5">
                  <span className="text-[11px] text-slate-600 bg-slate-200/75 backdrop-blur-xs px-4 py-1.5 rounded-full font-medium">
                    {msg.content} <span className="font-mono text-slate-500 ml-1">{msg.timestamp}</span>
                  </span>
                </div>
              );
            }

            const isCustomer = msg.senderType === 'CUSTOMER';
            const isAI = msg.senderType === 'AI';
            const isMobileEcho = msg.senderType === 'BUSINESS_MOBILE_ECHO';
            const isInspecting = inspectedMsgId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[74%] rounded-2xl px-4 py-3 border shadow-[0_4px_14px_-4px_rgba(15,23,42,0.06)] ${
                    isCustomer
                      ? 'bg-white/95 border-white text-slate-900 rounded-tl-md'
                      : isAI
                      ? 'bg-[#E8F5E9]/95 border-emerald-200/80 text-slate-900 rounded-tr-md'
                      : 'bg-emerald-600 border-emerald-500 text-white rounded-tr-md'
                  }`}
                >
                  {/* Sender Header Line */}
                  <div
                    className={`flex items-center justify-between gap-4 text-[11px] mb-1 ${
                      isCustomer
                        ? 'text-slate-500'
                        : isAI
                        ? 'text-emerald-800'
                        : 'text-emerald-100'
                    }`}
                  >
                    <span className="font-bold">
                      {isCustomer
                        ? `${msg.senderName} (Customer)`
                        : isAI
                        ? 'AI Assistant (Auto-Reply)'
                        : isMobileEcho
                        ? `${msg.senderName || 'WhatsApp Business App'} (Mobile Echo)`
                        : `${msg.senderName} (You)`}
                    </span>

                    {isAI && (msg.aiMetadata || msg.structuredAnalysis) && (
                      <button
                        type="button"
                        onClick={() => setInspectedMsgId(isInspecting ? null : msg.id)}
                        className="text-emerald-700 hover:text-emerald-900 font-semibold underline flex items-center gap-1 cursor-pointer"
                      >
                        <Clock className="w-3 h-3" />
                        <span>{isInspecting ? 'Hide AI details' : 'Why AI said this?'}</span>
                      </button>
                    )}
                  </div>

                  {/* Message Content */}
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2.5 space-y-1.5">
                      {msg.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/80 text-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                            <span className="font-medium truncate">{att.name}</span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-500 shrink-0">
                            {att.size}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI Explanation Drawer */}
                  {isAI && isInspecting && (msg.aiMetadata || msg.structuredAnalysis) && (
                    <div className="mt-3 pt-2.5 border-t border-emerald-300/70 space-y-1.5 text-xs text-slate-800">
                      <div className="text-[11px] font-bold text-emerald-900">
                        What AI understood from the customer:
                      </div>
                      <div className="grid grid-cols-2 gap-2 bg-white/85 p-2.5 rounded-xl text-[11px]">
                        <div>
                          <span className="text-slate-500">Intent: </span>
                          <span className="font-semibold text-slate-900">
                            {msg.aiMetadata?.intent || msg.structuredAnalysis?.intent}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Lead Score: </span>
                          <span className="font-mono font-bold text-emerald-700">
                            {msg.aiMetadata?.leadScore ||
                              msg.aiMetadata?.lead_score ||
                              msg.structuredAnalysis?.leadScore ||
                              75}
                            /100 (
                            {msg.aiMetadata?.leadType ||
                              msg.aiMetadata?.lead_type ||
                              msg.structuredAnalysis?.leadType ||
                              'WARM'}
                            )
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Service: </span>
                          <span className="text-slate-900 font-medium">
                            {msg.aiMetadata?.service ||
                              msg.aiMetadata?.interested_service ||
                              msg.structuredAnalysis?.service ||
                              'General'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Budget: </span>
                          <span className="font-mono text-slate-900 font-semibold">
                            {msg.aiMetadata?.budget || 'Not shared yet'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Timestamp & Read Ticks */}
                  <div
                    className={`flex items-center justify-end gap-1 text-[10px] font-mono mt-1 tabular-nums ${
                      isCustomer
                        ? 'text-slate-400'
                        : isAI
                        ? 'text-slate-500'
                        : 'text-emerald-100'
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    {!isCustomer && (
                      <CheckCheck
                        className={`w-3.5 h-3.5 ${
                          isAI ? 'text-emerald-600' : 'text-white'
                        }`}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Suggestion Pills + Reply Composer */}
        <div className="px-4 pt-2 pb-3.5 bg-white/55 border-t border-white/80 space-y-2.5">
          {quickReplyPills.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              {quickReplyPills.map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReplyText(suggestion)}
                  className="px-3.5 py-1.5 text-xs bg-white/85 hover:bg-white text-slate-700 hover:text-slate-900 border border-white rounded-full shadow-2xs whitespace-nowrap transition-all cursor-pointer font-medium"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSendReply} className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleAttachDemoDocument}
              className="w-10 h-10 rounded-full bg-white/90 hover:bg-white border border-white text-slate-500 hover:text-slate-900 flex items-center justify-center shadow-2xs transition-all cursor-pointer shrink-0"
              title="Send Sample Quotation PDF"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <div className="flex-1 flex items-center bg-white/90 border border-white rounded-full px-4 py-2 shadow-2xs">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your message to the customer..."
                className="flex-1 text-xs text-slate-900 bg-transparent focus:outline-none"
              />
              <div className="flex items-center gap-2 text-slate-400 pl-2">
                <button
                  type="button"
                  onClick={() => setReplyText((prev) => `${prev} 😊`)}
                  className="hover:text-slate-600 cursor-pointer"
                  title="Insert emoji"
                >
                  <Smile className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-full shadow-sm transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Reply</span>
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT FLOATING PANE: "WHAT AI KNOWS" */}
      <div className="w-full lg:w-80 xl:w-[340px] glass-panel rounded-[26px] overflow-y-auto p-4 space-y-3.5 shrink-0 h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[15px] font-bold text-slate-900">What AI Knows</h3>
          {lead ? (
            <Link
              to={`/leads/${lead.id}`}
              className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1"
            >
              <span>Full Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : null}
        </div>

        {!lead ? (
          <div className="p-5 glass-card rounded-2xl space-y-3 text-center">
            <div className="text-xs font-bold text-slate-800">No Lead Profile Linked</div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Create a lead record for {contact?.name || 'this customer'} to track budget, urgency
              score, and deal stage.
            </p>
            <button
              type="button"
              onClick={() => {
                if (!contact) return;
                addLead({
                  contactId: contact.id,
                  conversationId: conv.id,
                  leadStatus: 'NEW',
                  leadType: 'WARM',
                  leadScore: 55,
                  interestedService: 'General Inquiry',
                  budget: 'Not disclosed',
                  estimatedValueInr: 0,
                  timeline: 'Not specified',
                  requirements: [],
                  buyingSignals: ['Active WhatsApp chat logged'],
                  source: 'WhatsApp Inbound',
                  assignedAgentId: currentUser?.id || 'admin-1',
                  aiSummary: `Chat started with ${contact.name}.`,
                  purchaseIntent: false
                });
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              + Create Lead for Customer
            </button>
          </div>
        ) : (
          <>
            {/* Card 1: Customer Summary + Service + Budget + Timeline */}
            <div className="glass-card rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <MessageSquare className="w-4 h-4 fill-current" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {contact?.name} · {contact?.company || 'WhatsApp Inquiry'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Best time: {contact?.bestTimeToContact || 'Anytime'}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-100/80 rounded-xl">
                <div className="text-[11px] text-slate-500">Service They Want</div>
                <div className="text-xs font-bold text-slate-900 mt-0.5">
                  {lead.interestedService || 'General Inquiry'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-slate-100/80 rounded-xl">
                  <div className="text-[11px] text-slate-500">Confirmed Budget</div>
                  <div className="text-sm font-mono font-bold text-emerald-700 mt-0.5 tabular-nums">
                    {lead.budget || 'Not disclosed'}
                  </div>
                </div>
                <div className="p-3 bg-slate-100/80 rounded-xl">
                  <div className="text-[11px] text-slate-500">Start Timeline</div>
                  <div className="text-xs font-bold text-slate-900 mt-1">
                    {lead.timeline || 'Not specified'}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Suggested Next Step */}
            <div className="glass-card rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <Lightbulb className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-900">Suggested Next Step</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {lead.recommendedNextAction ||
                    'Share service deck and schedule 15-minute discovery call.'}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setReplyText(
                      'Could we schedule a quick 15-minute discovery call to walk through our service deck and pricing?'
                    )
                  }
                  className="w-7 h-7 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shrink-0 cursor-pointer"
                  title="Use this suggestion in chat"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Card 3: Why they look ready to buy */}
            {lead.buyingSignals && lead.buyingSignals.length > 0 && (
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 space-y-2">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Why they look ready to buy</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {lead.buyingSignals.map((sig, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{sig}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Card 4: AI Lead Score & Stage Selectors */}
            <div className="glass-card rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowScoreDetails((prev) => !prev)}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-900 cursor-pointer"
                >
                  <span>AI Lead Score</span>
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <span
                  className={`text-sm font-bold font-mono tabular-nums ${
                    (lead.leadScore ?? 50) >= 81
                      ? 'text-emerald-600'
                      : (lead.leadScore ?? 50) >= 61
                      ? 'text-indigo-600'
                      : 'text-amber-600'
                  }`}
                >
                  {lead.leadScore ?? 50}/100 ({lead.leadType || 'WARM'})
                </span>
              </div>

              {showScoreDetails && (
                <div className="bg-slate-100/80 rounded-xl p-3 space-y-2">
                  {[
                    {
                      label: 'Has Budget Ready',
                      val: lead.scoreBreakdown?.budgetReadiness ?? 12,
                      max: 25
                    },
                    {
                      label: 'Clear Requirement',
                      val: lead.scoreBreakdown?.needSpecificity ?? 12,
                      max: 25
                    },
                    {
                      label: 'Wants to Start Soon',
                      val: lead.scoreBreakdown?.timelineUrgency ?? 10,
                      max: 20
                    },
                    {
                      label: 'Decision Maker',
                      val: lead.scoreBreakdown?.decisionAuthority ?? 8,
                      max: 15
                    },
                    {
                      label: 'Active in Chat',
                      val: lead.scoreBreakdown?.engagementDepth ?? 8,
                      max: 15
                    }
                  ].map((item) => {
                    const pct = Math.round((item.val / item.max) * 100);
                    return (
                      <div key={item.label} className="space-y-0.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-600">{item.label}</span>
                          <span className="font-mono font-semibold text-slate-900 tabular-nums">
                            {item.val}/{item.max}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              pct >= 80
                                ? 'bg-emerald-500'
                                : pct >= 55
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Priority</label>
                  <select
                    value={lead.leadType || 'WARM'}
                    onChange={(e) => updateLead(lead.id, { leadType: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs font-semibold border border-slate-200/80 rounded-xl bg-white/90"
                  >
                    <option value="HOT">HOT (Ready)</option>
                    <option value="WARM">WARM</option>
                    <option value="COLD">COLD</option>
                    <option value="UNQUALIFIED">UNQUALIFIED</option>
                    <option value="EXISTING_CUSTOMER">EXISTING CUSTOMER</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Deal Stage</label>
                  <select
                    value={lead.leadStatus || 'NEW'}
                    onChange={(e) => updateLead(lead.id, { leadStatus: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs font-semibold border border-slate-200/80 rounded-xl bg-white/90"
                  >
                    <option value="NEW">NEW</option>
                    <option value="CONTACTED">CONTACTED</option>
                    <option value="QUALIFIED">QUALIFIED</option>
                    <option value="PROPOSAL">PROPOSAL</option>
                    <option value="NEGOTIATION">NEGOTIATION</option>
                    <option value="WON">WON</option>
                    <option value="LOST">LOST</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Handled By</label>
                <select
                  value={lead.assignedAgentId || 'admin-1'}
                  onChange={(e) => updateLead(lead.id, { assignedAgentId: e.target.value })}
                  className="w-full px-2.5 py-2 text-xs font-medium border border-slate-200/80 rounded-xl bg-white/90"
                >
                  {teamMembers.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tm.name} ({tm.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Team Notes */}
              <div className="pt-2 border-t border-slate-200/60 space-y-2">
                <div className="text-xs font-bold text-slate-900">Team Notes</div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!noteInput.trim()) return;
                    addLeadNote(lead.id, noteInput);
                    setNoteInput('');
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Write a quick note..."
                    className="flex-1 px-3 py-2 text-xs bg-white/90 border border-slate-200/80 rounded-xl focus:outline-none focus:border-slate-900"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Save
                  </button>
                </form>

                {(lead.notes || []).length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {(lead.notes || []).map((n) => (
                      <div
                        key={n.id}
                        className="p-2.5 bg-slate-100/80 rounded-xl text-xs"
                      >
                        <div className="text-[10px] text-slate-500">
                          {n.authorName} · {n.createdAt}
                        </div>
                        <div className="text-slate-800 mt-0.5">{n.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal to Schedule Follow-up */}
      {showFollowUpModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-2xl border border-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
              <h3 className="text-sm font-bold text-slate-900">Schedule Follow-up Call</h3>
              <button
                type="button"
                onClick={() => setShowFollowUpModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddQuickFollowUp} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Time</label>
                  <input
                    type="time"
                    required
                    value={followUpTime}
                    onChange={(e) => setFollowUpTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reminder Note</label>
                <input
                  type="text"
                  value={followUpNote}
                  onChange={(e) => setFollowUpNote(e.target.value)}
                  placeholder="Call agenda or proposal review..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-xl cursor-pointer"
                >
                  Schedule Call
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal to Start a New WhatsApp Chat */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-2xl border border-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
              <h3 className="text-sm font-bold text-slate-900">Start New WhatsApp Chat</h3>
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateNewChat} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  placeholder="e.g., Akhil Thomas"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  WhatsApp Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  placeholder="+91 98470 00000"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Interested Service
                  </label>
                  <input
                    type="text"
                    value={newChatService}
                    onChange={(e) => setNewChatService(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Estimated Budget
                  </label>
                  <input
                    type="text"
                    value={newChatBudget}
                    onChange={(e) => setNewChatBudget(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl cursor-pointer"
                >
                  Save & Open Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
