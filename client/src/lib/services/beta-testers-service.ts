import { create } from '@bufbuild/protobuf';
import {
  BetaAuditResponseSchema,
  BetaTesterCreateRequestSchema,
  BetaTesterListResponseSchema,
  BetaTesterRecordSchema,
  BetaTesterResetAllResponseSchema,
  BetaTesterResetResponseSchema,
  type BetaAuditEntry as ProtoBetaAuditEntry,
  type BetaTesterLimits as ProtoBetaTesterLimits,
  type BetaTesterRecord as ProtoBetaTesterRecord,
  type BetaTesterResetResult as ProtoBetaTesterResetResult,
  type BetaTesterUsage as ProtoBetaTesterUsage,
} from '@modl-gg/proto/modl/v1/beta_pb.ts';
import { protoFetch, protoSend } from '@/lib/proto-fetch';
import { mapPagination, toNum, tsToIso, type PaginationSummary } from '@/lib/proto-ui';
import { buildQueryString } from '@/lib/query-string';
import {
  normalizeProvisioningStatus,
  normalizeServerPlan,
  normalizeSubscriptionStatus,
  type ProvisioningStatus,
  type ServerPlan,
  type SubscriptionStatus,
} from '@/lib/services/server-status';

const BASE_PATH = '/v1/admin/beta-testers';

export interface BetaTesterUsage {
  storageUsedBytes: number;
  userCount: number;
  ticketCount: number;
  cdnUsageGb: number;
  aiRequestsUsed: number;
}

export interface BetaTesterLimits {
  maxStaffSeats: number;
  maxStorageBytes: number;
  aiRequestLimit: number;
  cdnLimitGb: number;
  customDomainAllowed: boolean;
  maxUploadBytes: number;
}

export interface BetaTesterRecord {
  id: string;
  serverName: string;
  customDomain: string;
  adminEmail: string;
  plan: ServerPlan;
  subscriptionStatus?: SubscriptionStatus;
  betaTester: boolean;
  provisioningStatus: ProvisioningStatus;
  emailVerified: boolean;
  apiKeySet: boolean;
  createdAt?: string;
  updatedAt?: string;
  betaTesterCreatedAt?: string;
  betaTesterCreatedBy?: string;
  usage: BetaTesterUsage;
  limits: BetaTesterLimits;
}

export interface PaginatedBetaTesters {
  betaTesters: BetaTesterRecord[];
  pagination: PaginationSummary;
}

export interface BetaTesterResetResult {
  serverId: string;
  clearedCollections: string[];
}

export interface BetaTesterResetAllItem {
  serverId: string;
  serverName: string;
  success: boolean;
  message?: string;
}

export interface BetaTesterResetAllResult {
  results: BetaTesterResetAllItem[];
}

export interface BetaAuditEntry {
  action: string;
  adminEmail: string;
  timestamp?: string;
  details?: string;
}

export interface BetaTesterAudit {
  entries: BetaAuditEntry[];
}

export interface ListBetaTestersParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface CreateBetaTesterInput {
  serverName: string;
  customDomain: string;
  adminEmail: string;
}

function mapUsage(usage: ProtoBetaTesterUsage | undefined): BetaTesterUsage {
  return {
    storageUsedBytes: usage ? toNum(usage.storageUsedBytes) : 0,
    userCount: usage ? toNum(usage.userCount) : 0,
    ticketCount: usage ? toNum(usage.ticketCount) : 0,
    cdnUsageGb: usage?.cdnUsageGb ?? 0,
    aiRequestsUsed: usage ? toNum(usage.aiRequestsUsed) : 0,
  };
}

function mapLimits(limits: ProtoBetaTesterLimits | undefined): BetaTesterLimits {
  return {
    maxStaffSeats: limits ? toNum(limits.maxStaffSeats) : 0,
    maxStorageBytes: limits ? toNum(limits.maxStorageBytes) : 0,
    aiRequestLimit: limits ? toNum(limits.aiRequestLimit) : 0,
    cdnLimitGb: limits?.cdnLimitGb ?? 0,
    customDomainAllowed: limits?.customDomainAllowed ?? false,
    maxUploadBytes: limits ? toNum(limits.maxUploadBytes) : 0,
  };
}

