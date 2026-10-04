import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { CRMProvider, useCRM } from './context/CRMContext';
import { CRMWorkspaceLayout } from './layouts/CRMWorkspaceLayout';
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage
} from './pages/AuthPages';
import { DashboardPage } from './pages/DashboardPage';
import { WhatsAppInboxPage } from './pages/WhatsAppInboxPage';
import { AIInsightsPage } from './pages/AIInsightsPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { ContactsListPage, ContactDetailsPage } from './pages/ContactsPages';
import { LeadsListPage, LeadDetailsPage } from './pages/LeadsPages';
import { FollowUpsPage } from './pages/FollowUpsPage';
import {
  TeamMembersPage,
  AISettingsPage,
  KnowledgeBasePage,
  WhatsAppSettingsPage,
  CompanySettingsPage,
  ProfileSettingsPage,
  ArchitectureBlueprintPage
} from './pages/ManagementPages';

const AccessDeniedView = () => {
  const { currentUser } = useCRM();
  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto flex items-center justify-center min-h-[70vh]">
      <div className="glass-panel-strong rounded-3xl p-8 border border-rose-200/80 shadow-xl text-center space-y-4 w-full">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-300 text-rose-700 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-300 text-rose-800 font-mono text-xs font-bold">
          403 · ACCESS DENIED
        </div>
        <h1 className="text-xl font-bold text-slate-900">
          Administrator Authorization Required
        </h1>
        <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
          Your account (<strong>{currentUser?.name}</strong> ·{' '}
          <span className="font-mono font-semibold">{currentUser?.role || 'AGENT'}</span>) does not
          have permission to access this administrative module. Only <strong>ADMIN</strong> accounts
          are authorized for this route.
        </p>
        <div className="pt-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, currentUser } = useCRM();
  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" replace />;
  }
  const actualRole = currentUser.role === 'ADMIN' ? 'ADMIN' : 'AGENT';
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(actualRole)) {
    return (
      <CRMWorkspaceLayout>
        <AccessDeniedView />
      </CRMWorkspaceLayout>
    );
  }
  return <CRMWorkspaceLayout>{children}</CRMWorkspaceLayout>;
};

const RootRedirect = () => {
  const { isAuthenticated, currentUser } = useCRM();
  if (isAuthenticated && currentUser) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
};

export function App() {
  return (
    <CRMProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Root URL Redirect: / -> /login if unauthenticated, /dashboard if authenticated */}
          <Route path="/" element={<RootRedirect />} />

          {/* Shared CRM Workspace Routes (ADMIN & AGENT) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'AGENT']}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/insights"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'AGENT']}>
                <AIInsightsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbox"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'AGENT']}>
                <WhatsAppInboxPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/conversations"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'AGENT']}>
                <ConversationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contacts"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'AGENT']}>
                <ContactsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contacts/:id"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'AGENT']}>
                <ContactDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leads"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'AGENT']}>
                <LeadsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leads/:id"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'AGENT']}>
                <LeadDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/follow-ups"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'AGENT']}>
                <FollowUpsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'AGENT']}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/knowledge-base"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'AGENT']}>
                <KnowledgeBasePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'AGENT']}>
                <ProfileSettingsPage mode="profile" />
              </ProtectedRoute>
            }
          />

          {/* Strictly ADMIN-Only Routes */}
          <Route
            path="/team"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <TeamMembersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-settings"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AISettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/whatsapp-settings"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <WhatsAppSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company-settings"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <CompanySettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <ProfileSettingsPage mode="settings" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/architecture"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <ArchitectureBlueprintPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </CRMProvider>
  );
}

export default App;
