import { Route, Switch, Redirect } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import ServersPage from '@/pages/ServersPage';
import ServerDetailPage from '@/pages/ServerDetailPage';
import MonitoringPage from '@/pages/MonitoringPage';
import LoadingPage from '@/pages/LoadingPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import SystemConfigPage from '@/pages/SystemConfigPage';
import SecurityPage from '@/pages/SecurityPage';
import SystemPromptsPage from '@/pages/SystemPromptsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
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
          <Route path="/" component={DashboardPage} exact />
          <Route path="/servers" component={ServersPage} />
          <Route path="/servers/:id" component={ServerDetailPage} />
          <Route path="/monitoring" component={MonitoringPage} />
          <Route path="/analytics" component={AnalyticsPage} />
          <Route path="/system" component={SystemConfigPage} />
          <Route path="/system/prompts" component={SystemPromptsPage} />
          <Route path="/security" component={SecurityPage} />
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
    </div>
  );
}

export default App; 