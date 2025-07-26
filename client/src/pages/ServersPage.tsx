import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@modl-gg/shared-web/components/ui/card';
import { Button } from '@modl-gg/shared-web/components/ui/button';
import { Input } from '@modl-gg/shared-web/components/ui/input';
import { Badge } from '@modl-gg/shared-web/components/ui/badge';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { 
  Server, 
  Search, 
  Plus, 
  Filter,
  MoreHorizontal,
  LogOut,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';

interface ModlServer {
  _id: string;
  serverName: string;
  customDomain: string;
  adminEmail: string;
  plan: 'free' | 'premium';
  emailVerified: boolean;
  provisioningStatus: 'pending' | 'in-progress' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export default function ServersPage() {
  const { session, logout } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const { 
    data: serversData, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['servers', { search: searchTerm, plan: selectedPlan, status: selectedStatus }],
    queryFn: async () => {
      const response = await apiClient.getServers({
        search: searchTerm || undefined,
        plan: selectedPlan !== 'all' ? selectedPlan : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
      });
      return response.data;
    },
  });

  const servers = serversData?.servers || [];
  const pagination = serversData?.pagination;

  const getStatusBadge = (server: ModlServer) => {
    if (!server.emailVerified) {
      return <Badge variant="warning">Unverified</Badge>;
    }
    
    switch (server.provisioningStatus) {
      case 'completed':
        return <Badge variant="success">Active</Badge>;
      case 'pending':
      case 'in-progress':
        return <Badge variant="info">Provisioning</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    return plan === 'premium' ? (
      <Badge variant="default">Premium</Badge>
    ) : (
      <Badge variant="outline">Free</Badge>
    );
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
              <a className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                Dashboard
              </a>
            </Link>
            <Link href="/servers">
              <a className="px-3 py-2 text-sm font-medium border-b-2 border-primary text-primary">
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
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold">Server Management</h2>
              <p className="text-muted-foreground">
                Manage all modl server instances
              </p>
            </div>
            <Button className="flex items-center space-x-2" disabled>
              <Plus className="w-4 h-4" />
              <span>Add Server</span>
              <Badge variant="secondary" className="ml-2">Soon</Badge>
            </Button>
          </div>

          {/* Filters and Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search servers, domains, or emails..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <select
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value)}
                    className="px-3 py-2 border border-input rounded-md text-sm"
                  >
                    <option value="all">All Plans</option>
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                  </select>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="px-3 py-2 border border-input rounded-md text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                    <option value="unverified">Unverified</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Servers Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                Servers ({pagination?.total || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">Loading servers...</p>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-destructive">Failed to load servers</p>
                  <p className="text-sm text-muted-foreground">{(error as any)?.message}</p>
                </div>
              ) : servers.length === 0 ? (
                <div className="text-center py-8">
                  <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No servers found</p>
                  <p className="text-sm text-muted-foreground">
                    {searchTerm || selectedPlan !== 'all' || selectedStatus !== 'all' 
                      ? 'Try adjusting your filters' 
                      : 'Servers will appear here once they are registered'
                    }
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Server Name</th>
                        <th>Domain</th>
                        <th>Admin Email</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servers.map((server: ModlServer) => (
                        <tr key={server._id}>
                          <td>
                            <div className="font-medium">
                              <Link href={`/servers/${server._id}`} className="hover:text-blue-600">
                                {server.serverName}
                              </Link>
                            </div>
                          </td>
                          <td>
                            <div className="text-sm">
                              {server.customDomain}.modl.gg
                            </div>
                          </td>
                          <td>
                            <div className="text-sm">{server.adminEmail}</div>
                          </td>
                          <td>
                            {getPlanBadge(server.plan)}
                          </td>
                          <td>
                            {getStatusBadge(server)}
                          </td>
                          <td>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(server.createdAt)}
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center space-x-2">
                              <Link href={`/servers/${server._id}`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </Link>
                              <Button variant="ghost" size="sm" disabled>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" disabled>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
} 