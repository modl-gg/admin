import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@modl-gg/shared-web/components/ui/card';
import { Button } from '@modl-gg/shared-web/components/ui/button';
import { Badge } from '@modl-gg/shared-web/components/ui/badge';
import { useRealTimeMetrics } from '@/hooks/useMonitoring';
import { formatDateRelative } from '@/lib/utils';
import {
  Server,
  Activity,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

export default function DashboardPage() {
  const { metrics, health, isLoading, lastUpdated } = useRealTimeMetrics();

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />;
      case 'degraded':
        return <AlertCircle className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-600 dark:text-green-400';
      case 'good':
        return 'text-blue-600 dark:text-blue-400';
      case 'fair':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'poor':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome back!</h1>
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

              <Link href="/prompts">
                <Button variant="outline" className="w-full h-20 flex flex-col">
                  <Sparkles className="h-6 w-6 mb-2" />
                  AI Prompts
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
