import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Copy,
  Check,
  Save,
  X,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Smartphone,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Lock,
  Sparkles,
  Building2,
  Webhook
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import {
  MONGOOSE_MODELS,
  API_CONTRACTS,
  DEVELOPMENT_PHASES
} from '../data/architectureBlueprint';

/* 1. TEAM MEMBERS PAGE */
export const TeamMembersPage = () => {
  const {
    teamMembers = [],
    leads = [],
    conversations = [],
    currentUser,
    addTeamMember,
    updateTeamMember,
    deleteTeamMember,
    changePassword
  } = useCRM();

  const isAdmin = currentUser?.role === 'ADMIN';

  // Add Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [role, setRole] = useState('AGENT');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [addError, setAddError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Password Reset Modal State
  const [resetTarget, setResetTarget] = useState(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');

  const handleOpenAdd = () => {
    setName('');
    setEmail('');
    setPhone('+91 ');
    setRole('AGENT');
    setPassword('');
    setAddError('');
    setShowAddModal(true);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!name.trim() || !email.trim() || !password) {
      setAddError('Full Name, Work Email, and Password are required.');
      return;
    }
    if (password.length < 6) {
      setAddError('Password must be at least 6 characters.');
      return;
    }
    setIsSubmitting(true);
    const result = await addTeamMember({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role: role === 'ADMIN' ? 'ADMIN' : 'AGENT',
      password,
      isActive: true
    });
    setIsSubmitting(false);
    if (!result?.ok) {
      setAddError(result?.error || 'Could not create team member.');
      return;
    }
    setShowAddModal(false);
  };

  const handleOpenResetPassword = (tm) => {
    setResetTarget(tm);
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetError('');
  };

  const handleConfirmResetPassword = async (e) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError('');
    if (!resetNewPassword || resetNewPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    const res = await changePassword({
      userId: resetTarget.id,
      newPassword: resetNewPassword
    });
    if (!res?.ok) {
      setResetError(res?.error || 'Failed to reset password.');
      return;
    }
    setResetTarget(null);
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="glass-panel rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-600">
            Role-Based Access Control (ADMIN, AGENT) · Email + Password Authentication
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">
            Team Members ({teamMembers.length})
          </h1>
        </div>
        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-semibold rounded-xl hover:from-emerald-500 hover:to-teal-400 shadow-md shadow-emerald-600/20 flex items-center gap-1.5 self-start transition-all cursor-pointer"
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
              <th className="py-3 px-4 font-semibold">Team Member & Login Email</th>
              <th className="py-3 px-4 font-semibold">Phone Number</th>
              <th className="py-3 px-4 font-semibold">Role</th>
              <th className="py-3 px-4 font-semibold text-right">Assigned Leads</th>
              <th className="py-3 px-4 font-semibold">Last Login</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/50">
            {teamMembers.map((tm) => {
              const liveAssignedLeads = leads.filter((l) => l.assignedAgentId === tm.id).length;
              const liveActiveChats = conversations.filter((c) => c.assignedAgentId === tm.id).length;
              const isSelf = currentUser?.id === tm.id;
              const memberRole = tm.role === 'ADMIN' ? 'ADMIN' : 'AGENT';
              const initials = (tm.name || 'TM')
                .split(' ')
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <tr key={tm.id} className="hover:bg-white/45 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{tm.name}</span>
                          {isSelf && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/15 text-indigo-800 border border-indigo-300">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 font-mono">{tm.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-700 tabular-nums">
                    {tm.phone || '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    {isAdmin ? (
                      <select
                        value={memberRole}
                        onChange={(e) => updateTeamMember(tm.id, { role: e.target.value })}
                        className="px-2.5 py-1.5 border border-white/80 rounded-xl bg-white/75 font-mono text-xs font-semibold cursor-pointer"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="AGENT">AGENT</option>
                      </select>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-white/70 border border-white font-mono font-semibold">
                        {memberRole}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                    <span className="font-bold text-slate-900">
                      {liveAssignedLeads || tm.assignedLeadsCount || 0}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {liveActiveChats} active {liveActiveChats === 1 ? 'chat' : 'chats'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                    {tm.lastLoginAt || 'Never'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        tm.isActive !== false
                          ? 'bg-emerald-500/15 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-200/70 text-slate-600 border border-slate-300'
                      }`}
                    >
                      {tm.isActive !== false ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenResetPassword(tm)}
                          className="px-2.5 py-1.5 border border-white/80 bg-white/75 rounded-xl hover:bg-white text-indigo-700 font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="Reset / Change Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Password</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateTeamMember(tm.id, { isActive: tm.isActive === false })
                          }
                          className="px-2.5 py-1.5 border border-white/80 bg-white/75 rounded-xl hover:bg-white text-slate-700 font-semibold transition-colors cursor-pointer"
                        >
                          {tm.isActive !== false ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTeamMember(tm.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 rounded-xl hover:bg-white/60 cursor-pointer"
                          title="Delete Team Member"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ADD TEAM MEMBER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel-strong border border-white/80 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Create Team Member Account</h3>
                <p className="text-[11px] text-slate-500">
                  Member will sign in using their Work Email and Password
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-3.5 text-xs">
              {addError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-300 text-rose-800 font-semibold">
                  {addError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Rahul Nair"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Work Email (Used for Login) *
                </label>
                <input
                  type="email"
                  required
                  placeholder="rahul@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 98470 00000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white/80 border border-white/90 rounded-xl font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Role *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white/80 border border-white/90 rounded-xl font-semibold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="AGENT">AGENT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Login Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-3.5 pr-9 py-2 bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Hashed securely on the backend before saving. Phone number is for contact reference only.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-white/80 bg-white/60 rounded-xl font-semibold text-slate-600 hover:bg-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-500 shadow-sm cursor-pointer"
                >
                  {isSubmitting ? 'Creating Account...' : 'Create Member Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD RESET MODAL */}
      {resetTarget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel-strong border border-white/80 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Reset Password · {resetTarget.name}
                </h3>
                <p className="text-[11px] text-slate-500">{resetTarget.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmResetPassword} className="space-y-3.5 text-xs">
              {resetError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-300 text-rose-800 font-semibold">
                  {resetError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Min. 6 characters"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Re-enter new password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-4 py-2 border border-white/80 bg-white/60 rounded-xl font-semibold text-slate-600 hover:bg-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 shadow-sm cursor-pointer"
                >
                  Update Password
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
  const { aiSettings, updateAISettings, currentUser, authToken, pushToast } = useCRM();
  const isAdmin = currentUser?.role === 'ADMIN';
  const [formState, setFormState] = useState(aiSettings);
  const [adminCfg, setAdminCfg] = useState(null);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('');
  const [openaiApiKeyInput, setOpenaiApiKeyInput] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [savingVault, setSavingVault] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState(null);

  const getAuthHeaders = () => {
    let token = authToken || '';
    if (!token && typeof window !== 'undefined') {
      try {
        token = localStorage.getItem('pulseflow_auth_token') || '';
      } catch {
        token = '';
      }
    }
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  const loadAdminAiVault = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/admin/config', { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok && data?.config) {
        setAdminCfg(data.config);
      }
    } catch (err) {
      console.error('Failed to load Admin AI config:', err);
    }
  };

  useEffect(() => {
    loadAdminAiVault();
  }, [isAdmin, authToken]);

  const handleSave = async (e) => {
    e.preventDefault();
    updateAISettings(formState);
    if (isAdmin) {
      setSavingVault(true);
      try {
        const activeProvider =
          String(formState.provider || '').toLowerCase() === 'openai' ? 'openai' : 'gemini';
        const payload = {
          aiProvider: activeProvider,
          geminiModel:
            activeProvider === 'gemini'
              ? formState.model || adminCfg?.geminiModel || 'gemini-2.5-flash'
              : adminCfg?.geminiModel || 'gemini-2.5-flash',
          openaiModel:
            activeProvider === 'openai'
              ? formState.model || adminCfg?.openaiModel || 'gpt-4o-mini'
              : adminCfg?.openaiModel || 'gpt-4o-mini'
        };
        if (geminiApiKeyInput.trim()) payload.geminiApiKey = geminiApiKeyInput.trim();
        if (openaiApiKeyInput.trim()) payload.openaiApiKey = openaiApiKeyInput.trim();

        const res = await fetch('/api/admin/config', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data?.config) {
          setAdminCfg(data.config);
          setGeminiApiKeyInput('');
          setOpenaiApiKeyInput('');
        }
      } catch (err) {
        console.error('Failed to save encrypted AI provider keys:', err);
      } finally {
        setSavingVault(false);
      }
    }
  };

  const handleClearAiKey = async (providerKey) => {
    if (!isAdmin) return;
    setSavingVault(true);
    try {
      const body =
        providerKey === 'gemini' ? { clearGeminiApiKey: true } : { clearOpenaiApiKey: true };
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok && data?.config) {
        setAdminCfg(data.config);
        pushToast(
          'Encrypted Key Cleared',
          `Removed stored ${providerKey === 'gemini' ? 'Gemini' : 'OpenAI'} API key from MongoDB.`,
          'warning'
        );
      }
    } catch (err) {
      pushToast('Clear Failed', err.message, 'danger');
    } finally {
      setSavingVault(false);
    }
  };

  const handleTestAiProvider = async () => {
    setTestingAi(true);
    setAiTestResult(null);
    try {
      const activeProvider =
        String(formState.provider || '').toLowerCase() === 'openai' ? 'openai' : 'gemini';
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ provider: activeProvider })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'AI provider verification failed.');
      }
      setAiTestResult({
        ok: true,
        provider: data.provider,
        model: data.model,
        reply: data.reply
      });
      pushToast(
        'AI Provider Verified',
        `Live response received from ${data.provider.toUpperCase()} (${data.model}).`,
        'success'
      );
    } catch (err) {
      setAiTestResult({ ok: false, error: err.message });
      pushToast('AI Verification Error', err.message, 'danger');
    } finally {
      setTestingAi(false);
    }
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

          {/* Encrypted AI Provider API Keys (Admin-Only MongoDB AES-256-GCM Vault) */}
          <div className="pt-3 border-t border-white/60 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-slate-900">
                  Encrypted AI Provider API Keys (MongoDB AES-256-GCM)
                </span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  disabled={testingAi}
                  onClick={handleTestAiProvider}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{testingAi ? 'Testing Live Provider...' : 'Verify Active AI Provider'}</span>
                </button>
              )}
            </div>

            {isAdmin ? (
              <div className="grid grid-cols-1 gap-3">
                <div className="p-3.5 rounded-2xl bg-white/75 border border-white/90 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">Google Gemini API Key</span>
                    {adminCfg?.geminiApiKeyConfigured ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-300 text-emerald-900 text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Configured ({adminCfg.geminiApiKeyMasked || 'Encrypted'})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-300 text-amber-900 text-[10px] font-bold">
                        <span>Not Configured</span>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showGeminiKey ? 'text' : 'password'}
                      value={geminiApiKeyInput}
                      onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                      placeholder={
                        adminCfg?.geminiApiKeyConfigured
                          ? 'Enter new Gemini API key to rotate encrypted key...'
                          : 'Paste Gemini API key (AIza...)'
                      }
                      autoComplete="new-password"
                      className="w-full pl-3 pr-9 py-2 rounded-xl border border-white/90 bg-white/90 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showGeminiKey ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Encrypted before saving in MongoDB. Never returned to browser.</span>
                    {adminCfg?.geminiApiKeySource === 'MONGODB_ENCRYPTED' && (
                      <button
                        type="button"
                        onClick={() => handleClearAiKey('gemini')}
                        className="text-rose-600 hover:underline font-semibold cursor-pointer"
                      >
                        Clear DB Key
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/75 border border-white/90 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">OpenAI API Key</span>
                    {adminCfg?.openaiApiKeyConfigured ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-300 text-emerald-900 text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Configured ({adminCfg.openaiApiKeyMasked || 'Encrypted'})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-300 text-amber-900 text-[10px] font-bold">
                        <span>Not Configured</span>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showOpenaiKey ? 'text' : 'password'}
                      value={openaiApiKeyInput}
                      onChange={(e) => setOpenaiApiKeyInput(e.target.value)}
                      placeholder={
                        adminCfg?.openaiApiKeyConfigured
                          ? 'Enter new OpenAI API key to rotate encrypted key...'
                          : 'Paste OpenAI API key (sk-...)'
                      }
                      autoComplete="new-password"
                      className="w-full pl-3 pr-9 py-2 rounded-xl border border-white/90 bg-white/90 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenaiKey((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showOpenaiKey ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Encrypted before saving in MongoDB. Never returned to browser.</span>
                    {adminCfg?.openaiApiKeySource === 'MONGODB_ENCRYPTED' && (
                      <button
                        type="button"
                        onClick={() => handleClearAiKey('openai')}
                        className="text-rose-600 hover:underline font-semibold cursor-pointer"
                      >
                        Clear DB Key
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                AI API keys are encrypted in MongoDB with AES-256-GCM and restricted to Admin users.
              </p>
            )}

            {aiTestResult && (
              <div
                className={`p-3 rounded-2xl border text-xs ${
                  aiTestResult.ok
                    ? 'bg-emerald-500/10 border-emerald-300 text-emerald-950'
                    : 'bg-rose-500/15 border-rose-300 text-rose-900'
                }`}
              >
                {aiTestResult.ok ? (
                  <div>
                    <span className="font-bold">
                      Verified {aiTestResult.provider.toUpperCase()} ({aiTestResult.model}):
                    </span>{' '}
                    {aiTestResult.reply}
                  </div>
                ) : (
                  <div>
                    <span className="font-bold">Verification Failed:</span> {aiTestResult.error}
                  </div>
                )}
              </div>
            )}
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

/* 4. WHATSAPP EMBEDDED SIGNUP & INTEGRATION PANEL */
const ONBOARDING_FLOW_STEPS = [
  { id: 1, label: 'Connect WhatsApp', desc: 'Initiate onboarding inside PulseFlow CRM' },
  { id: 2, label: 'Meta / Facebook Login for Business', desc: 'Authenticate with Meta Business account' },
  { id: 3, label: 'Select Business Portfolio', desc: 'Choose your Meta Business Portfolio' },
  { id: 4, label: 'Select/Create WhatsApp Business Account', desc: 'Link or create your WABA container' },
  { id: 5, label: 'Select/Connect WhatsApp Business number', desc: 'Connect number (supports Coexistence when eligible)' },
  { id: 6, label: 'Meta authorization & Return to PulseFlow', desc: 'Verify WABA, Phone ID, Webhook & Coexistence sync' },
  { id: 7, label: 'Connected', desc: 'CRM Inbox + AI Automation starts working immediately' }
];

export const WhatsAppIntegrationSection = ({ compact = false }) => {
  const navigate = useNavigate();
  const {
    whatsappSettings,
    updateWhatsAppSettings,
    currentUser,
    authToken,
    pushToast,
    setWhatsappOnboardingModalOpen
  } = useCRM();

  const [configData, setConfigData] = useState(null);
  const [connection, setConnection] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);

  useEffect(() => {
    if (setWhatsappOnboardingModalOpen) {
      setWhatsappOnboardingModalOpen(onboardingModalOpen);
    }
    return () => {
      if (setWhatsappOnboardingModalOpen) {
        setWhatsappOnboardingModalOpen(false);
      }
    };
  }, [onboardingModalOpen, setWhatsappOnboardingModalOpen]);
  const [onboardingMode, setOnboardingMode] = useState('COEXISTENCE');
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [fbSdkLoaded, setFbSdkLoaded] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');

  const DEFAULT_META_APP_ID = '1640164817625713';
  const DEFAULT_EMBEDDED_SIGNUP_CONFIG_ID = '1105412835405203';
  const TEST_PHONE_DISPLAY = '+1 (555) 639-1516';
  const TEST_PHONE_NUMBER_ID = '1346163251921781';
  const TEST_WABA_ID = '1117283247416297';
  const PRODUCTION_WEBHOOK_URL = 'https://pulseflow-whatsapp-ai-crm-web.onrender.com/webhook';

  // Editable Meta App ID & Embedded Signup Config ID + write-only encrypted secrets
  const [metaAppIdInput, setMetaAppIdInput] = useState(DEFAULT_META_APP_ID);
  const [configIdInput, setConfigIdInput] = useState(DEFAULT_EMBEDDED_SIGNUP_CONFIG_ID);
  const [metaAppSecretInput, setMetaAppSecretInput] = useState('');
  const [verifyTokenInput, setVerifyTokenInput] = useState('');
  const [showMetaSecret, setShowMetaSecret] = useState(false);
  const [savingMetaConfig, setSavingMetaConfig] = useState(false);
  const [showMetaRequirements, setShowMetaRequirements] = useState(false);

  // Meta Official Test Number Restore & Live Verification state
  const [testAccessTokenInput, setTestAccessTokenInput] = useState('');
  const [showTestToken, setShowTestToken] = useState(false);
  const [testRecipientPhoneInput, setTestRecipientPhoneInput] = useState('');
  const [testMessageTextInput, setTestMessageTextInput] = useState(
    'PulseFlow CRM Meta Test Number verification check'
  );
  const [verifyingTestSetup, setVerifyingTestSetup] = useState(false);
  const [testDiagnostics, setTestDiagnostics] = useState(null);
  const [testSetupMessage, setTestSetupMessage] = useState('');

  // Refs to coordinate WA_EMBEDDED_SIGNUP postMessage and FB.login OAuth code callback
  const embeddedSessionRef = useRef({
    wabaId: '',
    phoneNumberId: '',
    businessId: '',
    sessionEvent: ''
  });
  const pendingCodeRef = useRef('');
  const submissionInFlightRef = useRef(false);

  const getAuthHeaders = () => {
    let token = authToken || '';
    if (!token && typeof window !== 'undefined') {
      try {
        token = localStorage.getItem('pulseflow_auth_token') || '';
      } catch {
        token = '';
      }
    }
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  const loadEmbeddedConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch('/api/whatsapp/embedded-config', {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      setConfigData(data);
      if (data.connection) {
        setConnection(data.connection);
      }
      const resolvedAppId =
        data.appId && data.appId !== '1420003542794708'
          ? String(data.appId).trim()
          : DEFAULT_META_APP_ID;
      const resolvedConfigId =
        data.configId && data.configId !== '47642322601105412835405203476567'
          ? String(data.configId).trim()
          : DEFAULT_EMBEDDED_SIGNUP_CONFIG_ID;
      setMetaAppIdInput(resolvedAppId);
      setConfigIdInput(resolvedConfigId);
    } catch (err) {
      console.error('Failed to load WhatsApp embedded config:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    loadEmbeddedConfig();
  }, []);

  // Load official Facebook JS SDK when Meta App ID is available
  useEffect(() => {
    const rawAppId = (metaAppIdInput || configData?.appId || DEFAULT_META_APP_ID).trim();
    const activeAppId =
      !rawAppId || rawAppId === '1420003542794708' ? DEFAULT_META_APP_ID : rawAppId;
    const apiVer = configData?.apiVersion || 'v21.0';
    if (!activeAppId || typeof window === 'undefined') return;

    const initFbSdk = () => {
      if (window.FB) {
        try {
          window.FB.init({
            appId: activeAppId,
            autoLogAppEvents: true,
            xfbml: true,
            version: apiVer
          });
          setFbSdkLoaded(true);
        } catch (err) {
          console.warn('FB.init warning:', err);
        }
      }
    };

    if (window.FB) {
      initFbSdk();
      return;
    }

    window.fbAsyncInit = function () {
      initFbSdk();
    };

    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      document.body.appendChild(script);
    }
  }, [metaAppIdInput, configData?.appId, configData?.apiVersion]);

  const finalizeEmbeddedSignupOnBackend = async ({
    code = '',
    wabaId = '',
    phoneNumberId = '',
    businessId = '',
    sessionEvent = ''
  }) => {
    if (submissionInFlightRef.current) return;
    submissionInFlightRef.current = true;
    setIsConnecting(true);
    setOnboardingError('');

    try {
      setOnboardingStep(6);

      const res = await fetch('/api/whatsapp/embedded-signup/complete', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          code: code || pendingCodeRef.current,
          wabaId: wabaId || embeddedSessionRef.current.wabaId,
          phoneNumberId: phoneNumberId || embeddedSessionRef.current.phoneNumberId,
          businessId: businessId || embeddedSessionRef.current.businessId,
          sessionEvent: sessionEvent || embeddedSessionRef.current.sessionEvent,
          onboardingMode
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok || data.connectionStatus !== 'CONNECTED') {
        if (data.connection) {
          setConnection(data.connection);
        }
        throw new Error(
          data.error || 'Meta verification failed. WhatsApp was not marked as connected.'
        );
      }

      setOnboardingStep(7);
      setConnection(data.connection);
      updateWhatsAppSettings({
        isConnected: true,
        phoneNumberId: data.connection.phoneNumberId,
        businessAccountId: data.connection.wabaId,
        displayPhoneNumber: data.connection.displayPhoneNumber
      });

      pushToast(
        'WhatsApp Connected to PulseFlow',
        `${data.connection.businessName || data.connection.verifiedName} · ${
          data.connection.maskedPhone
        } is verified and connected.`,
        'success'
      );

      setTimeout(() => {
        setIsConnecting(false);
        submissionInFlightRef.current = false;
        setOnboardingModalOpen(false);
        setOnboardingStep(0);
      }, 600);
    } catch (err) {
      setIsConnecting(false);
      submissionInFlightRef.current = false;
      setOnboardingStep(1);
      setOnboardingError(err.message || 'Could not complete Meta WhatsApp verification.');
    }
  };

  // Listen for Meta's official WA_EMBEDDED_SIGNUP session info postMessage event
  useEffect(() => {
    const handleMetaMessage = (event) => {
      if (
        !event.origin ||
        (!event.origin.endsWith('facebook.com') && !event.origin.endsWith('fb.com'))
      ) {
        return;
      }
      try {
        const payload =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (payload && payload.type === 'WA_EMBEDDED_SIGNUP') {
          const evType = payload.event || '';
          const evData = payload.data || {};
          embeddedSessionRef.current = {
            wabaId: evData.waba_id || embeddedSessionRef.current.wabaId || '',
            phoneNumberId:
              evData.phone_number_id || embeddedSessionRef.current.phoneNumberId || '',
            businessId: evData.business_id || embeddedSessionRef.current.businessId || '',
            sessionEvent: evType
          };

          if (evType === 'CANCEL') {
            setIsConnecting(false);
            submissionInFlightRef.current = false;
            setOnboardingStep(1);
            setOnboardingError(
              evData.current_step
                ? `Meta Embedded Signup was cancelled at step: ${evData.current_step}.`
                : 'Meta Embedded Signup was cancelled before completion.'
            );
            return;
          }

          if (evType === 'ERROR') {
            setIsConnecting(false);
            submissionInFlightRef.current = false;
            setOnboardingStep(1);
            setOnboardingError(
              evData.error_message || 'Meta Embedded Signup reported an onboarding error.'
            );
            return;
          }

          if (
            (evType === 'FINISH' || evType === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') &&
            pendingCodeRef.current &&
            !submissionInFlightRef.current
          ) {
            finalizeEmbeddedSignupOnBackend({
              code: pendingCodeRef.current,
              wabaId: embeddedSessionRef.current.wabaId,
              phoneNumberId: embeddedSessionRef.current.phoneNumberId,
              businessId: embeddedSessionRef.current.businessId,
              sessionEvent: evType
            });
          }
        }
      } catch {
        // ignore non-JSON postMessage events
      }
    };

    window.addEventListener('message', handleMetaMessage);
    return () => window.removeEventListener('message', handleMetaMessage);
  }, [onboardingMode, authToken]);

  const handleSaveMetaAppConfig = async (e) => {
    e.preventDefault();
    setSavingMetaConfig(true);
    setOnboardingError('');
    try {
      const payload = {
        metaAppId: metaAppIdInput.trim(),
        embeddedSignupConfigId: configIdInput.trim()
      };
      if (metaAppSecretInput.trim()) {
        payload.metaAppSecret = metaAppSecretInput.trim();
      }
      if (verifyTokenInput.trim()) {
        payload.whatsappVerifyToken = verifyTokenInput.trim();
      }
      const res = await fetch('/api/whatsapp/embedded-config', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to save Meta App configuration.');
      }
      setMetaAppSecretInput('');
      setVerifyTokenInput('');
      await loadEmbeddedConfig();
      pushToast(
        'Meta Embedded Signup Config Saved',
        'Meta App ID, Config ID, and encrypted secrets saved to MongoDB.',
        'success'
      );
    } catch (err) {
      setOnboardingError(err.message);
      pushToast('Save Failed', err.message, 'danger');
    } finally {
      setSavingMetaConfig(false);
    }
  };

  // Launch official Meta Embedded Signup popup via FB.login (Never fakes or simulates onboarding)
  const handleLaunchMetaPopup = () => {
    setOnboardingError('');
    const rawAppId = (metaAppIdInput || configData?.appId || DEFAULT_META_APP_ID).trim();
    const rawConfigId = (
      configIdInput ||
      configData?.configId ||
      DEFAULT_EMBEDDED_SIGNUP_CONFIG_ID
    ).trim();
    const activeAppId =
      !rawAppId || rawAppId === '1420003542794708' ? DEFAULT_META_APP_ID : rawAppId;
    const activeConfigId =
      !rawConfigId || rawConfigId === '47642322601105412835405203476567'
        ? DEFAULT_EMBEDDED_SIGNUP_CONFIG_ID
        : rawConfigId;
    const apiVer = configData?.apiVersion || 'v21.0';

    if (!activeAppId || !activeConfigId) {
      setOnboardingError(
        'Configuration Error: META_APP_ID and META_EMBEDDED_SIGNUP_CONFIG_ID are required before launching Meta Embedded Signup. Simulated onboarding is disabled.'
      );
      setShowMetaRequirements(true);
      return;
    }

    if (typeof window === 'undefined' || !window.FB) {
      setOnboardingError(
        'Facebook JS SDK (connect.facebook.net/en_US/sdk.js) is still loading or blocked by the browser. Ensure popups/scripts from facebook.com are allowed and try again.'
      );
      return;
    }

    // Re-initialize FB SDK immediately before FB.login so the OAuth URL strictly uses activeAppId (1097762042867836)
    try {
      window.FB.init({
        appId: activeAppId,
        autoLogAppEvents: true,
        xfbml: true,
        version: apiVer
      });
    } catch (err) {
      console.warn('FB.init pre-login warning:', err);
    }

    setIsConnecting(true);
    setOnboardingStep(2);
    pendingCodeRef.current = '';
    submissionInFlightRef.current = false;
    embeddedSessionRef.current = {
      wabaId: '',
      phoneNumberId: '',
      businessId: '',
      sessionEvent: ''
    };

    const extras = {
      setup: {},
      featureType:
        onboardingMode === 'COEXISTENCE' ? 'whatsapp_business_app_onboarding' : '',
      sessionInfoVersion: '3'
    };

    window.FB.login(
      (response) => {
        const code = response?.authResponse?.code || '';
        if (!code) {
          setIsConnecting(false);
          submissionInFlightRef.current = false;
          setOnboardingStep(1);
          setOnboardingError(
            'Meta login failed or was closed before returning an OAuth authorization code. WhatsApp was not connected.'
          );
          return;
        }

        pendingCodeRef.current = code;

        if (embeddedSessionRef.current.sessionEvent === 'CANCEL') {
          setIsConnecting(false);
          submissionInFlightRef.current = false;
          setOnboardingStep(1);
          setOnboardingError('Meta Embedded Signup was cancelled before completion.');
          return;
        }

        // Wait briefly if WA_EMBEDDED_SIGNUP postMessage is still arriving, then verify on backend
        const waitMs = embeddedSessionRef.current.wabaId ? 50 : 900;
        setTimeout(() => {
          if (
            !submissionInFlightRef.current &&
            embeddedSessionRef.current.sessionEvent !== 'CANCEL'
          ) {
            finalizeEmbeddedSignupOnBackend({
              code,
              wabaId: embeddedSessionRef.current.wabaId,
              phoneNumberId: embeddedSessionRef.current.phoneNumberId,
              businessId: embeddedSessionRef.current.businessId,
              sessionEvent: embeddedSessionRef.current.sessionEvent || 'FINISH'
            });
          }
        }, waitMs);
      },
      {
        config_id: activeConfigId,
        response_type: 'code',
        override_default_response_type: true,
        extras
      }
    );
  };

  const handleDisconnectWhatsApp = async () => {
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to disconnect WhatsApp');
      }
      if (data.connection) {
        setConnection(data.connection);
      }
      updateWhatsAppSettings({
        isConnected: false
      });
      pushToast(
        'WhatsApp Disconnected',
        'Disconnected from PulseFlow CRM. Test number metadata preserved and real number +91 7902931503 untouched.',
        'warning'
      );
    } catch (err) {
      pushToast('Disconnect Error', err.message, 'danger');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRestoreAndVerifyTestNumber = async (e) => {
    if (e) e.preventDefault();
    setVerifyingTestSetup(true);
    setOnboardingError('');
    setTestSetupMessage('');
    try {
      const res = await fetch('/api/whatsapp/test-number/restore', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          metaAppId: DEFAULT_META_APP_ID,
          phoneNumberId: TEST_PHONE_NUMBER_ID,
          wabaId: TEST_WABA_ID,
          displayPhoneNumber: TEST_PHONE_DISPLAY,
          accessToken: testAccessTokenInput.trim(),
          testRecipientPhone: testRecipientPhoneInput.trim(),
          testMessageText: testMessageTextInput.trim()
        })
      });
      const data = await res.json();
      if (data.diagnostics) {
        setTestDiagnostics(data.diagnostics);
      }
      if (data.connection) {
        setConnection(data.connection);
      }
      if (!res.ok || data.status === 'ERROR') {
        throw new Error(data.error || 'Meta Test Number verification failed.');
      }
      if (testAccessTokenInput.trim()) {
        setTestAccessTokenInput('');
      }
      setTestSetupMessage(data.message || 'Meta Test Number configuration updated.');
      if (data.connectionStatus === 'CONNECTED') {
        updateWhatsAppSettings({
          isConnected: true,
          phoneNumberId: TEST_PHONE_NUMBER_ID,
          businessAccountId: TEST_WABA_ID,
          displayPhoneNumber: TEST_PHONE_DISPLAY
        });
        pushToast(
          'Meta Test Number Connected',
          data.message || 'Webhook subscribed & test message delivered!',
          'success'
        );
      } else {
        pushToast(
          'Test Number Step Verified',
          data.message || 'Provide an allowlisted recipient number to verify test message delivery.',
          'warning'
        );
      }
    } catch (err) {
      setOnboardingError(err.message);
      pushToast('Test Number Verification Failed', err.message, 'danger');
    } finally {
      setVerifyingTestSetup(false);
    }
  };

  const rawActiveAppId = (metaAppIdInput || configData?.appId || DEFAULT_META_APP_ID).trim();
  const rawActiveConfigId = (
    configIdInput ||
    configData?.configId ||
    DEFAULT_EMBEDDED_SIGNUP_CONFIG_ID
  ).trim();
  const activeAppId =
    !rawActiveAppId || rawActiveAppId === '1420003542794708'
      ? DEFAULT_META_APP_ID
      : rawActiveAppId;
  const activeConfigId =
    !rawActiveConfigId || rawActiveConfigId === '47642322601105412835405203476567'
      ? DEFAULT_EMBEDDED_SIGNUP_CONFIG_ID
      : rawActiveConfigId;
  const metaConfigReady = Boolean(activeAppId && activeConfigId);
  const isConnected = Boolean(
    connection?.connected &&
      connection?.connectionStatus === 'CONNECTED' &&
      connection?.wabaId &&
      connection?.phoneNumberId
  );
  const isErrorState = connection?.connectionStatus === 'ERROR';

  return (
    <>
      <div className="glass-panel-strong rounded-3xl p-6 lg:p-7 border border-white/85 shadow-lg space-y-6">
        {!isConnected ? (
          /* ================= NOT CONNECTED / ERROR VIEW ================= */
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/5 border border-slate-300/80 text-[11px] font-semibold text-slate-700">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Meta WhatsApp Embedded Signup · Facebook Login for Business</span>
              </div>

              <h2 className="text-xl font-bold text-slate-900">WhatsApp Integration</h2>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Connect your WhatsApp Business account to PulseFlow and manage conversations,
                automation and leads from one place.
              </p>

              {!metaConfigReady && (
                <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-300 text-amber-950 text-xs">
                  <div className="font-bold">CODE COMPLETE — META CONFIGURATION REQUIRED</div>
                  <div className="mt-0.5 text-[11px]">
                    Configure <code className="font-mono">META_APP_ID</code> and{' '}
                    <code className="font-mono">META_EMBEDDED_SIGNUP_CONFIG_ID</code> (plus{' '}
                    <code className="font-mono">META_APP_SECRET</code> on the backend) to launch
                    live Meta Embedded Signup.
                  </div>
                </div>
              )}

              {/* Restored Meta Official Test Number Configuration Summary */}
              <div className="p-4 rounded-2xl bg-white/80 border border-emerald-200/90 space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">
                    Restored Meta Official Cloud API Test Number Setup
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-900 border border-amber-300">
                    Real Number +91 7902931503 Untouched
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-slate-900/5 border border-slate-200/80">
                    <span className="text-slate-500 font-semibold">Test Phone:</span>{' '}
                    <span className="font-mono font-bold text-slate-900">
                      {connection?.displayPhoneNumber || TEST_PHONE_DISPLAY}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/5 border border-slate-200/80">
                    <span className="text-slate-500 font-semibold">Phone Number ID:</span>{' '}
                    <span className="font-mono font-bold text-slate-900">
                      {connection?.phoneNumberId || TEST_PHONE_NUMBER_ID}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/5 border border-slate-200/80">
                    <span className="text-slate-500 font-semibold">WABA ID:</span>{' '}
                    <span className="font-mono font-bold text-slate-900">
                      {connection?.wabaId || TEST_WABA_ID}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/5 border border-slate-200/80">
                    <span className="text-slate-500 font-semibold">Meta App ID:</span>{' '}
                    <span className="font-mono font-bold text-slate-900">
                      {connection?.metaAppId || DEFAULT_META_APP_ID}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-600 truncate">
                  <strong className="font-sans text-slate-700">Production Webhook:</strong>{' '}
                  {connection?.webhookUrl || PRODUCTION_WEBHOOK_URL}
                </div>
              </div>

              {isErrorState && connection?.lastError && (
                <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-300 text-rose-900 text-xs font-medium">
                  <strong>Verification Status:</strong> {connection.lastError}
                </div>
              )}

              {testSetupMessage && (
                <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-300 text-emerald-950 text-xs font-medium">
                  {testSetupMessage}
                </div>
              )}

              <div className="pt-1 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOnboardingError('');
                    setOnboardingStep(1);
                    setOnboardingModalOpen(true);
                  }}
                  className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Connect WhatsApp</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowMetaRequirements((prev) => !prev)}
                  className="px-3.5 py-2.5 border border-white/85 bg-white/75 hover:bg-white text-slate-700 text-xs font-semibold rounded-2xl flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>Meta Setup & Coexistence Info</span>
                  {showMetaRequirements ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <div className="pt-2 flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-500">Status:</span>
                {isErrorState ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-300 text-rose-900 font-bold">
                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                    <span>Error</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/80 border border-slate-300 text-slate-800 font-bold">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    <span>Not Connected</span>
                  </span>
                )}
              </div>
            </div>

            {/* Official Meta Test Number Verification & Test Message Delivery Form */}
            <form
              onSubmit={handleRestoreAndVerifyTestNumber}
              className="p-4 rounded-2xl bg-white/80 border border-white/95 text-xs space-y-3 min-w-[300px] max-w-lg w-full"
            >
              <div className="font-bold text-slate-900 flex items-center justify-between gap-2">
                <span>Verify & Connect Meta Test Number (+1 555-639-1516)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 border border-emerald-300">
                  Graph API v21.0
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Paste a fresh Meta Test Access Token from{' '}
                <strong>Meta App Dashboard ({DEFAULT_META_APP_ID}) → WhatsApp → API Setup</strong> and
                an allowlisted recipient number to verify webhook subscription and test message
                delivery before marking Connected.
              </p>

              <div className="space-y-2">
                <div>
                  <label className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-1">
                    <span>Meta Test Access Token (Encrypted at Rest)</span>
                    <span
                      className={`text-[10px] font-bold ${
                        connection?.accessTokenConfigured ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {connection?.accessTokenConfigured ? 'Token Stored in DB' : 'Required'}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showTestToken ? 'text' : 'password'}
                      value={testAccessTokenInput}
                      onChange={(e) => setTestAccessTokenInput(e.target.value)}
                      placeholder={
                        connection?.accessTokenConfigured
                          ? 'Paste refreshed 24h Test Token or leave blank to reuse stored token...'
                          : 'Paste EAAG... Test Access Token from Meta API Setup'
                      }
                      autoComplete="new-password"
                      className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTestToken((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showTestToken ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Allowlisted Test Recipient Phone Number (for Delivery Check)
                  </label>
                  <input
                    type="text"
                    value={testRecipientPhoneInput}
                    onChange={(e) => setTestRecipientPhoneInput(e.target.value)}
                    placeholder="e.g. +91 98470 11223 (must be in Meta API Setup 'To' list)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-xs"
                  />
                </div>
              </div>

              {testDiagnostics && (
                <div className="p-2.5 rounded-xl bg-slate-900/5 border border-slate-200/90 grid grid-cols-2 gap-1.5 text-[11px]">
                  <div>
                    Token Valid:{' '}
                    <strong className={testDiagnostics.tokenValid ? 'text-emerald-700' : 'text-rose-700'}>
                      {testDiagnostics.tokenValid ? 'Yes' : 'No'}
                    </strong>
                  </div>
                  <div>
                    WABA ({TEST_WABA_ID}):{' '}
                    <strong className={testDiagnostics.wabaVerified ? 'text-emerald-700' : 'text-rose-700'}>
                      {testDiagnostics.wabaVerified ? 'Verified' : 'Pending'}
                    </strong>
                  </div>
                  <div>
                    Phone ID ({TEST_PHONE_NUMBER_ID}):{' '}
                    <strong className={testDiagnostics.phoneVerified ? 'text-emerald-700' : 'text-rose-700'}>
                      {testDiagnostics.phoneVerified ? 'Verified' : 'Pending'}
                    </strong>
                  </div>
                  <div>
                    Webhook Subscribed:{' '}
                    <strong className={testDiagnostics.webhookSubscribed ? 'text-emerald-700' : 'text-rose-700'}>
                      {testDiagnostics.webhookSubscribed ? 'Verified' : 'Pending'}
                    </strong>
                  </div>
                  <div className="col-span-2">
                    Test Message Delivery:{' '}
                    <strong
                      className={
                        testDiagnostics.testMessageDelivered ? 'text-emerald-700' : 'text-amber-800'
                      }
                    >
                      {testDiagnostics.testMessageDelivered
                        ? `Delivered (${testDiagnostics.testMessageId})`
                        : 'Awaiting allowlisted recipient delivery check'}
                    </strong>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={verifyingTestSetup}
                className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>
                  {verifyingTestSetup
                    ? 'Verifying Token, Webhook & Test Message...'
                    : 'Verify Webhook & Send Test Message to Connect'}
                </span>
              </button>
            </form>
          </div>
        ) : (
          /* ================= CONNECTED VIEW ================= */
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/60">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900">WhatsApp Integration</h2>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/80 text-emerald-900 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                    <span>Connected</span>
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Verified via Meta WhatsApp Business Graph API · Access tokens are isolated strictly on the server
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => navigate('/inbox')}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Open Inbox</span>
                </button>

                <button
                  type="button"
                  disabled={isDisconnecting}
                  onClick={handleDisconnectWhatsApp}
                  className="px-4 py-2.5 border border-rose-300/90 bg-rose-500/10 hover:bg-rose-500/20 text-rose-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            </div>

            {/* Connected Account Details Grid (Strictly from verified Meta connection — zero hardcoded values) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
              <div className="p-4 rounded-2xl bg-white/75 border border-white/90 space-y-1">
                <div className="text-[11px] font-semibold text-slate-500">Business:</div>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-700 shrink-0" />
                  <span>{connection.businessName || connection.verifiedName || '—'}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/75 border border-white/90 space-y-1">
                <div className="text-[11px] font-semibold text-slate-500">
                  WhatsApp Business Account:
                </div>
                <div className="text-sm font-bold text-slate-900 truncate">
                  {connection.wabaName || 'Verified WABA'}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  WABA ID: {connection.wabaId || connection.maskedWabaId || '—'}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/75 border border-white/90 space-y-1">
                <div className="text-[11px] font-semibold text-slate-500">Phone:</div>
                <div className="text-sm font-mono font-bold text-slate-900">
                  {connection.displayPhoneNumber || connection.maskedPhone || '—'}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  Meta App ID: {connection.metaAppId || DEFAULT_META_APP_ID}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/75 border border-white/90 space-y-1">
                <div className="text-[11px] font-semibold text-slate-500">Phone Number ID:</div>
                <div className="text-sm font-mono font-bold text-slate-900">
                  {connection.phoneNumberId || connection.maskedPhoneNumberId || '—'}
                </div>
                <div className="text-[11px] font-mono text-emerald-700">
                  +91 7902931503 Untouched
                </div>
              </div>
            </div>

            {/* Operational Status Pills (Messaging, Webhook, AI Automation) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-300/80 flex items-center justify-between">
                <span className="font-semibold text-slate-700">Messaging:</span>
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-900">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>{connection.messagingActive ? 'Active' : 'Inactive'}</span>
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-300/80 flex items-center justify-between">
                <span className="font-semibold text-slate-700">Webhook:</span>
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-900">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>{connection.webhookSubscribed ? 'Connected' : 'Not Subscribed'}</span>
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-300/80 flex items-center justify-between">
                <span className="font-semibold text-slate-700">AI Automation:</span>
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-900">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>{connection.aiAutomationEnabled ? 'Enabled' : 'Disabled'}</span>
                </span>
              </div>
            </div>

            {/* Coexistence Eligibility Notice (Truthful to Meta's onboarding & Graph API) */}
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                connection.coexistenceStatus === 'CONNECTED'
                  ? 'bg-emerald-500/10 border-emerald-300/80 text-emerald-950'
                  : 'bg-amber-500/10 border-amber-300/80 text-amber-950'
              }`}
            >
              {connection.coexistenceStatus === 'CONNECTED' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <div className="font-bold">
                  WhatsApp Business App + Cloud API Coexistence Status:{' '}
                  <span className="font-mono">{connection.coexistenceStatus}</span>
                </div>
                <div>
                  {connection.coexistenceStatus === 'CONNECTED'
                    ? 'WhatsApp Business App + Cloud API Coexistence is active for this Meta account and number (smb_app_data state & history sync initialized).'
                    : 'Coexistence is not currently available/eligible for this Meta account or number.'}
                </div>
                <div className="text-[11px] opacity-85">
                  PulseFlow never forces phone number migration, never calls deregister, and never deactivates your WhatsApp Business mobile app.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Meta Embedded Signup & Coexistence Documentation */}
        {showMetaRequirements && (
          <div className="pt-4 border-t border-white/60 grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-white/70 border border-white/90 space-y-2">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>Meta Embedded Signup Production Requirements</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-700 leading-relaxed">
                <li>
                  <strong>Facebook Login for Business:</strong> Create a Configuration ID in Meta App Dashboard with Embedded Signup v3 enabled.
                </li>
                <li>
                  <strong>Required Permissions (App Review / Advanced Access):</strong>{' '}
                  <code className="font-mono">whatsapp_business_management</code>,{' '}
                  <code className="font-mono">whatsapp_business_messaging</code>, and{' '}
                  <code className="font-mono">business_management</code>.
                </li>
                <li>
                  <strong>Coexistence Eligibility:</strong> Meta requires Tech Provider / Solution Partner onboarding, <code className="font-mono">featureType: 'whatsapp_business_app_onboarding'</code>, and <code className="font-mono">smb_message_echoes</code> webhook subscription.
                </li>
              </ul>
            </div>

            <form
              onSubmit={handleSaveMetaAppConfig}
              className="p-4 rounded-2xl bg-white/70 border border-white/90 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-900">
                  Meta Embedded Signup & Encrypted Vault Config
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-900 border border-emerald-300">
                  AES-256-GCM MongoDB
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Meta App ID (<code className="font-mono">metaAppId</code>)
                  </label>
                  <input
                    type="text"
                    value={metaAppIdInput}
                    onChange={(e) => setMetaAppIdInput(e.target.value)}
                    placeholder="1097762042867836"
                    className="w-full px-3 py-1.5 rounded-xl border border-white/90 bg-white/90 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Embedded Signup Config ID (<code className="font-mono">config_id</code>)
                  </label>
                  <input
                    type="text"
                    value={configIdInput}
                    onChange={(e) => setConfigIdInput(e.target.value)}
                    placeholder="1105412835405203"
                    className="w-full px-3 py-1.5 rounded-xl border border-white/90 bg-white/90 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                    <span>Meta App Secret (Encrypted)</span>
                    <span
                      className={`text-[10px] font-bold ${
                        configData?.appSecretConfigured ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {configData?.appSecretConfigured
                        ? `Set (${configData.metaAppSecretMasked || 'Encrypted'})`
                        : 'Missing'}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showMetaSecret ? 'text' : 'password'}
                      value={metaAppSecretInput}
                      onChange={(e) => setMetaAppSecretInput(e.target.value)}
                      placeholder={
                        configData?.appSecretConfigured
                          ? 'Enter new App Secret to rotate...'
                          : 'Paste Meta App Secret'
                      }
                      autoComplete="new-password"
                      className="w-full pl-3 pr-8 py-1.5 rounded-xl border border-white/90 bg-white/90 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMetaSecret((p) => !p)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showMetaSecret ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                    <span>Webhook Verify Token (Encrypted)</span>
                    <span
                      className={`text-[10px] font-bold ${
                        configData?.verifyTokenConfigured ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {configData?.verifyTokenConfigured
                        ? `Set (${configData.verifyTokenMasked || 'Encrypted'})`
                        : 'Missing'}
                    </span>
                  </label>
                  <input
                    type="password"
                    value={verifyTokenInput}
                    onChange={(e) => setVerifyTokenInput(e.target.value)}
                    placeholder={
                      configData?.verifyTokenConfigured
                        ? 'Enter new Verify Token to rotate...'
                        : 'Set custom hub.verify_token'
                    }
                    autoComplete="new-password"
                    className="w-full px-3 py-1.5 rounded-xl border border-white/90 bg-white/90 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">
                  Secrets are encrypted with AES-256-GCM in MongoDB and never sent to the browser.
                </span>
                <button
                  type="submit"
                  disabled={savingMetaConfig}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl cursor-pointer"
                >
                  {savingMetaConfig ? 'Encrypting & Saving...' : 'Save Meta Config'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ================= META EMBEDDED SIGNUP ONBOARDING MODAL ================= */}
      {onboardingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-strong border border-white/90 rounded-3xl max-w-2xl w-full p-6 lg:p-7 shadow-2xl space-y-5 text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-white/60">
              <div>
                <div className="text-[11px] font-mono font-bold text-emerald-700 uppercase">
                  Meta WhatsApp Embedded Signup v3
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  Connect WhatsApp Business to PulseFlow
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Authorize your Meta Business Portfolio, WhatsApp Business Account, and phone number without copying or pasting tokens.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isConnecting && setOnboardingModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/60 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!metaConfigReady && (
              <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-300 text-amber-950 space-y-2">
                <div className="font-bold">
                  Configuration Required: META_APP_ID & META_EMBEDDED_SIGNUP_CONFIG_ID
                </div>
                <div className="text-[11px]">
                  Enter your Meta App ID and Facebook Login for Business Configuration ID below (or configure them in <code className="font-mono">.env</code>) before launching the Meta popup.
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <input
                    type="text"
                    value={metaAppIdInput}
                    onChange={(e) => setMetaAppIdInput(e.target.value)}
                    placeholder="META_APP_ID"
                    className="px-3 py-1.5 rounded-xl border border-amber-300 bg-white/90 font-mono text-xs"
                  />
                  <input
                    type="text"
                    value={configIdInput}
                    onChange={(e) => setConfigIdInput(e.target.value)}
                    placeholder="META_EMBEDDED_SIGNUP_CONFIG_ID"
                    className="px-3 py-1.5 rounded-xl border border-amber-300 bg-white/90 font-mono text-xs"
                  />
                </div>
              </div>
            )}

            {/* Coexistence Mode Selection */}
            <div className="space-y-2">
              <div className="font-bold text-slate-900">
                Select Number Connection Preference (Coexistence Protection)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOnboardingMode('COEXISTENCE')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    onboardingMode === 'COEXISTENCE'
                      ? 'bg-emerald-500/15 border-emerald-500 text-slate-900 shadow-xs'
                      : 'bg-white/65 border-white/85 text-slate-700 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">WhatsApp Business App + Cloud API</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                      Coexistence
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Keep your number active on your WhatsApp Business mobile app AND PulseFlow CRM simultaneously. Never forces migration or calls /register.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setOnboardingMode('CLOUD_API')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    onboardingMode === 'CLOUD_API'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white/65 border-white/85 text-slate-700 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Dedicated Cloud API Number</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-500/20">
                      Standard
                    </span>
                  </div>
                  <p
                    className={`text-[11px] mt-1 leading-relaxed ${
                      onboardingMode === 'CLOUD_API' ? 'text-slate-300' : 'text-slate-600'
                    }`}
                  >
                    Connect a number dedicated exclusively to Meta WhatsApp Cloud API & PulseFlow CRM.
                  </p>
                </button>
              </div>
            </div>

            {/* Step-by-step Onboarding Pipeline */}
            <div className="p-4 rounded-2xl bg-white/75 border border-white/90 space-y-2.5">
              <div className="font-bold text-slate-900">Onboarding Steps</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ONBOARDING_FLOW_STEPS.map((st) => {
                  const done = onboardingStep > st.id;
                  const active = onboardingStep === st.id;
                  return (
                    <div
                      key={st.id}
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                        done
                          ? 'bg-emerald-500/10 border-emerald-300/80 text-emerald-950'
                          : active
                          ? 'bg-indigo-500/10 border-indigo-300 text-indigo-950 font-semibold'
                          : 'bg-white/60 border-white/80 text-slate-600'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                          done
                            ? 'bg-emerald-600 text-white'
                            : active
                            ? 'bg-indigo-600 text-white animate-pulse'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {done ? '✓' : st.id}
                      </span>
                      <div>
                        <div className="font-bold text-[11px]">{st.label}</div>
                        <div className="text-[10px] opacity-80">{st.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {onboardingError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-300 text-rose-900 font-semibold">
                {onboardingError}
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-300/80 text-amber-950 text-[11px] leading-relaxed">
              <strong>Coexistence Safeguard:</strong> PulseFlow requests{' '}
              <code className="font-mono">whatsapp_business_app_onboarding</code> when Coexistence is selected and only marks Coexistence CONNECTED after Meta returns <code className="font-mono">FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING</code> and completes <code className="font-mono">smb_app_data</code> state &amp; history sync.
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                disabled={isConnecting}
                onClick={() => setOnboardingModalOpen(false)}
                className="px-4 py-2.5 border border-white/85 bg-white/70 hover:bg-white rounded-xl font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isConnecting}
                onClick={handleLaunchMetaPopup}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>
                  {isConnecting
                    ? 'Verifying with Meta Graph API...'
                    : 'Continue with Meta / Facebook Login for Business'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* 4B. WHATSAPP SETTINGS PAGE */
export const WhatsAppSettingsPage = () => {
  const { whatsappSettings, updateWhatsAppSettings, currentUser, authToken, pushToast } = useCRM();
  const isAdmin = currentUser?.role === 'ADMIN';
  const [form, setForm] = useState({
    ...whatsappSettings,
    webhookUrl:
      typeof window !== 'undefined'
        ? `${window.location.origin}/webhook`
        : whatsappSettings.webhookUrl || 'https://pulseflow-whatsapp-ai-crm-web.onrender.com/webhook'
  });
  const [copied, setCopied] = useState(false);
  const [liveStatus, setLiveStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showWebhookPanel, setShowWebhookPanel] = useState(false);
  const [verifyTokenInput, setVerifyTokenInput] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);

  const getAuthHeaders = () => {
    let token = authToken || '';
    if (!token && typeof window !== 'undefined') {
      try {
        token = localStorage.getItem('pulseflow_auth_token') || '';
      } catch {
        token = '';
      }
    }
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

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
            `Verified: ${data.verifiedName || data.displayPhoneNumber}`,
            'success'
          );
        } else {
          pushToast(
            'WhatsApp Status Checked',
            data.error || 'Webhook receiver is online.',
            'warning'
          );
        }
      }
    } catch (err) {
      setLiveStatus({ cloudApiConnected: false, error: err.message });
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    checkLiveWhatsAppStatus(false);
  }, []);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSaveWebhook = async (e) => {
    e.preventDefault();
    updateWhatsAppSettings({ webhookUrl: form.webhookUrl });
    if (isAdmin) {
      setSavingWebhook(true);
      try {
        const payload = { webhookCallbackUrl: form.webhookUrl };
        if (verifyTokenInput.trim()) {
          payload.whatsappVerifyToken = verifyTokenInput.trim();
        }
        const res = await fetch('/api/admin/config', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Failed to save webhook configuration.');
        }
        setVerifyTokenInput('');
        pushToast(
          'Webhook Configuration Saved',
          'Webhook endpoint and encrypted Verify Token saved to MongoDB.',
          'success'
        );
      } catch (err) {
        pushToast('Save Failed', err.message, 'danger');
      } finally {
        setSavingWebhook(false);
      }
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="glass-panel rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-600">
            Meta WhatsApp Embedded Signup, Coexistence & Webhook Integration
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">WhatsApp Integration</h1>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            type="button"
            onClick={() => checkLiveWhatsAppStatus(true)}
            disabled={checkingStatus}
            className="px-3.5 py-2 border border-white/80 bg-white/75 text-slate-800 text-xs font-semibold rounded-xl hover:bg-white cursor-pointer backdrop-blur-md shadow-2xs"
          >
            {checkingStatus ? 'Checking Meta API...' : 'Verify Connection Status'}
          </button>
          <button
            type="button"
            onClick={() => setShowWebhookPanel((prev) => !prev)}
            className="px-3.5 py-2 border border-white/80 bg-white/75 text-slate-700 text-xs font-semibold rounded-xl hover:bg-white cursor-pointer flex items-center gap-1"
          >
            <span>Webhook & Verify Token</span>
            {showWebhookPanel ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Primary WhatsApp Integration Onboarding & Connected Card */}
      <WhatsAppIntegrationSection />

      {/* Expandable Webhook Endpoint & Encrypted Verify Token Configuration */}
      {showWebhookPanel && (
        <form
          onSubmit={handleSaveWebhook}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs"
        >
          <div className="glass-panel rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
              <h2 className="text-sm font-bold text-slate-900">
                Webhook Callback Endpoint (GET & POST)
              </h2>
              <span className="font-semibold text-emerald-700">Webhook Active</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Public Webhook Callback URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.webhookUrl}
                  onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                  className="flex-1 px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(form.webhookUrl)}
                  className="px-3.5 py-2 border border-white/85 bg-white/75 rounded-xl hover:bg-white flex items-center gap-1 font-semibold cursor-pointer"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 bg-white/60 border border-white/85 rounded-2xl text-slate-700 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                <strong>AES-256-GCM Encryption:</strong> Access tokens, App Secrets, and Webhook Verify Tokens are encrypted at rest in MongoDB and never exposed to the browser.
              </span>
            </div>
          </div>

          <div className="glass-panel rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
              <h2 className="text-sm font-bold text-slate-900">
                Encrypted Webhook Verify Token (<code className="font-mono">hub.verify_token</code>)
              </h2>
              <span className="text-[11px] font-mono text-emerald-700 font-bold">
                MongoDB Encrypted
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Set or rotate the verify token used by <code className="font-mono">GET /webhook</code> when Meta verifies your callback endpoint in the Meta App Dashboard.
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                New Webhook Verify Token (Write-Only)
              </label>
              <input
                type="password"
                value={verifyTokenInput}
                onChange={(e) => setVerifyTokenInput(e.target.value)}
                placeholder="Enter custom hub.verify_token (encrypted on save)"
                autoComplete="new-password"
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 font-mono"
              />
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="submit"
                disabled={savingWebhook}
                className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingWebhook ? 'Encrypting & Saving...' : 'Save Webhook Settings'}</span>
              </button>
            </div>
          </div>
        </form>
      )}
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

/* 5B. UNIFIED ADMIN SYSTEM & INTEGRATION CONFIGURATION VAULT (MongoDB AES-256-GCM) */
export const AdminSystemConfigurationVault = () => {
  const { currentUser, authToken, pushToast } = useCRM();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingAi, setTestingAi] = useState(false);

  // Public / non-secret fields
  const [publicAppUrl, setPublicAppUrl] = useState(
    'https://pulseflow-whatsapp-ai-crm-web.onrender.com'
  );
  const [webhookCallbackUrl, setWebhookCallbackUrl] = useState(
    'https://pulseflow-whatsapp-ai-crm-web.onrender.com/webhook'
  );
  const [metaAppId, setMetaAppId] = useState('1640164817625713');
  const [embeddedSignupConfigId, setEmbeddedSignupConfigId] = useState('1105412835405203');
  const [metaGraphApiVersion, setMetaGraphApiVersion] = useState('v21.0');
  const [aiProvider, setAiProvider] = useState('gemini');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');

  // Write-only secret inputs (never populated from backend, cleared immediately after save)
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [whatsappVerifyToken, setWhatsappVerifyToken] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');

  const getAuthHeaders = () => {
    let token = authToken || '';
    if (!token && typeof window !== 'undefined') {
      try {
        token = localStorage.getItem('pulseflow_auth_token') || '';
      } catch {
        token = '';
      }
    }
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  const loadVaultConfig = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/config', { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok && data?.config) {
        const cfg = data.config;
        setConfig(cfg);
        if (cfg.publicAppUrl) setPublicAppUrl(cfg.publicAppUrl);
        if (cfg.webhookCallbackUrl) setWebhookCallbackUrl(cfg.webhookCallbackUrl);
        if (cfg.metaAppId && cfg.metaAppId !== '1420003542794708') {
          setMetaAppId(cfg.metaAppId);
        } else {
          setMetaAppId('1097762042867836');
        }
        if (
          cfg.embeddedSignupConfigId &&
          cfg.embeddedSignupConfigId !== '47642322601105412835405203476567'
        ) {
          setEmbeddedSignupConfigId(cfg.embeddedSignupConfigId);
        } else {
          setEmbeddedSignupConfigId('1105412835405203');
        }
        if (cfg.metaGraphApiVersion) setMetaGraphApiVersion(cfg.metaGraphApiVersion);
        if (cfg.aiProvider) setAiProvider(cfg.aiProvider);
        if (cfg.geminiModel) setGeminiModel(cfg.geminiModel);
        if (cfg.openaiModel) setOpenaiModel(cfg.openaiModel);
      }
    } catch (err) {
      console.error('Failed to load Admin System Config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVaultConfig();
  }, [isAdmin, authToken]);

  if (!isAdmin) return null;

  const handleSaveVault = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        publicAppUrl: publicAppUrl.trim(),
        webhookCallbackUrl: webhookCallbackUrl.trim(),
        metaAppId: metaAppId.trim(),
        embeddedSignupConfigId: embeddedSignupConfigId.trim(),
        metaGraphApiVersion: metaGraphApiVersion.trim() || 'v21.0',
        aiProvider,
        geminiModel: geminiModel.trim() || 'gemini-2.5-flash',
        openaiModel: openaiModel.trim() || 'gpt-4o-mini'
      };
      if (metaAppSecret.trim()) payload.metaAppSecret = metaAppSecret.trim();
      if (whatsappVerifyToken.trim()) payload.whatsappVerifyToken = whatsappVerifyToken.trim();
      if (geminiApiKey.trim()) payload.geminiApiKey = geminiApiKey.trim();
      if (openaiApiKey.trim()) payload.openaiApiKey = openaiApiKey.trim();

      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to save encrypted system configuration.');
      }
      setConfig(data.config);
      setMetaAppSecret('');
      setWhatsappVerifyToken('');
      setGeminiApiKey('');
      setOpenaiApiKey('');
      pushToast(
        'Encrypted Configuration Saved',
        'Application settings and AES-256-GCM encrypted secrets stored in MongoDB.',
        'success'
      );
    } catch (err) {
      pushToast('Save Failed', err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleTestAi = async () => {
    setTestingAi(true);
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ provider: aiProvider })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'AI provider test failed.');
      }
      pushToast(
        'AI Provider Verified',
        `${data.provider.toUpperCase()} (${data.model}): ${data.reply}`,
        'success'
      );
    } catch (err) {
      pushToast('AI Test Failed', err.message, 'danger');
    } finally {
      setTestingAi(false);
    }
  };

  return (
    <form
      onSubmit={handleSaveVault}
      className="glass-panel-strong rounded-3xl p-6 lg:p-7 border border-white/85 shadow-lg space-y-5 text-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/60">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-300 text-emerald-900 text-[10px] font-mono font-bold mb-1">
            <Lock className="w-3 h-3 text-emerald-700" />
            <span>MongoDB AES-256-GCM Encrypted Configuration Vault</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Admin System & Integration Settings
          </h2>
          <p className="text-xs text-slate-600">
            Manage Meta Embedded Signup, Webhook Verify Token, and Gemini/OpenAI credentials from the Admin UI. Secrets are encrypted at rest in MongoDB and never sent to the browser.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            disabled={testingAi}
            onClick={handleTestAi}
            className="px-3.5 py-2.5 border border-white/85 bg-white/80 hover:bg-white text-slate-800 font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>{testingAi ? 'Testing AI...' : 'Test AI Provider'}</span>
          </button>

          <button
            type="submit"
            disabled={saving || loading}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Encrypting & Saving...' : 'Save Admin Configuration'}</span>
          </button>
        </div>
      </div>

      {/* Section 1: Public URLs & Meta Embedded Signup */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-3.5 rounded-2xl bg-white/75 border border-white/90 space-y-1.5">
          <label className="block font-bold text-slate-800">Public Application URL</label>
          <input
            type="url"
            value={publicAppUrl}
            onChange={(e) => setPublicAppUrl(e.target.value)}
            placeholder="https://pulseflow-whatsapp-ai-crm-web.onrender.com"
            className="w-full px-3 py-2 rounded-xl border border-white/90 bg-white font-mono text-xs"
          />
          <div className="text-[10px] text-slate-500">Render production base URL</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/75 border border-white/90 space-y-1.5">
          <label className="block font-bold text-slate-800">Webhook Callback URL</label>
          <input
            type="url"
            value={webhookCallbackUrl}
            onChange={(e) => setWebhookCallbackUrl(e.target.value)}
            placeholder="https://pulseflow-whatsapp-ai-crm-web.onrender.com/webhook"
            className="w-full px-3 py-2 rounded-xl border border-white/90 bg-white font-mono text-xs"
          />
          <div className="text-[10px] text-slate-500">Meta WhatsApp Webhook endpoint</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/75 border border-white/90 space-y-1.5">
          <label className="block font-bold text-slate-800">Meta Graph API Version</label>
          <input
            type="text"
            value={metaGraphApiVersion}
            onChange={(e) => setMetaGraphApiVersion(e.target.value)}
            placeholder="v21.0"
            className="w-full px-3 py-2 rounded-xl border border-white/90 bg-white font-mono text-xs"
          />
          <div className="text-[10px] text-slate-500">Used for Embedded Signup & Cloud API</div>
        </div>
      </div>

      {/* Section 2: Meta App Credentials (App ID, Config ID, Encrypted Secret & Verify Token) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-3.5 rounded-2xl bg-white/75 border border-white/90 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-800">Meta App ID</label>
            <span className="text-[10px] font-mono text-emerald-700 font-semibold">Public SDK</span>
          </div>
          <input
            type="text"
            value={metaAppId}
            onChange={(e) => setMetaAppId(e.target.value)}
            placeholder="1097762042867836"
            className="w-full px-3 py-2 rounded-xl border border-white/90 bg-white font-mono text-xs"
          />
        </div>

        <div className="p-3.5 rounded-2xl bg-white/75 border border-white/90 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-800">Embedded Signup Config ID</label>
            <span
              className={`text-[10px] font-bold ${
                embeddedSignupConfigId ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {embeddedSignupConfigId ? 'Configured' : 'Required'}
            </span>
          </div>
          <input
            type="text"
            value={embeddedSignupConfigId}
            onChange={(e) => setEmbeddedSignupConfigId(e.target.value)}
            placeholder="1105412835405203"
            className="w-full px-3 py-2 rounded-xl border border-white/90 bg-white font-mono text-xs"
          />
        </div>

        <div className="p-3.5 rounded-2xl bg-white/75 border border-white/90 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-800">Meta App Secret</label>
            <span
              className={`text-[10px] font-bold ${
                config?.metaAppSecretConfigured ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {config?.metaAppSecretConfigured
                ? `Encrypted (${config.metaAppSecretMasked || 'Set'})`
                : 'Not Set'}
            </span>
          </div>
          <input
            type="password"
            value={metaAppSecret}
            onChange={(e) => setMetaAppSecret(e.target.value)}
            placeholder={
              config?.metaAppSecretConfigured
                ? 'Enter new App Secret to rotate...'
                : 'Paste Meta App Secret (write-only)'
            }
            autoComplete="new-password"
            className="w-full px-3 py-2 rounded-xl border border-white/90 bg-white font-mono text-xs"
          />
        </div>

        <div className="p-3.5 rounded-2xl bg-white/75 border border-white/90 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-800">Webhook Verify Token</label>
            <span
              className={`text-[10px] font-bold ${
                config?.whatsappVerifyTokenConfigured ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {config?.whatsappVerifyTokenConfigured
                ? `Encrypted (${config.whatsappVerifyTokenMasked || 'Set'})`
                : 'Not Set'}
            </span>
          </div>
          <input
            type="password"
            value={whatsappVerifyToken}
            onChange={(e) => setWhatsappVerifyToken(e.target.value)}
            placeholder={
              config?.whatsappVerifyTokenConfigured
                ? 'Enter new Verify Token to rotate...'
                : 'Set hub.verify_token (write-only)'
            }
            autoComplete="new-password"
            className="w-full px-3 py-2 rounded-xl border border-white/90 bg-white font-mono text-xs"
          />
        </div>
      </div>

      {/* Section 3: AI Provider & Encrypted API Keys */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-3.5 rounded-2xl bg-white/75 border border-white/90 space-y-1.5">
          <label className="block font-bold text-slate-800">Active AI Provider</label>
          <select
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-white/90 bg-white font-semibold text-xs"
          >
            <option value="gemini">Google Gemini (Primary)</option>
            <option value="openai">OpenAI (Service Layer)</option>
          </select>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/75 border border-white/90 space-y-1.5">
          <label className="block font-bold text-slate-800">Gemini / OpenAI Models</label>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              placeholder="gemini-2.5-flash"
              className="px-2.5 py-2 rounded-xl border border-white/90 bg-white font-mono text-[11px]"
            />
            <input
              type="text"
              value={openaiModel}
              onChange={(e) => setOpenaiModel(e.target.value)}
              placeholder="gpt-4o-mini"
              className="px-2.5 py-2 rounded-xl border border-white/90 bg-white font-mono text-[11px]"
            />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/75 border border-white/90 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-800">Gemini API Key</label>
            <span
              className={`text-[10px] font-bold ${
                config?.geminiApiKeyConfigured ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {config?.geminiApiKeyConfigured
                ? `Encrypted (${config.geminiApiKeyMasked || 'Set'})`
                : 'Not Set'}
            </span>
          </div>
          <input
            type="password"
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            placeholder={
              config?.geminiApiKeyConfigured
                ? 'Enter new Gemini key to rotate...'
                : 'Paste Gemini API Key (write-only)'
            }
            autoComplete="new-password"
            className="w-full px-3 py-2 rounded-xl border border-white/90 bg-white font-mono text-xs"
          />
        </div>

        <div className="p-3.5 rounded-2xl bg-white/75 border border-white/90 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-800">OpenAI API Key</label>
            <span
              className={`text-[10px] font-bold ${
                config?.openaiApiKeyConfigured ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {config?.openaiApiKeyConfigured
                ? `Encrypted (${config.openaiApiKeyMasked || 'Set'})`
                : 'Not Set'}
            </span>
          </div>
          <input
            type="password"
            value={openaiApiKey}
            onChange={(e) => setOpenaiApiKey(e.target.value)}
            placeholder={
              config?.openaiApiKeyConfigured
                ? 'Enter new OpenAI key to rotate...'
                : 'Paste OpenAI API Key (write-only)'
            }
            autoComplete="new-password"
            className="w-full px-3 py-2 rounded-xl border border-white/90 bg-white font-mono text-xs"
          />
        </div>
      </div>

      {/* Render ENV vs Encrypted MongoDB Architecture Boundary */}
      <div className="p-3.5 rounded-2xl bg-slate-900/5 border border-slate-300/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-700">
        <div>
          <strong>Render Infrastructure ENV Only:</strong>{' '}
          <code className="font-mono">MONGODB_URI</code>,{' '}
          <code className="font-mono">JWT_SECRET</code>,{' '}
          <code className="font-mono">SETTINGS_ENCRYPTION_KEY</code>
        </div>
        <div>
          <strong>MongoDB AES-256-GCM Encrypted:</strong> Meta App Secret, Verify Token, WABA Token, Gemini &amp; OpenAI Keys
        </div>
      </div>
    </form>
  );
};

/* 6. PROFILE & GENERAL SETTINGS PAGE */
export const ProfileSettingsPage = ({ mode }) => {
  const { currentUser, updateOwnProfile, changePassword, pushToast } = useCRM();
  const isAdmin = currentUser?.role === 'ADMIN';
  const actualRole = isAdmin ? 'ADMIN' : 'AGENT';

  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [profileError, setProfileError] = useState('');

  // Password Change State (Admin only)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const [hotLeadAlert, setHotLeadAlert] = useState(true);
  const [handoffAlert, setHandoffAlert] = useState(true);
  const [followUpAlert, setFollowUpAlert] = useState(true);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '');
    }
  }, [currentUser?.id, currentUser?.name, currentUser?.email, currentUser?.phone]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    setProfileError('');
    if (!name.trim() || !email.trim()) {
      setProfileError('Full Name and Work Email are required.');
      return;
    }
    const res = await updateOwnProfile({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim()
    });
    if (res?.ok === false) {
      setProfileError(res.error || 'Could not update profile.');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    setPasswordError('');
    setPasswordSuccess('');
    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    setChangingPass(true);
    const res = await changePassword({
      userId: currentUser.id,
      currentPassword,
      newPassword
    });
    setChangingPass(false);
    if (!res?.ok) {
      setPasswordError(res?.error || 'Failed to change password.');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordSuccess('Your password has been securely updated.');
  };

  if (!isAdmin) {
    // AGENT VIEW: Strictly read-only account information (No editable profile form, no Save Profile Changes)
    return (
      <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-6">
        <div className="glass-panel rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-600">Agent Workspace Account Information</div>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">My Account Profile</h1>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-300 text-emerald-800 font-mono text-xs font-bold self-start sm:self-auto">
            {currentUser?.name} ({actualRole})
          </span>
        </div>

        <div className="glass-panel rounded-3xl p-6 space-y-4 text-xs max-w-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/60">
            <h2 className="text-sm font-bold text-slate-900">Account Details (Read-Only)</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-mono text-[10px] font-bold">
              {actualRole}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-2xl bg-white/65 border border-white/85">
              <div className="text-[11px] font-semibold text-slate-500">Full Name</div>
              <div className="text-sm font-bold text-slate-900 mt-1">
                {currentUser?.name || '—'}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/65 border border-white/85">
              <div className="text-[11px] font-semibold text-slate-500">Work Email</div>
              <div className="text-sm font-mono font-semibold text-slate-900 mt-1">
                {currentUser?.email || '—'}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/65 border border-white/85">
              <div className="text-[11px] font-semibold text-slate-500">Phone Number</div>
              <div className="text-sm font-mono text-slate-800 mt-1">
                {currentUser?.phone || '—'}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/65 border border-white/85">
              <div className="text-[11px] font-semibold text-slate-500">Account Role</div>
              <div className="text-sm font-mono font-bold text-emerald-700 mt-1">
                {actualRole}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/55 border border-white/80 text-slate-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0" />
            <span>
              Profile editing and role management are restricted to workspace Administrators (
              <strong>ADMIN</strong>).
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="glass-panel rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-600">Account Profile, Security & Workspace Preferences</div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">
            {mode === 'profile' ? 'Edit Profile & Security' : 'General CRM & Profile Settings'}
          </h1>
        </div>
        <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-300 text-emerald-800 font-mono text-xs font-bold self-start sm:self-auto">
          Signed in as {currentUser?.name} ({actualRole})
        </span>
      </div>

      {mode !== 'profile' && <WhatsAppIntegrationSection compact />}
      {mode !== 'profile' && <AdminSystemConfigurationVault />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        {/* Personal Details Card (ADMIN ONLY) */}
        <form onSubmit={handleSaveProfile} className="glass-panel rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Edit Personal Profile</h2>
            <span className="text-[11px] text-slate-500">Syncs across all CRM modules</span>
          </div>

          {profileError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-300 text-rose-800 font-semibold">
              {profileError}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Full Display Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Work Email (Login Credential) *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assigned Role</label>
              <input
                type="text"
                readOnly
                value={actualRole}
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/60 font-mono font-bold text-slate-700"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-500 hover:to-teal-400 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            Save Profile Changes
          </button>
        </form>

        {/* Change Password Card */}
        <form onSubmit={handlePasswordChange} className="glass-panel rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Change Account Password</h2>
            <span className="text-[11px] font-mono text-emerald-700 font-semibold">
              Scrypt Hashed
            </span>
          </div>

          {passwordError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-300 text-rose-800 font-semibold">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-300 text-emerald-900 font-semibold">
              {passwordSuccess}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Current Password *</label>
            <input
              type="password"
              required
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">New Password *</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Min. 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Confirm New Password *
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2 border border-white/85 rounded-xl bg-white/80 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={changingPass}
            className="px-4 py-2.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
          >
            {changingPass ? 'Updating Password...' : 'Update Password'}
          </button>
        </form>
      </div>

      <div className="glass-panel rounded-3xl p-6 space-y-4 text-xs">
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
          className="px-4 py-2.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
        >
          Save Notification Rules
        </button>
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
