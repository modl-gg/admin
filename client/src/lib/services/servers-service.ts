import { requestJsonRaw } from '@/lib/api';
import {
  getOptionalString,
  isRecord,
  normalizeDateValue,
  unwrapEnvelope,
  unwrapEnvelopeOptionalData,
} from '@/lib/api-contracts/common';

export type ServerPlan = 'free' | 'premium';
export type ProvisioningStatus = 'pending' | 'in-progress' | 'completed' | 'failed';
export type CustomDomainStatus = 'pending' | 'error' | 'active' | 'verifying';
export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'inactive'
  | 'trialing'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

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

interface RawServer {
  id?: unknown;
  _id?: unknown;
  serverName?: unknown;
  customDomain?: unknown;
  adminEmail?: unknown;
  plan?: unknown;
  emailVerified?: unknown;
  provisioningStatus?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  userCount?: unknown;
  ticketCount?: unknown;
  lastActivityAt?: unknown;
  databaseName?: unknown;
  customDomainOverride?: unknown;
  customDomainStatus?: unknown;
  customDomainLastChecked?: unknown;
  customDomainError?: unknown;
  stripeCustomerId?: unknown;
  stripeSubscriptionId?: unknown;
  subscriptionStatus?: unknown;
  currentPeriodEnd?: unknown;
}

interface RawServersPayload {
  servers?: unknown;
  pagination?: {
    page?: unknown;
    limit?: unknown;
    total?: unknown;
    pages?: unknown;
  };
}

interface RawStatsPayload {
  totalPlayers?: unknown;
  totalTickets?: unknown;
  totalLogs?: unknown;
  lastActivity?: unknown;
  databaseSize?: unknown;
}

interface RawUsageSummary {
  userCount?: unknown;
  ticketCount?: unknown;
  updatedAt?: unknown;
  fromCache?: unknown;
}

interface RawUsagePayload {
  usage?: unknown;
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

function normalizeServerPlan(value: unknown): ServerPlan {
  if (typeof value !== 'string') {
    return 'free';
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'premium' ? 'premium' : 'free';
}

function normalizeProvisioningStatus(value: unknown): ProvisioningStatus {
  if (typeof value !== 'string') {
    return 'pending';
  }

  const normalized = value.trim().toLowerCase().replace(/_/g, '-');
  if (normalized === 'in-progress') {
    return 'in-progress';
  }

  if (normalized === 'completed') {
    return 'completed';
  }

  if (normalized === 'failed') {
    return 'failed';
  }

  return 'pending';
}

function normalizeCustomDomainStatus(value: unknown): CustomDomainStatus | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'pending' || normalized === 'error' || normalized === 'active' || normalized === 'verifying') {
    return normalized;
  }

  return undefined;
}

function normalizeSubscriptionStatus(value: unknown): SubscriptionStatus | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  const allowed: SubscriptionStatus[] = [
    'active',
    'canceled',
    'past_due',
    'inactive',
    'trialing',
    'incomplete',
    'incomplete_expired',
    'unpaid',
    'paused',
  ];

  return allowed.includes(normalized as SubscriptionStatus)
    ? (normalized as SubscriptionStatus)
    : undefined;
}

function ensureServerId(value: RawServer): string {
  if (typeof value.id === 'string') {
    return value.id;
  }

  if (typeof value._id === 'string') {
    return value._id;
  }

  return '';
}

function mapServerListItem(raw: RawServer): AdminServerListItem {
  return {
    id: ensureServerId(raw),
    serverName: getOptionalString(raw.serverName) ?? 'Unknown Server',
    customDomain: getOptionalString(raw.customDomain) ?? 'unknown',
    adminEmail: getOptionalString(raw.adminEmail) ?? 'unknown@example.com',
    plan: normalizeServerPlan(raw.plan),
    emailVerified: raw.emailVerified === true,
    provisioningStatus: normalizeProvisioningStatus(raw.provisioningStatus),
    createdAt: normalizeDateValue(raw.createdAt),
    updatedAt: normalizeDateValue(raw.updatedAt),
    userCount: typeof raw.userCount === 'number' ? raw.userCount : undefined,
    ticketCount: typeof raw.ticketCount === 'number' ? raw.ticketCount : undefined,
    lastActivityAt: normalizeDateValue(raw.lastActivityAt),
  };
}