function mapBetaTester(record: ProtoBetaTesterRecord): BetaTesterRecord {
  return {
    id: record.id,
    serverName: record.serverName || 'Unknown Server',
    customDomain: record.customDomain || 'unknown',
    adminEmail: record.adminEmail || 'unknown@example.com',
    plan: normalizeServerPlan(record.plan),
    subscriptionStatus: normalizeSubscriptionStatus(record.subscriptionStatus),
    betaTester: record.betaTester,
    provisioningStatus: normalizeProvisioningStatus(record.provisioningStatus),
    emailVerified: record.emailVerified,
    apiKeySet: record.apiKeySet,
    createdAt: tsToIso(record.createdAt),
    updatedAt: tsToIso(record.updatedAt),
    betaTesterCreatedAt: tsToIso(record.betaTesterCreatedAt),
    betaTesterCreatedBy: record.betaTesterCreatedBy || undefined,
    usage: mapUsage(record.usage),
    limits: mapLimits(record.limits),
  };
}

function mapResetResult(result: ProtoBetaTesterResetResult): BetaTesterResetAllItem {
  return {
    serverId: result.serverId,
    serverName: result.serverName || 'Unknown Server',
    success: result.success,
    message: result.message || undefined,
  };
}

function mapAuditEntry(entry: ProtoBetaAuditEntry): BetaAuditEntry {
  return {
    action: entry.action || 'unknown',
    adminEmail: entry.adminEmail || 'unknown',
    timestamp: tsToIso(entry.timestamp),
    details: entry.details || undefined,
  };
}

export const betaTestersService = {
  async listBetaTesters(params?: ListBetaTestersParams): Promise<PaginatedBetaTesters> {
    const query = buildQueryString({
      page: params?.page,
      limit: params?.limit,
      search: params?.search,
    });

    const response = await protoFetch(BetaTesterListResponseSchema, `${BASE_PATH}${query}`);

    return {
      betaTesters: response.items.map(mapBetaTester),
      pagination: mapPagination(response.pagination, 20),
    };
  },

  async getBetaTester(id: string): Promise<BetaTesterRecord> {
    const response = await protoFetch(BetaTesterRecordSchema, `${BASE_PATH}/${id}`);
    return mapBetaTester(response);
  },

  async createBetaTester(input: CreateBetaTesterInput): Promise<BetaTesterRecord> {
    const response = await protoSend(
      'POST',
      BASE_PATH,
      BetaTesterCreateRequestSchema,
      create(BetaTesterCreateRequestSchema, {
        serverName: input.serverName,
        customDomain: input.customDomain,
        adminEmail: input.adminEmail,
      }),
      BetaTesterRecordSchema,
    );

    return mapBetaTester(response);
  },

  async revokeBetaTester(id: string): Promise<BetaTesterRecord> {
    const response = await protoFetch(BetaTesterRecordSchema, `${BASE_PATH}/${id}`, {
      method: 'DELETE',
    });

    return mapBetaTester(response);
  },

  async resetBetaTester(id: string): Promise<BetaTesterResetResult> {
    const response = await protoFetch(BetaTesterResetResponseSchema, `${BASE_PATH}/${id}/reset`, {
      method: 'POST',
    });

    return {
      serverId: response.serverId,
      clearedCollections: response.clearedCollections,
    };
  },

  async resetAllBetaTesters(): Promise<BetaTesterResetAllResult> {
    const response = await protoFetch(BetaTesterResetAllResponseSchema, `${BASE_PATH}/reset-all`, {
      method: 'POST',
    });

    return {
      results: response.results.map(mapResetResult),
    };
  },

  async getBetaTesterAudit(id: string, limit = 25): Promise<BetaTesterAudit> {
    const query = buildQueryString({ limit });
    const response = await protoFetch(BetaAuditResponseSchema, `${BASE_PATH}/${id}/audit${query}`);

    return {
      entries: response.entries.map(mapAuditEntry),
    };
  },
};
