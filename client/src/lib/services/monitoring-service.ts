import { create } from '@bufbuild/protobuf';
import {
  AdminMonitoringDashboardResponseSchema,
  AdminMonitoringDeleteLogsResponseSchema,
  AdminMonitoringHealthResponseSchema,
  AdminMonitoringLogMetricsSchema,
  AdminMonitoringLogWindowSchema,
  AdminMonitoringLogsResponseSchema,
  AdminMonitoringServerMetricsSchema,
  AdminMonitoringSourcesResponseSchema,
  AdminMonitoringSystemHealthSummarySchema,
  AdminMonitoringSystemLogMutationResponseSchema,
  AdminMonitoringUnresolvedLogsSchema,
  DeleteLogsRequestSchema,
  ResolveLogRequestSchema,
  type AdminMonitoringHealthCheck,
  type SystemLogResponse,
} from '@modl-gg/proto/modl/v1/admin_pb.ts';
import { requestBlob } from '@/lib/api';
import { protoFetch, protoSend, requireData } from '@/lib/proto-fetch';
import { mapPagination, toEpochMillisString, toNum, tsToIso } from '@/lib/proto-ui';

export type LogLevel = 'info' | 'warning' | 'error' | 'critical';

export interface DashboardMetrics {
  servers: {
    total: number;
    active: number;
    pending: number;
    failed: number;
    recentRegistrations: number;
    concurrentServers: number;
    concurrentPlayers: number;
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
  trends: Array<Record<string, unknown>>;
  lastUpdated?: string;
}

export interface SystemLog {
  id: string;
  level: LogLevel;
  message: string;
  source: string;
  category?: string;
  timestamp: string;
  serverId?: string;
  metadata?: Record<string, unknown>;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface LogsPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface LogsResponse {
  logs: SystemLog[];
  pagination: LogsPagination;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'critical';
  checks: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'critical' | 'unknown';
    message: string;
    responseTime?: number;
    count?: number;
    error?: string;
  }>;
  timestamp?: string;
}

export interface LogFilters {
  page?: number;
  limit?: number;
  level?: string;
  source?: string;
  category?: string;
  resolved?: boolean;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'timestamp' | 'level';
  sortOrder?: 'asc' | 'desc';
}

function toLogLevel(value: string): LogLevel {
  const normalized = value.toLowerCase();
  if (normalized === 'critical' || normalized === 'error' || normalized === 'warning') {
    return normalized;
  }

  return 'info';
}

function toCheckStatus(value: string): HealthCheck['checks'][number]['status'] {
  const normalized = value.toLowerCase();
  if (normalized === 'healthy' || normalized === 'degraded' || normalized === 'critical') {
    return normalized;
  }

  return 'unknown';
}

function toHealthStatus(value: string): HealthCheck['status'] {
  const normalized = value.toLowerCase();
  if (normalized === 'healthy' || normalized === 'critical') {
    return normalized;
  }

  return 'degraded';
}

function toSystemHealthStatus(value: string): DashboardMetrics['systemHealth']['status'] {
  const normalized = value.toLowerCase();
  if (normalized === 'excellent' || normalized === 'good' || normalized === 'fair') {
    return normalized;
  }

  return 'poor';
}

function toNonEmptyStrings(values: string[]): string[] {
  return values.filter((entry) => entry.length > 0);
}

function mapLog(log: SystemLogResponse): SystemLog {
  return {
    id: log.id,
    level: toLogLevel(log.level),
    message: log.message,
    source: log.source || 'unknown',
    category: log.category,
    timestamp: tsToIso(log.timestamp) ?? '',
    serverId: log.serverId,
    metadata: log.metadata,
    resolved: log.resolved,
    resolvedBy: log.resolvedBy,
    resolvedAt: tsToIso(log.resolvedAt),
  };
}

function mapHealthCheckEntry(check: AdminMonitoringHealthCheck): HealthCheck['checks'][number] {
  return {
    name: check.name,
    status: toCheckStatus(check.status),
    message: check.message ?? '',
    responseTime: check.responseTime !== undefined ? toNum(check.responseTime) : undefined,
    count: check.count !== undefined ? toNum(check.count) : undefined,
    error: check.error,
  };
}

function buildQuery(filters?: LogFilters): string {
  const params = new URLSearchParams();

  if (!filters) {
    return '';
  }

  if (filters.page !== undefined) params.append('page', String(filters.page));
  if (filters.limit !== undefined) params.append('limit', String(filters.limit));
  if (filters.level) params.append('level', filters.level);
  if (filters.source) params.append('source', filters.source);
  if (filters.category) params.append('category', filters.category);
  if (filters.resolved !== undefined) params.append('resolved', String(filters.resolved));
  if (filters.search) params.append('search', filters.search);

  const startDateMillis = toEpochMillisString(filters.startDate);
  if (startDateMillis) params.append('startDate', startDateMillis);

  const endDateMillis = toEpochMillisString(filters.endDate);
  if (endDateMillis) params.append('endDate', endDateMillis);

  if (filters.sortBy) params.append('sort', filters.sortBy);
  if (filters.sortOrder) params.append('order', filters.sortOrder);

  const query = params.toString();
  return query ? `?${query}` : '';
}

export const monitoringService = {
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const response = await protoFetch(AdminMonitoringDashboardResponseSchema, '/v1/admin/monitoring/dashboard');
    const data = requireData(response.data, 'admin monitoring dashboard');

    const servers = data.servers ?? create(AdminMonitoringServerMetricsSchema);
    const logs = data.logs ?? create(AdminMonitoringLogMetricsSchema);
    const last24h = logs.last24h ?? create(AdminMonitoringLogWindowSchema);
    const unresolved = logs.unresolved ?? create(AdminMonitoringUnresolvedLogsSchema);
    const systemHealth = data.systemHealth ?? create(AdminMonitoringSystemHealthSummarySchema);

    return {
      servers: {
        total: toNum(servers.total),
        active: toNum(servers.active),
        pending: toNum(servers.pending),
        failed: toNum(servers.failed),
        recentRegistrations: toNum(servers.recentRegistrations),
        concurrentServers: toNum(servers.concurrentServers),
        concurrentPlayers: toNum(servers.concurrentPlayers),
      },
      logs: {
        last24h: {
          total: toNum(last24h.total),
          critical: toNum(last24h.critical),
          error: toNum(last24h.error),
          warning: toNum(last24h.warning),
        },
        unresolved: {
          critical: toNum(unresolved.critical),
          error: toNum(unresolved.error),
        },
      },
      systemHealth: {
        score: systemHealth.score,
        status: toSystemHealthStatus(systemHealth.status),
      },
      trends: data.trends,
      lastUpdated: tsToIso(data.lastUpdated),
    };
  },

