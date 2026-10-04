import React, { useState, useMemo } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Flame,
  Plus,
  ArrowUpRight,
  Building2,
  Phone,
  Mail,
  Sparkles,
  CheckCircle2,
  MessageSquare,
  ChevronLeft,
  LayoutGrid,
  List,
  Trash2,
  Send,
  X,
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';

const STAGES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL_SENT',
  'WON',
  'LOST',
];

export const LeadsListPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || 'ALL';

  const {
    leads = [],
    contacts = [],
    teamMembers = [],
    addContact,
    addLead,
    updateLead,
    startOrOpenConversation,
  } = useCRM();

  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [stageFilter, setStageFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'kanban'
  const [showAddModal, setShowAddModal] = useState(false);

  const [newLead, setNewLead] = useState({
    name: '',
    company: '',
    phone: '+91 ',
    email: '',
    leadScore: 85,
    budget: '₹1,00,000',
    interestedService: 'Custom Web & Mobile App Development',
    leadStatus: 'QUALIFIED',
    timeline: 'Within 30 days',
    aiSummary: '',
  });

  // Enrich leads with contact data so lead.name / lead.company / lead.phone are always defined
  const enrichedLeads = useMemo(() => {
    return leads.map((lead) => {
      const contact = contacts.find((c) => c.id === lead.contactId) || {};
      const assignedRep =
        teamMembers.find((m) => m.id === lead.assignedAgentId) ||
        teamMembers[0] || { name: 'Binil B' };
      const name = contact.name || lead.name || 'WhatsApp Prospect';
      const company = contact.company || lead.company || 'Inbound Business';
      const phone = contact.phone || lead.phone || '—';
      const email = contact.email || lead.email || '—';
      const leadType = lead.leadType || lead.status || 'WARM';
      const leadScore = lead.leadScore ?? lead.score ?? 70;
      const leadStatus = lead.leadStatus || lead.stage || 'QUALIFIED';
      const estimatedValue = Number(lead.estimatedValueInr ?? lead.estimatedValue ?? 50000);
      const initials = name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      return {
        ...lead,
        displayName: name,
        displayCompany: company,
        displayPhone: phone,
        displayEmail: email,
        displayType: leadType,
        displayScore: leadScore,
        displayStage: leadStatus,
        displayValue: estimatedValue,
        displayBudget: lead.budget || `₹${estimatedValue.toLocaleString('en-IN')}`,
        displayTimeline: lead.timeline || 'Within 30 days',
        displayService: lead.interestedService || lead.industry || 'WhatsApp CRM & AI',
        displayAssignedTo: assignedRep.name,
        displayTags: lead.requirements || contact.tags || [],
        initials,
      };
    });
  }, [leads, contacts, teamMembers]);

  const filteredLeads = useMemo(() => {
    return enrichedLeads.filter((lead) => {
      if (statusFilter !== 'ALL' && lead.displayType !== statusFilter) return false;
      if (stageFilter !== 'ALL' && lead.displayStage !== stageFilter) return false;
      if (
        searchQuery &&
        !lead.displayName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !lead.displayCompany.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !lead.displayPhone.includes(searchQuery) &&
        !lead.displayService.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [enrichedLeads, statusFilter, stageFilter, searchQuery]);

  const handleStatusTabChange = (status) => {
    setStatusFilter(status);
    if (status === 'ALL') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', status);
    }
    setSearchParams(searchParams);
  };

  const handleCreateLead = (e) => {
    e.preventDefault();
    if (!newLead.name.trim()) return;

    const createdContact = addContact(
      {
        name: newLead.name.trim(),
        company: newLead.company.trim() || 'Inbound Business',
        phone: newLead.phone.trim() || '+91 98470 00000',
        email: newLead.email.trim() || 'contact@company.in',
        roleTitle: 'Decision Maker',
        location: 'Kerala, India',
        preferredLanguage: 'English',
        source: 'WhatsApp Inbound',
        tags: [newLead.interestedService],
      },
      { createLead: false, createConversation: true }
    );

    const score = Number(newLead.leadScore) || 85;
    const created = addLead({
      contactId: createdContact.id,
      leadStatus: newLead.leadStatus,
      leadType: score >= 81 ? 'HOT' : score >= 50 ? 'WARM' : 'COLD',
      leadScore: score,
      interestedService: newLead.interestedService,
      budget: newLead.budget,
      timeline: newLead.timeline,
      requirements: [newLead.interestedService],
      source: 'WhatsApp Inbound',
      assignedAgentId: teamMembers[0]?.id || 'admin-1',
      aiSummary:
        newLead.aiSummary ||
        `Qualified lead interested in ${newLead.interestedService} (${newLead.budget}).`,
      purchaseIntent: true,
    });

    setShowAddModal(false);
    navigate(`/leads/${created.id}`);
  };

  const handleOpenChatForLead = async (lead) => {
    const conv = await startOrOpenConversation(lead.contactId, lead.id);
    navigate(`/inbox?convId=${conv?.id || lead.conversationId || 'conv-1'}`);
  };

  const totalPipelineValue = useMemo(() => {
    return filteredLeads.reduce((sum, l) => sum + (l.displayValue || 0), 0);
  }, [filteredLeads]);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              AI-Qualified Sales Leads
            </h1>
            <span className="px-3 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-800 border border-emerald-400/40">
              ₹{totalPipelineValue.toLocaleString('en-IN')} Active Pipeline
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-0.5">
            Leads automatically scored and categorized from live WhatsApp conversations by Gemini AI
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="inline-flex bg-white/60 border border-white/80 rounded-xl p-1 shadow-2xs backdrop-blur-md">
            <button
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'table'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Table
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'kanban'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Pipeline Board
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-semibold hover:from-emerald-500 hover:to-teal-400 transition-all shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Add New Lead
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel rounded-3xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'ALL', label: 'All Leads', count: enrichedLeads.length },
            { id: 'HOT', label: 'HOT (81-100)', count: enrichedLeads.filter((l) => l.displayType === 'HOT').length },
            { id: 'WARM', label: 'WARM (31-80)', count: enrichedLeads.filter((l) => l.displayType === 'WARM').length },
            { id: 'COLD', label: 'COLD (0-30)', count: enrichedLeads.filter((l) => l.displayType === 'COLD').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleStatusTabChange(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white/60 text-slate-700 hover:bg-white border border-white/70'
              }`}
            >
              {tab.id === 'HOT' && <Flame className="w-3.5 h-3.5 text-rose-500" />}
              {tab.label}
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-white/75 border border-white/80 rounded-xl text-slate-700 focus:outline-none focus:border-emerald-500 backdrop-blur-md"
          >
            <option value="ALL">All Pipeline Stages</option>
            {STAGES.map((st) => (
              <option key={st} value={st}>
                {st.replace('_', ' ')}
              </option>
            ))}
          </select>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lead, company, or WhatsApp..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-white/75 border border-white/80 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-500 backdrop-blur-md"
            />
          </div>
        </div>
      </div>

      {/* Table View vs Kanban View */}
      {viewMode === 'table' ? (
        <div className="glass-panel rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/60 bg-white/35 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Lead & Company</th>
                  <th className="py-3.5 px-4">AI Score & Status</th>
                  <th className="py-3.5 px-4">Pipeline Stage & Service</th>
                  <th className="py-3.5 px-4">Budget & Timeline</th>
                  <th className="py-3.5 px-4">Assigned Rep</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/50 text-sm">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-white/45 transition-colors group">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                          {lead.initials}
                        </div>
                        <div>
                          <Link
                            to={`/leads/${lead.id}`}
                            className="font-bold text-slate-900 hover:text-emerald-700 transition-colors flex items-center gap-1"
                          >
                            {lead.displayName}
                            <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-600" />
                          </Link>
                          <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              {lead.displayCompany}
                            </span>
                            <span>•</span>
                            <span className="font-mono text-[11px]">{lead.displayPhone}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2.5">
                        <select
                          value={lead.displayType}
                          onChange={(e) => {
                            const nextType = e.target.value;
                            const nextScore =
                              nextType === 'HOT' ? 88 : nextType === 'WARM' ? 68 : 25;
                            updateLead(lead.id, { leadType: nextType, leadScore: nextScore });
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono border cursor-pointer focus:outline-none ${
                            lead.displayType === 'HOT'
                              ? 'bg-rose-500/15 text-rose-800 border-rose-300'
                              : lead.displayType === 'WARM'
                              ? 'bg-amber-500/15 text-amber-800 border-amber-300'
                              : 'bg-white/70 text-slate-700 border-white/80'
                          }`}
                        >
                          <option value="HOT">HOT • {lead.displayScore}</option>
                          <option value="WARM">WARM • {lead.displayScore}</option>
                          <option value="COLD">COLD • {lead.displayScore}</option>
                        </select>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Intent: <span className="font-semibold text-slate-700">{lead.purchaseIntent ? 'High Intent' : 'Evaluating'}</span>
                      </p>
                    </td>

                    <td className="py-4 px-4">
                      <select
                        value={lead.displayStage}
                        onChange={(e) => updateLead(lead.id, { leadStatus: e.target.value })}
                        className="px-2.5 py-1.5 rounded-xl bg-white/75 border border-white/80 text-xs font-semibold text-slate-800 hover:bg-white focus:outline-none focus:border-emerald-500"
                      >
                        {STAGES.map((st) => (
                          <option key={st} value={st}>
                            {st.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-600 mt-1 truncate max-w-[220px]">
                        {lead.displayService}
                      </p>
                    </td>

                    <td className="py-4 px-4">
                      <p className="text-sm font-bold font-mono text-slate-900">
                        {lead.displayBudget}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">Timeline: {lead.displayTimeline}</p>
                    </td>

                    <td className="py-4 px-4">
                      <span className="text-xs font-medium text-slate-800">{lead.displayAssignedTo}</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">{lead.updatedAt || 'Today'}</p>
                    </td>

                    <td className="py-4 px-5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenChatForLead(lead)}
                          className="p-2 rounded-xl border border-white/80 bg-white/65 text-slate-600 hover:text-emerald-700 hover:bg-white transition-colors cursor-pointer"
                          title="Message on WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          to={`/leads/${lead.id}`}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                        >
                          Profile
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageLeads = filteredLeads.filter((l) => l.displayStage === stage);
            const stageValue = stageLeads.reduce((s, l) => s + (l.displayValue || 0), 0);
            return (
              <div
                key={stage}
                className="glass-panel rounded-3xl p-3.5 flex flex-col min-h-[520px]"
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {stage.replace('_', ' ')}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-white/80 border border-white text-slate-700">
                    {stageLeads.length}
                  </span>
                </div>
                <p className="text-[11px] font-mono font-semibold text-slate-600 mb-3 px-1">
                  ₹{stageValue.toLocaleString('en-IN')}
                </p>

                <div className="space-y-3 flex-1">
                  {stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="p-3.5 rounded-2xl bg-white/75 border border-white/90 shadow-xs hover:bg-white transition-all flex flex-col justify-between gap-2.5"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                              lead.displayType === 'HOT'
                                ? 'bg-rose-500/15 text-rose-800'
                                : lead.displayType === 'WARM'
                                ? 'bg-amber-500/15 text-amber-800'
                                : 'bg-slate-200/70 text-slate-700'
                            }`}
                          >
                            {lead.displayType} • {lead.displayScore}
                          </span>
                          <span className="text-xs font-bold font-mono text-slate-900">
                            {lead.displayBudget}
                          </span>
                        </div>
                        <Link
                          to={`/leads/${lead.id}`}
                          className="block text-sm font-bold text-slate-900 hover:text-emerald-700 mt-2"
                        >
                          {lead.displayName}
                        </Link>
                        <p className="text-xs text-slate-600">{lead.displayCompany}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <select
                          value={lead.displayStage}
                          onChange={(e) => updateLead(lead.id, { leadStatus: e.target.value })}
                          className="text-[10px] font-semibold bg-white/80 border border-slate-200 rounded-lg px-1.5 py-1 text-slate-700"
                        >
                          {STAGES.map((st) => (
                            <option key={st} value={st}>
                              {st.replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                        <Link
                          to={`/leads/${lead.id}`}
                          className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          Open →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-strong rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-white/80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Add New Sales Lead</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateLead} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newLead.name}
                    onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                    placeholder="Neha Singhania"
                    className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company *</label>
                  <input
                    type="text"
                    required
                    value={newLead.company}
                    onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                    placeholder="Luminary FinTech"
                    className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Phone *</label>
                  <input
                    type="text"
                    required
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    placeholder="+91 98470 44901"
                    className="w-full px-3.5 py-2 text-sm font-mono bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
                  <input
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    placeholder="neha@luminary.io"
                    className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">AI Lead Score</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newLead.leadScore}
                    onChange={(e) => setNewLead({ ...newLead, leadScore: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 text-sm font-mono bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Budget</label>
                  <input
                    type="text"
                    value={newLead.budget}
                    onChange={(e) => setNewLead({ ...newLead, budget: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm font-mono bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pipeline Stage</label>
                  <select
                    value={newLead.leadStatus}
                    onChange={(e) => setNewLead({ ...newLead, leadStatus: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  >
                    {STAGES.map((st) => (
                      <option key={st} value={st}>
                        {st.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">AI Qualification Notes</label>
                <textarea
                  rows={2}
                  value={newLead.aiSummary}
                  onChange={(e) => setNewLead({ ...newLead, aiSummary: e.target.value })}
                  placeholder="Summary of WhatsApp inquiry, pain points, and timeline..."
                  className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-white/80 bg-white/60 text-xs font-semibold text-slate-600 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 shadow-sm"
                >
                  Create Qualified Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const LeadDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    leads = [],
    contacts = [],
    conversations = [],
    messagesByConv = {},
    followUps = [],
    teamMembers = [],
    updateLead,
    deleteLead,
    addLeadNote,
    addFollowUp,
    updateFollowUpStatus,
    sendAgentMessage,
    startOrOpenConversation,
  } = useCRM();

  const lead = leads.find((l) => l.id === id) || leads[0];
  const contact = contacts.find((c) => c.id === lead?.contactId) || {};
  const linkedConversation =
    conversations.find((c) => c.id === lead?.conversationId || c.leadId === lead?.id) ||
    conversations[0];
  const threadMessages = linkedConversation ? messagesByConv[linkedConversation.id] || [] : [];
  const leadFollowUps = followUps.filter((f) => f.leadId === lead?.id);
  const assignedRep =
    teamMembers.find((m) => m.id === lead?.assignedAgentId) ||
    teamMembers[0] || { name: 'Binil B' };

  const [noteInput, setNoteInput] = useState('');
  const [newReqInput, setNewReqInput] = useState('');
  const [quickWhatsAppMsg, setQuickWhatsAppMsg] = useState('');
  const [followUpTaskInput, setFollowUpTaskInput] = useState('');

  if (!lead) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="glass-panel rounded-3xl p-6 text-center space-y-3">
          <p className="text-sm font-bold text-slate-800">Lead record not found</p>
          <Link
            to="/leads"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Leads
          </Link>
        </div>
      </div>
    );
  }

  const displayName = contact.name || lead.name || 'WhatsApp Prospect';
  const displayCompany = contact.company || lead.company || 'Inbound Business';
  const displayPhone = contact.phone || lead.phone || '—';
  const displayEmail = contact.email || lead.email || '—';
  const displayType = lead.leadType || lead.status || 'WARM';
  const displayScore = lead.leadScore ?? lead.score ?? 75;
  const displayStage = lead.leadStatus || lead.stage || 'QUALIFIED';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    addLeadNote(lead.id, noteInput.trim());
    setNoteInput('');
  };

  const handleAddRequirement = (e) => {
    e.preventDefault();
    if (!newReqInput.trim()) return;
    const updatedReqs = [...(lead.requirements || []), newReqInput.trim()];
    updateLead(lead.id, { requirements: updatedReqs });
    setNewReqInput('');
  };

  const handleSendQuickWhatsApp = (e) => {
    e.preventDefault();
    if (!quickWhatsAppMsg.trim() || !linkedConversation) return;
    sendAgentMessage(linkedConversation.id, quickWhatsAppMsg);
    setQuickWhatsAppMsg('');
  };

  const handleAddFollowUp = (e) => {
    e.preventDefault();
    if (!followUpTaskInput.trim()) return;
    addFollowUp({
      leadId: lead.id,
      contactId: lead.contactId,
      assignedUserId: lead.assignedAgentId || 'admin-1',
      date: new Date().toISOString().slice(0, 10),
      time: '11:00',
      note: followUpTaskInput.trim(),
      status: 'PENDING',
    });
    setFollowUpTaskInput('');
  };

  const handleOpenInbox = async () => {
    const conv = await startOrOpenConversation(lead.contactId, lead.id);
    navigate(`/inbox?convId=${conv?.id || linkedConversation?.id || ''}`);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1440px] mx-auto">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/leads"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-white/65 px-3.5 py-2 rounded-xl border border-white/80 hover:bg-white shadow-2xs backdrop-blur-md w-fit"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to All Leads
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={displayStage}
            onChange={(e) => updateLead(lead.id, { leadStatus: e.target.value })}
            className="px-3.5 py-2 rounded-xl border border-white/80 bg-white/75 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 backdrop-blur-md"
          >
            {STAGES.map((st) => (
              <option key={st} value={st}>
                Stage: {st.replace('_', ' ')}
              </option>
            ))}
          </select>

          <button
            onClick={handleOpenInbox}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-semibold hover:from-emerald-500 hover:to-teal-400 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Open WhatsApp Thread
          </button>

          <button
            onClick={() => {
              deleteLead(lead.id);
              navigate('/leads');
            }}
            className="p-2 rounded-xl border border-white/80 bg-white/70 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors backdrop-blur-md cursor-pointer"
            title="Delete Lead"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="glass-panel rounded-3xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white font-bold text-xl flex items-center justify-center shrink-0 shadow-md">
              {initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900">{displayName}</h1>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold font-mono flex items-center gap-1 ${
                    displayType === 'HOT'
                      ? 'bg-rose-500/15 text-rose-800 border border-rose-300'
                      : displayType === 'WARM'
                      ? 'bg-amber-500/15 text-amber-800 border border-amber-300'
                      : 'bg-white/70 text-slate-700 border border-white/80'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  {displayType} LEAD • {displayScore}/100
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-800 border border-indigo-300">
                  Stage: {displayStage.replace('_', ' ')}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 mt-2">
                <span className="flex items-center gap-1.5 font-medium text-slate-800">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  {displayCompany} ({lead.interestedService || 'WhatsApp Inquiry'})
                </span>
                <span className="flex items-center gap-1.5 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  {displayPhone}
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  {displayEmail}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Score & Status Controls */}
          <div className="flex flex-wrap items-center gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-white/60">
            <div className="px-4 py-2.5 rounded-2xl bg-white/60 border border-white/80 backdrop-blur-md">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Confirmed Budget</p>
              <p className="text-lg font-bold font-mono text-slate-900">
                {lead.budget || '₹50,000'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-white/60 p-1.5 rounded-2xl border border-white/80 backdrop-blur-md">
              {['HOT', 'WARM', 'COLD'].map((st) => (
                <button
                  key={st}
                  onClick={() =>
                    updateLead(lead.id, {
                      leadType: st,
                      leadScore: st === 'HOT' ? 92 : st === 'WARM' ? 68 : 28,
                    })
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    displayType === st
                      ? st === 'HOT'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : st === 'WARM'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Deep Qualification & Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: AI Qualification & Notes */}
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                AI Qualification Breakdown
              </span>
              <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-500/15 px-2 py-0.5 rounded-full">
                Score {displayScore}/100
              </span>
            </div>

            <p className="text-xs text-slate-700 bg-white/60 p-3 rounded-2xl border border-white/80 mb-3 leading-relaxed">
              {lead.aiSummary || 'Customer qualified automatically via WhatsApp AI.'}
            </p>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-white/50">
                <span className="text-slate-600">Confirmed Budget</span>
                <span className="font-mono font-bold text-slate-900">{lead.budget || '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/50">
                <span className="text-slate-600">Target Timeline</span>
                <span className="font-semibold text-slate-900">{lead.timeline || '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/50">
                <span className="text-slate-600">Acquisition Source</span>
                <span className="font-semibold text-slate-900">{lead.source || 'WhatsApp Inbound'}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-600">Handled By</span>
                <select
                  value={lead.assignedAgentId || assignedRep?.id || 'admin-1'}
                  onChange={(e) => updateLead(lead.id, { assignedAgentId: e.target.value })}
                  className="px-2.5 py-1 rounded-xl border border-white/80 bg-white/80 font-semibold text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                >
                  {teamMembers.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tm.name} ({tm.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Add Note */}
            <form onSubmit={handleAddNote} className="mt-4 pt-4 border-t border-white/60 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Add Sales Note
              </label>
              <textarea
                rows={2}
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Record call outcomes or custom pricing notes..."
                className="w-full p-3 text-xs bg-white/75 border border-white/90 rounded-2xl focus:outline-none focus:bg-white focus:border-emerald-500"
              />
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Save Note to Timeline
              </button>
            </form>

            {(lead.notes || []).length > 0 && (
              <div className="mt-3 space-y-2">
                {lead.notes.map((n) => (
                  <div key={n.id} className="p-2.5 rounded-xl bg-white/60 border border-white/80 text-xs">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                      <span className="font-bold">{n.authorName}</span>
                      <span>{n.createdAt}</span>
                    </div>
                    <p className="text-slate-800">{n.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Requirements Card */}
          <div className="glass-panel rounded-3xl p-5">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
              Extracted Requirements & Signals
            </h3>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(lead.requirements || []).map((req) => (
                <span
                  key={req}
                  className="px-2.5 py-1 rounded-xl bg-white/75 border border-white/90 text-slate-800 text-xs font-medium"
                >
                  {req}
                </span>
              ))}
            </div>
            <form onSubmit={handleAddRequirement} className="flex gap-2">
              <input
                type="text"
                value={newReqInput}
                onChange={(e) => setNewReqInput(e.target.value)}
                placeholder="Add requirement..."
                className="flex-1 px-3 py-1.5 text-xs bg-white/75 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                Add
              </button>
            </form>
          </div>
        </div>

        {/* Middle: Live WhatsApp Transcript Preview & Quick Composer */}
        <div className="glass-panel rounded-3xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/60 bg-white/30 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">WhatsApp Conversation History</h3>
              <p className="text-[11px] text-slate-600">Synced with Meta Cloud Webhook</p>
            </div>
            <button
              onClick={handleOpenInbox}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              Full Inbox →
            </button>
          </div>

          <div className="flex-1 p-4 space-y-3 max-h-[420px] overflow-y-auto glass-scrollbar">
            {threadMessages.map((m) => (
              <div
                key={m.id}
                className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                  m.senderType === 'CUSTOMER'
                    ? 'bg-white/85 border border-white text-slate-800 mr-6 shadow-2xs'
                    : m.senderType === 'AI'
                    ? 'bg-indigo-950/90 text-white ml-6 shadow-xs'
                    : 'bg-emerald-700 text-white ml-6 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] opacity-75 mb-1 font-mono">
                  <span>{m.senderName || m.senderType}</span>
                  <span>{m.timestamp}</span>
                </div>
                <p>{m.content || m.text}</p>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleSendQuickWhatsApp}
            className="p-3.5 border-t border-white/60 bg-white/40 flex items-center gap-2"
          >
            <input
              type="text"
              value={quickWhatsAppMsg}
              onChange={(e) => setQuickWhatsAppMsg(e.target.value)}
              placeholder={`Send WhatsApp message to ${displayName}...`}
              className="flex-1 px-3.5 py-2 text-xs bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          </form>
        </div>

        {/* Right: Follow-Up Tasks for this Lead */}
        <div className="glass-panel rounded-3xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Scheduled Follow-Ups</h3>
            <p className="text-xs text-slate-600 mb-4">
              Action items linked to {displayName}
            </p>

            <div className="space-y-3 mb-4">
              {leadFollowUps.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center bg-white/50 rounded-2xl border border-dashed border-white/80">
                  No follow-ups scheduled for this lead yet.
                </p>
              ) : (
                leadFollowUps.map((f) => (
                  <div
                    key={f.id}
                    className="p-3.5 rounded-2xl bg-white/65 border border-white/85 flex items-start gap-2.5"
                  >
                    <button
                      onClick={() =>
                        updateFollowUpStatus(
                          f.id,
                          f.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
                        )
                      }
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                        f.status === 'COMPLETED'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-white border-slate-400'
                      }`}
                    >
                      {f.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3" />}
                    </button>
                    <div className="flex-1">
                      <p
                        className={`text-xs font-semibold ${
                          f.status === 'COMPLETED' ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {f.note || f.task}
                      </p>
                      <span className="text-[10px] font-mono text-slate-500">
                        {f.date} · {f.time}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <form onSubmit={handleAddFollowUp} className="pt-4 border-t border-white/60 space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Schedule New Follow-Up
            </label>
            <input
              type="text"
              value={followUpTaskInput}
              onChange={(e) => setFollowUpTaskInput(e.target.value)}
              placeholder="e.g., Follow up on proposal pricing..."
              className="w-full px-3.5 py-2 text-xs bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="w-full py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors cursor-pointer"
            >
              Add Follow-Up Task
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
