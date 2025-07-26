import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@modl-gg/shared-web/components/ui/card';
import { Button } from '@modl-gg/shared-web/components/ui/button';
import { Badge } from '@modl-gg/shared-web/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useRealTimeMetrics } from '@/hooks/useMonitoring';
import { formatDateRelative } from '@/lib/utils';
import { 
  Server, 
  Users, 
  Activity, 
  AlertTriangle, 
  TrendingUp,
  Settings,
  LogOut,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

export default function DashboardPage() {
  const { session, logout } = useAuth();
  const { metrics, health, isLoading, error, lastUpdated } = useRealTimeMetrics();

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-600';
      case 'good':
        return 'text-blue-600';
      case 'fair':
        return 'text-yellow-600';
      case 'poor':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Server className="w-4 h-4 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold">modl Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-muted-foreground">
                {session?.email}
              </div>
              <Button variant="ghost" size="sm" onClick={() => logout()}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex space-x-6">
            <Link href="/">
              <a className="px-3 py-2 text-sm font-medium border-b-2 border-primary text-primary">
                Dashboard
              </a>
            </Link>
            <Link href="/servers">
              <a className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                Servers
              </a>
            </Link>
            <Link href="/monitoring">
              <a className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                Monitoring
              </a>
            </Link>
            <Link href="/security">
              <a className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                Security
              </a>
            </Link>
            <Link href="/system">
              <a className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                System
              </a>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Welcome Section */}
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold mb-2">Welcome back!</h2>
              <p className="text-muted-foreground">
                Here's an overview of your modl platform.
              </p>
            </div>
            <div className="text-right">
              {lastUpdated && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 mr-1" />
                  Last updated {formatDateRelative(lastUpdated)}
                </div>
              )}
              {isLoading && (
                <div className="flex items-center text-sm text-muted-foreground mt-1">
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2"></div>
                  Updating...
                </div>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Servers</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.servers.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.servers.recentRegistrations || 0} new this week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Servers</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.servers.active || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.servers.pending || 0} pending
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate (24h)</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.logs.last24h.error || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.logs.last24h.critical || 0} critical
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Health</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getHealthStatusColor(metrics?.systemHealth.status || 'poor')}`}>
                  {metrics?.systemHealth.score || 0}%
                </div>
                <p className="text-xs text-muted-foreground capitalize">
                  {metrics?.systemHealth.status || 'Unknown'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* System Health Status */}
          {health && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  System Health Checks
                </CardTitle>
                <CardDescription>
                  Real-time system component status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {health.checks.map((check, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        {getHealthStatusIcon(check.status)}
                        <div>
                          <p className="font-medium">{check.name}</p>
                          <p className="text-sm text-muted-foreground">{check.message}</p>
                        </div>
                      </div>
                      {check.responseTime && (
                        <div className="text-sm text-muted-foreground">
                          {check.responseTime}ms
                        </div>
                      )}
                      {check.count !== undefined && (
                        <Badge variant={check.count === 0 ? "success" : "warning"}>
                          {check.count}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common administrative tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/servers">
                  <Button variant="outline" className="w-full h-20 flex flex-col">
                    <Server className="h-6 w-6 mb-2" />
                    Manage Servers
                  </Button>
                </Link>
                
                <Link href="/monitoring">
                  <Button variant="outline" className="w-full h-20 flex flex-col">
                    <Activity className="h-6 w-6 mb-2" />
                    View Monitoring
                  </Button>
                </Link>
                
                <Link href="/system">
                  <Button variant="outline" className="w-full h-20 flex flex-col">
                    <Settings className="h-6 w-6 mb-2" />
                    System Settings
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>


        </div>
      </main>
    </div>
  );
} 