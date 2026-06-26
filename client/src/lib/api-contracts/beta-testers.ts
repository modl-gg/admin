import {
  getOptionalString,
  isRecord,
  normalizeDateValue,
  parseNumber,
} from '@/lib/api-contracts/common';
import {
  normalizeProvisioningStatus,
  normalizeServerPlan,
  normalizeSubscriptionStatus,
  type ProvisioningStatus,
  type ServerPlan,
  type SubscriptionStatus,
} from '@/lib/services/servers-service';

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
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
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

interface RawBetaTester {
  id?: unknown;
  _id?: unknown;
  serverName?: unknown;
  customDomain?: unknown;
  adminEmail?: unknown;
  plan?: unknown;
  subscriptionStatus?: unknown;
  betaTester?: unknown;
  provisioningStatus?: unknown;
  emailVerified?: unknown;
  apiKeySet?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  betaTesterCreatedAt?: unknown;
  betaTesterCreatedBy?: unknown;
  usage?: unknown;
  limits?: unknown;
}

function ensureId(raw: RawBetaTester): string {
  if (typeof raw.id === 'string') {
    return raw.id;
  }

  if (typeof raw._id === 'string') {
    return raw._id;
  }

  return '';
}

function mapUsage(value: unknown): BetaTesterUsage {
  const raw = isRecord(value) ? value : {};

  return {
    storageUsedBytes: parseNumber(raw.storageUsedBytes, 0),
    userCount: parseNumber(raw.userCount, 0),
    ticketCount: parseNumber(raw.ticketCount, 0),
    cdnUsageGb: parseNumber(raw.cdnUsageGb, 0),
    aiRequestsUsed: parseNumber(raw.aiRequestsUsed, 0),
  };
}

function mapLimits(value: unknown): BetaTesterLimits {
  const raw = isRecord(value) ? value : {};

  return {
    maxStaffSeats: parseNumber(raw.maxStaffSeats, 0),
    maxStorageBytes: parseNumber(raw.maxStorageBytes, 0),
    aiRequestLimit: parseNumber(raw.aiRequestLimit, 0),
    cdnLimitGb: parseNumber(raw.cdnLimitGb, 0),
    customDomainAllowed: raw.customDomainAllowed === true,
    maxUploadBytes: parseNumber(raw.maxUploadBytes, 0),
  };
}

export function mapBetaTester(raw: RawBetaTester): BetaTesterRecord {
  return {
    id: ensureId(raw),
    serverName: getOptionalString(raw.serverName) ?? 'Unknown Server',
    customDomain: getOptionalString(raw.customDomain) ?? 'unknown',
    adminEmail: getOptionalString(raw.adminEmail) ?? 'unknown@example.com',
    plan: normalizeServerPlan(raw.plan),
    subscriptionStatus: normalizeSubscriptionStatus(raw.subscriptionStatus),
    betaTester: raw.betaTester === true,
    provisioningStatus: normalizeProvisioningStatus(raw.provisioningStatus),
    emailVerified: raw.emailVerified === true,
    apiKeySet: raw.apiKeySet === true,
    createdAt: normalizeDateValue(raw.createdAt),
    updatedAt: normalizeDateValue(raw.updatedAt),
    betaTesterCreatedAt: normalizeDateValue(raw.betaTesterCreatedAt),
    betaTesterCreatedBy: getOptionalString(raw.betaTesterCreatedBy),
    usage: mapUsage(raw.usage),
    limits: mapLimits(raw.limits),
  };
}

export function mapResetResult(value: unknown): BetaTesterResetResult {
  const raw = isRecord(value) ? value : {};
  const collections = Array.isArray(raw.clearedCollections)
    ? raw.clearedCollections.filter((entry): entry is string => typeof entry === 'string')
    : [];

  return {
    serverId: getOptionalString(raw.serverId) ?? '',
    clearedCollections: collections,
  };
}

export function mapResetAllResult(value: unknown): BetaTesterResetAllResult {
  const raw = isRecord(value) ? value : {};
  const items = Array.isArray(raw.results) ? raw.results : [];

  return {
    results: items.filter(isRecord).map((entry) => ({
      serverId: getOptionalString(entry.serverId) ?? '',
      serverName: getOptionalString(entry.serverName) ?? 'Unknown Server',
      success: entry.success === true,
      message: getOptionalString(entry.message),
    })),
  };
}

export function mapAudit(value: unknown): BetaTesterAudit {
  const raw = isRecord(value) ? value : {};
  const entries = Array.isArray(raw.entries) ? raw.entries : [];

  return {
    entries: entries.filter(isRecord).map((entry) => ({
      action: getOptionalString(entry.action) ?? 'unknown',
      adminEmail: getOptionalString(entry.adminEmail) ?? 'unknown',
      timestamp: normalizeDateValue(entry.timestamp),
      details: getOptionalString(entry.details),
    })),
  };
}
