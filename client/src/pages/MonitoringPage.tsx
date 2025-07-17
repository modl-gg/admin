import React, { useState } from 'react';
import { Link } from 'wouter';
import { Button } from 'modl-shared-web/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'modl-shared-web/components/ui/card';
import { Badge } from 'modl-shared-web/components/ui/badge';
import { Input } from 'modl-shared-web/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useRealTimeMetrics } from '@/hooks/useMonitoring';
import { formatDateRelative } from '@/lib/utils';
import SystemLogs from '@/components/SystemLogs';
import { 
  ArrowLeft,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Clock,
  LogOut
} from 'lucide-react';

export default function MonitoringPage() {
  const { logout } = useAuth();
  const [filters, setFilters] = useState({ page: 1 });
  const [showFilters, setShowFilters] = useState(false);
  
  const { metrics, health } = useRealTimeMetrics();

  const getStatusIcon = (level: string, resolved: boolean) => {
    if (resolved) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    switch (level) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link href="/">
                <Button variant="ghost" size="sm" className="mr-4">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">System Monitoring</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button onClick={logout} variant="outline">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Metrics Overview */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                  <div className="text-2xl font-bold text-red-600">{metrics.logs.unresolved.critical}</div>
                  <p className="text-xs text-muted-foreground">Unresolved</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Error Count</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{metrics.logs.unresolved.error}</div>
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
                        {getStatusIcon(check.status, false)}
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

          {/* System Logs Management */}
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
        </div>
      </div>
    </div>
  );
} 