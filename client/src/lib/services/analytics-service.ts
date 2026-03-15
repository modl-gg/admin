import { requestJsonRaw, requestText } from '@/lib/api';
import { isRecord, unwrapEnvelope } from '@/lib/api-contracts/common';

export type AnalyticsRange = '7d' | '30d' | '90d' | '1y';
export type AnalyticsExportType = 'csv' | 'json';

export interface LiveServer {
  serverId: string;
  serverName: string;
  playerCount: number;
  platform: string;
  version: string;
  pluginVersion: string;
}

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
    serverActivity: Array<{ date: string; activeServers: number }>;
    liveServers: LiveServer[];
    totalPlayerCount: number;
    playerActivity: Array<{ date: string; players: number }>;
  };
  systemHealth: {
    errorRates: Array<{ date: string; errors: number; warnings: number; critical: number }>;
  };
}

interface RawServerInstance {
  date: string;
  servers: Array<Record<string, unknown>>;
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
    liveServers?: unknown;
    totalPlayerCount?: unknown;
    playerActivity?: unknown;
  };
  systemHealth?: {
    errorRates?: unknown;
  };
}

function extractServerInstances(raw: unknown): RawServerInstance[] {
  if (!isRecord(raw) || !Array.isArray(raw.serverInstances)) {
    return [];
  }

  return (raw.serverInstances as unknown[]).filter(
    (entry): entry is RawServerInstance =>
      isRecord(entry) &&
      typeof entry.date === 'string' &&
      Array.isArray(entry.servers),
  );
}

function extractActivityData(raw: unknown): Array<Record<string, unknown>> {
  if (!isRecord(raw) || !Array.isArray(raw.data)) {
    return [];
  }

  return raw.data.filter((entry): entry is Record<string, unknown> => isRecord(entry));
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

    const serverInstances = extractServerInstances(raw);
    const activityData = extractActivityData(raw);

    let data: RawAnalyticsData;
    try {
      ({ data } = unwrapEnvelope<RawAnalyticsData>(raw, 'admin analytics dashboard'));
    } catch {
      data = {};
    }

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

    const serverActivityRaw = Array.isArray(data.usageStatistics?.serverActivity)
      ? (data.usageStatistics?.serverActivity as Array<Record<string, unknown>>)
      : [];
    const serverActivity = serverActivityRaw.length > 0
      ? serverActivityRaw.map((row) => ({
          date: parseString(row.date),
          activeServers: parseNumber(row.activeServers),
        }))
      : activityData.map((row) => ({
          date: parseString(row.date),
          activeServers: parseNumber(row.activeServers),
        }));

    const liveServersRaw = Array.isArray(data.usageStatistics?.liveServers)
      ? (data.usageStatistics?.liveServers as Array<Record<string, unknown>>)
      : [];
    const latestSnapshot = serverInstances.length > 0
      ? serverInstances[serverInstances.length - 1]
      : null;
    const liveServerSource = liveServersRaw.length > 0
      ? liveServersRaw
      : (latestSnapshot?.servers ?? []);
    const liveServers: LiveServer[] = liveServerSource.map((row) => ({
      serverId: parseString(row.serverId),
      serverName: parseString(row.serverName, 'Unknown'),
      playerCount: parseNumber(row.playerCount),
      platform: parseString(row.platform, 'unknown'),
      version: parseString(row.version),
      pluginVersion: parseString(row.pluginVersion),
    }));

    const playerActivityRaw = Array.isArray(data.usageStatistics?.playerActivity)
      ? (data.usageStatistics?.playerActivity as Array<Record<string, unknown>>)
      : [];
    const playerActivity = playerActivityRaw.length > 0
      ? playerActivityRaw.map((row) => ({
          date: parseString(row.date),
          players: parseNumber(row.players),
        }))
      : serverInstances.map((snapshot) => ({
          date: snapshot.date,
          players: snapshot.servers.reduce((sum, s) => sum + parseNumber(s.playerCount), 0),
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
        serverActivity,
        liveServers,
        totalPlayerCount: parseNumber(data.usageStatistics?.totalPlayerCount) ||
          liveServers.reduce((sum, s) => sum + s.playerCount, 0),
        playerActivity,
      },
      systemHealth: {
        errorRates: Array.isArray(data.systemHealth?.errorRates)
          ? (data.systemHealth?.errorRates as Array<{ date: string; errors: number; warnings: number; critical: number }>)
          : [],
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
