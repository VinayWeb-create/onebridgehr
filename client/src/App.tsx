import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

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

// Guard Component to block unauthenticated sessions
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Auth & Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/onboarding/accept/:token" element={<CandidatePortal />} />
              <Route path="/accept-offer/:token" element={<RedirectToNewPortal />} />
              <Route path="/offer-accepted" element={<OfferAccepted />} />

              {/* Protected Workspace Nodes */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
              <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
              <Route path="/leaves" element={<ProtectedRoute><Leaves /></ProtectedRoute>} />
              <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
              <Route path="/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
              <Route path="/onboarding/my-documents" element={<ProtectedRoute><OnboardingSection /></ProtectedRoute>} />
              <Route path="/onboarding/*" element={<Navigate to="/employees" replace />} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

              {/* Redirect Node */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;

