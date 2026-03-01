import { requestBlob, requestJsonRaw } from '@/lib/api';
import { normalizeDateValue, toEpochMillisString, unwrapEnvelope } from '@/lib/api-contracts/common';

export type LogLevel = 'info' | 'warning' | 'error' | 'critical';

export interface DashboardMetrics {
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

interface RawLog {
  id?: unknown;
  _id?: unknown;
  level?: unknown;
  message?: unknown;
  source?: unknown;
  category?: unknown;
  timestamp?: unknown;
  serverId?: unknown;
  metadata?: unknown;
  resolved?: unknown;
  resolvedBy?: unknown;
  resolvedAt?: unknown;
}

interface RawLogsPayload {
  logs?: unknown;
  pagination?: {
    page?: unknown;
    limit?: unknown;
    total?: unknown;
    pages?: unknown;
  };
}

interface RawLogSourcesPayload {
  sources?: unknown;
  categories?: unknown;
}

function parseNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function toLogLevel(value: unknown): LogLevel {
  if (typeof value !== 'string') {
    return 'info';
  }

  const normalized = value.toLowerCase();
  if (normalized === 'critical' || normalized === 'error' || normalized === 'warning') {
    return normalized;
  }

  return 'info';
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function mapLog(raw: RawLog): SystemLog {
  const id = typeof raw.id === 'string' ? raw.id : (typeof raw._id === 'string' ? raw._id : '');

  return {
    id,
    level: toLogLevel(raw.level),
    message: typeof raw.message === 'string' ? raw.message : '',
    source: typeof raw.source === 'string' ? raw.source : 'unknown',
    category: typeof raw.category === 'string' ? raw.category : undefined,
    timestamp: normalizeDateValue(raw.timestamp) ?? '',
    serverId: typeof raw.serverId === 'string' ? raw.serverId : undefined,
    metadata: toRecord(raw.metadata),
    resolved: raw.resolved === true,
    resolvedBy: typeof raw.resolvedBy === 'string' ? raw.resolvedBy : undefined,
    resolvedAt: normalizeDateValue(raw.resolvedAt),
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
    const raw = await requestJsonRaw<unknown>('/v1/admin/monitoring/dashboard');
    const { data } = unwrapEnvelope<DashboardMetrics>(raw, 'admin monitoring dashboard');

    return {
      ...data,
      lastUpdated: normalizeDateValue(data.lastUpdated),
    };
  },

  async getSystemHealth(): Promise<HealthCheck> {
    const raw = await requestJsonRaw<unknown>('/v1/admin/monitoring/health');
    const { data } = unwrapEnvelope<HealthCheck>(raw, 'admin monitoring health');

    return {
      ...data,
      timestamp: normalizeDateValue(data.timestamp),
    };
  },

  async getSystemLogs(filters?: LogFilters): Promise<LogsResponse> {
    const query = buildQuery(filters);
    const raw = await requestJsonRaw<unknown>(`/v1/admin/monitoring/logs${query}`);
    const { data } = unwrapEnvelope<RawLogsPayload>(raw, 'admin monitoring logs');

    const rawLogs = Array.isArray(data.logs) ? (data.logs as RawLog[]) : [];
    const paginationRaw = data.pagination ?? {};

    return {
      logs: rawLogs.map(mapLog),
      pagination: {
        page: parseNumber(paginationRaw.page, 1),
        limit: parseNumber(paginationRaw.limit, 50),
        total: parseNumber(paginationRaw.total, 0),
        pages: parseNumber(paginationRaw.pages, 0),
      },
    };
  },

  async getLogSources(): Promise<{ sources: string[]; categories: string[] }> {
    const raw = await requestJsonRaw<unknown>('/v1/admin/monitoring/sources');
    const { data } = unwrapEnvelope<RawLogSourcesPayload>(raw, 'admin monitoring sources');

    return {
      sources: toStringArray(data.sources),
      categories: toStringArray(data.categories),
    };
  },

  async resolveLog(logId: string, resolvedBy = 'admin'): Promise<SystemLog> {
    const raw = await requestJsonRaw<unknown>(`/v1/admin/monitoring/logs/${logId}/resolve`, {
      method: 'PUT',
      body: { resolvedBy },
    });

    const { data } = unwrapEnvelope<RawLog>(raw, 'admin monitoring resolve log');
    return mapLog(data);
  },

  async createLog(logData: {
    level: LogLevel;
    message: string;
    source: string;
    category?: string;
    metadata?: Record<string, unknown>;
  }): Promise<SystemLog> {
    const raw = await requestJsonRaw<unknown>('/v1/admin/monitoring/logs', {
      method: 'POST',
      body: logData,
    });

    const { data } = unwrapEnvelope<RawLog>(raw, 'admin monitoring create log');
    return mapLog(data);
  },

  async deleteLogs(logIds: string[]): Promise<number> {
    const raw = await requestJsonRaw<unknown>('/v1/admin/monitoring/logs/delete', {
      method: 'POST',
      body: { logIds },
    });

    const { data } = unwrapEnvelope<{ deletedCount?: unknown }>(raw, 'admin monitoring delete logs');
    return parseNumber(data.deletedCount, 0);
  },

  async exportLogs(filters?: Omit<LogFilters, 'page' | 'limit' | 'sortBy' | 'sortOrder'>): Promise<Blob> {
    const query = buildQuery(filters);
    return requestBlob(`/v1/admin/monitoring/logs/export${query}`);
  },

  async clearAllLogs(): Promise<number> {
    const raw = await requestJsonRaw<unknown>('/v1/admin/monitoring/logs/clear-all', {
      method: 'POST',
    });

    const { data } = unwrapEnvelope<{ deletedCount?: unknown }>(raw, 'admin monitoring clear logs');
    return parseNumber(data.deletedCount, 0);
  },
};
