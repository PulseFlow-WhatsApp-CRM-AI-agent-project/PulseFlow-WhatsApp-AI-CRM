import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Plus,
  Sparkles,
  MessageSquare,
  Clock,
  Building2,
  X,
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';

export const FollowUpsPage = () => {
  const {
    followUps = [],
    leads = [],
    contacts = [],
    teamMembers = [],
    updateFollowUpStatus,
    addFollowUp,
  } = useCRM();

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    leadId: leads[0]?.id || 'lead-1',
    note: '',
    date: new Date().toISOString().slice(0, 10),
    time: '14:00',
  });

  // Enrich followUps with lead and contact info
  const enrichedTasks = useMemo(() => {
    return followUps.map((item) => {
      const lead = leads.find((l) => l.id === item.leadId) || {};
      const contact =
        contacts.find((c) => c.id === item.contactId || c.id === lead.contactId) || {};
      const assignedUser =
        teamMembers.find((m) => m.id === item.assignedUserId) ||
        teamMembers[0] || { name: 'Binil B' };

      return {
        ...item,
        displayLeadName: item.leadName || contact.name || 'WhatsApp Customer',
        displayCompany: item.company || contact.company || 'Inbound Business',
        displayTask: item.note || item.task || 'Follow up with customer on WhatsApp',
        displayDue: item.dueTime || `${item.date || 'Today'} at ${item.time || '11:00'}`,
        displayPriority: lead.leadType === 'HOT' ? 'URGENT' : 'HIGH',
        displayOwner: item.assignedTo || assignedUser.name,
        leadId: item.leadId || lead.id || 'lead-1',
      };
    });
  }, [followUps, leads, contacts, teamMembers]);

  const filteredTasks = useMemo(() => {
    return enrichedTasks.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      return true;
    });
  }, [enrichedTasks, statusFilter]);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.note.trim()) return;
    const targetLead = leads.find((l) => l.id === form.leadId) || leads[0];
    addFollowUp({
      leadId: targetLead?.id || 'lead-1',
      contactId: targetLead?.contactId || 'cnt-1',
      assignedUserId: teamMembers[0]?.id || 'admin-1',
      date: form.date,
      time: form.time,
      note: form.note.trim(),
      status: 'PENDING',
    });
    setShowModal(false);
    setForm({ ...form, note: '' });
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Follow-Up Tasks & SLA Reminders
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            AI-recommended and agent-scheduled WhatsApp follow-ups to prevent deal slippage
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-semibold hover:from-emerald-500 hover:to-teal-400 transition-all shadow-md shadow-emerald-600/20 w-fit cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Schedule Follow-Up
        </button>
      </div>

      {/* Filters */}
      <div className="glass-panel rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'ALL', label: 'All Tasks', count: enrichedTasks.length },
            {
              id: 'PENDING',
              label: 'Pending',
              count: enrichedTasks.filter((f) => f.status === 'PENDING').length,
            },
            {
              id: 'COMPLETED',
              label: 'Completed',
              count: enrichedTasks.filter((f) => f.status === 'COMPLETED').length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white/60 text-slate-700 hover:bg-white border border-white/75'
              }`}
            >
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
      </div>

      {/* Task Cards */}
      <div className="grid grid-cols-1 gap-4">
        {filteredTasks.map((item) => (
          <div
            key={item.id}
            className={`glass-panel rounded-3xl p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              item.status === 'COMPLETED' ? 'opacity-70' : 'hover:bg-white/75'
            }`}
          >
            <div className="flex items-start gap-4">
              <button
                onClick={() =>
                  updateFollowUpStatus(
                    item.id,
                    item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
                  )
                }
                className={`mt-1 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                  item.status === 'COMPLETED'
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'border-slate-400 bg-white/80 hover:border-emerald-500'
                }`}
              >
                {item.status === 'COMPLETED' && <CheckCircle2 className="w-4 h-4" />}
              </button>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/leads/${item.leadId}`}
                    className={`text-base font-bold hover:text-emerald-700 ${
                      item.status === 'COMPLETED' ? 'line-through text-slate-400' : 'text-slate-900'
                    }`}
                  >
                    {item.displayLeadName}
                  </Link>
                  <span className="text-xs text-slate-600 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {item.displayCompany}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      item.displayPriority === 'URGENT'
                        ? 'bg-rose-500/15 text-rose-800 border border-rose-300'
                        : 'bg-amber-500/15 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {item.displayPriority}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-800 border border-indigo-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-600" />
                    WhatsApp Follow-Up
                  </span>
                </div>

                <p
                  className={`text-sm ${
                    item.status === 'COMPLETED' ? 'line-through text-slate-400' : 'text-slate-800'
                  }`}
                >
                  {item.displayTask}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Due: {item.displayDue}
                  </span>
                  <span>•</span>
                  <span>Owner: <strong className="text-slate-700">{item.displayOwner}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() =>
                  updateFollowUpStatus(
                    item.id,
                    item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
                  )
                }
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  item.status === 'COMPLETED'
                    ? 'bg-white/70 text-slate-600 hover:bg-white'
                    : 'bg-emerald-500/15 text-emerald-900 hover:bg-emerald-500/25 border border-emerald-300'
                }`}
              >
                {item.status === 'COMPLETED' ? 'Reopen Task' : 'Mark Complete'}
              </button>
              <Link
                to="/inbox"
                className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-strong rounded-3xl max-w-md w-full p-6 shadow-2xl border border-white/80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Create Follow-Up Reminder</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Lead</label>
                <select
                  value={form.leadId}
                  onChange={(e) => setForm({ ...form, leadId: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                >
                  {leads.map((l) => {
                    const c = contacts.find((cnt) => cnt.id === l.contactId) || {};
                    return (
                      <option key={l.id} value={l.id}>
                        {c.name || l.name || 'Lead'} ({c.company || l.interestedService})
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Task Description *</label>
                <input
                  type="text"
                  required
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Send updated SLA & pricing breakdown on WhatsApp"
                  className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-white/80 bg-white/60 text-xs font-semibold text-slate-600 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 shadow-sm"
                >
                  Save Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const AnalyticsPage = () => {
  const { leads = [], conversations = [], followUps = [] } = useCRM();

  const hotCount = leads.filter((l) => (l.leadType || l.status) === 'HOT').length;
  const warmCount = leads.filter((l) => (l.leadType || l.status) === 'WARM').length;
  const coldCount = leads.filter((l) => (l.leadType || l.status) === 'COLD').length;
  const aiActive = conversations.filter((c) => c.aiEnabled && !c.humanTakeoverActive).length;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="glass-panel rounded-3xl p-5">
        <div className="text-xs text-slate-600">WhatsApp & AI Revenue Attribution</div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
          Executive CRM Analytics & SLA Telemetry
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-3xl p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase">Total Leads</div>
          <div className="text-3xl font-bold font-mono text-slate-900 mt-1">{leads.length}</div>
          <div className="text-xs text-emerald-700 font-semibold mt-1">{hotCount} HOT Qualified</div>
        </div>
        <div className="glass-panel rounded-3xl p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase">AI Resolution</div>
          <div className="text-3xl font-bold font-mono text-indigo-700 mt-1">
            {conversations.length ? Math.round((aiActive / conversations.length) * 100) : 82}%
          </div>
          <div className="text-xs text-slate-600 mt-1">{aiActive} autonomous threads</div>
        </div>
        <div className="glass-panel rounded-3xl p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase">First Response SLA</div>
          <div className="text-3xl font-bold font-mono text-emerald-700 mt-1">1.8s</div>
          <div className="text-xs text-slate-600 mt-1">Meta Cloud Webhook v20.0</div>
        </div>
        <div className="glass-panel rounded-3xl p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase">Follow-Up Tasks</div>
          <div className="text-3xl font-bold font-mono text-amber-700 mt-1">{followUps.length}</div>
          <div className="text-xs text-slate-600 mt-1">Tracked in SLA queue</div>
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-6">
        <h2 className="text-base font-bold text-slate-900 mb-4">Lead Temperature Breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-300/80">
            <div className="text-xs font-bold text-rose-900">HOT LEADS (81–100)</div>
            <div className="text-2xl font-bold font-mono text-rose-800 mt-1">{hotCount}</div>
          </div>
          <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-300/80">
            <div className="text-xs font-bold text-amber-900">WARM LEADS (31–80)</div>
            <div className="text-2xl font-bold font-mono text-amber-800 mt-1">{warmCount}</div>
          </div>
          <div className="p-4 rounded-2xl bg-white/65 border border-white/90">
            <div className="text-xs font-bold text-slate-700">COLD LEADS (0–30)</div>
            <div className="text-2xl font-bold font-mono text-slate-800 mt-1">{coldCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
