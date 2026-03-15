import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@modl-gg/shared-web/components/ui/card';
import { Badge } from '@modl-gg/shared-web/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@modl-gg/shared-web/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@modl-gg/shared-web/components/ui/select';
import { apiClient, ActivitySnapshot } from '@/lib/api';
import {
  BarChart,
  Bar,
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
  FileText,
  BarChart3,
  Activity,
  LogOut,
  Clock,
  AlertTriangle
} from 'lucide-react';

interface AnalyticsData {
  overview: {
    totalServers: number;
    activeServers: number;
    totalUsers: number;
    totalTickets: number;
    serverGrowthRate: string;
    userGrowthRate: string;
    avgPlayersPerServer: string;
    avgTicketsPerServer: string;
  };
  serverMetrics: {
    byPlan: Array<{ name: string; value: number; percentage: number }>;
    byStatus: Array<{ name: string; value: number; color: string }>;
    registrationTrend: Array<{ date: string; servers: number; cumulative: number }>;
  };
  usageStatistics: {
    topServersByUsers: Array<{ serverName: string; userCount: number; customDomain: string }>;
    serverActivity: Array<{ date: string; activeServers: number; newRegistrations: number }>;
    geographicDistribution: Array<{ region: string; servers: number; percentage: number }>;
    playerGrowth: Array<{ date: string; players: number; cumulative: number }>;
    ticketVolume: Array<{ date: string; tickets: number }>;
  };
  systemHealth: {
    errorRates: Array<{ date: string; errors: number; warnings: number; critical: number }>;
  };
}


