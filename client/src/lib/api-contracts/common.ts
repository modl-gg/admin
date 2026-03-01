export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.success === 'boolean';
}

function unwrapEnvelopeBase<T>(value: unknown, context: string): ApiEnvelope<T> {
  if (!isApiEnvelope<T>(value)) {
    throw new Error(`Invalid API response shape for ${context}`);
  }

  if (!value.success) {
    throw new Error(value.error ?? value.message ?? `Request failed for ${context}`);
  }

  return value;
}

export function unwrapEnvelopeOptionalData<T>(
  value: unknown,
  context: string
): { data?: T; message?: string } {
  const envelope = unwrapEnvelopeBase<T>(value, context);

  return { data: envelope.data, message: envelope.message };
}

export function unwrapEnvelope<T>(
  value: unknown,
  context: string
): { data: T; message?: string } {
  const envelope = unwrapEnvelopeBase<T>(value, context);

  if (envelope.data === undefined) {
    throw new Error(`Missing data payload for ${context}`);
  }

  return { data: envelope.data, message: envelope.message };
}

export function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function normalizeDateValue(value: unknown): string | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
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
