import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Check,
  Save,
  X,
  ShieldCheck
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import {
  ARCHITECTURE_SECTIONS,
  MONGOOSE_MODELS,
  API_CONTRACTS,
  DEVELOPMENT_PHASES
} from '../data/architectureBlueprint';

/* 1. TEAM MEMBERS PAGE */
export const TeamMembersPage = () => {
  const { teamMembers, currentUser, addTeamMember, updateTeamMember, deleteTeamMember } = useCRM();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91 98470 ');
  const [role, setRole] = useState('AGENT');

  const handleAdd = (e) => {
    e.preventDefault();
    addTeamMember({ name, email, phone, role, isActive: true });
    setShowModal(false);
    setName('');
    setEmail('');
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="glass-panel rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-600">Role-Based Access Control (ADMIN, MANAGER, AGENT)</div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">
            Team Members ({teamMembers.length})
          </h1>
        </div>
        {currentUser.role === 'ADMIN' && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-semibold rounded-xl hover:from-emerald-500 hover:to-teal-400 shadow-md shadow-emerald-600/20 flex items-center gap-1.5 self-start transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Team Member</span>
          </button>
        )}
      </div>

      <div className="glass-panel rounded-3xl p-5 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/60 text-slate-500">
              <th className="py-3 px-4 font-semibold">Name & Email</th>
              <th className="py-3 px-4 font-semibold">Phone</th>
              <th className="py-3 px-4 font-semibold">Role</th>
              <th className="py-3 px-4 font-semibold text-right">Assigned Leads</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/50">
            {teamMembers.map((tm) => (
              <tr key={tm.id} className="hover:bg-white/45 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="font-bold text-slate-900">{tm.name}</div>
                  <div className="text-[11px] text-slate-600">{tm.email}</div>
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-700 tabular-nums">{tm.phone}</td>
                <td className="py-3.5 px-4">
                  {currentUser.role === 'ADMIN' ? (
                    <select
                      value={tm.role}
                      onChange={(e) =>
                        updateTeamMember(tm.id, { role: e.target.value })
                      }
                      className="px-2.5 py-1.5 border border-white/80 rounded-xl bg-white/75 font-mono text-xs"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="AGENT">AGENT</option>
                    </select>
                  ) : (
                    <span className="font-mono font-semibold">{tm.role}</span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold">
                  {tm.assignedLeadsCount}
                </td>
                <td className="py-3.5 px-4">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      tm.isActive
                        ? 'bg-emerald-500/15 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-200/70 text-slate-600'
                    }`}
                  >
                    {tm.isActive ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                  {currentUser.role === 'ADMIN' && (
                    <>
                      <button
                        onClick={() => updateTeamMember(tm.id, { isActive: !tm.isActive })}
                        className="px-3 py-1.5 border border-white/80 bg-white/75 rounded-xl hover:bg-white text-slate-700 font-semibold transition-colors"
                      >
                        {tm.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => deleteTeamMember(tm.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 rounded-xl hover:bg-white/60"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel-strong border border-white/80 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
              <h3 className="text-sm font-bold text-slate-900">Invite Team Member</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white/80 border border-white/90 rounded-xl font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="AGENT">AGENT</option>
                  </select>
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-white/80 bg-white/60 rounded-xl font-semibold text-slate-600 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-500 shadow-sm"
                >
                  Provision Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* 2. AI SETTINGS PAGE */
export const AISettingsPage = () => {
  const { aiSettings, updateAISettings } = useCRM();
  const [formState, setFormState] = useState(aiSettings);

  const handleSave = (e) => {
    e.preventDefault();
    updateAISettings(formState);
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="glass-panel rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-600">
            AI Reply Engine, Lead Scoring Thresholds, Multi-Language & System Prompt
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">AI Behavior & Model Settings</h1>
        </div>
        <button
          onClick={handleSave}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-semibold rounded-xl hover:from-emerald-500 hover:to-teal-400 shadow-md shadow-emerald-600/20 flex items-center gap-1.5 self-start transition-all"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save AI Settings</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Model, Language & Auto-Reply Controls</h2>

          <div className="flex items-center justify-between py-2 border-b border-white/50">
            <div>
              <div className="font-semibold text-slate-900">AI Engine Master Toggle</div>
              <div className="text-[11px] text-slate-600">
                Enable AI analysis, intent detection, and lead scoring
              </div>
            </div>
            <input
              type="checkbox"
              checked={formState.aiEnabled}
              onChange={(e) => setFormState({ ...formState, aiEnabled: e.target.checked })}
              className="w-4 h-4 accent-emerald-600"
            />
          </div>

          <div className="flex items-center justify-between py-2 border-b border-white/50">
            <div>
              <div className="font-semibold text-slate-900">Automated WhatsApp Reply</div>
              <div className="text-[11px] text-slate-600">
                Automatically reply to incoming WhatsApp messages unless taken over by human
              </div>
            </div>
            <input
              type="checkbox"
              checked={formState.autoReplyEnabled}
              onChange={(e) => setFormState({ ...formState, autoReplyEnabled: e.target.checked })}
              className="w-4 h-4 accent-emerald-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">AI Service Provider</label>
              <select
                value={formState.provider}
                onChange={(e) =>
                  setFormState({ ...formState, provider: e.target.value })
                }
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 focus:outline-none focus:border-emerald-500"
              >
                <option value="GEMINI">Google Gemini API (Primary)</option>
                <option value="OPENAI">OpenAI API (Service Layer)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Model Identifier</label>
              <select
                value={formState.model}
                onChange={(e) => setFormState({ ...formState, model: e.target.value })}
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 font-mono focus:outline-none focus:border-emerald-500"
              >
                <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
                <option value="gemini-3.6-flash">gemini-3.6-flash</option>
                <option value="gemini-3.8-flash">gemini-3.8-flash</option>
                <option value="gpt-4o-mini">gpt-4o-mini</option>
                <option value="gpt-4o">gpt-4o</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Temperature ({formState.temperature})
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={formState.temperature}
                onChange={(e) =>
                  setFormState({ ...formState, temperature: Number(e.target.value) })
                }
                className="w-full accent-indigo-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Max Response Words
              </label>
              <input
                type="number"
                value={formState.maxResponseLength}
                onChange={(e) =>
                  setFormState({ ...formState, maxResponseLength: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Business Tone</label>
              <select
                value={formState.businessTone}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    businessTone: e.target.value
                  })
                }
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 focus:outline-none focus:border-emerald-500"
              >
                <option value="PROFESSIONAL">Professional</option>
                <option value="CONSULTATIVE">Consultative</option>
                <option value="FRIENDLY">Friendly</option>
                <option value="CONCISE">Concise</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Default Response Language
              </label>
              <select
                value={formState.responseLanguage}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    responseLanguage: e.target.value
                  })
                }
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 focus:outline-none focus:border-emerald-500"
              >
                <option value="AUTO">Auto-Detect (English / Malayalam / Manglish)</option>
                <option value="ENGLISH">English Default</option>
                <option value="MANGLISH">Manglish Preferred</option>
                <option value="MALAYALAM">Malayalam Preferred</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right: Lead Score Thresholds & System Prompt */}
        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">
            Lead Score Thresholds (0–100) & Human Handoff
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 bg-white/60 border border-white/85 rounded-2xl">
              <div className="text-[11px] text-slate-600">COLD Max</div>
              <input
                type="number"
                value={formState.scoreThresholds.coldMax}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    scoreThresholds: {
                      ...formState.scoreThresholds,
                      coldMax: Number(e.target.value)
                    }
                  })
                }
                className="w-full mt-1 px-2 py-1 border border-white/90 rounded-lg bg-white/90 font-mono"
              />
            </div>
            <div className="p-2.5 bg-white/60 border border-white/85 rounded-2xl">
              <div className="text-[11px] text-slate-600">WARM Max</div>
              <input
                type="number"
                value={formState.scoreThresholds.warmMax}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    scoreThresholds: {
                      ...formState.scoreThresholds,
                      warmMax: Number(e.target.value)
                    }
                  })
                }
                className="w-full mt-1 px-2 py-1 border border-white/90 rounded-lg bg-white/90 font-mono"
              />
            </div>
            <div className="p-2.5 bg-white/60 border border-white/85 rounded-2xl">
              <div className="text-[11px] text-slate-600">QUALIFIED Max</div>
              <input
                type="number"
                value={formState.scoreThresholds.qualifiedMax}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    scoreThresholds: {
                      ...formState.scoreThresholds,
                      qualifiedMax: Number(e.target.value)
                    }
                  })
                }
                className="w-full mt-1 px-2 py-1 border border-white/90 rounded-lg bg-white/90 font-mono"
              />
            </div>
            <div className="p-2.5 bg-rose-500/10 border border-rose-300/70 rounded-2xl">
              <div className="text-[11px] text-rose-800 font-semibold">HOT Minimum</div>
              <input
                type="number"
                value={formState.scoreThresholds.hotMin}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    scoreThresholds: {
                      ...formState.scoreThresholds,
                      hotMin: Number(e.target.value)
                    }
                  })
                }
                className="w-full mt-1 px-2 py-1 border border-white/90 rounded-lg bg-white/90 font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="font-semibold text-slate-700">
                Human Handoff Confidence Threshold
              </label>
              <span className="font-mono font-bold text-slate-900">
                {formState.humanHandoffThreshold.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.4}
              max={0.95}
              step={0.05}
              value={formState.humanHandoffThreshold}
              onChange={(e) =>
                setFormState({ ...formState, humanHandoffThreshold: Number(e.target.value) })
              }
              className="w-full accent-indigo-600"
            />
            <p className="text-[11px] text-slate-600 mt-0.5">
              When AI confidence falls below {formState.humanHandoffThreshold.toFixed(2)}, auto-reply stops and the thread is flagged for Human Attention.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Configurable AI System Prompt
            </label>
            <textarea
              rows={8}
              value={formState.systemPrompt}
              onChange={(e) => setFormState({ ...formState, systemPrompt: e.target.value })}
              className="w-full p-3.5 border border-white/85 bg-white/80 rounded-2xl font-mono text-xs leading-relaxed focus:outline-none focus:bg-white focus:border-emerald-500"
            />
          </div>
        </div>
      </form>
    </div>
  );
};

/* 3. KNOWLEDGE BASE PAGE */
export const KnowledgeBasePage = () => {
  const {
    knowledgeBase,
    currentUser,
    addKnowledgeArticle,
    updateKnowledgeArticle,
    deleteKnowledgeArticle
  } = useCRM();

  const [catFilter, setCatFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState('SERVICES');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [keywords, setKeywords] = useState('');

  const categories = [
    'COMPANY_INFO',
    'SERVICES',
    'PRICING',
    'FAQ',
    'BUSINESS_HOURS',
    'LOCATIONS',
    'CONTACT_INFO',
    'POLICIES',
    'PRODUCT_INFO',
    'SALES_INFO'
  ];

  const filtered = knowledgeBase.filter((k) =>
    catFilter === 'ALL' ? true : k.category === catFilter
  );

  const handleAdd = (e) => {
    e.preventDefault();
    addKnowledgeArticle({
      category,
      title,
      content,
      keywords: keywords
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      isActive: true
    });
    setShowModal(false);
    setTitle('');
    setContent('');
    setKeywords('');
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="glass-panel rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-600">
            Authoritative Source of Truth Injected into AI Context
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">
            Company Knowledge Base ({filtered.length} entries)
          </h1>
        </div>
        {currentUser.role === 'ADMIN' && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-semibold rounded-xl hover:from-emerald-500 hover:to-teal-400 shadow-md shadow-emerald-600/20 flex items-center gap-1.5 self-start transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Knowledge Entry</span>
          </button>
        )}
      </div>

      <div className="glass-panel rounded-3xl p-2 flex flex-wrap gap-1.5">
        <button
          onClick={() => setCatFilter('ALL')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
            catFilter === 'ALL' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-700 hover:bg-white/70'
          }`}
        >
          ALL
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
              catFilter === cat ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-700 hover:bg-white/70'
            }`}
          >
            {cat.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="glass-panel rounded-3xl p-5 hover:bg-white/75 transition-all flex flex-col justify-between space-y-3"
          >
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono font-bold text-indigo-800 bg-indigo-500/15 px-2.5 py-0.5 rounded-full border border-indigo-300">{item.category}</span>
                <span>Updated {item.updatedAt}</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mt-2">{item.title}</h3>
              <p className="text-xs text-slate-700 mt-2 whitespace-pre-line leading-relaxed">
                {item.content}
              </p>
            </div>

            <div className="pt-3 border-t border-white/60 flex items-center justify-between text-xs">
              <div className="text-[11px] text-slate-600 truncate">
                Keywords: {item.keywords.join(' · ')}
              </div>
              {currentUser.role === 'ADMIN' && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      updateKnowledgeArticle(item.id, { isActive: !item.isActive })
                    }
                    className={`font-semibold px-2.5 py-1 rounded-xl border ${
                      item.isActive
                        ? 'text-emerald-800 bg-emerald-500/15 border-emerald-300'
                        : 'text-slate-500 bg-white/60 border-white/80'
                    }`}
                  >
                    {item.isActive ? 'Active in AI' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => deleteKnowledgeArticle(item.id)}
                    className="text-slate-500 hover:text-rose-600 p-1.5 rounded-xl hover:bg-white/60"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel-strong border border-white/80 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
              <h3 className="text-sm font-bold text-slate-900">Add Knowledge Base Entry</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2 border border-white/90 rounded-xl bg-white/80"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Custom ERP Integration Pricing"
                  className="w-full px-3.5 py-2 border border-white/90 rounded-xl bg-white/80"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Authoritative Content (Used by AI)
                </label>
                <textarea
                  rows={5}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Provide factual service details, pricing ranges, and policies..."
                  className="w-full p-3 border border-white/90 rounded-xl bg-white/80"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="erp, sap, pricing, branches"
                  className="w-full px-3.5 py-2 border border-white/90 rounded-xl bg-white/80"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-white/80 bg-white/60 rounded-xl font-semibold text-slate-600 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-500 shadow-sm"
                >
                  Save Knowledge Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* 4. WHATSAPP SETTINGS PAGE */
export const WhatsAppSettingsPage = () => {
  const { whatsappSettings, updateWhatsAppSettings, pushToast } = useCRM();
  const [form, setForm] = useState({
    ...whatsappSettings,
    webhookUrl:
      typeof window !== 'undefined'
        ? `${window.location.origin}/webhook`
        : whatsappSettings.webhookUrl
  });
  const [copied, setCopied] = useState(false);
  const [liveStatus, setLiveStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const checkLiveWhatsAppStatus = async (notify = false) => {
    setCheckingStatus(true);
    try {
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();
      setLiveStatus(data);
      if (data.displayPhoneNumber && !form.displayPhoneNumber) {
        setForm((prev) => ({ ...prev, displayPhoneNumber: data.displayPhoneNumber }));
      }
      if (notify) {
        if (data.cloudApiConnected) {
          pushToast(
            'WhatsApp Cloud API Connected',
            `Verified: ${data.verifiedName || data.displayPhoneNumber || data.phoneNumberId}`,
            'success'
          );
        } else {
          pushToast('WhatsApp Token Expired / Error', data.error || 'Connection failed', 'danger');
        }
      }
    } catch (err) {
      setLiveStatus({ cloudApiConnected: false, error: err.message });
    } finally {
      setCheckingStatus(false);
    }
  };

  React.useEffect(() => {
    checkLiveWhatsAppStatus(false);
  }, []);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="glass-panel rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-600">
            Meta WhatsApp Business Cloud API & Webhook Configuration
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">WhatsApp Cloud API Settings</h1>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            type="button"
            onClick={() => checkLiveWhatsAppStatus(true)}
            disabled={checkingStatus}
            className="px-3.5 py-2 border border-white/80 bg-white/75 text-slate-800 text-xs font-semibold rounded-xl hover:bg-white cursor-pointer backdrop-blur-md shadow-2xs"
          >
            {checkingStatus ? 'Testing Meta API...' : 'Test Live Connection'}
          </button>
          <button
            onClick={() => updateWhatsAppSettings(form)}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-semibold rounded-xl hover:from-emerald-500 hover:to-teal-400 shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {liveStatus && liveStatus.cloudApiConnected && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-300/80 rounded-2xl text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 backdrop-blur-md">
          <div>
            <div className="font-bold">
              Meta WhatsApp Cloud API Connected · {liveStatus.verifiedName || 'Verified Number'} ({liveStatus.displayPhoneNumber})
            </div>
            <div className="text-emerald-900 mt-0.5">
              Phone Number ID: <code className="font-mono">{liveStatus.phoneNumberId}</code> · WABA ID: <code className="font-mono">{liveStatus.businessAccountId}</code> · Webhook Receiver Ready
            </div>
          </div>
        </div>
      )}

      {liveStatus && !liveStatus.cloudApiConnected && (
        <div className="p-4 bg-amber-500/15 border border-amber-300/80 rounded-2xl text-xs text-amber-950 space-y-1 backdrop-blur-md">
          <div className="font-bold">
            Meta Cloud API Status: Access Token Expired (Webhook Receiver is Active)
          </div>
          <div className="font-mono text-[11px] text-amber-900">{liveStatus.error}</div>
          <div className="text-amber-900 pt-1">
            Your incoming webhook endpoint (<code className="font-mono">/webhook</code>) is online and verified, but your temporary 24-hour <code className="font-mono">WHATSAPP_ACCESS_TOKEN</code> from Meta Developer Console has expired. Generate a fresh token (or System User permanent token) in Meta App Dashboard to resume sending live outgoing WhatsApp messages.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/60">
            <h2 className="text-sm font-bold text-slate-900">Webhook & Business Account Identifiers</h2>
            <span
              className={`font-semibold ${
                liveStatus?.cloudApiConnected
                  ? 'text-emerald-700'
                  : liveStatus
                  ? 'text-amber-700'
                  : 'text-slate-500'
              }`}
            >
              {liveStatus?.cloudApiConnected
                ? `Cloud API Connected · ${liveStatus.displayPhoneNumber || form.lastWebhookAt}`
                : liveStatus
                ? 'Webhook Ready · Token Expired'
                : 'Checking Meta API...'}
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Webhook Callback Endpoint (GET & POST)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={form.webhookUrl}
                className="flex-1 px-3.5 py-2 border border-white/85 rounded-xl bg-white/65 font-mono"
              />
              <button
                type="button"
                onClick={() => handleCopy(form.webhookUrl)}
                className="px-3.5 py-2 border border-white/85 bg-white/75 rounded-xl hover:bg-white flex items-center gap-1 font-semibold"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                WhatsApp Phone Number ID
              </label>
              <input
                type="text"
                value={form.phoneNumberId}
                onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                WhatsApp Business Account ID
              </label>
              <input
                type="text"
                value={form.businessAccountId}
                onChange={(e) => setForm({ ...form, businessAccountId: e.target.value })}
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Connected Display Phone Number
            </label>
            <input
              type="text"
              value={form.displayPhoneNumber}
              onChange={(e) => setForm({ ...form, displayPhoneNumber: e.target.value })}
              className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 font-mono"
            />
          </div>

          <div className="p-3.5 bg-white/60 border border-white/85 rounded-2xl text-slate-700 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <span>
              <strong>Server-Side Credential Isolation:</strong> Your permanent <code className="font-mono">WHATSAPP_ACCESS_TOKEN</code> and <code className="font-mono">WHATSAPP_VERIFY_TOKEN</code> are stored strictly in backend environment variables and are never exposed to the browser.
            </span>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">
            External Automation & n8n Workflow Compatibility
          </h2>
          <p className="text-slate-600 leading-relaxed">
            Optionally forward qualified Hot Leads, Human Handoff escalations, and overdue Follow-up events to an external n8n webhook for custom notifications and external CRM workflows.
          </p>

          <div className="flex items-center justify-between py-2 border-b border-white/50">
            <div>
              <div className="font-semibold text-slate-900">Enable n8n Event Webhook Forwarding</div>
              <div className="text-[11px] text-slate-600">
                Emits JSON events on lead.hot, conversation.handoff, and followup.due
              </div>
            </div>
            <input
              type="checkbox"
              checked={form.n8nEnabled}
              onChange={(e) => setForm({ ...form, n8nEnabled: e.target.checked })}
              className="w-4 h-4 accent-emerald-600"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">n8n Webhook Target URL</label>
            <input
              type="url"
              value={form.n8nWebhookUrl}
              onChange={(e) => setForm({ ...form, n8nWebhookUrl: e.target.value })}
              className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/* 5. COMPANY SETTINGS PAGE */
export const CompanySettingsPage = () => {
  const { companySettings, updateCompanySettings } = useCRM();
  const [form, setForm] = useState(companySettings);

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="glass-panel rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-600">Organization Profile & Business Hours</div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">Company Settings</h1>
        </div>
        <button
          onClick={() => updateCompanySettings(form)}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-semibold rounded-xl hover:from-emerald-500 hover:to-teal-400 shadow-md shadow-emerald-600/20 flex items-center gap-1.5 self-start transition-all"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Company Profile</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Organization Identity</h2>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Company Legal Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Industry</label>
              <input
                type="text"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Currency</label>
              <input
                type="text"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Support Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Primary Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Headquarters Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80"
            />
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Operating Business Hours ({form.timezone})</h2>
          <div className="divide-y divide-white/50">
            {form.businessHours.map((bh, idx) => (
              <div key={bh.day} className="py-2.5 flex items-center justify-between">
                <span className="font-semibold text-slate-800 w-28">{bh.day}</span>
                <label className="flex items-center gap-1.5 text-slate-600">
                  <input
                    type="checkbox"
                    checked={bh.isOpen}
                    onChange={(e) => {
                      const next = [...form.businessHours];
                      next[idx] = { ...bh, isOpen: e.target.checked };
                      setForm({ ...form, businessHours: next });
                    }}
                    className="accent-emerald-600"
                  />
                  <span>{bh.isOpen ? 'Open' : 'Closed'}</span>
                </label>
                {bh.isOpen ? (
                  <span className="font-mono text-slate-800 tabular-nums">
                    {bh.open} – {bh.close}
                  </span>
                ) : (
                  <span className="text-slate-500">AI 24/7 Auto-Reply Only</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* 6. PROFILE & GENERAL SETTINGS PAGE */
export const ProfileSettingsPage = ({ mode }) => {
  const { currentUser, updateTeamMember, pushToast } = useCRM();
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone);
  const [hotLeadAlert, setHotLeadAlert] = useState(true);
  const [handoffAlert, setHandoffAlert] = useState(true);
  const [followUpAlert, setFollowUpAlert] = useState(true);

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="glass-panel rounded-3xl p-5">
        <div className="text-xs text-slate-600">Account & Workspace Preferences</div>
        <h1 className="text-xl font-bold text-slate-900 mt-0.5">
          {mode === 'profile' ? 'My User Profile' : 'General CRM Settings'}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Personal Details & Role</h2>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              readOnly
              value={currentUser.email}
              className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/60 text-slate-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assigned Role</label>
              <input
                type="text"
                readOnly
                value={currentUser.role}
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/60 font-mono font-bold"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateTeamMember(currentUser.id, { name, phone })}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-500 hover:to-teal-400 shadow-md shadow-emerald-600/20 transition-all"
          >
            Update Profile
          </button>
        </div>

        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Real-Time Notification Preferences</h2>
          <label className="flex items-center justify-between py-2 border-b border-white/50">
            <span>Instant alert when AI qualifies a new HOT Lead (Score 81+)</span>
            <input
              type="checkbox"
              checked={hotLeadAlert}
              onChange={(e) => setHotLeadAlert(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
          </label>
          <label className="flex items-center justify-between py-2 border-b border-white/50">
            <span>High-priority alert when Human Handoff is triggered</span>
            <input
              type="checkbox"
              checked={handoffAlert}
              onChange={(e) => setHandoffAlert(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
          </label>
          <label className="flex items-center justify-between py-2 border-b border-white/50">
            <span>Daily reminder for pending and overdue Follow-ups</span>
            <input
              type="checkbox"
              checked={followUpAlert}
              onChange={(e) => setFollowUpAlert(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
          </label>
          <button
            type="button"
            onClick={() =>
              pushToast('Preferences Saved', 'Notification triggers updated.', 'success')
            }
            className="px-4 py-2.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all"
          >
            Save Notification Rules
          </button>
        </div>
      </div>
    </div>
  );
};

/* 7. PHASE 1 ARCHITECTURE BLUEPRINT REFERENCE PAGE */
export const ArchitectureBlueprintPage = () => {
  const [selectedModel, setSelectedModel] = useState(MONGOOSE_MODELS[0]);

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="glass-panel rounded-3xl p-5">
        <div className="text-xs text-slate-600">Phase 1 Approved Engineering Blueprint</div>
        <h1 className="text-xl font-bold text-slate-900 mt-0.5">
          System Architecture, Mongoose Schemas & 12-Phase Tracker
        </h1>
      </div>

      <div className="glass-panel rounded-3xl p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-3">12-Phase Implementation Progress</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/60 text-slate-500">
                <th className="py-2.5 px-3 font-semibold">Phase</th>
                <th className="py-2.5 px-3 font-semibold">Milestone</th>
                <th className="py-2.5 px-3 font-semibold">Deliverables</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/50">
              {DEVELOPMENT_PHASES.map((p) => (
                <tr key={p.phase} className="hover:bg-white/45 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold tabular-nums">
                    Phase {p.phase}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{p.name}</td>
                  <td className="py-2.5 px-3 text-slate-700">{p.deliverables}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-3xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Mongoose Models ({MONGOOSE_MODELS.length})</h2>
          <div className="flex flex-wrap gap-1.5 bg-white/55 border border-white/80 p-1.5 rounded-2xl">
            {MONGOOSE_MODELS.map((m) => (
              <button
                key={m.name}
                onClick={() => setSelectedModel(m)}
                className={`px-3 py-1 text-xs rounded-xl transition-all ${
                  selectedModel.name === m.name
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'text-slate-700 hover:bg-white/70'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
          <div className="text-xs space-y-1">
            <div className="font-semibold text-slate-900">{selectedModel.purpose}</div>
            <div className="font-mono text-[11px] text-slate-600">
              Indexes: {selectedModel.indexes.join(' · ')}
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-5 space-y-2">
          <h2 className="text-sm font-bold text-slate-900">
            REST API Contracts ({API_CONTRACTS.length} Routes)
          </h2>
          <div className="max-h-48 overflow-y-auto divide-y divide-white/50 text-xs glass-scrollbar">
            {API_CONTRACTS.map((api, idx) => (
              <div key={idx} className="py-2 flex items-center justify-between">
                <span className="font-mono font-semibold text-slate-900">
                  {api.method} {api.endpoint}
                </span>
                <span className="text-slate-600">{api.module}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
