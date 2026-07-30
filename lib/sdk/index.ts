/** Zero-dependency client for Node, Bun, Deno, browsers, and Edge runtimes. */
export type ContextCompressRequest = { clientRequestId: string; task: string; tokenBudget: number; documents: Array<{ id: string; title?: string; text: string }> }
export type ContextCompressResponse = { packId: string; context: string; metrics: { originalEstimatedTokens: number; compiledEstimatedTokens: number; estimatedReductionPercent: number }; sources: Array<{ sourceId: string; includedPassageIds: string[] }>; warnings: string[] }
export type ProvenanceVerifyResponse = { claim_id: string; title: string; summary: string; status: 'VERIFIED' | 'SOURCED' | 'ILLUSTRATIVE' | 'UNVERIFIED'; latex_formulation: string; sources: string[]; tags: string[]; canonical_url: string }
export class MahaApiError extends Error { readonly status: number; readonly code: string; constructor(status: number, code: string, message: string) { super(message); this.name = 'MahaApiError'; this.status = status; this.code = code } }
export class MahaAuthenticationError extends MahaApiError { constructor(status: 401 | 402, code: string, message: string) { super(status, code, message); this.name = 'MahaAuthenticationError' } }
export type MahaClientOptions = { apiKey: string; baseUrl?: string }

export class MahaClient {
  private readonly baseUrl: string
  private readonly options: MahaClientOptions
  constructor(options: MahaClientOptions) { if (!options.apiKey.trim()) throw new Error('apiKey is required.'); this.options = options; this.baseUrl = (options.baseUrl ?? 'https://www.mahastrategies.com').replace(/\/$/, '') }
  async compress(payload: ContextCompressRequest): Promise<ContextCompressResponse> { return this.request('/api/v1/compress', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }) }
  async verify(claimId: string): Promise<ProvenanceVerifyResponse> { if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(claimId)) throw new Error('claimId must be a lowercase slug.'); return this.request(`/api/v1/claims/${encodeURIComponent(claimId)}`) }
  async getBalance(): Promise<{ balance_credits: number }> { return this.request('/api/v1/keys/balance') }
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers: { Accept: 'application/json', Authorization: `Bearer ${this.options.apiKey}`, ...init.headers } })
      if (response.status === 429 && attempt < 3) { const retry = Number(response.headers.get('retry-after')); const delay = Number.isFinite(retry) && retry > 0 ? retry * 1_000 : 250 * 2 ** attempt; await new Promise((resolve) => setTimeout(resolve, delay)); continue }
      const data = await response.json().catch(() => ({})) as T & { error?: { code?: string; message?: string } }
      if (!response.ok) { const code = data.error?.code ?? `http_${response.status}`; const message = data.error?.message ?? `Maha API request failed (${response.status}).`; if (response.status === 401 || response.status === 402) throw new MahaAuthenticationError(response.status, code, message); throw new MahaApiError(response.status, code, message) }
      return data
    }
    throw new MahaApiError(429, 'rate_limited', 'Rate limit retry budget exhausted.')
  }
}
