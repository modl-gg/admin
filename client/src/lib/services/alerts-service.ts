import { create } from '@bufbuild/protobuf';
import {
  AdminSystemAlertResponseSchema,
  AdminSystemAlertsResponseSchema,
  CreateSystemAlertRequestSchema,
  UpdateSystemAlertRequestSchema,
  type AdminSystemAlertResponse,
} from '@modl-gg/proto/modl/v1/alert_pb.ts';
import { protoFetch, protoSend } from '@/lib/proto-fetch';
import { millisToIso, toEpochMillisString } from '@/lib/proto-ui';

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
}

export interface AlertPayload {
  message: string;
  severity: SystemAlertSeverity;
  audience: SystemAlertAudience;
  expiresAt: string;
}

function toSeverity(value: string): SystemAlertSeverity {
  const normalized = value.trim().toUpperCase();
  return normalized === 'WARNING' || normalized === 'CRITICAL' ? normalized : 'BASIC';
}

function toAudience(value: string): SystemAlertAudience {
  return value.trim().toUpperCase() === 'SUPER_ADMINS_ONLY' ? 'SUPER_ADMINS_ONLY' : 'ALL_PANEL_USERS';
}

function mapAlert(alert: AdminSystemAlertResponse): SystemAlert {
  return {
    id: alert.id,
    message: alert.message,
    severity: toSeverity(alert.severity),
    audience: toAudience(alert.audience),
    expiresAt: millisToIso(alert.expiresAt),
    createdAt: millisToIso(alert.createdAt),
    updatedAt: millisToIso(alert.updatedAt),
  };
}

function toExpiresAtMillis(value: string): bigint {
  return BigInt(toEpochMillisString(value) ?? '0');
}

export const alertsService = {
  async getAlerts(): Promise<SystemAlert[]> {
    const response = await protoFetch(AdminSystemAlertsResponseSchema, '/v1/admin/alerts');
    return response.items.map(mapAlert);
  },

  async createAlert(payload: AlertPayload): Promise<SystemAlert> {
    const created = await protoSend(
      'POST',
      '/v1/admin/alerts',
      CreateSystemAlertRequestSchema,
      create(CreateSystemAlertRequestSchema, {
        message: payload.message,
        severity: payload.severity,
        audience: payload.audience,
        expiresAt: toExpiresAtMillis(payload.expiresAt),
      }),
      AdminSystemAlertResponseSchema,
    );

    return mapAlert(created);
  },

  async updateAlert(id: string, payload: AlertPayload): Promise<SystemAlert> {
    const updated = await protoSend(
      'PUT',
      `/v1/admin/alerts/${id}`,
      UpdateSystemAlertRequestSchema,
      create(UpdateSystemAlertRequestSchema, {
        message: payload.message,
        severity: payload.severity,
        audience: payload.audience,
        expiresAt: toExpiresAtMillis(payload.expiresAt),
      }),
      AdminSystemAlertResponseSchema,
    );

    return mapAlert(updated);
  },
};