  async getSystemHealth(): Promise<HealthCheck> {
    const response = await protoFetch(AdminMonitoringHealthResponseSchema, '/v1/admin/monitoring/health');
    const data = requireData(response.data, 'admin monitoring health');

    return {
      status: toHealthStatus(data.status),
      checks: data.checks.map(mapHealthCheckEntry),
      timestamp: tsToIso(data.timestamp),
    };
  },

  async getSystemLogs(filters?: LogFilters): Promise<LogsResponse> {
    const query = buildQuery(filters);
    const response = await protoFetch(AdminMonitoringLogsResponseSchema, `/v1/admin/monitoring/logs${query}`);
    const data = requireData(response.data, 'admin monitoring logs');

    return {
      logs: data.logs.map(mapLog),
      pagination: mapPagination(data.pagination, 50),
    };
  },

  async getLogSources(): Promise<{ sources: string[]; categories: string[] }> {
    const response = await protoFetch(AdminMonitoringSourcesResponseSchema, '/v1/admin/monitoring/sources');
    const data = requireData(response.data, 'admin monitoring sources');

    return {
      sources: toNonEmptyStrings(data.sources),
      categories: toNonEmptyStrings(data.categories),
    };
  },

  async resolveLog(logId: string, resolvedBy = 'admin'): Promise<SystemLog> {
    const response = await protoSend(
      'PUT',
      `/v1/admin/monitoring/logs/${logId}/resolve`,
      ResolveLogRequestSchema,
      create(ResolveLogRequestSchema, { resolvedBy }),
      AdminMonitoringSystemLogMutationResponseSchema,
    );

    return mapLog(requireData(response.data, 'admin monitoring resolve log'));
  },

  async deleteLogs(logIds: string[]): Promise<number> {
    const response = await protoSend(
      'POST',
      '/v1/admin/monitoring/logs/delete',
      DeleteLogsRequestSchema,
      create(DeleteLogsRequestSchema, { logIds }),
      AdminMonitoringDeleteLogsResponseSchema,
    );

    const data = requireData(response.data, 'admin monitoring delete logs');
    return toNum(data.deletedCount);
  },

  async exportLogs(filters?: Omit<LogFilters, 'page' | 'limit' | 'sortBy' | 'sortOrder'>): Promise<Blob> {
    const query = buildQuery(filters);
    return requestBlob(`/v1/admin/monitoring/logs/export${query}`);
  },

  async clearAllLogs(): Promise<number> {
    const response = await protoFetch(AdminMonitoringDeleteLogsResponseSchema, '/v1/admin/monitoring/logs/clear-all', {
      method: 'POST',
    });

    const data = requireData(response.data, 'admin monitoring clear logs');
    return toNum(data.deletedCount);
  },
};
