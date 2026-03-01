import { MODL } from '@modl-gg/shared-web';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function resolveApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return '';
  }

  if (import.meta.env.VITE_API_BASE_URL) {
    let url = import.meta.env.VITE_API_BASE_URL;
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    return url;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (!hostname.endsWith('.pages.dev') && !hostname.includes('localhost')) {
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        const baseDomain = parts.slice(-2).join('.');
        return `https://api.${baseDomain}`;
      }
    }
  }

  return MODL.Domain.HTTPS_API;
}

const API_BASE_URL = resolveApiBaseUrl();

export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function getCurrentDomain(): string {
  return window.location.hostname;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions extends Omit<RequestInit, 'method' | 'body'> {
  body?: unknown;
  method?: RequestMethod;
}

function createHeaders(options?: RequestOptions): Headers {
  const headers = new Headers(options?.headers);
  headers.set('X-Server-Domain', getCurrentDomain());

  if (options?.body !== undefined && options?.body !== null) {
    const bodyIsSerializable = typeof options.body === 'object' || typeof options.body === 'string';
    if (bodyIsSerializable && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  return headers;
}

function shouldJsonEncodeBody(options?: RequestOptions): boolean {
  if (!options || options.body === undefined || options.body === null) {
    return false;
  }

  if (typeof options.body === 'string') {
    return false;
  }

  return true;
}

async function handleRateLimitIfNeeded(response: Response): Promise<void> {
  if (response.status === 429) {
    const { handleRateLimitResponse, getCurrentPath } = await import('../utils/rate-limit-handler');
    await handleRateLimitResponse(response, getCurrentPath());
    throw new ApiError('Rate limit exceeded', 429);
  }
}

async function parseResponseBody(response: Response): Promise<unknown | undefined> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined;
  }

  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function extractErrorMessage(response: Response, payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;

    const errorValue = record.error;
    if (typeof errorValue === 'string' && errorValue.trim().length > 0) {
      return errorValue;
    }

    const messageValue = record.message;
    if (typeof messageValue === 'string' && messageValue.trim().length > 0) {
      return messageValue;
    }
  }

  return response.statusText || `HTTP ${response.status}`;
}

export async function apiFetch(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = 'GET', body, ...rest } = options;
  const fullUrl = getApiUrl(path);
  const headers = createHeaders(options);

  const processedBody = shouldJsonEncodeBody(options)
    ? JSON.stringify(body)
    : (typeof body === 'string' ? body : undefined);

  const response = await fetch(fullUrl, {
    ...rest,
    method,
    headers,
    credentials: 'include',
    body: processedBody,
  });

  await handleRateLimitIfNeeded(response);
  return response;
}

export async function requestJsonRaw<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await apiFetch(path, options);
  const payload = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(response, payload), response.status, payload);
  }

  if (payload === undefined) {
    throw new ApiError('Expected JSON response body', response.status);
  }

  return payload as T;
}

export async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await apiFetch(path, options);

  if (!response.ok) {
    const payload = await parseResponseBody(response);
    throw new ApiError(extractErrorMessage(response, payload), response.status, payload);
  }

  return response.blob();
}

export async function requestText(path: string, options: RequestOptions = {}): Promise<string> {
  const response = await apiFetch(path, options);

  if (!response.ok) {
    const payload = await parseResponseBody(response);
    throw new ApiError(extractErrorMessage(response, payload), response.status, payload);
  }

  return response.text();
}

export const api = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return requestJsonRaw<T>(path, { ...options, method: 'GET' });
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return requestJsonRaw<T>(path, { ...options, method: 'POST', body });
  },

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return requestJsonRaw<T>(path, { ...options, method: 'PUT', body });
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return requestJsonRaw<T>(path, { ...options, method: 'PATCH', body });
  },

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return requestJsonRaw<T>(path, { ...options, method: 'DELETE' });
  },
};

export type { RequestMethod, RequestOptions };
