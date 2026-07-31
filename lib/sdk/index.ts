/** Zero-dependency client for Node, Bun, Deno, browsers, and Edge runtimes. */
export type ContextCompressRequest = { clientRequestId: string; task: string; tokenBudget: number; documents: Array<{ id: string; title?: string; text: string }> }
export type ContextCompressResponse = { packId: string; context: string; metrics: { originalEstimatedTokens: number; compiledEstimatedTokens: number; estimatedReductionPercent: number }; sources: Array<{ sourceId: string; includedPassageIds: string[] }>; warnings: string[] }
export type ProvenanceVerifyResponse = { claim_id: string; title: string; summary: string; status: 'VERIFIED' | 'SOURCED' | 'ILLUSTRATIVE' | 'UNVERIFIED'; latex_formulation: string; sources: string[]; tags: string[]; canonical_url: string }

export type TensorOptRequest = { clientRequestId: string; problem: { formulation: 'qubo' | 'ising'; size?: number; termsUrl?: string; terms?: Array<{ i: number; j: number; weight: number }> }; solver?: { bondDimensionMax?: number; target_precision?: number; maxSweeps?: number; seed?: number } }
export type TensorOptJobRecord = { jobId: string; kind: 'tensor-opt'; status: 'queued' | 'processing' | 'completed' | 'failed'; clientRequestId: string; inputHash: string; credits: { reserved: number; charged: number | null; refunded: number }; result?: { objectiveValue: number; assignment: number[]; bestBound?: number; provenOptimal?: boolean }; diagnostics?: { wallClockSeconds: number; bondDimensionUsed?: number; sweepsCompleted?: number; discardedWeight?: number; deviceClass: string }; error?: { code: string; message: string }; citations?: Array<any> }

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

  async compress(payload: ContextCompressRequest): Promise<ContextCompressResponse> { return this.request('/api/v1/compress', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }) }

  async verify(claimId: string): Promise<ProvenanceVerifyResponse> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(claimId)) throw new Error('claimId must be a lowercase slug.');
    return this.request(`/api/v1/claims/${encodeURIComponent(claimId)}`)
  }

  async getBalance(): Promise<{ balance_credits: number }> { return this.request('/api/v1/keys/balance') }

  // --- Async GPU Worker Methods ---

  async dispatchTensorOpt(payload: TensorOptRequest): Promise<TensorOptJobRecord> {
    return this.request('/api/v1/jobs/tensor-opt', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } })
  }

  async getTensorOptJob(jobId: string): Promise<TensorOptJobRecord> {
    if (!/^job_[a-f0-9]{32}$/.test(jobId)) throw new Error('Invalid jobId format.');
    return this.request(`/api/v1/jobs/${encodeURIComponent(jobId)}`)
  }

  /**
   * Dispatches an optimization job and polls until completion or failure.
   */
  async solveTensorOpt(payload: TensorOptRequest, pollIntervalMs = 2000, maxRetries = 60): Promise<TensorOptJobRecord> {
    let job = await this.dispatchTensorOpt(payload);

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      if (job.status === 'completed' || job.status === 'failed') {
        return job;
      }
      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      job = await this.getTensorOptJob(job.jobId);
    }

    throw new Error(`Polling timed out after ${maxRetries} attempts. Job ${job.jobId} remains ${job.status}.`);
  }

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

      const data = await response.json().catch(() => ({})) as T & { error?: { code?: string; message?: string } }

      if (!response.ok) {
        const code = data.error?.code ?? `http_${response.status}`;
        const message = data.error?.message ?? `Maha API request failed (${response.status}).`;
        if (response.status === 401 || response.status === 402) throw new MahaAuthenticationError(response.status, code, message);
        throw new MahaApiError(response.status, code, message)
      }

      return data
    }
    throw new MahaApiError(429, 'rate_limited', 'Rate limit retry budget exhausted.')
  }
}