import { requestJsonRaw } from '@/lib/api';
import { parseNumber, unwrapEnvelope } from '@/lib/api-contracts/common';
import {
  mapAudit,
  mapBetaTester,
  mapResetAllResult,
  mapResetResult,
  type BetaTesterAudit,
  type BetaTesterRecord,
  type BetaTesterResetAllResult,
  type BetaTesterResetResult,
  type PaginatedBetaTesters,
} from '@/lib/api-contracts/beta-testers';

const BASE_PATH = '/v1/admin/beta-testers';

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

interface RawBetaTestersPayload {
  betaTesters?: unknown;
  pagination?: {
    page?: unknown;
    limit?: unknown;
    total?: unknown;
    pages?: unknown;
  };
}

function buildQueryString(params?: Record<string, string | number | undefined>): string {
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

export const betaTestersService = {
  async listBetaTesters(params?: ListBetaTestersParams): Promise<PaginatedBetaTesters> {
    const query = buildQueryString({
      page: params?.page,
      limit: params?.limit,
      search: params?.search,
    });

    const raw = await requestJsonRaw<unknown>(`${BASE_PATH}${query}`);
    const { data } = unwrapEnvelope<RawBetaTestersPayload>(raw, 'beta testers list');

    const betaTestersRaw = Array.isArray(data.betaTesters) ? data.betaTesters : [];
    const paginationRaw = data.pagination ?? {};

    return {
      betaTesters: betaTestersRaw.map(mapBetaTester),
      pagination: {
        page: parseNumber(paginationRaw.page, 1),
        limit: parseNumber(paginationRaw.limit, 20),
        total: parseNumber(paginationRaw.total, 0),
        pages: parseNumber(paginationRaw.pages, 0),
      },
    };
  },

  async getBetaTester(id: string): Promise<BetaTesterRecord> {
    const raw = await requestJsonRaw<unknown>(`${BASE_PATH}/${id}`);
    const { data } = unwrapEnvelope<unknown>(raw, 'beta tester detail');
    return mapBetaTester(data as Record<string, unknown>);
  },

  async createBetaTester(input: CreateBetaTesterInput): Promise<BetaTesterRecord> {
    const raw = await requestJsonRaw<unknown>(BASE_PATH, {
      method: 'POST',
      body: input,
    });

    const { data } = unwrapEnvelope<unknown>(raw, 'beta tester create');
    return mapBetaTester(data as Record<string, unknown>);
  },

  async revokeBetaTester(id: string): Promise<BetaTesterRecord> {
    const raw = await requestJsonRaw<unknown>(`${BASE_PATH}/${id}`, {
      method: 'DELETE',
    });

    const { data } = unwrapEnvelope<unknown>(raw, 'beta tester revoke');
    return mapBetaTester(data as Record<string, unknown>);
  },

  async resetBetaTester(id: string): Promise<BetaTesterResetResult> {
    const raw = await requestJsonRaw<unknown>(`${BASE_PATH}/${id}/reset`, {
      method: 'POST',
    });

    const { data } = unwrapEnvelope<unknown>(raw, 'beta tester reset');
    return mapResetResult(data);
  },

  async resetAllBetaTesters(): Promise<BetaTesterResetAllResult> {
    const raw = await requestJsonRaw<unknown>(`${BASE_PATH}/reset-all`, {
      method: 'POST',
    });

    const { data } = unwrapEnvelope<unknown>(raw, 'beta tester reset all');
    return mapResetAllResult(data);
  },

  async getBetaTesterAudit(id: string, limit = 25): Promise<BetaTesterAudit> {
    const query = buildQueryString({ limit });
    const raw = await requestJsonRaw<unknown>(`${BASE_PATH}/${id}/audit${query}`);

    const { data } = unwrapEnvelope<unknown>(raw, 'beta tester audit');
    return mapAudit(data);
  },
};
