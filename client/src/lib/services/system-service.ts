import { requestJsonRaw } from '@/lib/api';
import { normalizeDateValue, unwrapEnvelope, unwrapEnvelopeOptionalData } from '@/lib/api-contracts/common';

export interface SystemConfig {
  general: {
    systemName: string;
    adminEmail: string;
    timezone: string;
    defaultLanguage: string;
    maintenanceMode: boolean;
    maintenanceMessage: string;
  };
  logging: {
    pm2LoggingEnabled: boolean;
    logRetentionDays: number;
    maxLogSizePerDay: number;
  };
  security: {
    sessionTimeout: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
    requireTwoFactor: boolean;
    passwordMinLength: number;
    passwordRequireSpecial: boolean;
    ipWhitelist: string[];
    corsOrigins: string[];
  };
  notifications: {
    emailNotifications: boolean;
    criticalAlerts: boolean;
    weeklyReports: boolean;
    maintenanceAlerts: boolean;
    slackWebhook?: string;
    discordWebhook?: string;
  };
  performance: {
    cacheTtl: number;
    rateLimitRequests: number;
    rateLimitWindow: number;
    databaseConnectionPool: number;
    enableCompression: boolean;
    enableCaching: boolean;
  };
  features: {
    analyticsEnabled: boolean;
    auditLoggingEnabled: boolean;
    apiAccessEnabled: boolean;
    bulkOperationsEnabled: boolean;
    advancedFiltering: boolean;
    realTimeUpdates: boolean;
  };
}

export interface MaintenanceStatus {
  isActive: boolean;
  message: string;
}

export type PromptStrictnessLevel = 'lenient' | 'standard' | 'strict';

export interface SystemPrompt {
  id: string;
  strictnessLevel: PromptStrictnessLevel;
  prompt: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface RawSystemPrompt {
  id?: unknown;
  _id?: unknown;
  strictnessLevel?: unknown;
  prompt?: unknown;
  isActive?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

function toPromptStrictness(value: unknown): PromptStrictnessLevel {
  if (typeof value !== 'string') {
    return 'standard';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'lenient' || normalized === 'strict') {
    return normalized;
  }

  return 'standard';
}

function mapPrompt(raw: RawSystemPrompt): SystemPrompt {
  const id = typeof raw.id === 'string' ? raw.id : (typeof raw._id === 'string' ? raw._id : '');

  return {
    id,
    strictnessLevel: toPromptStrictness(raw.strictnessLevel),
    prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
    isActive: raw.isActive !== false,
    createdAt: normalizeDateValue(raw.createdAt),
    updatedAt: normalizeDateValue(raw.updatedAt),
  };
}

function toUpperStrictness(level: PromptStrictnessLevel): string {
  return level.toUpperCase();
}

export const systemService = {
  async getSystemConfig(): Promise<SystemConfig> {
    const raw = await requestJsonRaw<unknown>('/v1/admin/system/config');
    const { data } = unwrapEnvelope<SystemConfig>(raw, 'admin system config');
    return data;
  },

  async updateSystemConfig(config: SystemConfig): Promise<SystemConfig> {
    const raw = await requestJsonRaw<unknown>('/v1/admin/system/config', {
      method: 'PUT',
      body: config,
    });

    const { data } = unwrapEnvelope<SystemConfig>(raw, 'admin system update config');
    return data;
  },

  async getMaintenanceStatus(): Promise<MaintenanceStatus> {
    const raw = await requestJsonRaw<unknown>('/v1/admin/system/maintenance');
    const { data } = unwrapEnvelope<MaintenanceStatus>(raw, 'admin maintenance status');
    return data;
  },

  async toggleMaintenanceMode(params: { enabled: boolean; message?: string }): Promise<MaintenanceStatus> {
    const raw = await requestJsonRaw<unknown>('/v1/admin/system/maintenance/toggle', {
      method: 'POST',
      body: params,
    });

    const { data } = unwrapEnvelope<MaintenanceStatus>(raw, 'admin maintenance toggle');
    return data;
  },

  async restartService(service: string): Promise<string> {
    const raw = await requestJsonRaw<unknown>(`/v1/admin/system/services/${service}/restart`, {
      method: 'POST',
    });

    const { message } = unwrapEnvelopeOptionalData<unknown>(raw, 'admin restart service');
    return message ?? 'Service restart requested';
  },

  async getSystemPrompts(): Promise<SystemPrompt[]> {
    const raw = await requestJsonRaw<unknown>('/v1/admin/system/prompts');
    const { data } = unwrapEnvelope<unknown>(raw, 'admin system prompts');

    const prompts = Array.isArray(data) ? (data as RawSystemPrompt[]) : [];
    return prompts.map(mapPrompt);
  },

  async updateSystemPrompt(strictnessLevel: PromptStrictnessLevel, prompt: string): Promise<SystemPrompt> {
    const raw = await requestJsonRaw<unknown>(`/v1/admin/system/prompts/${toUpperStrictness(strictnessLevel)}`, {
      method: 'PUT',
      body: { prompt },
    });

    const { data } = unwrapEnvelope<RawSystemPrompt>(raw, 'admin update system prompt');
    return mapPrompt(data);
  },

  async resetSystemPrompt(strictnessLevel: PromptStrictnessLevel): Promise<SystemPrompt> {
    const raw = await requestJsonRaw<unknown>(`/v1/admin/system/prompts/${toUpperStrictness(strictnessLevel)}/reset`, {
      method: 'POST',
    });

    const { data } = unwrapEnvelope<RawSystemPrompt>(raw, 'admin reset system prompt');
    return mapPrompt(data);
  },
};
