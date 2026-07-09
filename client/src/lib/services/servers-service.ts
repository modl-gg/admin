import { create } from '@bufbuild/protobuf';
import { UpdateServerRequestSchema } from '@modl-gg/proto/modl/v1/admin_pb.ts';
import {
  AdminServerDetailResponseSchema,
  AdminServerListResponseSchema,
  AdminServerMutationResponseSchema,
  AdminServerStatsResponseSchema,
  AdminServerUsageBatchRequestSchema,
  AdminServerUsageBatchResponseSchema,
  type AdminServerRecord,
} from '@modl-gg/proto/modl/v1/server_pb.ts';
import { protoFetch, protoSend, requireData } from '@/lib/proto-fetch';
import { mapPagination, toNum, tsToIso } from '@/lib/proto-ui';
import { buildQueryString } from '@/lib/query-string';
import {
  normalizeProvisioningStatus,
  normalizeServerPlan,
  normalizeSubscriptionStatus,
  type CustomDomainStatus,
  type ProvisioningStatus,
  type ServerPlan,
  type SubscriptionStatus,
} from '@/lib/services/server-status';

export {
  normalizeProvisioningStatus,
  normalizeServerPlan,
  normalizeSubscriptionStatus,
  type CustomDomainStatus,
  type ProvisioningStatus,
  type ServerPlan,
  type SubscriptionStatus,
};

export interface AdminServerListItem {
  id: string;
  serverName: string;
  customDomain: string;
  adminEmail: string;
  plan: ServerPlan;
  emailVerified: boolean;
  provisioningStatus: ProvisioningStatus;
  createdAt?: string;
  updatedAt?: string;
  userCount?: number;
  ticketCount?: number;
  lastActivityAt?: string;
}

export interface AdminServerDetails extends AdminServerListItem {
  databaseName?: string;
  customDomainOverride?: string;
  customDomainStatus?: CustomDomainStatus;
  customDomainLastChecked?: string;
  customDomainError?: string;
  provisioningNotes?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  currentPeriodEnd?: string;
}

export interface ServerStats {
  totalPlayers: number;
  totalTickets: number;
  totalLogs: number;
  lastActivity?: string;
  databaseSize: number;
}

export interface ServerUsageSummary {
  userCount: number;
  ticketCount: number;
  updatedAt?: string;
  fromCache: boolean;
}

export interface PaginatedServers {
  servers: AdminServerListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

function normalizeCustomDomainStatus(value: string | undefined): CustomDomainStatus | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'pending' || normalized === 'error' || normalized === 'active' || normalized === 'verifying') {
    return normalized;
  }

  return undefined;
}

function toOptionalCount(value: bigint | undefined): number | undefined {
  return value !== undefined ? toNum(value) : undefined;
}

function mapServerListItem(record: AdminServerRecord): AdminServerListItem {
  return {
    id: record.id,
    serverName: record.serverName || 'Unknown Server',
    customDomain: record.customDomain || 'unknown',
    adminEmail: record.adminEmail || 'unknown@example.com',
    plan: normalizeServerPlan(record.plan),
    emailVerified: record.emailVerified,
    provisioningStatus: normalizeProvisioningStatus(record.provisioningStatus),
    createdAt: tsToIso(record.createdAt),
    updatedAt: tsToIso(record.updatedAt),
    userCount: toOptionalCount(record.userCount),
    ticketCount: toOptionalCount(record.ticketCount),
    lastActivityAt: tsToIso(record.lastActivityAt),
  };
}

function mapServerDetails(record: AdminServerRecord): AdminServerDetails {
  const base = mapServerListItem(record);

  return {
    ...base,
    databaseName: record.databaseName || undefined,
    customDomainOverride: record.customDomainOverride || undefined,
    customDomainStatus: normalizeCustomDomainStatus(record.customDomainStatus),
    customDomainLastChecked: tsToIso(record.customDomainLastChecked),
    customDomainError: record.customDomainError || undefined,
    provisioningNotes: record.provisioningNotes || undefined,
    stripeCustomerId: record.stripeCustomerId || undefined,
    stripeSubscriptionId: record.stripeSubscriptionId || undefined,
    subscriptionStatus: normalizeSubscriptionStatus(record.subscriptionStatus),
    currentPeriodEnd: tsToIso(record.currentPeriodEnd),
  };
}

function toBackendProvisioningStatus(value: ProvisioningStatus): string {
  return value.toUpperCase().replace(/-/g, '_');
}

function toBackendPlan(value: ServerPlan): string {
  return value.toUpperCase();
}

function toBackendSubscriptionStatus(value: SubscriptionStatus): string {
  return value.toUpperCase();
}

