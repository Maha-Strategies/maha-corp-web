/** Zero-dependency client for Node, Bun, Deno, browsers, and Edge runtimes. */
export type ContextCompressRequest = { clientRequestId: string; task: string; tokenBudget: number; documents: Array<{ id: string; title?: string; text: string }> }
export type ContextCompressResponse = { packId: string; context: string; metrics: { originalEstimatedTokens: number; compiledEstimatedTokens: number; estimatedReductionPercent: number }; sources: Array<{ sourceId: string; includedPassageIds: string[] }>; warnings: string[] }
export type ProvenanceVerifyResponse = { claim_id: string; title: string; summary: string; status: 'VERIFIED' | 'SOURCED' | 'ILLUSTRATIVE' | 'UNVERIFIED'; latex_formulation: string; sources: string[]; tags: string[]; canonical_url: string }

// --- Audit & MCP Types ---
export type AuditExportOptions = { format?: 'csv' | 'pdf'; startTime?: number; endTime?: number }
export type RegisterMCPOptions = { name: string; baseUrl: string; authType: 'bearer' | 'hmac' | 'none'; secret?: string }
export type McpToolDefinition = { name: string; description?: string; inputSchema: Record<string, unknown> }
export type McpToolDiscovery = { status: 'pending' | 'ready' | 'error'; tools: McpToolDefinition[]; discoveredAt?: number; error?: string }
export type McpServerSummary = { serverId: string; name: string; baseUrl: string; createdAt: number; status: 'active' | 'suspended'; discovery: McpToolDiscovery }
export type McpSlaSettings = { requestsPerMinute: number; timeoutMs: number; failureThreshold: number; cooldownMs: number }
export type RotatedApiKey = { apiKey: string; apiKeyId: string; balanceCredits: number; tier: 'starter' | 'builder' | 'scale' | 'enterprise'; disclosure: string }
export type TenantBillingSettings = { tenantId: string; tier: string; subscriptionStatus: string; subscriptionCredits: number; topupCredits: number; autoTopupEnabled: boolean; canEnableAutoTopup: boolean }

export class MahaApiError extends Error { readonly status: number; readonly code: string; constructor(status: number, code: string, message: string) { super(message); this.name = 'MahaApiError'; this.status = status; this.code = code } }
export class MahaAuthenticationError extends MahaApiError { constructor(status: 401 | 402, code: string, message: string) { super(status, code, message); this.name = 'MahaAuthenticationError' } }
export type MahaClientOptions = { apiKey: string; baseUrl?: string }

export class MahaClient {
  private readonly baseUrl: string
  private readonly options: MahaClientOptions

  constructor(options: MahaClientOptions) {
    if (!options.apiKey.trim()) throw new Error('apiKey is required.');
    this.options = options;
    this.baseUrl = (options.baseUrl ?? 'https://www.mahastrategies.com').replace(/\/$/, '')
  }

  // --- Core API Methods ---

