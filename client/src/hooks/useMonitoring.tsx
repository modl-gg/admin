import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

interface DashboardMetrics {
  servers: {
    total: number;
    active: number;
    pending: number;
    failed: number;
    recentRegistrations: number;
  };
  logs: {
    last24h: {
      total: number;
      critical: number;
      error: number;
      warning: number;
    };
    unresolved: {
      critical: number;
      error: number;
    };
  };
  systemHealth: {
    score: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
  };
  trends: any[];
  lastUpdated: string;
}

interface SystemLog {
  _id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  source: string;
  timestamp: string;
  serverId?: string;
  category?: string;
  resolved?: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  metadata?: Record<string, any>;
}

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'critical';
  checks: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'critical' | 'unknown';
    message: string;
    responseTime?: number;
    count?: number;
    error?: string;
  }>;
  timestamp: string;
}

export function useDashboardMetrics() {
  return useQuery<DashboardMetrics>({
    queryKey: ['monitoring', 'dashboard'],
    queryFn: async () => {
      const response = await apiClient.getDashboardMetrics();
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 20000, // Data is fresh for 20 seconds
  });
}

export function useSystemHealth() {
  return useQuery<HealthCheck>({
    queryKey: ['monitoring', 'health'],
    queryFn: async () => {
      const response = await apiClient.getSystemHealth();
      return response.data;
    },
    refetchInterval: 15000, // Refetch every 15 seconds
    staleTime: 10000, // Data is fresh for 10 seconds
  });
}

export function useSystemLogs(params?: {
  page?: number;
  limit?: number;
  level?: string;
  source?: string;
  category?: string;
  resolved?: boolean;
  search?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ['monitoring', 'logs', params],
    queryFn: () => apiClient.getSystemLogs(params),
    staleTime: 10000, // 10 seconds
  });
}

export function useLogSources() {
  return useQuery({
    queryKey: ['monitoring', 'sources'],
    queryFn: async () => {
      const response = await apiClient.getLogSources();
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useResolveLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ logId, resolvedBy }: { logId: string; resolvedBy?: string }) =>
      apiClient.resolveLog(logId, resolvedBy),
    onSuccess: () => {
      // Invalidate logs and dashboard metrics
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'logs'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'dashboard'] });
    },
  });
}

export function useCreateLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (logData: {
      level: 'info' | 'warning' | 'error' | 'critical';
      message: string;
      source: string;
      category?: string;
      metadata?: Record<string, any>;
    }) => apiClient.createLog(logData),
    onSuccess: () => {
      // Invalidate logs and dashboard metrics
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'logs'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'dashboard'] });
    },
  });
}

// Real-time monitoring hook using polling
export function useRealTimeMetrics() {
  const dashboardQuery = useDashboardMetrics();
  const healthQuery = useSystemHealth();

  return {
    metrics: dashboardQuery.data,
    health: healthQuery.data,
    isLoading: dashboardQuery.isLoading || healthQuery.isLoading,
    error: dashboardQuery.error || healthQuery.error,
    lastUpdated: dashboardQuery.dataUpdatedAt,
  };
} 