const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
      <BarChart3 className="h-12 w-12 mb-4 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');

  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['analytics', dateRange],
    queryFn: async () => {
      const response = await apiClient.getAnalytics(dateRange);
      return response.data;
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const serverDistributions = useMemo(() => {
    const servers = analytics?.usageStatistics.liveServers ?? [];
    const count = (key: 'platform' | 'version' | 'pluginVersion') => {
      const counts: Record<string, number> = {};
      for (const s of servers) {
        const val = s[key] || 'unknown';
        counts[val] = (counts[val] ?? 0) + 1;
      }
      const total = servers.length || 1;
      return Object.entries(counts)
        .map(([name, value]) => ({ name, value, percentage: Number(((value / total) * 100).toFixed(1)) }))
        .sort((a, b) => b.value - a.value);
    };
    return {
      byPlatform: count('platform'),
      byVersion: count('version'),
      byPluginVersion: count('pluginVersion'),
    };
  }, [analytics]);

  const generateReport = async () => {
    try {
      await analyticsService.generateReport({
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
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500 dark:text-red-400" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load Analytics</h3>
            <p className="text-muted-foreground">Unable to fetch analytics data.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Analytics & Reports</h1>
        {dateRangeSelector}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="servers">Servers</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Server className="h-4 w-4 mr-2" />
                  Total Servers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.overview.totalServers ?? 0}</div>
                <div className="flex items-center text-xs text-muted-foreground">
                  {parseFloat(analytics.overview.serverGrowthRate) >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1 text-red-600 dark:text-red-400" />
                  )}
                  {analytics.overview.serverGrowthRate ?? '0'}% vs last period
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
                <div className="text-2xl font-bold">{analytics.overview.activeServers ?? 0}</div>
                <div className="text-xs text-muted-foreground">
                  {analytics.overview.totalServers ? ((analytics.overview.activeServers / analytics.overview.totalServers) * 100).toFixed(1) : '0'}% of total
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
                <div className="text-2xl font-bold">{(analytics.overview.totalUsers ?? 0).toLocaleString()}</div>
                <div className="flex items-center text-xs text-muted-foreground">
                  {parseFloat(analytics.overview.userGrowthRate) >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1 text-red-600 dark:text-red-400" />
                  )}
                  {analytics.overview.userGrowthRate ?? '0'}% growth
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
                <div className="text-2xl font-bold">{(analytics.overview.totalTickets ?? 0).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Across all servers</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Players per Server</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.overview.avgPlayersPerServer}</div>
                <div className="text-xs text-muted-foreground">Engagement metric</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Tickets per Server</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.overview.avgTicketsPerServer}</div>
                <div className="text-xs text-muted-foreground">Support activity</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Server Registration Trend</CardTitle>
              <CardDescription>Daily server registrations and cumulative growth</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.serverMetrics.registrationTrend.length === 0 ? (
                <EmptyChart message="No registration data for this period" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.serverMetrics.registrationTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="servers" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} name="Daily Registrations" />
                    <Area type="monotone" dataKey="cumulative" stackId="2" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} name="Cumulative Total" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Online Servers &amp; Players Over Time</CardTitle>
              <CardDescription>5-minute snapshots of platform activity</CardDescription>
            </CardHeader>
            <CardContent>
              {activityData.length === 0 ? (
                <EmptyChart message="No activity snapshots yet — data is collected hourly" />
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="activeServers"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.4}
                      name="Online Servers"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="onlinePlayers"
                      stroke="#82ca9d"
                      fill="#82ca9d"
                      fillOpacity={0.4}
                      name="Online Players"
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

            {/* Snapshot-based distribution charts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Platform Distribution</CardTitle>
                  <CardDescription>Live servers by platform type</CardDescription>
                </CardHeader>
                <CardContent>
                  {serverDistributions.byPlatform.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={serverDistributions.byPlatform}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) => `${name} (${percentage}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {serverDistributions.byPlatform.map((_entry, index) => (
                            <Cell key={`platform-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-12">No live servers.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Minecraft Version</CardTitle>
                  <CardDescription>Live servers by MC version</CardDescription>
                </CardHeader>
                <CardContent>
                  {serverDistributions.byVersion.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={serverDistributions.byVersion}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) => `${name} (${percentage}%)`}
                          outerRadius={80}
                          fill="#82ca9d"
                          dataKey="value"
                        >
                          {serverDistributions.byVersion.map((_entry, index) => (
                            <Cell key={`version-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-12">No live servers.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Plugin Version</CardTitle>
                  <CardDescription>Live servers by modl plugin version</CardDescription>
                </CardHeader>
                <CardContent>
                  {serverDistributions.byPluginVersion.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={serverDistributions.byPluginVersion}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) => `${name} (${percentage}%)`}
                          outerRadius={80}
                          fill="#ffc658"
                          dataKey="value"
                        >
                          {serverDistributions.byPluginVersion.map((_entry, index) => (
                            <Cell key={`plugin-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-12">No live servers.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            {/* Live Snapshot Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Server className="h-4 w-4 mr-2" />
                    Live Servers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.usageStatistics.liveServers.length}</div>
                  <div className="text-xs text-muted-foreground">Currently connected</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    Online Players
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.usageStatistics.totalPlayerCount.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Across all live servers</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Activity className="h-4 w-4 mr-2" />
                    Snapshot Window
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.usageStatistics.serverActivity.length}</div>
                  <div className="text-xs text-muted-foreground">Data points (last 24h, every 5 min)</div>
                </CardContent>
              </Card>
            </div>

            {/* Active Servers Over Time */}
            <Card>
              <CardHeader>
                <CardTitle>Active Servers (Last 24h)</CardTitle>
                <CardDescription>Number of servers with recent heartbeats, sampled every 5 minutes</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.usageStatistics.serverActivity.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={analytics.usageStatistics.serverActivity.map(p => ({
                      ...p,
                      date: new Date(p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="activeServers"
                        stroke="#8884d8"
                        fill="#8884d8"
                        fillOpacity={0.4}
                        name="Active Servers"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-12">No snapshot data yet. Data appears after the first 5-minute collection cycle.</p>
                )}
              </CardContent>
            </Card>

            {/* Player Activity Over Time */}
            <Card>
              <CardHeader>
                <CardTitle>Player Activity (Last 24h)</CardTitle>
                <CardDescription>Total online players across all servers, sampled every 5 minutes</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.usageStatistics.playerActivity.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={analytics.usageStatistics.playerActivity.map(p => ({
                      ...p,
                      date: new Date(p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="players"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.4}
                        name="Online Players"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-12">No player activity data yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Live Server Instances */}
            <Card>
              <CardHeader>
                <CardTitle>Live Server Instances</CardTitle>
                <CardDescription>Servers currently connected to the platform (from latest snapshot)</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.usageStatistics.liveServers.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.usageStatistics.liveServers.map((server) => (
                      <div key={server.serverId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <div>
                            <p className="font-medium">{server.serverName}</p>
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">{server.platform}</Badge>
                              {server.version && <span>MC {server.version}</span>}
                              {server.pluginVersion && <span>v{server.pluginVersion}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{server.playerCount}</p>
                          <p className="text-xs text-muted-foreground">players</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No servers currently connected.</p>
                )}
              </CardContent>
            </Card>

            {/* Top Servers by User Count */}
            <Card>
              <CardHeader>
                <CardTitle>Top Servers by User Count</CardTitle>
                <CardDescription>Most active servers in the network</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.usageStatistics.topServersByUsers.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.usageStatistics.topServersByUsers.slice(0, 10).map((server, index) => (
                      <div key={server.serverName} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold">#{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium">{server.serverName}</p>
                            <p className="text-sm text-muted-foreground">{server.customDomain}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{(server.userCount ?? 0).toLocaleString()}</p>
                          <p className="text-sm text-muted-foreground">users</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No server data available.</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="health" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Error Rates</CardTitle>
              <CardDescription>Error, warning, and critical issue trends</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.systemHealth.errorRates.length === 0 ? (
                <EmptyChart message="No error rate data for this period" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.systemHealth.errorRates}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="critical" stackId="1" stroke="#dc2626" fill="#dc2626" fillOpacity={0.8} name="Critical" />
                    <Area type="monotone" dataKey="errors" stackId="1" stroke="#ea580c" fill="#ea580c" fillOpacity={0.8} name="Errors" />
                    <Area type="monotone" dataKey="warnings" stackId="1" stroke="#ca8a04" fill="#ca8a04" fillOpacity={0.8} name="Warnings" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