  async compress(payload: ContextCompressRequest): Promise<ContextCompressResponse> { return this.request('/api/v1/compress', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }) }

  async verify(claimId: string): Promise<ProvenanceVerifyResponse> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(claimId)) throw new Error('claimId must be a lowercase slug.');
    return this.request(`/api/v1/claims/${encodeURIComponent(claimId)}`)
  }

  async getBalance(): Promise<{ api_key_id?: string; tenant_id?: string; balance_credits: number; subscription_credits?: number; topup_credits?: number; tier?: string }> { return this.request('/api/v1/keys/balance') }
  /** Replaces this raw API credential while preserving its key ID and balance. The returned secret is disclosed once. */
  async rotateApiKey(): Promise<RotatedApiKey> { return this.request('/api/v1/keys/rotate', { method: 'POST' }) }
  /** Permanently disables this raw API credential. */
  async revokeApiKey(): Promise<{ revoked: true }> { return this.request('/api/v1/keys/revoke', { method: 'POST' }) }
  public readonly billing = {
    getSettings: async (): Promise<TenantBillingSettings> => this.request('/api/v1/billing/settings'),
    subscribe: async (tier: 'builder' | 'scale', clientRequestId = crypto.randomUUID().replaceAll('-', '')): Promise<{ url: string }> => this.request('/api/v1/billing/subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier, clientRequestId }) }),
    setAutoTopup: async (enabled: boolean): Promise<{ autoTopupEnabled: boolean }> => this.request('/api/v1/billing/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autoTopupEnabled: enabled }) }),
  }

  // --- Phase A: Audit & Compliance ---

  public readonly audit = {
    /**
     * Exports double-entry provenance ledger entries as a raw CSV string or PDF ArrayBuffer/Blob.
     */
    export: async (options: AuditExportOptions = {}): Promise<{ data: ArrayBuffer | Blob | string; filename: string }> => {
      const format = options.format ?? 'csv';
      const params = new URLSearchParams({ format });
      if (options.startTime) params.set('startTime', options.startTime.toString());
      if (options.endTime) params.set('endTime', options.endTime.toString());

      // Bypass internal request() to handle raw binary/text responses cleanly
      const response = await fetch(`${this.baseUrl}/api/v1/audit/export?${params.toString()}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.options.apiKey}` }
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new MahaApiError(response.status, `http_${response.status}`, `Audit export failed: ${errText}`);
      }

      const contentDisposition = response.headers.get('content-disposition');
      const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `maha_audit.${format}`;

      if (format === 'csv') {
        return { data: await response.text(), filename };
      }

      // Return ArrayBuffer for Edge/Node/Bun, and Blob for Browser environments
      if (typeof window === 'undefined') {
        return { data: await response.arrayBuffer(), filename };
      } else {
        return { data: await response.blob(), filename };
      }
    }
  };

  // --- Phase B: Enterprise MCP Gateway ---

  public readonly mcp = {
    /** Lists the authenticated API key's registered MCP upstreams without credentials. */
    listServers: async (): Promise<McpServerSummary[]> => {
      const response = await this.request<{ servers: McpServerSummary[] }>('/api/v1/mcp/servers')
      return response.servers
    },
    /** Re-runs the upstream tools/list handshake and persists a validated tool inventory. */
    discoverTools: async (serverId: string): Promise<McpServerSummary> => {
      const response = await this.request<{ server: McpServerSummary }>(`/api/v1/mcp/servers/${encodeURIComponent(serverId)}/discover`, { method: 'POST' })
      return response.server
    },
    /** Reads tenant-wide MCP proxy rate, timeout, and circuit-breaker controls. */
    getSettings: async (): Promise<McpSlaSettings> => {
      const response = await this.request<{ settings: McpSlaSettings }>('/api/v1/mcp/settings')
      return response.settings
    },
    /** Replaces tenant-wide MCP proxy controls after server-side bounds validation. */
    updateSettings: async (settings: McpSlaSettings): Promise<McpSlaSettings> => {
      const response = await this.request<{ settings: McpSlaSettings }>('/api/v1/mcp/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
      return response.settings
    },
    /**
     * Registers a new tenant-scoped upstream MCP tool server.
     */
    registerServer: async (options: RegisterMCPOptions): Promise<McpServerSummary & { id: string }> => {
      return this.request('/api/v1/mcp/register', {
        method: 'POST',
        body: JSON.stringify(options),
        headers: { 
          'Content-Type': 'application/json',
        }
      });
    },

    /**
     * Dispatches a JSON-RPC 2.0 call through the tenant MCP Gateway proxy.
     */
    call: async <T = unknown>(serverId: string, method: string, params: Record<string, unknown> = {}): Promise<T> => {
      const payload = {
        jsonrpc: '2.0',
        id: `req_${Date.now()}`,
        method,
        params
      };

      const response = await this.request<{ result?: T; error?: { code: number; message: string } }>(
        `/api/v1/mcp/gateway/${encodeURIComponent(serverId)}`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 
            'Content-Type': 'application/json',
          }
        }
      );

      if (response.error) {
        throw new Error(`MCP Error [${response.error.code}]: ${response.error.message}`);
      }
      return response.result as T;
    }
  };

  // --- Base Fetch Implementation ---

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers: { Accept: 'application/json', Authorization: `Bearer ${this.options.apiKey}`, ...init.headers } })

      if (response.status === 429 && attempt < 3) {
        const retry = Number(response.headers.get('retry-after'));
        const delay = Number.isFinite(retry) && retry > 0 ? retry * 1_000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue
      }

      const data = await response.json().catch(() => ({})) as T & { error?: { code?: string; message?: string } | string }

      if (!response.ok) {
        const error = data.error
        const code = typeof error === 'object' && error !== null ? error.code ?? `http_${response.status}` : `http_${response.status}`;
        const message = typeof error === 'string'
          ? error
          : typeof error === 'object' && error !== null && error.message
            ? error.message
            : `Maha API request failed (${response.status}).`;
        if (response.status === 401 || response.status === 402) throw new MahaAuthenticationError(response.status, code, message);
        throw new MahaApiError(response.status, code, message)
      }

      return data
    }
    throw new MahaApiError(429, 'rate_limited', 'Rate limit retry budget exhausted.')
  }
}
