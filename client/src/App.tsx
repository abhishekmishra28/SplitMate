import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// @ts-ignore
import { AuthProvider, useAuth } from './contexts/AuthContext';
// @ts-ignore
import AuthPage from './pages/AuthPage';
// @ts-ignore
import Dashboard from './pages/Dashboard';
// @ts-ignore
import GroupView from './pages/GroupView';
// @ts-ignore
import ImportCSV from './pages/ImportCSV';
// @ts-ignore
import PersonalAnalytics from './pages/PersonalAnalytics';
// @ts-ignore
import Layout from './components/Layout';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Loading SplitMate...</p>
      </div>
    </div>
  );
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return !user ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1f2937',
              color: '#f9fafb',
              border: '1px solid #374151',
            },
            success: { iconTheme: { primary: '#8b5cf6', secondary: '#fff' } },
          }}
        />
        <Routes>
          <Route
            path="/auth"
            element={
              <PublicRoute>
                <AuthPage />
              </PublicRoute>
            }
          />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="groups/:groupId" element={<GroupView />} />
            <Route path="groups/:groupId/import" element={<ImportCSV />} />
            <Route path="analytics" element={<PersonalAnalytics />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
