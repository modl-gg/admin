import { requestJsonRaw } from '@/lib/api';
import {
  normalizeDateValue,
  normalizeStringArray,
  unwrapEnvelope,
  unwrapEnvelopeOptionalData,
} from '@/lib/api-contracts/common';

export interface AdminSession {
  email?: string;
  lastActivityAt?: string;
  loggedInIps: string[];
  isAuthenticated: boolean;
}

interface SessionPayload {
  email?: unknown;
  lastActivityAt?: unknown;
  loggedInIps?: unknown;
  isAuthenticated?: unknown;
}

interface LoginPayload {
  email?: unknown;
  lastActivityAt?: unknown;
}

function mapSessionPayload(payload: SessionPayload): AdminSession {
  return {
    email: typeof payload.email === 'string' ? payload.email : undefined,
    lastActivityAt: normalizeDateValue(payload.lastActivityAt),
    loggedInIps: normalizeStringArray(payload.loggedInIps),
    isAuthenticated: payload.isAuthenticated === true,
  };
}

export const authService = {
  async getSession(): Promise<AdminSession> {
    const raw = await requestJsonRaw<unknown>('/v1/admin/auth/session');
    const { data } = unwrapEnvelope<SessionPayload>(raw, 'admin auth session');
    return mapSessionPayload(data);
  },

  async requestCode(email: string): Promise<string> {
    const raw = await requestJsonRaw<unknown>('/v1/admin/auth/request-code', {
      method: 'POST',
      body: { email },
    });

    const { message } = unwrapEnvelopeOptionalData<unknown>(raw, 'admin auth request code');
    return message ?? 'Verification code requested';
  },

  async login(email: string, code: string): Promise<AdminSession> {
    const raw = await requestJsonRaw<unknown>('/v1/admin/auth/login', {
      method: 'POST',
      body: { email, code },
    });

    const { data } = unwrapEnvelope<LoginPayload>(raw, 'admin auth login');

    return {
      email: typeof data.email === 'string' ? data.email : email,
      lastActivityAt: normalizeDateValue(data.lastActivityAt),
      loggedInIps: [],
      isAuthenticated: true,
    };
  },

  async logout(): Promise<void> {
    const raw = await requestJsonRaw<unknown>('/v1/admin/auth/logout', {
      method: 'POST',
    });

    unwrapEnvelopeOptionalData<unknown>(raw, 'admin auth logout');
  },
};