export interface GetServersParams {
  page?: number;
  limit?: number;
  search?: string;
  plan?: string;
  status?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface UpdateServerInput {
  adminEmail?: string;
  emailVerified?: boolean;
  provisioningStatus?: ProvisioningStatus;
  provisioningNotes?: string;
  plan?: ServerPlan;
  subscriptionStatus?: SubscriptionStatus;
  lastActivityAt?: string;
}

export const serversService = {
  async getServers(params?: GetServersParams): Promise<PaginatedServers> {
    const query = buildQueryString({
      page: params?.page,
      limit: params?.limit,
      search: params?.search,
      plan: params?.plan,
      status: params?.status,
      sort: params?.sort,
      order: params?.order,
    });

    const response = await protoFetch(AdminServerListResponseSchema, `/v1/admin/servers${query}`);
    const data = requireData(response.data, 'admin servers list');

    return {
      servers: data.servers.map(mapServerListItem),
      pagination: mapPagination(data.pagination, 20),
    };
  },

  async getServer(id: string): Promise<AdminServerDetails> {
    const response = await protoFetch(AdminServerDetailResponseSchema, `/v1/admin/servers/${id}`);
    return mapServerDetails(requireData(response.data, 'admin server detail'));
  },

  async getServerStats(id: string): Promise<ServerStats> {
    const response = await protoFetch(AdminServerStatsResponseSchema, `/v1/admin/servers/${id}/stats`);
    const data = requireData(response.data, 'admin server stats');

    return {
      totalPlayers: toNum(data.totalPlayers),
      totalTickets: toNum(data.totalTickets),
      totalLogs: toNum(data.totalLogs),
      lastActivity: tsToIso(data.lastActivity),
      databaseSize: toNum(data.databaseSize),
    };
  },

  async getServerUsageBatch(serverIds: string[], forceRefresh = false): Promise<Record<string, ServerUsageSummary>> {
    if (serverIds.length === 0) {
      return {};
    }

    const dedupedIds = Array.from(new Set(serverIds.map((id) => id.trim()).filter((id) => id.length > 0))).slice(0, 50);

    if (dedupedIds.length === 0) {
      return {};
    }

    const response = await protoSend(
      'POST',
      '/v1/admin/servers/usage/batch',
      AdminServerUsageBatchRequestSchema,
      create(AdminServerUsageBatchRequestSchema, {
        serverIds: dedupedIds,
        forceRefresh,
      }),
      AdminServerUsageBatchResponseSchema,
    );

    const data = requireData(response.data, 'admin server usage batch');

    const usageById: Record<string, ServerUsageSummary> = {};
    Object.entries(data.usage).forEach(([serverId, summary]) => {
      usageById[serverId] = {
        userCount: toNum(summary.userCount),
        ticketCount: toNum(summary.ticketCount),
        updatedAt: tsToIso(summary.updatedAt),
        fromCache: summary.fromCache,
      };
    });

    return usageById;
  },

  async updateServer(id: string, input: UpdateServerInput): Promise<AdminServerDetails> {
    const request = create(UpdateServerRequestSchema, {
      adminEmail: input.adminEmail,
      emailVerified: input.emailVerified,
      provisioningStatus:
        input.provisioningStatus !== undefined ? toBackendProvisioningStatus(input.provisioningStatus) : undefined,
      provisioningNotes: input.provisioningNotes,
      plan: input.plan !== undefined ? toBackendPlan(input.plan) : undefined,
      subscriptionStatus:
        input.subscriptionStatus !== undefined ? toBackendSubscriptionStatus(input.subscriptionStatus) : undefined,
      lastActivityAt: input.lastActivityAt,
    });

    const response = await protoSend(
      'PUT',
      `/v1/admin/servers/${id}`,
      UpdateServerRequestSchema,
      request,
      AdminServerMutationResponseSchema,
    );

    return mapServerDetails(requireData(response.data, 'admin server update'));
  },

  async deleteServer(id: string): Promise<void> {
    await protoFetch(AdminServerMutationResponseSchema, `/v1/admin/servers/${id}`, {
      method: 'DELETE',
    });
  },

  async resetDatabase(id: string): Promise<string> {
    const response = await protoFetch(AdminServerMutationResponseSchema, `/v1/admin/servers/${id}/reset-database`, {
      method: 'POST',
    });

    return response.message ?? 'Server reset initiated';
  },

  async exportData(id: string): Promise<string> {
    const response = await protoFetch(AdminServerMutationResponseSchema, `/v1/admin/servers/${id}/export-data`, {
      method: 'POST',
    });

    return response.message ?? 'Server export initiated';
  },
};
