import { requestJsonRaw } from '@/lib/api';
import { normalizeDateValue, unwrapEnvelope } from '@/lib/api-contracts/common';

export type SystemAlertSeverity = 'BASIC' | 'WARNING' | 'CRITICAL';
export type SystemAlertAudience = 'ALL_PANEL_USERS' | 'SUPER_ADMINS_ONLY';

export interface SystemAlert {
  id: string;
  message: string;
  severity: SystemAlertSeverity;
  audience: SystemAlertAudience;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

interface RawSystemAlert {
  id?: unknown;
  _id?: unknown;
  message?: unknown;
  severity?: unknown;
  audience?: unknown;
  expiresAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: unknown;
  updatedBy?: unknown;
}

export interface AlertPayload {
  message: string;
  severity: SystemAlertSeverity;
  audience: SystemAlertAudience;
  expiresAt: string;
}

function toSeverity(value: unknown): SystemAlertSeverity {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return normalized === 'WARNING' || normalized === 'CRITICAL' ? normalized : 'BASIC';
}

function toAudience(value: unknown): SystemAlertAudience {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return normalized === 'SUPER_ADMINS_ONLY' ? normalized : 'ALL_PANEL_USERS';
}

function mapAlert(raw: RawSystemAlert): SystemAlert {
  const id = typeof raw.id === 'string' ? raw.id : (typeof raw._id === 'string' ? raw._id : '');

  return {
    id,
    message: typeof raw.message === 'string' ? raw.message : '',
    severity: toSeverity(raw.severity),
    audience: toAudience(raw.audience),
    expiresAt: normalizeDateValue(raw.expiresAt),
    createdAt: normalizeDateValue(raw.createdAt),
    updatedAt: normalizeDateValue(raw.updatedAt),
    createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : undefined,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : undefined,
  };
}

export const alertsService = {
  async getAlerts(): Promise<SystemAlert[]> {
    const raw = await requestJsonRaw<unknown>('/v1/admin/alerts');
    const { data } = unwrapEnvelope<RawSystemAlert[]>(raw, 'admin alerts');
    return Array.isArray(data) ? data.map(mapAlert) : [];
  },

  async createAlert(payload: AlertPayload): Promise<SystemAlert> {
    const raw = await requestJsonRaw<unknown>('/v1/admin/alerts', {
      method: 'POST',
      body: payload,
    });
    const { data } = unwrapEnvelope<RawSystemAlert>(raw, 'admin create alert');
    return mapAlert(data);
  },

  async updateAlert(id: string, payload: AlertPayload): Promise<SystemAlert> {
    const raw = await requestJsonRaw<unknown>(`/v1/admin/alerts/${id}`, {
      method: 'PUT',
      body: payload,
    });
    const { data } = unwrapEnvelope<RawSystemAlert>(raw, 'admin update alert');
    return mapAlert(data);
  },
};
