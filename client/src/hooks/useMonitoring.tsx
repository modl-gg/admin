import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  monitoringService,
  type DashboardMetrics,
  type HealthCheck,
  type LogFilters,
  type LogLevel,
} from '@/lib/services/monitoring-service';

export function useDashboardMetrics() {
  return useQuery<DashboardMetrics>({
    queryKey: ['monitoring', 'dashboard'],
    queryFn: () => monitoringService.getDashboardMetrics(),
    refetchInterval: 30000,
    staleTime: 20000,
  });
}

export function useSystemHealth() {
  return useQuery<HealthCheck>({
    queryKey: ['monitoring', 'health'],
    queryFn: () => monitoringService.getSystemHealth(),
    refetchInterval: 15000,
    staleTime: 10000,
  });
}

export function useSystemLogs(params?: LogFilters) {
  return useQuery({
    queryKey: ['monitoring', 'logs', params],
    queryFn: () => monitoringService.getSystemLogs(params),
    staleTime: 10000,
  });
}

export function useLogSources() {
  return useQuery({
    queryKey: ['monitoring', 'sources'],
    queryFn: () => monitoringService.getLogSources(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useResolveLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ logId, resolvedBy }: { logId: string; resolvedBy?: string }) =>
      monitoringService.resolveLog(logId, resolvedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'logs'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'dashboard'] });
    },
  });
}

export function useCreateLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (logData: {
      level: LogLevel;
      message: string;
      source: string;
      category?: string;
      metadata?: Record<string, unknown>;
    }) => monitoringService.createLog(logData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'logs'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'dashboard'] });
    },
  });
}

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
