import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt';

export function toNum(value: bigint): number {
  return Number(value);
}

export function tsToIso(value?: Timestamp): string | undefined {
  return value ? timestampDate(value).toISOString() : undefined;
}

export function millisToIso(value: bigint): string | undefined {
  const millis = Number(value);
  return millis > 0 ? new Date(millis).toISOString() : undefined;
}

interface ProtoPagination {
  page: number;
  limit: number;
  total: bigint;
  pages: number;
}

export interface PaginationSummary {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export function mapPagination(pagination: ProtoPagination | undefined, defaultLimit: number): PaginationSummary {
  return {
    page: pagination?.page || 1,
    limit: pagination?.limit || defaultLimit,
    total: pagination ? toNum(pagination.total) : 0,
    pages: pagination?.pages ?? 0,
  };
}

export function toEpochMillisString(value?: string): string | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  if (/^\d+$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return String(parsed.getTime());
}
