import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@modl-gg/shared-web/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@modl-gg/shared-web/components/ui/card';
import { Badge } from '@modl-gg/shared-web/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@modl-gg/shared-web/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api';
import { formatDate, formatDateRelative } from '@/lib/utils';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { 
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  Server,
  Calendar,
  Download,
  FileText,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  LogOut,
  Clock,
  Globe,
  Database,
  AlertTriangle
} from 'lucide-react';

interface AnalyticsData {
  overview: {
    totalServers: number;
    activeServers: number;
    totalUsers: number;
    totalTickets: number;
    serverGrowthRate: number;
    userGrowthRate: number;
  };
  serverMetrics: {
    byPlan: Array<{ name: string; value: number; percentage: number }>;
    byStatus: Array<{ name: string; value: number; color: string }>;
    registrationTrend: Array<{ date: string; servers: number; cumulative: number }>;
  };
  usageStatistics: {
    topServersByUsers: Array<{ name: string; users: number; domain: string }>;
    serverActivity: Array<{ date: string; activeServers: number; newRegistrations: number }>;
    geographicDistribution: Array<{ region: string; servers: number; percentage: number }>;
  };
  systemHealth: {
    errorRates: Array<{ date: string; errors: number; warnings: number; critical: number }>;
    uptime: Array<{ service: string; uptime: number; status: string }>;
    performanceMetrics: Array<{ metric: string; value: number; trend: 'up' | 'down' | 'stable' }>;
  };
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

export default function AnalyticsPage() {
  const { logout } = useAuth();
  const [dateRange, setDateRange] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');

  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['analytics', dateRange],
    queryFn: async () => {
      const response = await apiClient.getAnalytics(dateRange);
      return response.data;
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const handleExportData = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      await apiClient.exportAnalytics(type, dateRange);
      // This would trigger a download
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const generateReport = async () => {
    try {
      await apiClient.generateReport({
        type: 'comprehensive',
        dateRange,
        sections: ['overview', 'servers', 'usage', 'health']
      });
    } catch (error) {
      console.error('Report generation failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <Button onClick={logout} variant="outline">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="text-center py-8">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <h3 className="text-lg font-semibold mb-2">Failed to Load Analytics</h3>
              <p className="text-muted-foreground">Unable to fetch analytics data.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
              <div className="flex items-center space-x-3">
                <BarChart3 className="h-6 w-6 text-muted-foreground" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
                  <p className="text-sm text-muted-foreground">System insights and data analysis</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 border border-input rounded-md text-sm"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
              </select>
              <Button variant="outline" size="sm" onClick={generateReport}>
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
              <Button onClick={logout} variant="outline">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="servers">Server Analytics</TabsTrigger>
            <TabsTrigger value="usage">Usage Statistics</TabsTrigger>
            <TabsTrigger value="health">System Health</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Server className="h-4 w-4 mr-2" />
                    Total Servers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.overview.totalServers}</div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    {analytics.overview.serverGrowthRate > 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1 text-red-600" />
                    )}
                    {Math.abs(analytics.overview.serverGrowthRate)}% vs last period
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Activity className="h-4 w-4 mr-2" />
                    Active Servers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.overview.activeServers}</div>
                  <div className="text-xs text-muted-foreground">
                    {((analytics.overview.activeServers / analytics.overview.totalServers) * 100).toFixed(1)}% of total
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    Total Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.overview.totalUsers.toLocaleString()}</div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    {analytics.overview.userGrowthRate > 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1 text-red-600" />
                    )}
                    {Math.abs(analytics.overview.userGrowthRate)}% growth
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    Total Tickets
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.overview.totalTickets.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">
                    Across all servers
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Server Registration Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Server Registration Trend</CardTitle>
                <CardDescription>Daily server registrations and cumulative growth</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.serverMetrics.registrationTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="servers" 
                      stackId="1" 
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      fillOpacity={0.6}
                      name="Daily Registrations"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cumulative" 
                      stackId="2" 
                      stroke="#82ca9d" 
                      fill="#82ca9d" 
                      fillOpacity={0.6}
                      name="Cumulative Total"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="servers" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Server Plan Distribution</CardTitle>
                    <CardDescription>Breakdown of server plans</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={analytics.serverMetrics.byPlan}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percentage }) => `${name} (${percentage}%)`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {analytics.serverMetrics.byPlan.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Server Status Distribution</CardTitle>
                    <CardDescription>Current server status breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={analytics.serverMetrics.byStatus}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#8884d8" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
             <Card>
              <CardHeader>
                <CardTitle>Top Servers by User Count</CardTitle>
                <CardDescription>Most active servers in the network</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.usageStatistics.topServersByUsers.slice(0, 10).map((server, index) => (
                    <div key={server.name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-sm font-semibold">#{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium">{server.name}</p>
                          <p className="text-sm text-muted-foreground">{server.domain}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{server.users.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">users</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Server Activity Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Server Activity Timeline</CardTitle>
                <CardDescription>Daily active servers and new registrations</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.usageStatistics.serverActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="activeServers" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="Active Servers"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="newRegistrations" 
                      stroke="#82ca9d" 
                      strokeWidth={2}
                      name="New Registrations"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Geographic Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Geographic Distribution</CardTitle>
                <CardDescription>Server distribution by region</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {analytics.usageStatistics.geographicDistribution.map((region, index) => (
                      <div key={region.region} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{region.region}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold">{region.servers}</span>
                          <Badge variant="outline">{region.percentage}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={analytics.usageStatistics.geographicDistribution}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="servers"
                        label={({ region, percentage }) => `${region}: ${percentage}%`}
                      >
                        {analytics.usageStatistics.geographicDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health" className="space-y-6">
            {/* Error Rates Over Time */}
            <Card>
              <CardHeader>
                <CardTitle>System Error Rates</CardTitle>
                <CardDescription>Error, warning, and critical issue trends</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.systemHealth.errorRates}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="critical" 
                      stackId="1" 
                      stroke="#dc2626" 
                      fill="#dc2626" 
                      fillOpacity={0.8}
                      name="Critical"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="errors" 
                      stackId="1" 
                      stroke="#ea580c" 
                      fill="#ea580c" 
                      fillOpacity={0.8}
                      name="Errors"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="warnings" 
                      stackId="1" 
                      stroke="#ca8a04" 
                      fill="#ca8a04" 
                      fillOpacity={0.8}
                      name="Warnings"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 