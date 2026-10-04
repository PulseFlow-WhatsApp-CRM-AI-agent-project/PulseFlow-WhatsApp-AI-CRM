import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CRMProvider, useCRM } from './context/CRMContext';
import { CRMWorkspaceLayout } from './layouts/CRMWorkspaceLayout';
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage
} from './pages/AuthPages';
import { DashboardPage } from './pages/DashboardPage';
import { AIInsightsPage } from './pages/AIInsightsPage';
import { WhatsAppInboxPage } from './pages/WhatsAppInboxPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { LeadsListPage, LeadDetailsPage } from './pages/LeadsPages';
import { ContactsListPage, ContactDetailsPage } from './pages/ContactsPages';
import { FollowUpsPage, AnalyticsPage } from './pages/FollowUpsPage';
import {
  TeamMembersPage,
  AISettingsPage,
  KnowledgeBasePage,
  WhatsAppSettingsPage,
  CompanySettingsPage,
  ProfileSettingsPage,
  ArchitectureBlueprintPage
} from './pages/ManagementPages';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, authToken, currentUser } = useCRM();
  if (!isAuthenticated || !authToken || !currentUser) {
    return <Navigate to="/login" replace />;
  }
  return <CRMWorkspaceLayout>{children}</CRMWorkspaceLayout>;
};

const RootRedirect = () => {
  const { isAuthenticated, authToken, currentUser } = useCRM();
  if (isAuthenticated && authToken && currentUser) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <CRMProvider>
      <BrowserRouter>
        <Routes>
          {/* Root URL Redirect: / -> /login (unauthenticated) or /dashboard (authenticated) */}
          <Route path="/" element={<RootRedirect />} />

          {/* Public Authentication Pages */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected Main CRM Workspace Pages */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/insights"
            element={
              <ProtectedRoute>
                <AIInsightsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbox"
            element={
              <ProtectedRoute>
                <WhatsAppInboxPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/conversations"
            element={
              <ProtectedRoute>
                <ConversationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leads"
            element={
              <ProtectedRoute>
                <LeadsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leads/:id"
            element={
              <ProtectedRoute>
                <LeadDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contacts"
            element={
              <ProtectedRoute>
                <ContactsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contacts/:id"
            element={
              <ProtectedRoute>
                <ContactDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/follow-ups"
            element={
              <ProtectedRoute>
                <FollowUpsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />

          {/* Management & Settings Pages */}
          <Route
            path="/team"
            element={
              <ProtectedRoute>
                <TeamMembersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-settings"
            element={
              <ProtectedRoute>
                <AISettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/knowledge-base"
            element={
              <ProtectedRoute>
                <KnowledgeBasePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/whatsapp-settings"
            element={
              <ProtectedRoute>
                <WhatsAppSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company-settings"
            element={
              <ProtectedRoute>
                <CompanySettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfileSettingsPage mode="profile" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <ProfileSettingsPage mode="general" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/architecture"
            element={
              <ProtectedRoute>
                <ArchitectureBlueprintPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback Redirect */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </CRMProvider>
  );
}
