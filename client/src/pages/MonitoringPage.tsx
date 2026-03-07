import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@modl-gg/shared-web/components/ui/card';
import { Badge } from '@modl-gg/shared-web/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@modl-gg/shared-web/components/ui/tabs';
import { useRealTimeMetrics } from '@/hooks/useMonitoring';
import SystemLogs from '@/components/SystemLogs';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Clock,
  Users,
  Wifi
} from 'lucide-react';

export default function MonitoringPage() {
  const { metrics, health } = useRealTimeMetrics();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-orange-500 dark:text-orange-400" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6">System Monitoring</h1>

      <Tabs defaultValue="health" className="space-y-6">
        <TabsList>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-6">
          {/* Metrics Overview */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Logs (24h)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.logs.last24h.total}</div>
                  <p className="text-xs text-muted-foreground">Last 24 hours</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{metrics.logs.unresolved.critical}</div>
                  <p className="text-xs text-muted-foreground">Unresolved</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Error Count</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{metrics.logs.unresolved.error}</div>
                  <p className="text-xs text-muted-foreground">Unresolved</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">System Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.systemHealth.score}%</div>
                  <p className="text-xs text-muted-foreground capitalize">{metrics.systemHealth.status}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Wifi className="h-4 w-4" />
                    Online Servers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{metrics.servers.concurrentServers}</div>
                  <p className="text-xs text-muted-foreground">Syncing in last 5 min</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Online Players
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{metrics.servers.concurrentPlayers}</div>
                  <p className="text-xs text-muted-foreground">Currently in-game</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* System Health Checks */}
          {health && (
            <Card>
              <CardHeader>
                <CardTitle>Real-time Health Checks</CardTitle>
                <CardDescription>Current status of system components</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {health.checks.map((check, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(check.status)}
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
                        <Badge variant={check.count === 0 ? "outline" : "destructive"}>
                          {check.count}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>System Logs</CardTitle>
              <CardDescription>
                Monitor, filter, and manage system logs in real-time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SystemLogs />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
