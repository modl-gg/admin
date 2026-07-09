import { Route, Switch, Redirect } from 'wouter';
import { Toaster } from '@modl-gg/shared-web/components/ui/toaster';
import { useAuth } from '@/hooks/useAuth';
import Layout from '@/components/layout/Layout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import ServersPage from '@/pages/ServersPage';
import ServerDetailPage from '@/pages/ServerDetailPage';
import MonitoringPage from '@/pages/MonitoringPage';
import LoadingPage from '@/pages/LoadingPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import SystemPromptsPage from '@/pages/SystemPromptsPage';
import AlertsPage from '@/pages/AlertsPage';
import SecurityPage from '@/pages/SecurityPage';
import BetaTestersPage from '@/pages/BetaTestersPage';
import BetaTesterDetailPage from '@/pages/BetaTesterDetailPage';
import { isStagingHost } from '@/lib/env';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingPage />;
  }

  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/" /> : <LoginPage />}
      </Route>

      <ProtectedRoute>
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/servers" component={ServersPage} />
          <Route path="/servers/:id" component={ServerDetailPage} />
          <Route path="/monitoring" component={MonitoringPage} />
          <Route path="/analytics" component={AnalyticsPage} />
          <Route path="/prompts" component={SystemPromptsPage} />
          <Route path="/alerts" component={AlertsPage} />
          <Route path="/security" component={SecurityPage} />
          {isStagingHost() && (
            <Route path="/beta-testers" component={BetaTestersPage} />
          )}
          {isStagingHost() && (
            <Route path="/beta-testers/:id" component={BetaTesterDetailPage} />
          )}
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </ProtectedRoute>
    </Switch>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <AppRoutes />
      <Toaster />
    </div>
  );
}

export default App;
