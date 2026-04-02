import { MODL } from '@modl-gg/shared-web';

export interface ActivitySnapshot {
  date: string;
  activeServers: number;
  onlinePlayers: number;
  totalPlayers: number;
  totalServers: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

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

class ApiClient {
  private baseUrl = '/v1/admin';

  private async request<T>(
    endpoint: string,
    options: { method?: RequestMethod; body?: unknown } = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', body } = options;

    const response = await apiFetch(`${this.baseUrl}${endpoint}`, { method, body });
    const data = await response.json();

    if (!response.ok) {
      if (endpoint === '/auth/session' && response.status === 401) {
        throw new ApiError(data.error || `HTTP ${response.status}`, response.status);
      }
      throw new ApiError(data.error || `HTTP ${response.status}`, response.status);
    }

    return data;
  }

  async requestCode(email: string) {
    return this.request('/auth/request-code', {
      method: 'POST',
      body: { email },
    });
  }

  async login(email: string, code: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: { email, code },
    });
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  async getSession() {
    return this.request('/auth/session');
  }

  async getServers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    plan?: string;
    status?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const query = queryParams.toString();
    return this.request(`/servers${query ? `?${query}` : ''}`);
  }

  async getServer(id: string) {
    return this.request(`/servers/${id}`);
  }

  async getServerStats(id: string) {
    return this.request(`/servers/${id}/stats`);
  }

  async updateServerStats(id: string, stats: {
    userCount?: number;
    ticketCount?: number;
    lastActivityAt?: string;
  }) {
    return this.request(`/servers/${id}/stats`, {
      method: 'PUT',
      body: stats,
    });
  }

  async updateServer(id: string, data: any) {
    return this.request(`/servers/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteServer(id: string) {
    return this.request(`/servers/${id}`, {
      method: 'DELETE',
    });
  }

  async createServer(data: any) {
    return this.request('/servers', {
      method: 'POST',
      body: data,
    });
  }

  async bulkServerAction(action: string, serverIds: string[], parameters?: any) {
    return this.request('/servers/bulk', {
      method: 'POST',
      body: { action, serverIds, parameters },
    });
  }

  async resetDatabase(id: string) {
    return this.request(`/servers/${id}/reset-database`, {
      method: 'POST',
    });
  }

  async exportData(id: string) {
    return this.request(`/servers/${id}/export-data`, {
      method: 'POST',
    });
  }

  async getDashboardStats() {
    return this.request('/analytics/dashboard');
  }

  async healthCheck() {
    return this.request('/health');
  }

  async getDashboardMetrics() {
    return this.request('/monitoring/dashboard');
  }

  async getSystemHealth() {
    return this.request('/monitoring/health');
  }

  async getLogSources() {
    return this.request('/monitoring/sources');
  }

  async resolveLog(logId: string, resolvedBy?: string) {
    return this.request(`/monitoring/logs/${logId}/resolve`, {
      method: 'PUT',
      body: { resolvedBy },
    });
  }

  async createLog(logData: {
    level: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    source: string;
    category?: string;
    metadata?: Record<string, any>;
  }) {
    return this.request('/monitoring/logs', {
      method: 'POST',
      body: logData,
    });
  }

  async getSystemLogs(params?: {
    page?: number;
    limit?: number;
    level?: string;
    source?: string;
    category?: string;
    resolved?: boolean;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const searchParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }

    const queryString = searchParams.toString();
    return this.request(`/monitoring/logs${queryString ? `?${queryString}` : ''}`);
  }

  async deleteLogs(logIds: string[]) {
    return this.request('/monitoring/logs/delete', {
      method: 'POST',
      body: { logIds },
    });
  }

  async exportLogs(filters?: Record<string, any>) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return this.request(`/monitoring/logs/export${query ? `?${query}` : ''}`);
  }

  async clearAllLogs() {
    return this.request('/monitoring/logs/clear-all', {
      method: 'POST',
    });
  }

  async getSystemConfig() {
    return this.request('/system/config');
  }

  async updateSystemConfig(config: any) {
    return this.request('/system/config', {
      method: 'PUT',
      body: config,
    });
  }

  async getMaintenanceStatus() {
    return this.request('/system/maintenance');
  }

  async toggleMaintenanceMode(params: { enabled: boolean; message?: string }) {
    return this.request('/system/maintenance/toggle', {
      method: 'POST',
      body: params,
    });
  }

  async restartService(service: string) {
    return this.request(`/system/services/${service}/restart`, {
      method: 'POST',
    });
  }

  async getAnalytics(range: string) {
    return this.request(`/analytics/dashboard?range=${range}`);
  }

  async getActivitySnapshots(range: string) {
    return this.request<ActivitySnapshot[]>(`/analytics/activity?range=${range}`);
  }

  async exportAnalytics(type: string, range: string) {
    return this.request('/analytics/export', {
      method: 'POST',
      body: { type, range },
    });
  }

  async generateReport(params: any) {
    return this.request('/analytics/report', {
      method: 'POST',
      body: params,
    });
  }

  async getUsageStatistics(range: string) {
    return this.request(`/analytics/usage?range=${range}`);
  }

  async getHistoricalData(metric: string, range: string) {
    return this.request(`/analytics/historical?metric=${metric}&range=${range}`);
  }

  async getServerExport(format: string, filters?: any) {
    return this.request('/servers/export', {
      method: 'POST',
      body: { format, filters },
    });
  }

  async searchServers(query: string, filters?: any) {
    return this.request('/servers/search', {
      method: 'POST',
      body: { query, filters },
    });
  }

  async getAuditLogs(params?: any) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, (value as any).toString());
        }
      });
    }
    const query = queryParams.toString();
    return this.request(`/audit/logs${query ? `?${query}` : ''}`);
  }

  async getSecurityEvents(params?: any) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, (value as any).toString());
        }
      });
    }
    const query = queryParams.toString();
    return this.request(`/security/events${query ? `?${query}` : ''}`);
  }

  async getRateLimitStatus() {
    return this.request('/system/rate-limits');
  }

  async updateRateLimits(config: any) {
    return this.request('/system/rate-limits', {
      method: 'PUT',
      body: config,
    });
  }

  async getSystemPrompts() {
    return this.request('/system/prompts');
  }

  async updateSystemPrompt(strictnessLevel: 'lenient' | 'standard' | 'strict', prompt: string) {
    return this.request(`/system/prompts/${strictnessLevel}`, {
      method: 'PUT',
      body: { prompt },
    });
  }

  async resetSystemPrompt(strictnessLevel: 'lenient' | 'standard' | 'strict') {
    return this.request(`/system/prompts/${strictnessLevel}/reset`, {
      method: 'POST',
    });
  }
}

export const apiClient = new ApiClient();

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
