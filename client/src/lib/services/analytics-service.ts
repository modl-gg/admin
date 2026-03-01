import { requestJsonRaw, requestText } from '@/lib/api';
import { unwrapEnvelope } from '@/lib/api-contracts/common';

export type AnalyticsRange = '7d' | '30d' | '90d' | '1y';
export type AnalyticsExportType = 'csv' | 'json';

export interface AnalyticsData {
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
    uptime?: Array<{ service: string; uptime: number; status: string }>;
    performanceMetrics?: Array<{ metric: string; value: number; trend: 'up' | 'down' | 'stable' }>;
  };
}

interface RawAnalyticsData {
  overview?: {
    totalServers?: unknown;
    activeServers?: unknown;
    totalUsers?: unknown;
    totalTickets?: unknown;
    serverGrowthRate?: unknown;
    userGrowthRate?: unknown;
    avgPlayersPerServer?: unknown;
    avgTicketsPerServer?: unknown;
  };
  serverMetrics?: {
    byPlan?: unknown;
    byStatus?: unknown;
    registrationTrend?: unknown;
  };
  usageStatistics?: {
    topServersByUsers?: unknown;
    serverActivity?: unknown;
    geographicDistribution?: unknown;
    playerGrowth?: unknown;
    ticketVolume?: unknown;
  };
  systemHealth?: {
    errorRates?: unknown;
    uptime?: unknown;
    performanceMetrics?: unknown;
  };
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

function parseString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeRange(range: AnalyticsRange): string {
  if (range === '1y') {
    return '365d';
  }

  return range;
}

function statusColor(status: string): string {
  const normalized = status.trim().toLowerCase().replace(/_/g, '-');
  switch (normalized) {
    case 'completed':
      return '#10b981';
    case 'pending':
    case 'in-progress':
      return '#f59e0b';
    case 'failed':
      return '#ef4444';
    default:
      return '#6b7280';
  }
}

export const analyticsService = {
  async getAnalytics(range: AnalyticsRange): Promise<AnalyticsData> {
    const backendRange = normalizeRange(range);
    const raw = await requestJsonRaw<unknown>(`/v1/admin/analytics/dashboard?range=${backendRange}`);
    const { data } = unwrapEnvelope<RawAnalyticsData>(raw, 'admin analytics dashboard');

    const overview = data.overview ?? {};

    const planRows = Array.isArray(data.serverMetrics?.byPlan)
      ? (data.serverMetrics?.byPlan as Array<Record<string, unknown>>)
      : [];
    const totalPlanCount = planRows.reduce((sum, row) => sum + parseNumber(row.value), 0);

    const byPlan = planRows.map((row) => {
      const value = parseNumber(row.value);
      const percentage = totalPlanCount > 0 ? Number(((value / totalPlanCount) * 100).toFixed(1)) : 0;
      return {
        name: parseString(row.name).toLowerCase(),
        value,
        percentage,
      };
    });

    const statusRows = Array.isArray(data.serverMetrics?.byStatus)
      ? (data.serverMetrics?.byStatus as Array<Record<string, unknown>>)
      : [];

    const byStatus = statusRows.map((row) => {
      const name = parseString(row.name).toLowerCase().replace(/_/g, '-');
      return {
        name,
        value: parseNumber(row.value),
        color: statusColor(name),
      };
    });

    const registrationRows = Array.isArray(data.serverMetrics?.registrationTrend)
      ? (data.serverMetrics?.registrationTrend as Array<Record<string, unknown>>)
      : [];

    let runningCumulative = 0;
    const registrationTrend = registrationRows.map((row) => {
      const dailyServers = parseNumber(row.servers);
      runningCumulative += dailyServers;
      return {
        date: parseString(row.date),
        servers: dailyServers,
        cumulative: runningCumulative,
      };
    });

    const topServersRaw = Array.isArray(data.usageStatistics?.topServersByUsers)
      ? (data.usageStatistics?.topServersByUsers as Array<Record<string, unknown>>)
      : [];

    const topServersByUsers = topServersRaw.map((row) => ({
      serverName: parseString(row.serverName, 'Unknown Server'),
      userCount: parseNumber(row.userCount),
      customDomain: parseString(row.customDomain, 'unknown'),
    }));

    return {
      overview: {
        totalServers: parseNumber(overview.totalServers),
        activeServers: parseNumber(overview.activeServers),
        totalUsers: parseNumber(overview.totalUsers),
        totalTickets: parseNumber(overview.totalTickets),
        serverGrowthRate: parseString(overview.serverGrowthRate, '0.00'),
        userGrowthRate: parseString(overview.userGrowthRate, '0.00'),
        avgPlayersPerServer: parseString(overview.avgPlayersPerServer, '0.0'),
        avgTicketsPerServer: parseString(overview.avgTicketsPerServer, '0.0'),
      },
      serverMetrics: {
        byPlan,
        byStatus,
        registrationTrend,
      },
      usageStatistics: {
        topServersByUsers,
        serverActivity: Array.isArray(data.usageStatistics?.serverActivity)
          ? (data.usageStatistics?.serverActivity as Array<{ date: string; activeServers: number; newRegistrations: number }>)
          : [],
        geographicDistribution: Array.isArray(data.usageStatistics?.geographicDistribution)
          ? (data.usageStatistics?.geographicDistribution as Array<{ region: string; servers: number; percentage: number }>)
          : [],
        playerGrowth: Array.isArray(data.usageStatistics?.playerGrowth)
          ? (data.usageStatistics?.playerGrowth as Array<{ date: string; players: number; cumulative: number }>)
          : [],
        ticketVolume: Array.isArray(data.usageStatistics?.ticketVolume)
          ? (data.usageStatistics?.ticketVolume as Array<{ date: string; tickets: number }>)
          : [],
      },
      systemHealth: {
        errorRates: Array.isArray(data.systemHealth?.errorRates)
          ? (data.systemHealth?.errorRates as Array<{ date: string; errors: number; warnings: number; critical: number }>)
          : [],
        uptime: Array.isArray(data.systemHealth?.uptime)
          ? (data.systemHealth?.uptime as Array<{ service: string; uptime: number; status: string }>)
          : undefined,
        performanceMetrics: Array.isArray(data.systemHealth?.performanceMetrics)
          ? (data.systemHealth?.performanceMetrics as Array<{ metric: string; value: number; trend: 'up' | 'down' | 'stable' }>)
          : undefined,
      },
    };
  },

  async exportAnalytics(type: AnalyticsExportType, range: AnalyticsRange): Promise<Blob | Record<string, unknown>> {
    const backendRange = normalizeRange(range);

    if (type === 'csv') {
      const csv = await requestText('/v1/admin/analytics/export', {
        method: 'POST',
        body: { type, range: backendRange },
      });

      return new Blob([csv], { type: 'text/csv;charset=utf-8' });
    }

    return requestJsonRaw<Record<string, unknown>>('/v1/admin/analytics/export', {
      method: 'POST',
      body: { type, range: backendRange },
    });
  },

  async generateReport(params: {
    type: string;
    dateRange: AnalyticsRange;
    sections: string[];
  }): Promise<void> {
    await requestJsonRaw<unknown>('/v1/admin/analytics/report', {
      method: 'POST',
      body: {
        type: params.type,
        dateRange: normalizeRange(params.dateRange),
        sections: params.sections,
      },
    });
  },
};
