export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api'; // Vite proxy will handle this
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(data.error || `HTTP ${response.status}`, response.status);
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        // Don't log expected 401 errors for the session check
        if (endpoint === '/auth/session' && error.status === 401) {
          // Do nothing, this is an expected "error" for logged-out users
        } else {
          console.error(`API request failed with status ${error.status}:`, error.message);
        }
      } else {
        console.error('API request failed:', error);
      }
      throw error;
    }
  }

  // Auth endpoints
  async requestCode(email: string) {
    return this.request('/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async login(email: string, code: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
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

  // Server management endpoints
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
      body: JSON.stringify(stats),
    });
  }

  async updateServer(id: string, data: any) {
    return this.request(`/servers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
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
      body: JSON.stringify(data),
    });
  }

  async bulkServerAction(action: string, serverIds: string[], parameters?: any) {
    return this.request('/servers/bulk', {
      method: 'POST',
      body: JSON.stringify({
        action,
        serverIds,
        parameters,
      }),
    });
  }

  // Reset server to provisioning state (clears database and resets provisioning status)
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

  // Dashboard/Analytics endpoints
  async getDashboardStats() {
    return this.request('/analytics/dashboard');
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // Monitoring endpoints
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
      body: JSON.stringify({ resolvedBy }),
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
      body: JSON.stringify(logData),
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

  // System Configuration
  async getSystemConfig() {
    return this.request('/system/config');
  }

  async updateSystemConfig(config: any) {
    return this.request('/system/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async getMaintenanceStatus() {
    return this.request('/system/maintenance');
  }

  async toggleMaintenanceMode(params: { enabled: boolean; message?: string }) {
    return this.request('/system/maintenance/toggle', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async restartService(service: string) {
    return this.request(`/system/services/${service}/restart`, {
      method: 'POST',
    });
  }

  // Analytics - Enhanced methods
  async getAnalytics(range: string) {
    return this.request(`/analytics/dashboard?range=${range}`);
  }

  async exportAnalytics(type: string, range: string) {
    return this.request('/analytics/export', {
      method: 'POST',
      body: JSON.stringify({ type, range }),
    });
  }

  async generateReport(params: any) {
    return this.request('/analytics/report', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getUsageStatistics(range: string) {
    return this.request(`/analytics/usage?range=${range}`);
  }

  async getHistoricalData(metric: string, range: string) {
    return this.request(`/analytics/historical?metric=${metric}&range=${range}`);
  }

  // Enhanced server export
  async getServerExport(format: string, filters?: any) {
    return this.request('/servers/export', {
      method: 'POST',
      body: JSON.stringify({ format, filters }),
    });
  }

  // Advanced Search
  async searchServers(query: string, filters?: any) {
    return this.request('/servers/search', {
      method: 'POST',
      body: JSON.stringify({ query, filters }),
    });
  }

  // Security and Audit
  async getAuditLogs(params?: any) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
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
          queryParams.append(key, value.toString());
        }
      });
    }
    const query = queryParams.toString();
    return this.request(`/security/events${query ? `?${query}` : ''}`);
  }

  async testSecurityConfig() {
    return this.request('/security/test', {
      method: 'POST',
    });
  }

  // Rate Limiting
  async getRateLimitStatus() {
    return this.request('/system/rate-limits');
  }

  async updateRateLimits(config: any) {
    return this.request('/system/rate-limits', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  // System Prompts Management
  async getSystemPrompts() {
    return this.request('/system/prompts');
  }

  async updateSystemPrompt(strictnessLevel: 'lenient' | 'standard' | 'strict', prompt: string) {
    return this.request(`/system/prompts/${strictnessLevel}`, {
      method: 'PUT',
      body: JSON.stringify({ prompt })
    });
  }

  async resetSystemPrompt(strictnessLevel: 'lenient' | 'standard' | 'strict') {
    return this.request(`/system/prompts/${strictnessLevel}/reset`, {
      method: 'POST'
    });
  }
}

export const apiClient = new ApiClient(); 