function mapServerDetails(raw: RawServer): AdminServerDetails {
  const base = mapServerListItem(raw);

  return {
    ...base,
    databaseName: getOptionalString(raw.databaseName),
    customDomainOverride: getOptionalString(raw.customDomainOverride),
    customDomainStatus: normalizeCustomDomainStatus(raw.customDomainStatus),
    customDomainLastChecked: normalizeDateValue(raw.customDomainLastChecked),
    customDomainError: getOptionalString(raw.customDomainError),
    stripeCustomerId: getOptionalString(raw.stripeCustomerId),
    stripeSubscriptionId: getOptionalString(raw.stripeSubscriptionId),
    subscriptionStatus: normalizeSubscriptionStatus(raw.subscriptionStatus),
    currentPeriodEnd: normalizeDateValue(raw.currentPeriodEnd),
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

function mapUsageSummary(raw: RawUsageSummary): ServerUsageSummary {
  return {
    userCount: parseNumber(raw.userCount, 0),
    ticketCount: parseNumber(raw.ticketCount, 0),
    updatedAt: normalizeDateValue(raw.updatedAt),
    fromCache: raw.fromCache === true,
  };
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

function buildQueryString(params?: Record<string, string | number | boolean | undefined>): string {
  const queryParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
  }

  const query = queryParams.toString();
  return query ? `?${query}` : '';
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

    const raw = await requestJsonRaw<unknown>(`/v1/admin/servers${query}`);
    const { data } = unwrapEnvelope<RawServersPayload>(raw, 'admin servers list');

    const serversRaw = Array.isArray(data.servers) ? (data.servers as RawServer[]) : [];
    const paginationRaw = data.pagination ?? {};

    return {
      servers: serversRaw.map(mapServerListItem),
      pagination: {
        page: parseNumber(paginationRaw.page, 1),
        limit: parseNumber(paginationRaw.limit, 20),
        total: parseNumber(paginationRaw.total, 0),
        pages: parseNumber(paginationRaw.pages, 0),
      },
    };
  },

  async getServer(id: string): Promise<AdminServerDetails> {
    const raw = await requestJsonRaw<unknown>(`/v1/admin/servers/${id}`);
    const { data } = unwrapEnvelope<RawServer>(raw, 'admin server detail');
    return mapServerDetails(data);
  },

  async getServerStats(id: string): Promise<ServerStats> {
    const raw = await requestJsonRaw<unknown>(`/v1/admin/servers/${id}/stats`);
    const { data } = unwrapEnvelope<RawStatsPayload>(raw, 'admin server stats');

    return {
      totalPlayers: parseNumber(data.totalPlayers),
      totalTickets: parseNumber(data.totalTickets),
      totalLogs: parseNumber(data.totalLogs),
      lastActivity: normalizeDateValue(data.lastActivity),
      databaseSize: parseNumber(data.databaseSize),
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

    const raw = await requestJsonRaw<unknown>('/v1/admin/servers/usage/batch', {
      method: 'POST',
      body: {
        serverIds: dedupedIds,
        forceRefresh,
      },
    });

    const { data } = unwrapEnvelope<RawUsagePayload>(raw, 'admin server usage batch');
    const usageRaw = isRecord(data.usage) ? data.usage : {};

    const usageById: Record<string, ServerUsageSummary> = {};
    Object.entries(usageRaw).forEach(([serverId, entry]) => {
      if (isRecord(entry)) {
        usageById[serverId] = mapUsageSummary(entry);
      }
    });

    return usageById;
  },

  async updateServer(id: string, input: UpdateServerInput): Promise<AdminServerDetails> {
    const payload: Record<string, unknown> = {};

    if (input.adminEmail !== undefined) payload.adminEmail = input.adminEmail;
    if (input.emailVerified !== undefined) payload.emailVerified = input.emailVerified;
    if (input.provisioningStatus !== undefined) payload.provisioningStatus = toBackendProvisioningStatus(input.provisioningStatus);
    if (input.provisioningNotes !== undefined) payload.provisioningNotes = input.provisioningNotes;
    if (input.plan !== undefined) payload.plan = toBackendPlan(input.plan);
    if (input.subscriptionStatus !== undefined) payload.subscriptionStatus = toBackendSubscriptionStatus(input.subscriptionStatus);
    if (input.lastActivityAt !== undefined) payload.lastActivityAt = input.lastActivityAt;

    const raw = await requestJsonRaw<unknown>(`/v1/admin/servers/${id}`, {
      method: 'PUT',
      body: payload,
    });

    const { data } = unwrapEnvelope<RawServer>(raw, 'admin server update');
    return mapServerDetails(data);
  },

  async deleteServer(id: string): Promise<void> {
    const raw = await requestJsonRaw<unknown>(`/v1/admin/servers/${id}`, {
      method: 'DELETE',
    });

    unwrapEnvelopeOptionalData<unknown>(raw, 'admin server delete');
  },

  async resetDatabase(id: string): Promise<string> {
    const raw = await requestJsonRaw<unknown>(`/v1/admin/servers/${id}/reset-database`, {
      method: 'POST',
    });

    const { message } = unwrapEnvelopeOptionalData<unknown>(raw, 'admin server reset database');
    return message ?? 'Server reset initiated';
  },

  async exportData(id: string): Promise<string> {
    const raw = await requestJsonRaw<unknown>(`/v1/admin/servers/${id}/export-data`, {
      method: 'POST',
    });

    const { message } = unwrapEnvelopeOptionalData<unknown>(raw, 'admin server export data');
    return message ?? 'Server export initiated';
  },
};
