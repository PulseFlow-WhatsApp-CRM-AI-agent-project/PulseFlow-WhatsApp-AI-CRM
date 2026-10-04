import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  MessageSquare,
  MessagesSquare,
  Target,
  Users,
  CalendarClock,
  BarChart3,
  UserCog,
  Bot,
  BookOpen,
  Smartphone,
  Building2,
  UserCircle,
  Settings,
  Bell,
  Menu,
  X,
  LogOut,
  FileCode2,
  Check,
  Sparkles,
  Search,
  ArrowUpRight,
  ArrowRight,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  UserCheck
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import bgImage from '../public/bg.webp';

export const CRMWorkspaceLayout = ({ children }) => {
  const {
    currentUser,
    logout,
    conversations,
    leads,
    contacts,
    followUps,
    knowledgeGaps,
    strategicFindings,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    hotLeadAlerts,
    hotLeadOverlayOpen,
    setHotLeadOverlayOpen,
    acknowledgeHotLeads,
    takeOverConversation,
    startOrOpenConversation,
    aiSettings,
    toasts,
    dismissToast
  } = useCRM();

  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [aiSectionOpen, setAiSectionOpen] = useState(true);
  const [quickQuery, setQuickQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const totalConversationsCount = conversations.length;
  const unreadChatsCount = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const handoffCount = conversations.filter(
    (c) => c.needsHumanAttention || c.humanAttentionRecommended
  ).length;
  const hotLeadsCount = leads.filter(
    (l) => l.leadType === 'HOT' || Number(l.leadScore) >= 81
  ).length;
  const pendingFollowUpsCount = followUps.filter(
    (f) => f.status === 'PENDING' || f.status === 'OVERDUE'
  ).length;
  const unreadNotifsCount = notifications.filter((n) => !n.isRead).length;

  const isAdmin = currentUser?.role === 'ADMIN';
  const actualRole = isAdmin ? 'ADMIN' : 'AGENT';

  const userInitials = (currentUser?.name || 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const primaryNavItems = [
    {
      label: 'Home',
      path: '/dashboard',
      icon: Home,
      roles: ['ADMIN', 'AGENT']
    },
    {
      label: 'WhatsApp Inbox',
      path: '/inbox',
      icon: MessageSquare,
      isWhatsApp: true,
      badge: unreadChatsCount > 0 ? unreadChatsCount : totalConversationsCount,
      badgeDark: true,
      alert: handoffCount > 0,
      roles: ['ADMIN', 'AGENT']
    },
    {
      label: 'What AI Knows',
      path: '/insights',
      icon: Sparkles,
      roles: ['ADMIN', 'AGENT']
    },
    {
      label: 'Sales Leads',
      path: '/leads',
      icon: Target,
      badge: hotLeadsCount > 0 ? hotLeadsCount : leads.length,
      roles: ['ADMIN', 'AGENT']
    },
    {
      label: 'Follow-up Tasks',
      path: '/follow-ups',
      icon: CalendarClock,
      badge: pendingFollowUpsCount > 0 ? pendingFollowUpsCount : undefined,
      roles: ['ADMIN', 'AGENT']
    },
    {
      label: 'Contacts',
      path: '/contacts',
      icon: Users,
      roles: ['ADMIN', 'AGENT']
    },
    {
      label: 'Analytics',
      path: '/analytics',
      icon: BarChart3,
      roles: ['ADMIN', 'AGENT']
    },
    {
      label: 'Team Members',
      path: '/team',
      icon: UserCog,
      roles: ['ADMIN']
    }
  ];

  const aiAutomationNavItems = [
    {
      label: 'AI Knowledge Base',
      path: '/knowledge-base',
      icon: BookOpen,
      roles: ['ADMIN', 'AGENT']
    },
    {
      label: 'AI Reply Settings',
      path: '/ai-settings',
      icon: Bot,
      roles: ['ADMIN']
    },
    {
      label: 'All Conversations',
      path: '/conversations',
      icon: MessagesSquare,
      roles: ['ADMIN', 'AGENT']
    },
    {
      label: 'Reports & Charts',
      path: '/analytics',
      icon: BarChart3,
      roles: ['ADMIN', 'AGENT']
    },
    {
      label: 'WhatsApp Connection',
      path: '/whatsapp-settings',
      icon: Smartphone,
      roles: ['ADMIN']
    },
    {
      label: 'System Settings',
      path: '/settings',
      icon: Settings,
      roles: ['ADMIN']
    },
    {
      label: 'Company Profile',
      path: '/company-settings',
      icon: Building2,
      roles: ['ADMIN']
    },
    {
      label: 'System Blueprint',
      path: '/architecture',
      icon: FileCode2,
      roles: ['ADMIN']
    }
  ];

  const isPathActive = (path) => {
    if (path === '/leads' && location.pathname.startsWith('/leads')) return true;
    if (path === '/contacts' && location.pathname.startsWith('/contacts')) return true;
    return location.pathname === path;
  };

  const quickSearchResults = useMemo(() => {
    const q = quickQuery.toLowerCase().trim();
    if (!q) {
      return {
        leads: leads.slice(0, 3),
        findings: strategicFindings.slice(0, 3)
      };
    }
    return {
      leads: leads.filter((l) => {
        const c = contacts.find((cnt) => cnt.id === l.contactId);
        return (
          c?.name?.toLowerCase().includes(q) ||
          c?.company?.toLowerCase().includes(q) ||
          l.interestedService?.toLowerCase().includes(q) ||
          l.aiSummary?.toLowerCase().includes(q) ||
          (l.buyingSignals || []).some((s) => s.toLowerCase().includes(q))
        );
      }),
      findings: strategicFindings.filter(
        (f) =>
          f.title?.toLowerCase().includes(q) ||
          f.findingSummary?.toLowerCase().includes(q) ||
          f.recommendation?.toLowerCase().includes(q)
      )
    };
  }, [quickQuery, leads, contacts, strategicFindings]);

  const roleLabel = actualRole;

  return (
    <div
      className="h-screen w-screen overflow-hidden text-slate-900 flex flex-col relative select-none sm:select-auto bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Subtle Ambient Glass Scrim over Background Image */}
      <div className="absolute inset-0 bg-white/25 backdrop-blur-[4px] pointer-events-none z-0" />

      {/* TOP FLOATING HEADER BAR */}
      <header className="relative z-30 px-4 lg:px-6 pt-3 pb-2 flex items-center justify-between gap-4 shrink-0">
        {/* Left: Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden p-2 rounded-xl bg-white/80 border border-white/90 text-slate-700 hover:text-slate-900 shadow-xs cursor-pointer"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 group whitespace-nowrap"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center shadow-sm border border-white/60">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
                <path d="M6 4h7a5 5 0 0 1 0 10H9v6H6V4zm3 3v4h4a2 2 0 1 0 0-4H9z" />
              </svg>
            </div>
            <span className="text-[17px] font-bold tracking-tight text-slate-900">
              PulseFlow CRM
            </span>
          </Link>
        </div>

        {/* Center: Pill Search Bar with ⌘K */}
        <div className="flex-1 max-w-xl mx-auto hidden md:block">
          <button
            type="button"
            onClick={() => setQuickSearchOpen(true)}
            className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-full bg-white/75 hover:bg-white/90 backdrop-blur-xl border border-white/90 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)] text-xs text-slate-500 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5 truncate">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">Search customers, messages, leads...</span>
            </div>
            <kbd className="px-2 py-0.5 text-[11px] font-mono font-medium text-slate-500 bg-slate-200/60 rounded-md shrink-0">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right: AI Status Pill, Hot Lead Alert, Notifications, User Profile Pill */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setQuickSearchOpen(true)}
            className="md:hidden p-2.5 rounded-full bg-white/80 border border-white/90 text-slate-700 shadow-xs cursor-pointer"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* AI Active Status Pill */}
          {isAdmin ? (
            <Link
              to="/ai-settings"
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/75 hover:bg-white/95 backdrop-blur-xl border border-white/90 shadow-xs text-xs font-semibold text-slate-800 transition-all whitespace-nowrap"
              title="Configure AI Auto-Reply Engine"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  aiSettings?.aiEnabled !== false
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                    : 'bg-amber-500'
                }`}
              />
              <span>{aiSettings?.aiEnabled !== false ? 'AI Active' : 'AI Paused'}</span>
            </Link>
          ) : (
            <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/75 backdrop-blur-xl border border-white/90 shadow-xs text-xs font-semibold text-slate-800 whitespace-nowrap">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  aiSettings?.aiEnabled !== false
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                    : 'bg-amber-500'
                }`}
              />
              <span>{aiSettings?.aiEnabled !== false ? 'AI Active' : 'AI Paused'}</span>
            </div>
          )}

          {/* Hot Lead Notification Pill when unacknowledged hot leads exist */}
          {hotLeadAlerts.length > 0 && (
            <button
              type="button"
              onClick={() => setHotLeadOverlayOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50/90 hover:bg-rose-100 border border-rose-200/90 rounded-full shadow-xs transition-all cursor-pointer whitespace-nowrap animate-pulse"
              title="Unacknowledged Hot Lead Alert — Click to open"
            >
              <span>
                🔥 {hotLeadAlerts.length} Hot {hotLeadAlerts.length === 1 ? 'Lead' : 'Leads'}
              </span>
            </button>
          )}

          {/* Notification Bell Circle */}
          <div className="relative">
            <button
              onClick={() => {
                setNotifOpen((prev) => !prev);
                setProfileMenuOpen(false);
              }}
              className="w-10 h-10 rounded-full bg-white/75 hover:bg-white/95 backdrop-blur-xl border border-white/90 shadow-xs flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all relative cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white font-mono text-[10px] font-bold flex items-center justify-center shadow-xs">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white/95 backdrop-blur-2xl border border-white rounded-2xl shadow-2xl z-50 p-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
                  <span className="text-xs font-bold text-slate-900">
                    Notifications ({unreadNotifsCount} unread)
                  </span>
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto mt-2">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          markNotificationRead(n.id);
                          setNotifOpen(false);
                          navigate(n.linkTo);
                        }}
                        className={`py-2.5 px-3 cursor-pointer rounded-xl hover:bg-slate-100/70 transition-colors ${
                          !n.isRead ? 'bg-emerald-50/50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span
                            className={`font-semibold ${
                              n.type === 'HUMAN_ATTENTION' || n.type === 'AI_ESCALATION'
                                ? 'text-rose-700'
                                : n.type === 'HOT_LEAD'
                                ? 'text-emerald-700'
                                : 'text-slate-800'
                            }`}
                          >
                            {n.title}
                          </span>
                          <span className="font-mono tabular-nums">{n.createdAt}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-snug">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Pill Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen((prev) => !prev);
                setNotifOpen(false);
              }}
              className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-full bg-white/75 hover:bg-white/95 backdrop-blur-xl border border-white/90 shadow-xs transition-all cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                {userInitials}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-xs font-bold text-slate-900 truncate max-w-[110px]">
                  {currentUser?.name}
                </div>
                <div className="text-[10px] font-mono font-bold text-slate-500">{roleLabel}</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
            </button>

            {profileMenuOpen && (
              <div className="absolute right-0 mt-2.5 w-64 bg-white/95 backdrop-blur-2xl border border-white rounded-2xl shadow-2xl z-50 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/70">
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-slate-900 truncate">{currentUser?.name}</div>
                    <div className="text-[11px] text-slate-500 truncate font-mono">{currentUser?.email}</div>
                    {currentUser?.phone && (
                      <div className="text-[10px] text-slate-400 font-mono">{currentUser.phone}</div>
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold shrink-0">
                    {actualRole}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <Link
                    to="/profile"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 font-medium"
                  >
                    <UserCircle className="w-3.5 h-3.5 text-slate-500" />
                    <span>{isAdmin ? 'Edit Profile & Password' : 'My Account Profile'}</span>
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/team"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 font-medium"
                    >
                      <UserCog className="w-3.5 h-3.5 text-slate-500" />
                      <span>Team Members</span>
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setHelpModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 font-medium cursor-pointer text-left"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>How PulseFlow Works</span>
                  </button>
                  <Link
                    to="/login"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      logout();
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN FLOATING WORKSPACE CONTAINER */}
      <div className="relative z-10 flex-1 flex gap-3.5 px-4 lg:px-6 pb-4 min-h-0 overflow-hidden">
        {/* Mobile Sidebar Backdrop */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 lg:hidden"
          />
        )}

        {/* LEFT FLOATING GLASS SIDEBAR */}
        <aside
          className={`${
            mobileMenuOpen
              ? 'fixed inset-y-3 left-3 z-50 w-64 shadow-2xl'
              : 'hidden'
          } lg:static lg:flex lg:w-60 xl:w-64 glass-panel rounded-[26px] shrink-0 flex-col justify-between p-3.5 h-full min-h-0 overflow-y-auto overscroll-contain`}
        >
          <div className="space-y-4">
            {/* Primary Navigation Links */}
            <nav className="space-y-1">
              {primaryNavItems.map((item) => {
                const allowed = !item.roles || item.roles.includes(actualRole);
                if (!allowed) return null;
                const Icon = item.icon;
                const active = isPathActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-[13px] transition-all ${
                      active
                        ? 'bg-white/95 text-slate-900 font-bold shadow-[0_4px_14px_-2px_rgba(15,23,42,0.08)] border border-white'
                        : 'text-slate-700 hover:bg-white/60 hover:text-slate-900 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.isWhatsApp ? (
                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <MessageSquare className="w-3 h-3 fill-current" />
                        </span>
                      ) : (
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            active ? 'text-slate-900' : 'text-slate-500'
                          }`}
                        />
                      )}
                      <span className="truncate">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {item.alert && (
                        <span
                          className="w-2 h-2 rounded-full bg-rose-500"
                          title="Customer waiting for human reply"
                        />
                      )}
                      {item.badge !== undefined && (
                        <span
                          className={`min-w-[22px] h-[22px] px-1.5 rounded-full font-mono text-[11px] font-bold flex items-center justify-center tabular-nums ${
                            item.badgeDark || active
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-200/80 text-slate-700'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </nav>

            {/* AI & AUTOMATION SECTION */}
            <div className="pt-3 border-t border-slate-300/50">
              <button
                type="button"
                onClick={() => setAiSectionOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-500 hover:text-slate-800 uppercase cursor-pointer"
              >
                <span>AI & AUTOMATION</span>
                {aiSectionOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {aiSectionOpen && (
                <div className="space-y-1 mt-1">
                  {aiAutomationNavItems.map((item) => {
                    const allowed = !item.roles || item.roles.includes(actualRole);
                    if (!allowed) return null;
                    const Icon = item.icon;
                    const active =
                      location.pathname === item.path &&
                      !(item.label === 'Reports & Charts' && location.pathname === '/analytics');
                    return (
                      <Link
                        key={`${item.label}-${item.path}`}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3.5 py-2 rounded-2xl text-[13px] transition-all ${
                          active
                            ? 'bg-white/95 text-slate-900 font-bold shadow-xs border border-white'
                            : 'text-slate-700 hover:bg-white/60 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            active ? 'text-slate-900' : 'text-slate-500'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* BOTTOM SIDEBAR AI ASSISTANT CARD (MATCHING REFERENCE IMAGE) */}
          <div className="pt-3 mt-4">
            <div className="relative overflow-hidden rounded-[22px] bg-white/85 border border-white p-3.5 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5 z-10">
                  <div className="text-[13px] font-bold text-slate-900">AI Assistant</div>
                  <div className="text-[11px] text-slate-500">Always ready to help</div>
                  <div className="inline-flex items-center gap-1.5 pt-1 text-[11px] font-semibold text-emerald-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                    <span>{aiSettings?.aiEnabled !== false ? 'Online' : 'Standby'}</span>
                  </div>
                </div>

                {/* Friendly 3D-style Robot Mascot SVG */}
                <div className="w-14 h-14 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 80 80" className="w-14 h-14 drop-shadow-md">
                    <defs>
                      <linearGradient id="botBody" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="60%" stopColor="#e2e8f0" />
                        <stop offset="100%" stopColor="#94a3b8" />
                      </linearGradient>
                      <linearGradient id="botScreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1e293b" />
                        <stop offset="100%" stopColor="#0f172a" />
                      </linearGradient>
                    </defs>
                    {/* Antenna */}
                    <line x1="40" y1="8" x2="40" y2="18" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="40" cy="7" r="4" fill="#38bdf8" />
                    {/* Head */}
                    <rect x="16" y="16" width="48" height="36" rx="18" fill="url(#botBody)" stroke="#cbd5e1" strokeWidth="1.5" />
                    {/* Visor */}
                    <rect x="22" y="23" width="36" height="20" rx="10" fill="url(#botScreen)" />
                    {/* Glowing Cyan Eyes */}
                    <circle cx="32" cy="33" r="4" fill="#38bdf8" />
                    <circle cx="48" cy="33" r="4" fill="#38bdf8" />
                    <circle cx="33" cy="31.5" r="1.2" fill="#ffffff" />
                    <circle cx="49" cy="31.5" r="1.2" fill="#ffffff" />
                    {/* Body */}
                    <rect x="24" y="53" width="32" height="20" rx="10" fill="url(#botBody)" stroke="#cbd5e1" strokeWidth="1.5" />
                    {/* Arms */}
                    <rect x="13" y="54" width="9" height="14" rx="4.5" fill="url(#botBody)" />
                    <rect x="58" y="54" width="9" height="14" rx="4.5" fill="url(#botBody)" />
                  </svg>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate(isAdmin ? '/ai-settings' : '/inbox')}
                className="mt-3 w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <span>{isAdmin ? 'Configure AI' : 'Open Inbox'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN VIEWPORT AREA */}
        <main className="flex-1 min-w-0 min-h-0 h-full overflow-y-auto overflow-x-hidden rounded-[26px]">
          {children}
        </main>
      </div>

      {/* "How It Works" Simple 3-Step Guide Modal */}
      {helpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-2xl border border-white rounded-3xl shadow-2xl max-w-xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  How PulseFlow CRM Works (3 Simple Steps)
                </h2>
                <p className="text-xs text-slate-500">
                  Designed to be simple, automatic, and easy to use every day
                </p>
              </div>
              <button
                onClick={() => setHelpModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-1">
                <div className="text-xs font-bold text-emerald-700">
                  Step 1 · Customers message your WhatsApp
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Customers can message in <strong>English</strong>, <strong>Manglish</strong>{' '}
                  (e.g., <em>"Website undakkanam, rate ethra aanu?"</em>), or{' '}
                  <strong>Malayalam</strong>. Our AI replies politely in the same language.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-1">
                <div className="text-xs font-bold text-indigo-700">
                  Step 2 · AI figures out their Budget, Need & Score
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  While chatting, AI automatically notes what service they want, their budget, and
                  how urgent it is. It gives each customer a simple score out of 100 (
                  <strong>Hot Lead</strong> = ready to buy).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-1">
                <div className="text-xs font-bold text-amber-700">
                  Step 3 · You step in only when needed
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  When a customer is ready to close or asks for a human manager, you get an alert.
                  Click <strong>Take Over Chat</strong> in the WhatsApp Inbox to talk to them
                  directly.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/80">
              <button
                onClick={() => {
                  setHelpModalOpen(false);
                  navigate('/inbox');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Try WhatsApp Inbox Now
              </button>
              <button
                onClick={() => setHelpModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Search Modal (⌘K) */}
      {quickSearchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center pt-16 px-4">
          <div className="bg-white/95 backdrop-blur-2xl border border-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden">
            <div className="p-4 border-b border-slate-200/80 flex items-center gap-3">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                placeholder="Search customers, messages, budgets, services, or leads..."
                className="w-full text-xs sm:text-sm text-slate-900 bg-transparent focus:outline-none"
              />
              <button
                onClick={() => setQuickSearchOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-[70vh] overflow-y-auto space-y-5">
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">
                  Matching Customers & Leads ({quickSearchResults.leads.length})
                </div>
                <div className="space-y-2">
                  {quickSearchResults.leads.map((l) => {
                    const c = contacts.find((cnt) => cnt.id === l.contactId);
                    return (
                      <div
                        key={l.id}
                        onClick={() => {
                          setQuickSearchOpen(false);
                          navigate(`/leads/${l.id}`);
                        }}
                        className="p-3.5 rounded-2xl border border-slate-200/80 bg-white/80 hover:border-slate-900 cursor-pointer transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">
                            {c?.name} · {c?.company}
                          </span>
                          <span className="text-xs font-mono font-bold text-emerald-700 tabular-nums">
                            {l.leadType} ({l.leadScore}/100) · {l.budget}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Wants: <strong>{l.interestedService}</strong> — Next step:{' '}
                          {l.recommendedNextAction}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">
                  AI Insights & Tips ({quickSearchResults.findings.length})
                </div>
                <div className="space-y-2">
                  {quickSearchResults.findings.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => {
                        setQuickSearchOpen(false);
                        navigate('/insights');
                      }}
                      className="p-3.5 rounded-2xl border border-slate-200/80 hover:border-slate-900 cursor-pointer transition-all bg-slate-50/70"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{f.title}</span>
                        <span className="text-xs font-mono text-emerald-700 font-semibold">
                          {f.metricBadge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{f.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
              <span>Click any item to open it directly</span>
              <Link
                to="/insights"
                onClick={() => setQuickSearchOpen(false)}
                className="font-semibold text-slate-900 hover:text-emerald-700 flex items-center gap-1"
              >
                <span>See All AI Insights</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Global Real-Time Hot Lead Notification & Handover Overlay */}
      {hotLeadOverlayOpen && hotLeadAlerts.length > 0 && (
        <div
          role="dialog"
          aria-labelledby="hot-lead-alert-title"
          className="fixed top-16 right-6 z-50 w-[calc(100vw-2rem)] max-w-md bg-white/95 backdrop-blur-2xl border border-white border-t-4 border-t-rose-500 rounded-3xl shadow-2xl p-5 space-y-4 transition-all"
        >
          {hotLeadAlerts.length === 1 ? (
            (() => {
              const singleAlert = hotLeadAlerts[0];
              return (
                <>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div
                        id="hot-lead-alert-title"
                        className="text-xs font-extrabold tracking-wide text-rose-600 uppercase flex items-center gap-1.5"
                      >
                        <span>🔥 HOT LEAD ALERT</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-900 mt-1">
                        You have 1 new Hot Lead that needs your attention.
                      </p>
                      <p className="text-[11px] text-slate-500">
                        New high-intent customer detected.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => acknowledgeHotLeads([singleAlert.leadId], 'DISMISS')}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                      title="Dismiss and acknowledge"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] text-slate-500 block">Customer</span>
                        <span className="text-sm font-bold text-slate-900">
                          {singleAlert.customerName}
                        </span>
                        {singleAlert.company ? (
                          <span className="text-xs text-slate-500 ml-1.5">
                            · {singleAlert.company}
                          </span>
                        ) : null}
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-mono font-bold text-xs tabular-nums">
                        {singleAlert.leadScore}/100 — HOT
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-200/70">
                      <div>
                        <span className="text-[11px] text-slate-500 block">Service</span>
                        <span className="font-semibold text-slate-900">
                          {singleAlert.interestedService}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">Budget</span>
                        <span className="font-mono font-bold text-emerald-700 tabular-nums">
                          {singleAlert.budget}
                        </span>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-200/70 space-y-1">
                      <div className="text-[11px] text-slate-500">Recommended action</div>
                      <div className="font-semibold text-slate-800">
                        Handover this lead to a human sales representative.
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          acknowledgeHotLeads([singleAlert.leadId], 'VIEW_LEAD');
                          navigate(`/leads/${singleAlert.leadId}`);
                        }}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        View Lead
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          acknowledgeHotLeads([singleAlert.leadId], 'TAKE_OVER_CHAT');
                          let convId = singleAlert.conversationId;
                          if (!convId && singleAlert.contactId) {
                            const opened = await startOrOpenConversation(
                              singleAlert.contactId,
                              singleAlert.leadId
                            );
                            convId = opened?.id || '';
                          }
                          if (convId) {
                            takeOverConversation(convId);
                            navigate(`/inbox?convId=${convId}`);
                          } else {
                            navigate('/inbox');
                          }
                        }}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Take Over Chat</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => acknowledgeHotLeads([singleAlert.leadId], 'DISMISS')}
                      className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </>
              );
            })()
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div
                    id="hot-lead-alert-title"
                    className="text-xs font-extrabold tracking-wide text-rose-600 uppercase flex items-center gap-1.5"
                  >
                    <span>🔥 HOT LEADS NEED ATTENTION</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 mt-1">
                    You have {hotLeadAlerts.length} new Hot Leads that need your attention.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    acknowledgeHotLeads(
                      hotLeadAlerts.map((a) => a.leadId),
                      'DISMISS'
                    )
                  }
                  className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                  title="Dismiss all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-3 max-h-60 overflow-y-auto divide-y divide-slate-200/70 text-xs">
                {hotLeadAlerts.map((alert, idx) => (
                  <div
                    key={alert.leadId}
                    className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 truncate">
                      <span className="font-mono text-slate-500 mr-1">{idx + 1}.</span>
                      <span className="font-bold text-slate-900">{alert.customerName}</span>
                      <span className="text-slate-400 mx-1">—</span>
                      <span className="font-mono font-bold text-rose-600 tabular-nums">
                        {alert.leadScore}/100
                      </span>
                      <span className="text-slate-400 mx-1">—</span>
                      <span className="font-mono text-emerald-700 font-semibold tabular-nums">
                        {alert.budget}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          acknowledgeHotLeads([alert.leadId], 'VIEW_LEAD');
                          navigate(`/leads/${alert.leadId}`);
                        }}
                        className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 rounded-lg cursor-pointer"
                      >
                        View Lead
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          acknowledgeHotLeads([alert.leadId], 'TAKE_OVER_CHAT');
                          let convId = alert.conversationId;
                          if (!convId && alert.contactId) {
                            const opened = await startOrOpenConversation(
                              alert.contactId,
                              alert.leadId
                            );
                            convId = opened?.id || '';
                          }
                          if (convId) {
                            takeOverConversation(convId);
                            navigate(`/inbox?convId=${convId}`);
                          } else {
                            navigate('/inbox');
                          }
                        }}
                        className="px-2 py-1 text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg cursor-pointer"
                      >
                        Take Over Chat
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    acknowledgeHotLeads(
                      hotLeadAlerts.map((a) => a.leadId),
                      'VIEW_HOT_LEADS'
                    );
                    navigate('/leads?type=HOT');
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  View Hot Leads
                </button>
                <button
                  type="button"
                  onClick={() =>
                    acknowledgeHotLeads(
                      hotLeadAlerts.map((a) => a.leadId),
                      'DISMISS'
                    )
                  }
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Toast Notification Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-6 z-50 space-y-2 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto bg-slate-900/95 backdrop-blur-xl text-white border border-white/15 rounded-2xl p-3.5 shadow-xl flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold">{t.title}</div>
                  {t.description && (
                    <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                      {t.description}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => dismissToast(t.id)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
