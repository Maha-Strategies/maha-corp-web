/** Zero-dependency client for Node, Bun, Deno, browsers, and Edge runtimes. */
export type ContextCompressRequest = { clientRequestId: string; task: string; tokenBudget: number; documents: Array<{ id: string; title?: string; text: string }> }
export type ContextCompressResponse = {
  version: string; packId: string; clientRequestId: string; task: string; tokenBudget: number; context: string
  metrics: { originalBytes: number; compiledBytes: number; originalEstimatedTokens: number; compiledEstimatedTokens: number; estimatedReductionPercent: number; sourceCount: number; sourceCoveragePercent: number; duplicatePassagesRemoved: number }
  includedPassages: Array<{ sourceId: string; passageId: string; passageHash: string; text: string }>
  sources: Array<{ sourceId: string; title: string; sourceHash: string; originalEstimatedTokens: number; passageCount: number; includedPassageIds: string[]; includedEstimatedTokens: number }>
  warnings: string[]
  warningCodes: Array<'model_neutral_token_estimates' | 'extractive_selection_not_verification' | 'no_passage_fit_budget'>
  retentionBoundaries: { selectionType: 'extractive'; evidenceRetention: 'best_effort'; claimVerificationPerformed: false; completenessGuaranteed: false; hallucinationPreventionGuaranteed: false; tokenCountType: 'model_neutral_estimate' }
  inputHash: string; outputHash: string; sourceTextStored: false; compiledContextStored: false
}
export type ProvenanceVerifyResponse = { claim_id: string; title: string; summary: string; status: 'VERIFIED' | 'SOURCED' | 'ILLUSTRATIVE' | 'UNVERIFIED'; latex_formulation: string; sources: string[]; tags: string[]; canonical_url: string }

