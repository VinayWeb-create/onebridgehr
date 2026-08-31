import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DialogProvider } from './context/DialogContext';

// Layouts & Pages
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Leaves from './pages/Leaves';
import Tasks from './pages/Tasks';
import Payroll from './pages/Payroll';
import IdCard from './pages/IdCard';
import Profile from './pages/Profile';
import Signature from './pages/Signature';
import CandidatePortal from './pages/onboarding/CandidatePortal';
import OnboardingSection from './pages/onboarding/OnboardingSection';
import OfferAccepted from './pages/OfferAccepted';
import RequestProposalPage from './pages/public/RequestProposalPage';
import BookDemoPage from './pages/public/BookDemoPage';
import PaymentPage from './pages/public/PaymentPage';

// Super Admin ERP Suite
import CrmHubPage from './pages/crm/CrmHubPage';
import FinanceHubPage from './pages/finance/FinanceHubPage';
import LeadsPage from './pages/crm/LeadsPage';
import { ProposalsPage } from './pages/crm/ProposalsPage';
import { ConsultationsPage } from './pages/crm/ConsultationsPage';
import QuotationsPage from './pages/crm/QuotationsPage';
import InvoicesPage from './pages/crm/InvoicesPage';
import TallyFinancePage from './pages/finance/TallyFinancePage';
import StatementOcrPage from './pages/finance/StatementOcrPage';
import AutomationSettingsPage from './pages/automations/AutomationSettingsPage';
import AiCommandCenterPage from './pages/ai/AiCommandCenterPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RedirectToNewPortal = () => {
  const { token } = useParams();
  return <Navigate to={`/onboarding/accept/${token}`} replace />;
};

// Guard Component to block unauthenticated sessions and enforce role restrictions
const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRoles?: string[] }> = ({
  children,
  requiredRoles,
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 dark:bg-brand-950">
        <span className="w-8 h-8 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Check role restrictions
  if (requiredRoles && !requiredRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Force onboarding if pending
  if (user.role === 'EMPLOYEE' && (user as any).onboardingPending && location.pathname !== '/onboarding/my-documents') {
    return <Navigate to="/onboarding/my-documents" replace />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <DialogProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                {/* Auth & Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/onboarding/accept/:token" element={<CandidatePortal />} />
                <Route path="/accept-offer/:token" element={<RedirectToNewPortal />} />
                <Route path="/offer-accepted" element={<OfferAccepted />} />
                <Route path="/proposal/request/:leadId" element={<RequestProposalPage />} />
                <Route path="/demo/book/:leadId" element={<BookDemoPage />} />
                <Route path="/payment/:id" element={<PaymentPage />} />

                {/* Core Protected Workspace Nodes */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
                <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
                <Route path="/leaves" element={<ProtectedRoute><Leaves /></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
                <Route path="/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
                <Route path="/onboarding/my-documents" element={<ProtectedRoute><OnboardingSection /></ProtectedRoute>} />
                <Route path="/onboarding/*" element={<Navigate to="/employees" replace />} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

                {/* Super Admin Exclusive CRM Suite Sub-Pages */}
                <Route
                  path="/crm"
                  element={<Navigate to="/crm/leads" replace />}
                />
                <Route
                  path="/crm/leads"
                  element={
                    <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>
                      <LeadsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/crm/proposals"
                  element={
                    <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>
                      <ProposalsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/crm/consultations"
                  element={
                    <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>
                      <ConsultationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/crm/quotations"
                  element={
                    <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>
                      <QuotationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/crm/invoices"
                  element={
                    <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>
                      <InvoicesPage />
                    </ProtectedRoute>
                  }
                />

                {/* Super Admin Exclusive Finance Module & Sub-Pages */}
                <Route
                  path="/finance"
                  element={
                    <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>
                      <FinanceHubPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/finance/tally"
                  element={
                    <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>
                      <TallyFinancePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/finance/statement-ocr"
                  element={
                    <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>
                      <StatementOcrPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/finance/automations"
                  element={
                    <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>
                      <AutomationSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/finance/*"
                  element={
                    <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>
                      <FinanceHubPage />
                    </ProtectedRoute>
                  }
                />

                {/* AI Autonomous Business Operating System (BOS) */}
                <Route
                  path="/ai/command-center"
                  element={
                    <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>
                      <AiCommandCenterPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/ai" element={<Navigate to="/ai/command-center" replace />} />

                {/* Direct & Legacy Quick Navigation Redirects */}
                <Route path="/leads" element={<Navigate to="/crm/leads" replace />} />
                <Route path="/quotations" element={<Navigate to="/crm/quotations" replace />} />
                <Route path="/invoices" element={<Navigate to="/crm/invoices" replace />} />
                <Route path="/tally-finance" element={<Navigate to="/finance/tally" replace />} />
                <Route path="/statement-ocr" element={<Navigate to="/finance/statement-ocr" replace />} />
                <Route path="/automations" element={<Navigate to="/finance/automations" replace />} />

                {/* Redirect Node */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </DialogProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;

