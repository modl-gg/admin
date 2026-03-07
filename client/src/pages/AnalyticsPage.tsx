import { useState } from 'react';
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
  TrendingUp,
  TrendingDown,
  Users,
  Server,
  FileText,
  BarChart3,
  Activity,
  Globe,
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

  const { data: activitySnapshots } = useQuery<ActivitySnapshot[]>({
    queryKey: ['activity-snapshots', dateRange],
    queryFn: async () => {
      const response = await apiClient.getActivitySnapshots(dateRange);
      return response.data ?? [];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const activityData = (activitySnapshots ?? []).map(s => ({
    ...s,
    date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  const dateRangeSelector = (
    <Select value={dateRange} onValueChange={setDateRange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7d">Last 7 days</SelectItem>
        <SelectItem value="30d">Last 30 days</SelectItem>
        <SelectItem value="90d">Last 90 days</SelectItem>
        <SelectItem value="1y">Last year</SelectItem>
      </SelectContent>
    </Select>
  );

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
              <CardTitle>Active Servers &amp; Players Over Time</CardTitle>
              <CardDescription>Hourly snapshots of platform activity</CardDescription>
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
                      name="Active Servers"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="totalPlayers"
                      stroke="#82ca9d"
                      fill="#82ca9d"
                      fillOpacity={0.4}
                      name="Total Players"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {activityData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Total Servers Over Time</CardTitle>
                <CardDescription>Cumulative server count</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="totalServers" stroke="#ffc658" strokeWidth={2} name="Total Servers" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="servers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Server Plan Distribution</CardTitle>
              <CardDescription>Breakdown of server plans</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.serverMetrics.byPlan.length === 0 ? (
                <EmptyChart message="No plan data available" />
              ) : (
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
                      {analytics.serverMetrics.byPlan.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Server Status Distribution</CardTitle>
              <CardDescription>Current server status breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.serverMetrics.byStatus.length === 0 ? (
                <EmptyChart message="No status data available" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.serverMetrics.byStatus}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Player Growth Trend</CardTitle>
              <CardDescription>Total players across all servers over time</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.usageStatistics.playerGrowth.length === 0 ? (
                <EmptyChart message="No player growth data for this period" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.usageStatistics.playerGrowth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="players" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="New Players" />
                    <Area type="monotone" dataKey="cumulative" stackId="2" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Total Players" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ticket Volume Trend</CardTitle>
              <CardDescription>Support tickets created over time</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.usageStatistics.ticketVolume.length === 0 ? (
                <EmptyChart message="No ticket volume data for this period" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.usageStatistics.ticketVolume}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="tickets" fill="#f59e0b" name="Tickets Created" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Servers by User Count</CardTitle>
              <CardDescription>Most active servers in the network</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.usageStatistics.topServersByUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No servers with user data yet</div>
              ) : (
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
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Server Activity Timeline</CardTitle>
              <CardDescription>Daily active servers and new registrations</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.usageStatistics.serverActivity.length === 0 ? (
                <EmptyChart message="No server activity data for this period" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.usageStatistics.serverActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="activeServers" stroke="#8884d8" strokeWidth={2} name="Active Servers" />
                    <Line type="monotone" dataKey="newRegistrations" stroke="#82ca9d" strokeWidth={2} name="New Registrations" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {analytics.usageStatistics.geographicDistribution.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Geographic Distribution</CardTitle>
                <CardDescription>Server distribution by region</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {analytics.usageStatistics.geographicDistribution.map((region) => (
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
                        {analytics.usageStatistics.geographicDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
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