// --- Audit & MCP Types ---
export type AuditExportOptions = { format?: 'csv' | 'pdf'; startTime?: number; endTime?: number }
export type McpServerPolicy = { allowedMethods: string[]; allowedToolNames: string[]; mode?: 'explicit' | 'legacy_discovered' }
export type RegisterMCPOptions = { name: string; baseUrl: string; authType: 'bearer' | 'hmac' | 'none'; secret?: string; allowedMethods?: string[]; allowedToolNames?: string[] }
export type McpToolDefinition = { name: string; description?: string; inputSchema: Record<string, unknown> }
export type McpToolDiscovery = { status: 'pending' | 'ready' | 'error'; tools: McpToolDefinition[]; discoveredAt?: number; error?: string }
export type McpServerSummary = { serverId: string; name: string; baseUrl: string; createdAt: number; status: 'active' | 'suspended'; policy: McpServerPolicy; discovery: McpToolDiscovery }
export type McpSlaSettings = { requestsPerMinute: number; timeoutMs: number; failureThreshold: number; cooldownMs: number }
export type RotatedApiKey = { apiKey: string; apiKeyId: string; balanceCredits: number; tier: 'starter' | 'builder' | 'scale' | 'enterprise'; disclosure: string }
export type TenantBillingSettings = { tenantId: string; tier: string; subscriptionStatus: string; subscriptionCredits: number; topupCredits: number; autoTopupEnabled: boolean; canEnableAutoTopup: boolean }
export type QuboIsingRequest = {
  clientRequestId: string
  problem: { formulation: 'qubo' | 'ising'; size: number; terms: Array<{ i: number; j: number; value: number }> }
  solver?: { maxSweeps?: number; replicas?: number; seed?: number; exactThreshold?: number; initialTemperature?: number; finalTemperature?: number }
  target?: 'gpu'
  timeoutSeconds?: number
}
export type QuboIsingJob = {
  jobId: string; kind: 'qubo-ising'; status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  clientRequestId: string; inputHash: string; pollUrl?: string; quotedCredits?: number
  acceptedConfiguration: { formulation: 'qubo' | 'ising'; problemSize: number; target: 'gpu' }
  credits: { reserved: number; charged: number | null; refunded: number }
  result: { objectiveValue: number; assignment: number[]; bestBound: number | null; provenOptimal: boolean } | null
  diagnostics: { algorithm: 'exhaustive-enumeration' | 'parallel-update-simulated-annealing-torch-v1'; sweepsCompleted: number; replicas: number | null; acceptedMoves: number | null; wallClockSeconds: number; deviceClass: string } | null
  error: { code: string; message: string } | null
}
export type TensorNetworkRequest = {
  clientRequestId: string
  problem: QuboIsingRequest['problem']
  solver?: { bondDimension?: number; exactThreshold?: number }
  target?: 'gpu'; timeoutSeconds?: number
}
export type TensorNetworkJob = Omit<QuboIsingJob, 'kind' | 'diagnostics'> & {
  kind: 'tensor-network'
  diagnostics: { algorithm: 'exhaustive-enumeration' | 'bounded-bond-transfer-contraction-torch-v1'; sweepsCompleted: number; replicas: null; acceptedMoves: null; wallClockSeconds: number; deviceClass: string; bondDimension?: number; peakFrontier?: number; truncations?: number } | null
}
export type Point3 = [number, number, number]
export type GeometricRegistrationRequest = {
  clientRequestId: string
  problem: { sourcePoints: Point3[]; targetPoints: Point3[]; weights?: number[] }
  solver?: { allowReflection?: false }
  target?: 'gpu'; timeoutSeconds?: number
}
export type GeometricRegistrationJob = Omit<QuboIsingJob, 'kind' | 'acceptedConfiguration' | 'result' | 'diagnostics'> & {
  kind: 'geometric-registration'
  acceptedConfiguration: { formulation: 'se3-paired-registration'; problemSize: number; target: 'gpu' }
  result: { rotation: [Point3, Point3, Point3]; translation: Point3; rmse: number; maxError: number; determinant: number } | null
  diagnostics: { algorithm: 'weighted-kabsch-svd-torch-v1'; pointCount: number; reflectionCorrected: boolean; orthogonalityResidual: number; singularValues: number[]; wallClockSeconds: number; deviceClass: string } | null
}
export type MahaOptimizationJob = QuboIsingJob | TensorNetworkJob | GeometricRegistrationJob

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

  public readonly optimization = {
    submitQuboIsing: async (payload: QuboIsingRequest): Promise<QuboIsingJob> => this.request('/api/v1/jobs/qubo-ising', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
    submitTensorNetwork: async (payload: TensorNetworkRequest): Promise<TensorNetworkJob> => this.request('/api/v1/jobs/tensor-network', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
    submitGeometricRegistration: async (payload: GeometricRegistrationRequest): Promise<GeometricRegistrationJob> => this.request('/api/v1/jobs/geometric-registration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
    getJob: async <T extends MahaOptimizationJob = MahaOptimizationJob>(jobId: string): Promise<T> => {
      if (!/^job_[a-f0-9]{32}$/.test(jobId)) throw new Error('jobId is malformed.')
      return this.request(`/api/v1/jobs/${encodeURIComponent(jobId)}`)
    },
    solveQuboIsing: async (payload: QuboIsingRequest, options: { pollIntervalMs?: number; timeoutMs?: number } = {}): Promise<QuboIsingJob> => {
      let job = await this.optimization.submitQuboIsing(payload)
      const deadline = Date.now() + (options.timeoutMs ?? 120_000)
      let delay = Math.max(100, options.pollIntervalMs ?? 500)
      while (job.status === 'queued' || job.status === 'processing') {
        if (Date.now() >= deadline) throw new MahaApiError(408, 'job_poll_timeout', 'QUBO/Ising job did not reach a terminal state before the polling deadline.')
        await new Promise((resolve) => setTimeout(resolve, delay))
        job = await this.optimization.getJob<QuboIsingJob>(job.jobId)
        delay = Math.min(5_000, Math.round(delay * 1.5))
      }
      if (job.status !== 'completed') throw new MahaApiError(500, job.error?.code ?? 'job_failed', job.error?.message ?? `QUBO/Ising job ended with status ${job.status}.`)
      return job
    },
    solveTensorNetwork: async (payload: TensorNetworkRequest, options: { pollIntervalMs?: number; timeoutMs?: number } = {}): Promise<TensorNetworkJob> => {
      let job = await this.optimization.submitTensorNetwork(payload)
      const deadline = Date.now() + (options.timeoutMs ?? 120_000)
      let delay = Math.max(100, options.pollIntervalMs ?? 500)
      while (job.status === 'queued' || job.status === 'processing') {
        if (Date.now() >= deadline) throw new MahaApiError(408, 'job_poll_timeout', 'Tensor-network job did not reach a terminal state before the polling deadline.')
        await new Promise((resolve) => setTimeout(resolve, delay))
        job = await this.optimization.getJob<TensorNetworkJob>(job.jobId)
        delay = Math.min(5_000, Math.round(delay * 1.5))
      }
      if (job.status !== 'completed') throw new MahaApiError(500, job.error?.code ?? 'job_failed', job.error?.message ?? `Tensor-network job ended with status ${job.status}.`)
      return job
    },
    solveGeometricRegistration: async (payload: GeometricRegistrationRequest, options: { pollIntervalMs?: number; timeoutMs?: number } = {}): Promise<GeometricRegistrationJob> => {
      let job = await this.optimization.submitGeometricRegistration(payload)
      const deadline = Date.now() + (options.timeoutMs ?? 120_000)
      let delay = Math.max(100, options.pollIntervalMs ?? 500)
      while (job.status === 'queued' || job.status === 'processing') {
        if (Date.now() >= deadline) throw new MahaApiError(408, 'job_poll_timeout', 'Geometric registration job did not reach a terminal state before the polling deadline.')
        await new Promise((resolve) => setTimeout(resolve, delay))
        job = await this.optimization.getJob<GeometricRegistrationJob>(job.jobId)
        delay = Math.min(5_000, Math.round(delay * 1.5))
      }
      if (job.status !== 'completed') throw new MahaApiError(500, job.error?.code ?? 'job_failed', job.error?.message ?? `Geometric registration job ended with status ${job.status}.`)
      return job
    },
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
    /** Replaces the explicit method and tool allowlist for a tenant-owned upstream. */
    updateServerPolicy: async (serverId: string, policy: { allowedMethods: string[]; allowedToolNames: string[]; status?: 'active' | 'suspended' }): Promise<McpServerSummary> => {
      const response = await this.request<{ server: McpServerSummary }>(`/api/v1/mcp/servers/${encodeURIComponent(serverId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(policy) })
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
        body: JSON.stringify({
          ...options,
          allowedMethods: options.allowedMethods ?? ['initialize', 'notifications/initialized', 'ping', 'tools/list', 'resources/list', 'resources/read', 'prompts/list', 'prompts/get'],
          allowedToolNames: options.allowedToolNames ?? [],
        }),
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
