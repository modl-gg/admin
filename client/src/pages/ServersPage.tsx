import { useState, useMemo, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@modl-gg/shared-web/components/ui/card';
import { Button } from '@modl-gg/shared-web/components/ui/button';
import { Input } from '@modl-gg/shared-web/components/ui/input';
import { Badge } from '@modl-gg/shared-web/components/ui/badge';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@modl-gg/shared-web/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@modl-gg/shared-web/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@modl-gg/shared-web/components/ui/select';
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
  Trash2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown
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
  userCount?: number;
  ticketCount?: number;
  region?: string;
  lastActivityAt?: string;
}

type SortField = 'serverName' | 'customDomain' | 'adminEmail' | 'plan' | 'createdAt' | 'userCount' | 'lastActivityAt';
type SortDirection = 'asc' | 'desc';

export default function ServersPage() {
  const { session, logout } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedPlan, selectedStatus, pageSize]);

  const { 
    data: serversData, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['servers', { 
      search: searchTerm, 
      plan: selectedPlan, 
      status: selectedStatus,
      page: currentPage,
      limit: pageSize,
      sort: sortField,
      order: sortDirection
    }],
    queryFn: async () => {
      const response = await apiClient.getServers({
        search: searchTerm || undefined,
        plan: selectedPlan !== 'all' ? selectedPlan : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        page: currentPage,
        limit: pageSize,
        sort: sortField,
        order: sortDirection,
      });
      return response.data;
    },
  });

  const servers = serversData?.servers || [];
  const pagination = serversData?.pagination || { total: 0, pages: 0, page: 1, limit: pageSize };

  // Use server-side sorted data directly since we're now passing sort parameters to the API
  const sortedServers = servers;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-muted-foreground" />;
    }
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4 text-primary" /> : 
      <ChevronDown className="w-4 h-4 text-primary" />;
  };

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
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search servers, domains, or emails..."
                      value={searchTerm}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="All Plans" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Plans</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="unverified">Unverified</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={pageSize.toString()} onValueChange={(value: string) => setPageSize(Number(value))}>
                    <SelectTrigger className="w-full sm:w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
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
                <div className="space-y-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Server Name</TableHead>
                          <TableHead className="hidden sm:table-cell">Domain</TableHead>
                          <TableHead className="hidden md:table-cell">Admin Email</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden lg:table-cell">Users</TableHead>
                          <TableHead className="hidden xl:table-cell">Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...Array(pageSize)].map((_, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="h-4 bg-muted animate-pulse rounded"></div>
                                <div className="h-3 bg-muted animate-pulse rounded w-2/3 sm:hidden"></div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="h-4 bg-muted animate-pulse rounded w-full"></div>
                            </TableCell>
                            <TableCell>
                              <div className="h-6 bg-muted animate-pulse rounded w-16"></div>
                            </TableCell>
                            <TableCell>
                              <div className="h-6 bg-muted animate-pulse rounded w-20"></div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <div className="h-4 bg-muted animate-pulse rounded w-8"></div>
                            </TableCell>
                            <TableCell className="hidden xl:table-cell">
                              <div className="h-4 bg-muted animate-pulse rounded w-24"></div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end space-x-1">
                                <div className="h-8 w-8 bg-muted animate-pulse rounded"></div>
                                <div className="h-8 w-8 bg-muted animate-pulse rounded"></div>
                                <div className="h-8 w-8 bg-muted animate-pulse rounded"></div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-destructive">Failed to load servers</p>
                  <p className="text-sm text-muted-foreground">{(error as any)?.message}</p>
                </div>
              ) : sortedServers.length === 0 ? (
                <div className="text-center py-12">
                  <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">No servers found</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    {searchTerm || selectedPlan !== 'all' || selectedStatus !== 'all' 
                      ? 'Try adjusting your search terms or filters to find what you\'re looking for.' 
                      : 'Servers will appear here once they are registered and provisioned.'
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 select-none transition-colors"
                            onClick={() => handleSort('serverName')}
                          >
                            <div className="flex items-center space-x-2">
                              <span>Server Name</span>
                              {renderSortIcon('serverName')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 select-none transition-colors hidden sm:table-cell"
                            onClick={() => handleSort('customDomain')}
                          >
                            <div className="flex items-center space-x-2">
                              <span>Domain</span>
                              {renderSortIcon('customDomain')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 select-none transition-colors hidden md:table-cell"
                            onClick={() => handleSort('adminEmail')}
                          >
                            <div className="flex items-center space-x-2">
                              <span>Admin Email</span>
                              {renderSortIcon('adminEmail')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 select-none transition-colors"
                            onClick={() => handleSort('plan')}
                          >
                            <div className="flex items-center space-x-2">
                              <span>Plan</span>
                              {renderSortIcon('plan')}
                            </div>
                          </TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 select-none transition-colors hidden lg:table-cell"
                            onClick={() => handleSort('userCount')}
                          >
                            <div className="flex items-center space-x-2">
                              <span>Users</span>
                              {renderSortIcon('userCount')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 select-none transition-colors hidden xl:table-cell"
                            onClick={() => handleSort('createdAt')}
                          >
                            <div className="flex items-center space-x-2">
                              <span>Created</span>
                              {renderSortIcon('createdAt')}
                            </div>
                          </TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedServers.map((server: ModlServer) => (
                          <TableRow key={server._id} className="hover:bg-muted/30 transition-colors">
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium">
                                  <Link href={`/servers/${server._id}`} className="hover:text-primary transition-colors">
                                    {server.serverName}
                                  </Link>
                                </div>
                                <div className="text-xs text-muted-foreground sm:hidden">
                                  {server.customDomain}.modl.gg
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <div className="text-sm font-mono text-muted-foreground">
                                {server.customDomain}.modl.gg
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="text-sm">{server.adminEmail}</div>
                            </TableCell>
                            <TableCell>
                              {getPlanBadge(server.plan)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(server)}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <div className="text-sm text-muted-foreground">
                                {server.userCount ?? '-'}
                              </div>
                            </TableCell>
                            <TableCell className="hidden xl:table-cell">
                              <div className="text-sm text-muted-foreground">
                                {formatDate(server.createdAt)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end space-x-1">
                                <Link href={`/servers/${server._id}`}>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </Link>
                                <Button variant="ghost" size="sm" disabled className="h-8 w-8 p-0">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" disabled className="h-8 w-8 p-0">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {pagination && pagination.pages > 1 && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total} results
                      </div>
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious 
                              href="#"
                              onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                                e.preventDefault();
                                if (currentPage > 1) setCurrentPage(currentPage - 1);
                              }}
                              className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                            />
                          </PaginationItem>
                          
                          {[...Array(Math.min(pagination.pages, 7))].map((_, i) => {
                            let pageNum;
                            if (pagination.pages <= 7) {
                              pageNum = i + 1;
                            } else if (currentPage <= 4) {
                              pageNum = i + 1;
                            } else if (currentPage >= pagination.pages - 3) {
                              pageNum = pagination.pages - 6 + i;
                            } else {
                              pageNum = currentPage - 3 + i;
                            }
                            
                            if (pageNum < 1 || pageNum > pagination.pages) return null;
                            
                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationLink
                                  href="#"
                                  onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                                    e.preventDefault();
                                    setCurrentPage(pageNum);
                                  }}
                                  isActive={currentPage === pageNum}
                                >
                                  {pageNum}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          })}
                          
                          <PaginationItem>
                            <PaginationNext 
                              href="#"
                              onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                                e.preventDefault();
                                if (currentPage < pagination.pages) setCurrentPage(currentPage + 1);
                              }}
                              className={currentPage >= pagination.pages ? 'pointer-events-none opacity-50' : ''}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
} 