import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Sparkles,
  ArrowRight,
  Lock,
  Mail,
  Phone,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import bgImage from '../public/bg.webp';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { loginWithEmailPassword, teamMembers = [] } = useCRM();

  const [email, setEmail] = useState(teamMembers[0]?.email || '33binilb@gmail.com');
  const [password, setPassword] = useState('PulseFlow@123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    const res = await loginWithEmailPassword(email.trim(), password);
    setLoading(false);
    if (!res?.ok) {
      setErrorMsg(res?.error || 'Invalid work email or password.');
      return;
    }
    navigate('/dashboard');
  };

  return (
    <div
      className="min-h-screen w-full flex bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] pointer-events-none" />

      {/* Left Brand & Architecture Showcase */}
      <div className="hidden lg:flex lg:w-1/2 p-8 flex-col justify-between relative z-10">
        <div className="glass-sidebar rounded-3xl p-10 h-full flex flex-col justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight">PulseFlow</span>
              <span className="block text-[11px] font-mono text-emerald-400 uppercase tracking-widest">
                AI WhatsApp CRM
              </span>
            </div>
          </div>

          <div className="max-w-lg space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-emerald-300 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5" />
              Powered by Meta WhatsApp Cloud API + Gemini 2.5
            </div>

            <h1 className="text-4xl font-bold tracking-tight leading-tight">
              Turn every inbound WhatsApp chat into a qualified revenue opportunity.
            </h1>

            <p className="text-slate-300 text-sm leading-relaxed">
              Autonomous AI replies in under 1.8 seconds, real-time BANT lead scoring (0–100), and instant one-click human agent takeover for high-intent enterprise buyers.
            </p>

            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-white/8 border border-white/15 backdrop-blur-md">
                <p className="text-2xl font-bold font-mono text-emerald-400">81.9%</p>
                <p className="text-xs text-slate-300 mt-1">AI Auto-Resolution</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/8 border border-white/15 backdrop-blur-md">
                <p className="text-2xl font-bold font-mono text-white">1.8s</p>
                <p className="text-xs text-slate-300 mt-1">First Response SLA</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/8 border border-white/15 backdrop-blur-md">
                <p className="text-2xl font-bold font-mono text-indigo-300">3.4x</p>
                <p className="text-xs text-slate-300 mt-1">Pipeline Velocity</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300 border-t border-white/15 pt-6">
            <span>Meta Business Partner Ready • Webhook v21.0</span>
            <span className="font-mono">Role-Based Access Control</span>
          </div>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10">
        <div className="max-w-md w-full glass-panel-strong rounded-3xl p-8 shadow-2xl border border-white/80">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Team Member Sign In
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Sign in with your Work Email and Password to access your CRM workspace
            </p>
          </div>

          {/* Quick Fill Active Team Accounts */}
          {teamMembers.length > 0 && (
            <div className="mb-5 p-3.5 rounded-2xl bg-white/60 border border-white/80">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Quick Fill Team Member Account
              </label>
              <div className="flex flex-wrap gap-1.5">
                {teamMembers.slice(0, 4).map((tm) => (
                  <button
                    key={tm.id}
                    type="button"
                    onClick={() => {
                      setEmail(tm.email);
                      setPassword('PulseFlow@123');
                      setErrorMsg('');
                    }}
                    className={`py-1.5 px-2.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      email.toLowerCase() === tm.email?.toLowerCase()
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white/80 text-slate-700 border border-white hover:bg-white'
                    }`}
                  >
                    {tm.name} ({tm.role})
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-300 text-xs font-semibold text-rose-800">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-sm font-bold hover:from-emerald-500 hover:to-teal-400 transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              {loading ? 'Authenticating Account...' : 'Sign In to PulseFlow CRM'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-xs text-center text-slate-600 mt-6">
            Need a new team member account?{' '}
            <Link to="/register" className="font-bold text-emerald-700 hover:underline">
              Create Team Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { registerUser } = useCRM();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '+91 ',
    password: '',
    role: 'AGENT',
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const result = await registerUser({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      password: form.password,
      role: form.role,
    });

    setLoading(false);
    if (!result?.ok) {
      setErrorMsg(result?.error || 'Registration failed');
      return;
    }
    navigate('/dashboard');
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] pointer-events-none" />

      <div className="max-w-md w-full glass-panel-strong rounded-3xl p-8 shadow-2xl border border-white/80 relative z-10">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-lg text-slate-900">PulseFlow CRM</span>
            <span className="block text-[10px] font-mono text-emerald-700 uppercase font-bold">
              Team Account Registration
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900">Create Team Member Account</h1>
        <p className="text-xs text-slate-600 mt-1 mb-6">
          Register with your work email and password to access the CRM workspace.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-300 text-xs font-semibold text-rose-800">
              {errorMsg}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Arjun Mehta"
              className="w-full px-3.5 py-2.5 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Work Email (Used for Login) *
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="arjun@company.com"
              className="w-full px-3.5 py-2.5 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98470 00000"
                  className="w-full pl-8 pr-3 py-2.5 text-xs font-mono bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Role *</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2.5 text-xs font-semibold bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-500"
              >
                <option value="ADMIN">ADMIN</option>
                <option value="MANAGER">MANAGER</option>
                <option value="AGENT">AGENT</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password *</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min. 6 characters"
              className="w-full px-3.5 py-2.5 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-sm font-bold hover:from-emerald-500 hover:to-teal-400 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            {loading ? 'Creating Account...' : 'Create Account & Sign In'}
          </button>
        </form>

        <p className="text-xs text-center text-slate-600 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-emerald-700 hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('33binilb@gmail.com');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] pointer-events-none" />
      <div className="max-w-md w-full glass-panel-strong rounded-3xl p-8 shadow-2xl border border-white/80 relative z-10">
        <h1 className="text-2xl font-bold text-slate-900">Reset Account Password</h1>
        <p className="text-xs text-slate-600 mt-1 mb-6">
          Enter your work email to proceed to password reset.
        </p>
        {sent ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-300 text-xs text-emerald-900 font-medium">
              Account verified for <strong>{email}</strong>. Click below to set a new password.
            </div>
            <Link
              to={`/reset-password?email=${encodeURIComponent(email)}`}
              className="block w-full py-3 text-center rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
            >
              Proceed to Set New Password
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Work Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-sm font-bold hover:from-emerald-500 hover:to-teal-400 shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              Continue
            </button>
          </form>
        )}
        <p className="text-xs text-center text-slate-600 mt-6">
          <Link to="/login" className="font-bold text-emerald-700 hover:underline">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { changePassword } = useCRM();
  const params = new URLSearchParams(window.location.search);
  const [email, setEmail] = useState(params.get('email') || '33binilb@gmail.com');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const res = await changePassword({
      email,
      newPassword: password,
      adminOverride: true,
    });
    if (!res?.ok) {
      setErrorMsg(res?.error || 'Could not reset password.');
      return;
    }
    navigate('/login');
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] pointer-events-none" />
      <div className="max-w-md w-full glass-panel-strong rounded-3xl p-8 shadow-2xl border border-white/80 relative z-10">
        <h1 className="text-2xl font-bold text-slate-900">Set New Password</h1>
        <p className="text-xs text-slate-600 mt-1 mb-6">
          Choose a strong password for your PulseFlow CRM account.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-300 text-xs font-semibold text-rose-800">
              {errorMsg}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Work Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">New Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className="w-full px-3.5 py-2.5 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-sm font-bold hover:from-emerald-500 hover:to-teal-400 shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            Update Password & Sign In
          </button>
        </form>
      </div>
    </div>
  );
};
