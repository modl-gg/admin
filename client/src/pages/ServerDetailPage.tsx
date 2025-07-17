import React, { useState } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'modl-shared-web/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'modl-shared-web/components/ui/card';
import { Badge } from 'modl-shared-web/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'modl-shared-web/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api';
import { formatDate, formatDateRelative, formatBytes } from '@/lib/utils';
import { 
  ArrowLeft,
  Server,
  Globe,
  Database,
  Calendar,
  Activity,
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  LogOut,
  Edit,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'modl-shared-web/components/ui/alert-dialog';
import { EditServerModal } from '@/components/EditServerModal';

interface ServerDetails {
  _id: string;
  serverName: string;
  customDomain: string;
  adminEmail: string;
  plan: 'free' | 'premium';
  emailVerified: boolean;
  provisioningStatus: 'pending' | 'in-progress' | 'completed' | 'failed';
  databaseName: string;
  createdAt: string;
  updatedAt: string;
  customDomain_override?: string;
  customDomain_status?: 'pending' | 'active' | 'error' | 'verifying';
  customDomain_lastChecked?: string;
  customDomain_error?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status?: 'active' | 'canceled' | 'past_due' | 'inactive';
  current_period_end?: string;
}

interface ServerStats {
  totalPlayers: number;
  totalTickets: number;
  totalLogs: number;
  lastActivity: string;
  databaseSize: number;
}

export default function ServerDetailPage() {
  const { id } = useParams();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data: server, isLoading, error } = useQuery<ServerDetails>({
    queryKey: ['server', id],
    queryFn: async () => {
      const response = await apiClient.getServer(id!);
      return response.data;
    },
    enabled: !!id,
  });

  const { data: stats } = useQuery<ServerStats>({
    queryKey: ['server-stats', id],
    queryFn: async () => {
      const response = await apiClient.getServerStats(id!);
      return response.data;
    },
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: (serverId: string) => apiClient.deleteServer(serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      navigate('/servers');
    },
    onError: (error) => {
      console.error('Failed to delete server:', error);
      // You might want to show a toast notification here
    },
  });

  const resetDatabaseMutation = useMutation({
    mutationFn: (serverId: string) => apiClient.resetDatabase(serverId),
    onSuccess: () => {
      // You might want to show a toast notification here
      console.log('Server reset to provisioning state successfully');
      queryClient.invalidateQueries({ queryKey: ['server-stats', id] });
      queryClient.invalidateQueries({ queryKey: ['server', id] });
    },
    onError: (error) => {
      console.error('Failed to reset server to provisioning state:', error);
    },
  });

  const exportDataMutation = useMutation({
    mutationFn: (serverId: string) => apiClient.exportData(serverId),
    onSuccess: () => {
      console.log('Data export initiated');
    },
    onError: (error) => {
      console.error('Failed to export data:', error);
    },
  });

  const handleDeleteServer = () => {
    if (server?._id) {
      deleteMutation.mutate(server._id);
    }
  };

  const handleResetDatabase = () => {
    if (server?._id) {
      resetDatabaseMutation.mutate(server._id);
    }
  };

  const handleExportData = () => {
    if (server?._id) {
      exportDataMutation.mutate(server._id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'in-progress':
        return <Badge variant="secondary"><Activity className="h-3 w-3 mr-1" />Provisioning</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    return plan === 'premium' 
      ? <Badge className="bg-purple-500">Premium</Badge>
      : <Badge variant="outline">Free</Badge>;
  };

  const getDomainStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'verifying':
        return <Badge variant="secondary"><Activity className="h-3 w-3 mr-1" />Verifying</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">Not Configured</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <Link href="/servers">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Servers
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
              <h3 className="text-lg font-semibold mb-2">Server Not Found</h3>
              <p className="text-muted-foreground">The requested server could not be found.</p>
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
              <Link href="/servers">
                <Button variant="ghost" size="sm" className="mr-4">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Servers
                </Button>
              </Link>
              <div className="flex items-center space-x-3">
                <Server className="h-6 w-6 text-muted-foreground" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{server.serverName}</h1>
                  <p className="text-sm text-muted-foreground">{server.customDomain}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
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
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Server Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Players</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalPlayers || 0}</div>
                  <p className="text-xs text-muted-foreground">Registered players</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalTickets || 0}</div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Database Size</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.databaseSize ? formatBytes(stats.databaseSize) : '0 MB'}</div>
                  <p className="text-xs text-muted-foreground">Current usage</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Last Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats?.lastActivity ? formatDateRelative(stats.lastActivity) : 'Unknown'}
                  </div>
                  <p className="text-xs text-muted-foreground">User activity</p>
                </CardContent>
              </Card>
            </div>

            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Server Information</CardTitle>
                <CardDescription>Basic server details and status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Server Name</label>
                      <p className="font-medium">{server.serverName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Subdomain</label>
                      <p className="font-medium">{server.customDomain}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Admin Email</label>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium">{server.adminEmail}</p>
                        {server.emailVerified ? (
                          <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>
                        ) : (
                          <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Unverified</Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Database Name</label>
                      <p className="font-medium">{server.databaseName}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Plan</label>
                      <div>{getPlanBadge(server.plan)}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <div>{getStatusBadge(server.provisioningStatus)}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Created</label>
                      <p className="font-medium">{formatDate(server.createdAt)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                      <p className="font-medium">{formatDate(server.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="configuration" className="space-y-6">
            {/* Domain Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Domain Configuration</CardTitle>
                <CardDescription>Custom domain and SSL settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Default Domain</label>
                    <p className="font-medium">{server.customDomain}.modl.gg</p>
                  </div>
                  
                  {server.customDomain_override && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Custom Domain</label>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium">{server.customDomain_override}</p>
                        {getDomainStatusBadge(server.customDomain_status)}
                      </div>
                      {server.customDomain_error && (
                        <p className="text-sm text-red-600 mt-1">{server.customDomain_error}</p>
                      )}
                      {server.customDomain_lastChecked && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last checked: {formatDateRelative(server.customDomain_lastChecked)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Server Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Server Actions</CardTitle>
                <CardDescription>Administrative actions for this server</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Server
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={resetDatabaseMutation.isPending}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {resetDatabaseMutation.isPending ? 'Resetting...' : 'Reset to Provisioning'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset server to provisioning state?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will reset the server back to provisioning state, clearing all data (players, tickets, logs) and allowing the provisioning system to reinitialize the database with proper structure and seed data. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetDatabase}>Confirm Reset</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={exportDataMutation.isPending}>
                        <Database className="h-4 w-4 mr-2" />
                        {exportDataMutation.isPending ? 'Exporting...' : 'Export Data'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Export Server Data</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will export all server data to a downloadable file. You will receive an email with the download link shortly.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleExportData}>Confirm Export</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Server
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the
                          server and all of its associated data.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteServer} disabled={deleteMutation.isPending}>
                          {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Server activity and logs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Activity Logs</h3>
                  <p className="mb-4">Server activity logs will be displayed here.</p>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Billing Information</CardTitle>
                <CardDescription>Subscription and payment details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Current Plan</label>
                    <div>{getPlanBadge(server.plan)}</div>
                  </div>
                  
                  {server.stripe_customer_id && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Customer ID</label>
                        <p className="font-mono text-sm">{server.stripe_customer_id}</p>
                      </div>
                      
                      {server.stripe_subscription_id && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Subscription ID</label>
                          <p className="font-mono text-sm">{server.stripe_subscription_id}</p>
                        </div>
                      )}
                      
                      {server.subscription_status && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Subscription Status</label>
                          <div>
                            <Badge variant={server.subscription_status === 'active' ? 'default' : 'secondary'}>
                              {server.subscription_status}
                            </Badge>
                          </div>
                        </div>
                      )}
                      
                      {server.current_period_end && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Current Period End</label>
                          <p className="font-medium">{formatDate(server.current_period_end)}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <EditServerModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        server={server || null}
      />
    </div>
  );
} 