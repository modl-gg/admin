import { create } from '@bufbuild/protobuf';
import {
  AdminAuthResponseSchema,
  AdminLoginRequestSchema,
  AdminLoginResponseSchema,
  AdminRequestCodeRequestSchema,
  AdminSessionResponseSchema,
} from '@modl-gg/proto/modl/v1/auth_pb.ts';
import { ProtoHttpError, protoFetch, protoSend, requireData } from '@/lib/proto-fetch';
import { tsToIso } from '@/lib/proto-ui';

export interface AdminSession {
  email?: string;
  lastActivityAt?: string;
  loggedInIps: string[];
  isAuthenticated: boolean;
}

export const authService = {
  async getSession(): Promise<AdminSession> {
    try {
      const response = await protoFetch(AdminSessionResponseSchema, '/v1/admin/auth/session');
      const data = requireData(response.data, 'admin auth session');

      return {
        email: data.email || undefined,
        lastActivityAt: tsToIso(data.lastActivityAt),
        loggedInIps: data.loggedInIps,
        isAuthenticated: data.isAuthenticated,
      };
    } catch (caught) {
      if (caught instanceof ProtoHttpError && caught.status === 401) {
        return {
          isAuthenticated: false,
          loggedInIps: [],
        };
      }

      throw caught;
    }
  },

  async requestCode(email: string): Promise<string> {
    const response = await protoSend(
      'POST',
      '/v1/admin/auth/request-code',
      AdminRequestCodeRequestSchema,
      create(AdminRequestCodeRequestSchema, { email }),
      AdminAuthResponseSchema,
    );

    return response.message || 'Verification code requested';
  },

  async login(email: string, code: string): Promise<AdminSession> {
    const response = await protoSend(
      'POST',
      '/v1/admin/auth/login',
      AdminLoginRequestSchema,
      create(AdminLoginRequestSchema, { email, code }),
      AdminLoginResponseSchema,
    );

    const data = requireData(response.data, 'admin auth login');

    return {
      email: data.email || email,
      lastActivityAt: tsToIso(data.lastActivityAt),
      loggedInIps: [],
      isAuthenticated: true,
    };
  },

  async logout(): Promise<void> {
    await protoFetch(AdminAuthResponseSchema, '/v1/admin/auth/logout', {
      method: 'POST',
    });
  },
};
