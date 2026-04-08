import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Scraper from './pages/Scraper';
import Leads from './pages/Leads';
import EmailTemplates from './pages/EmailTemplates';
import DemoLinks from './pages/DemoLinks';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Team from './pages/Team';
import ActivityLog from './pages/ActivityLog';
import Schedule from './pages/Schedule';
import SmsSequences from './pages/SmsSequences';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/scraper" element={<Scraper />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/templates" element={<EmailTemplates />} />
                <Route path="/demos" element={<DemoLinks />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/sms-sequences" element={<SmsSequences />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route
                  path="/settings"
                  element={<Settings />}
                />
                <Route
                  path="/team"
                  element={
                    <AdminRoute>
                      <Team />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/activity-log"
                  element={
                    <AdminRoute>
                      <ActivityLog />
                    </AdminRoute>
                  }
                />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
