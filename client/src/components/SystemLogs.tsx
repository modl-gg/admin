import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@modl-gg/shared-web/components/ui/button';
import { Input } from '@modl-gg/shared-web/components/ui/input';
import { Badge } from '@modl-gg/shared-web/components/ui/badge';
import { Card, CardContent } from '@modl-gg/shared-web/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@modl-gg/shared-web/components/ui/select';
import { Checkbox } from '@modl-gg/shared-web/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@modl-gg/shared-web/components/ui/alert-dialog';
import { apiClient } from '@/lib/api';
import { formatDate, formatDateRelative } from '@/lib/utils';
import { useSocket } from '@/hooks/use-socket';
import { 
  Search,
  Filter,
  Download,
  Trash2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  RotateCcw,
  Calendar,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  FileText,
  Wifi,
  WifiOff,
  Zap
} from 'lucide-react';

interface SystemLog {
  _id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  source: string;
  category?: string;
  timestamp: string;
  metadata?: Record<string, any>;
  resolved?: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
}

interface LogFilters {
  level: string;
  source: string;
  category: string;
  resolved: string;
  search: string;
  startDate: string;
  endDate: string;
}

export default function SystemLogs() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedLogs, setSelectedLogs] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [sortBy, setSortBy] = useState<'timestamp' | 'level'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [realTimeEnabled, setRealTimeEnabled] = useState(true);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  
  const [filters, setFilters] = useState<LogFilters>({
    level: 'all',
    source: 'all',
    category: 'all',
    resolved: 'all',
    search: '',
    startDate: '',
    endDate: ''
  });

  // Socket.IO for real-time updates
  const { isConnected, newLogs, clearNewLogs, startLogStream, stopLogStream } = useSocket();

  // Start/stop real-time streaming based on user preference
  useEffect(() => {
    if (realTimeEnabled && isConnected) {
      startLogStream();
    } else {
      stopLogStream();
    }
  }, [realTimeEnabled, isConnected]);

  // Auto-refresh logs when new real-time logs arrive
  useEffect(() => {
    if (newLogs.length > 0 && realTimeEnabled) {
      // Invalidate queries to refresh the log list
      queryClient.invalidateQueries({ queryKey: ['system-logs'] });
      // Clear the new logs buffer after a short delay
      const timer = setTimeout(() => {
        clearNewLogs();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [newLogs, realTimeEnabled, queryClient, clearNewLogs]);

  // Fetch logs with real-time updates
  const { data: logsData, isLoading, error, refetch } = useQuery({
    queryKey: ['system-logs', page, filters, sortBy, sortOrder],
    queryFn: async () => {
      const params = {
        page,
        limit: 20,
        sortBy,
        sortOrder,
        ...(filters.level !== 'all' && { level: filters.level }),
        ...(filters.source !== 'all' && { source: filters.source }),
        ...(filters.category !== 'all' && { category: filters.category }),
        ...(filters.resolved !== 'all' && { resolved: filters.resolved === 'true' }),
        ...(filters.search && { search: filters.search }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate })
      };
      const response = await apiClient.getSystemLogs(params);
      return response.data;
    },
    refetchInterval: autoRefresh ? 15000 : false, // Refresh every 15 seconds
  });

  // Get available log sources
  const { data: sourcesData } = useQuery({
    queryKey: ['log-sources'],
    queryFn: async () => {
      const response = await apiClient.getLogSources();
      return response.data;
    },
  });

  const sources = sourcesData?.sources || [];
  const categories = sourcesData?.categories || [];

  // Get PM2 status
  const { data: pm2Status } = useQuery({
    queryKey: ['pm2-status'],
    queryFn: async () => {
      const response = await fetch('/api/monitoring/pm2-status', {
        credentials: 'include'
      });
      const data = await response.json();
      return data;
    },
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Resolve logs mutation
  const resolveMutation = useMutation({
    mutationFn: async (logIds: string[]) => {
      const promises = logIds.map(id => apiClient.resolveLog(id, 'admin'));
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-logs'] });
      setSelectedLogs([]);
    },
  });

  // Delete logs mutation
  const deleteMutation = useMutation({
    mutationFn: async (logIds: string[]) => {
      const response = await fetch('/api/monitoring/logs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ logIds })
      });
      if (!response.ok) throw new Error('Failed to delete logs');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-logs'] });
      setSelectedLogs([]);
    },
  });

  // Export logs mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({
        ...(filters.level !== 'all' && { level: filters.level }),
        ...(filters.source !== 'all' && { source: filters.source }),
        ...(filters.category !== 'all' && { category: filters.category }),
        ...(filters.resolved !== 'all' && { resolved: filters.resolved }),
        ...(filters.search && { search: filters.search }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate })
      });
      
      const response = await fetch(`/api/monitoring/logs/export?${params}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Failed to export logs');
      
      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });

  // Clear all logs mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/monitoring/logs/clear-all', {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to clear logs');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-logs'] });
      setSelectedLogs([]);
      setShowClearAllDialog(false);
    },
  });

  const logs = logsData?.logs || [];
  const pagination = logsData?.pagination;

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return <Badge variant="destructive" className="bg-red-600 dark:bg-red-700"><XCircle className="h-3 w-3 mr-1" />Critical</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Error</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500 dark:bg-yellow-600"><AlertTriangle className="h-3 w-3 mr-1" />Warning</Badge>;
      case 'info':
        return <Badge variant="secondary"><Info className="h-3 w-3 mr-1" />Info</Badge>;
      default:
        return <Badge variant="outline">{level}</Badge>;
    }
  };

  const handleSelectAll = () => {
    if (selectedLogs.length === logs.length) {
      setSelectedLogs([]);
    } else {
      setSelectedLogs(logs.map(log => log._id));
    }
  };

  const handleSelectLog = (logId: string) => {
    setSelectedLogs(prev => 
      prev.includes(logId) 
        ? prev.filter(id => id !== logId)
        : [...prev, logId]
    );
  };

  const handleResolveSelected = () => {
    if (selectedLogs.length > 0) {
      resolveMutation.mutate(selectedLogs);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedLogs.length > 0) {
      const confirmed = window.confirm(`Are you sure you want to delete ${selectedLogs.length} selected log(s)? This action cannot be undone.`);
      if (confirmed) {
        deleteMutation.mutate(selectedLogs);
      }
    }
  };

  const handleExportLogs = () => {
    exportMutation.mutate();
  };

  const confirmClearAllLogs = () => {
    clearAllMutation.mutate();
  };

  const handleFilterChange = (key: keyof LogFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filtering
  };

  const clearFilters = () => {
    setFilters({
      level: 'all',
      source: 'all',
      category: 'all',
      resolved: 'all',
      search: '',
      startDate: '',
      endDate: ''
    });
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col gap-4">
        {/* Title row with badges */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">System Logs</h3>
          <div className="flex items-center space-x-2">
            {newLogs.length > 0 && (
              <Badge variant="default" className="bg-blue-600 dark:bg-blue-700">
                <Zap className="h-3 w-3 mr-1" />
                {newLogs.length} new
              </Badge>
            )}
            {pm2Status?.data && (
              <Badge 
                variant={pm2Status.data.isEnabled && pm2Status.data.isStreaming ? "default" : "destructive"}
                className={pm2Status.data.isEnabled && pm2Status.data.isStreaming ? "bg-green-600 dark:bg-green-700" : "bg-red-600 dark:bg-red-700"}
              >
                PM2 {!pm2Status.data.isEnabled ? 'Disabled' : pm2Status.data.isStreaming ? 'Active' : 'Inactive'}
              </Badge>
            )}
          </div>
        </div>

        {/* Controls row */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setRealTimeEnabled(!realTimeEnabled)}
              className={realTimeEnabled && isConnected ? 'text-green-600 dark:text-green-400 border-green-600 dark:border-green-400' : ''}
            >
              {isConnected ? (
                <Wifi className={`h-4 w-4 mr-2 ${realTimeEnabled ? 'text-green-600 dark:text-green-400' : ''}`} />
              ) : (
                <WifiOff className="h-4 w-4 mr-2 text-red-500 dark:text-red-400" />
              )}
              {realTimeEnabled ? 'Real-time' : 'Static'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? 'text-blue-600 dark:text-blue-400' : ''}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto-refresh' : 'Manual'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        
          <div className="flex items-center space-x-2">
            {selectedLogs.length > 0 && (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleResolveSelected}
                  disabled={resolveMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Resolve ({selectedLogs.length})
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDeleteSelected}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete ({selectedLogs.length})
                </Button>
              </>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportLogs}
              disabled={exportMutation.isPending}
            >
              <Download className="h-4 w-4 mr-2" />
              {exportMutation.isPending ? 'Exporting...' : 'Export'}
            </Button>
            <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  disabled={clearAllMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {clearAllMutation.isPending ? 'Clearing...' : 'Clear All'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All System Logs</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete ALL system logs? This action cannot be undone and will permanently remove all log entries from the database.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={confirmClearAllLogs}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete All Logs
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Level</label>
                <Select value={filters.level} onValueChange={(value) => handleFilterChange('level', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Source</label>
                <Select value={filters.source} onValueChange={(value) => handleFilterChange('source', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {sources?.map((source: string) => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={filters.resolved} onValueChange={(value) => handleFilterChange('resolved', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="false">Unresolved</SelectItem>
                    <SelectItem value="true">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Sort By</label>
                <div className="flex space-x-2">
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'timestamp' | 'level')}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="timestamp">Time</SelectItem>
                      <SelectItem value="level">Level</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search messages..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Start Date</label>
                <Input
                  type="datetime-local"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">End Date</label>
                <Input
                  type="datetime-local"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs Table */}
      <div className="border rounded-lg">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading logs...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
            <p className="text-destructive">Failed to load logs</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No logs found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your filters or check back later</p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="border-b p-4 bg-muted/50">
              <div className="flex items-center space-x-4">
                <Checkbox
                  checked={selectedLogs.length === logs.length}
                  onCheckedChange={handleSelectAll}
                />
                <div className="grid grid-cols-12 gap-4 flex-1 text-sm font-medium">
                  <div className="col-span-1">Level</div>
                  <div className="col-span-2">Source</div>
                  <div className="col-span-5">Message</div>
                  <div className="col-span-2">Time</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Actions</div>
                </div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y">
              {logs.map((log: SystemLog) => (
                <div key={log._id} className="p-4 hover:bg-muted/30">
                  <div className="flex items-start space-x-4">
                    <Checkbox
                      checked={selectedLogs.includes(log._id)}
                      onCheckedChange={() => handleSelectLog(log._id)}
                    />
                    <div className="grid grid-cols-12 gap-4 flex-1">
                      <div className="col-span-1">
                        {getLevelBadge(log.level)}
                      </div>
                      <div className="col-span-2">
                        <div className="text-sm font-medium">{log.source}</div>
                        {log.category && (
                          <div className="text-xs text-muted-foreground">{log.category}</div>
                        )}
                      </div>
                      <div className="col-span-5">
                        <div className="text-sm">{log.message}</div>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {Object.entries(log.metadata).slice(0, 2).map(([key, value]) => (
                              <span key={key} className="mr-2">
                                {key}: {String(value)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <div className="text-sm">{formatDateRelative(log.timestamp)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(log.timestamp)}
                        </div>
                      </div>
                      <div className="col-span-1">
                        {log.resolved ? (
                          <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400">
                            Resolved
                          </Badge>
                        ) : (
                          <Badge variant="outline">Open</Badge>
                        )}
                      </div>
                      <div className="col-span-1">
                        <div className="flex space-x-1">
                          <Button variant="ghost" size="sm" disabled>
                            <Eye className="h-3 w-3" />
                          </Button>
                          {!log.resolved && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => resolveMutation.mutate([log._id])}
                              disabled={resolveMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="border-t p-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} logs
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= pagination.pages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 