import { create } from '@bufbuild/protobuf';
import {
  AdminAnalyticsActivityResponseSchema,
  AdminAnalyticsDashboardDataSchema,
  AdminAnalyticsDashboardResponseSchema,
  AdminAnalyticsOverviewSchema,
} from '@modl-gg/proto/modl/v1/analytics_pb.ts';
import { protoFetch } from '@/lib/proto-fetch';
import { toNum } from '@/lib/proto-ui';
import { normalizeProvisioningStatus, planLabel, provisioningStatusLabel } from '@/lib/server-labels';

export type AnalyticsRange = '7d' | '30d' | '90d' | '1y';

export interface LiveServer {
  serverId: string;
  serverName: string;
  playerCount: number;
  platform: string;
  version: string;
  pluginVersion: string;
}

export interface ActivitySnapshot {
  date: string;
  activeServers: number;
  onlinePlayers: number;
  totalPlayers: number;
  totalServers: number;
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

function normalizeRange(range: AnalyticsRange): string {
  if (range === '1y') {
    return '365d';
  }

  return range;
}

function statusColor(status: string): string {
  switch (status) {
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
    const response = await protoFetch(
      AdminAnalyticsDashboardResponseSchema,
      `/v1/admin/analytics/dashboard?range=${backendRange}`,
    );

    const data = response.data ?? create(AdminAnalyticsDashboardDataSchema);
    const overview = data.overview ?? create(AdminAnalyticsOverviewSchema);

    const planRows = data.serverMetrics?.byPlan ?? [];
    const totalPlanCount = planRows.reduce((sum, row) => sum + row.value, 0);

    const byPlan = planRows.map((row) => ({
      name: planLabel(row.name),
      value: row.value,
      percentage: totalPlanCount > 0 ? Number(((row.value / totalPlanCount) * 100).toFixed(1)) : 0,
    }));

    const byStatus = (data.serverMetrics?.byStatus ?? []).reduce<Array<{ name: string; value: number; color: string }>>(
      (rows, row) => {
        const normalized = normalizeProvisioningStatus(row.name);
        const name = provisioningStatusLabel(normalized);
        const existing = rows.find((entry) => entry.name === name);
        if (existing) {
          existing.value += row.value;
        } else {
          rows.push({ name, value: row.value, color: statusColor(normalized) });
        }
        return rows;
      },
      [],
    );

    let runningCumulative = 0;
    const registrationTrend = (data.serverMetrics?.registrationTrend ?? []).map((row) => {
      runningCumulative += row.servers;
      return {
        date: row.date,
        servers: row.servers,
        cumulative: runningCumulative,
      };
    });

    const usage = data.usageStatistics;

    const topServersByUsers = (usage?.topServersByUsers ?? []).map((server) => ({
      serverName: server.serverName || 'Unknown Server',
      userCount: server.userCount !== undefined ? toNum(server.userCount) : 0,
      customDomain: server.customDomain || 'unknown',
    }));

    const serverActivity = (usage?.serverActivity ?? []).map((row) => ({
      date: row.date,
      activeServers: toNum(row.activeServers),
    }));

    const liveServers: LiveServer[] = (usage?.liveServers ?? []).map((server) => ({
      serverId: server.serverId,
      serverName: server.serverName || 'Unknown',
      playerCount: server.playerCount,
      platform: server.platform ?? 'unknown',
      version: server.version ?? '',
      pluginVersion: server.pluginVersion ?? '',
    }));

    const playerActivity = (usage?.playerActivity ?? []).map((row) => ({
      date: row.date,
      players: row.players,
    }));

    return {
      overview: {
        totalServers: toNum(overview.totalServers),
        activeServers: toNum(overview.activeServers),
        totalUsers: toNum(overview.totalUsers),
        totalTickets: toNum(overview.totalTickets),
        serverGrowthRate: overview.serverGrowthRate || '0.00',
        userGrowthRate: overview.userGrowthRate || '0.00',
        avgPlayersPerServer: overview.avgPlayersPerServer || '0.0',
        avgTicketsPerServer: overview.avgTicketsPerServer || '0.0',
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
        totalPlayerCount: (usage?.totalPlayerCount ?? 0) ||
          liveServers.reduce((sum, server) => sum + server.playerCount, 0),
        playerActivity,
      },
      systemHealth: {
        errorRates: (data.systemHealth?.errorRates ?? []).map((row) => ({
          date: row.date ?? '',
          errors: 0,
          warnings: 0,
          critical: 0,
        })),
      },
    };
  },

  async getActivitySnapshots(range: AnalyticsRange): Promise<ActivitySnapshot[]> {
    const response = await protoFetch(
      AdminAnalyticsActivityResponseSchema,
      `/v1/admin/analytics/activity?range=${range}`,
    );

    const totalPlayers = toNum(response.totalPlayers);
    const totalServers = toNum(response.totalServers);

    return response.data.map((point) => ({
      date: point.date,
      activeServers: toNum(point.activeServers),
      onlinePlayers: point.onlinePlayers,
      totalPlayers,
      totalServers,
    }));
  },
};
