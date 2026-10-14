import { z } from 'zod'
import { ENDPOINTS, endpointById } from './endpoints.registry.ts'
import { DOMAINS, recoverySeconds, RECEIPT_RETENTION_SECONDS, type Domain, type Endpoint } from './types.ts'
import { publicBookMetadata } from './book-catalogue.ts'
import { modularRecoveryContract } from '../x402/input-bound-payment.ts'
import { PRODUCTION_ENDPOINTS, productionEndpointById, releaseExample } from './production-release.ts'
export const searchInput = z.object({ q: z.string().max(160).default(''), domain: z.enum(DOMAINS).optional(), limit: z.number().int().min(1).max(10).default(5) }).strict()
const STOP = new Set(['the', 'a', 'an', 'and', 'for', 'to', 'of', 'with', 'can', 'i', 'my'])
const words = (s: string) => [...new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter(w => !STOP.has(w))
export function visibleEndpoint(e: Endpoint, local = false) {
  return e.status === 'released' && e.productionApproved || local && e.status === 'local-implemented'
}
export const describeEndpoint = (e: Endpoint) => ({ id: e.id, name: e.name, description: e.description, method: e.method, path: e.path, domain: e.domain,
  ...(e.productionApproved ? { examples: releaseExample(e.id) && { input: releaseExample(e.id)!.input, output: releaseExample(e.id)!.output } } : {}),
  ...(publicBookMetadata(e.id) ? { book: publicBookMetadata(e.id) } : {}),
  category: e.category, tags: e.tags, price_usdc: e.price_usdc, amount: e.amount, schema: e.schema, estimated_compute_cost: e.estimated_compute_cost,
  cost_basis: e.cost_basis, pricing: e.pricing, execution_cost: e.execution_cost, status: e.status, paymentEnabled: e.productionApproved, recovery: {
    binding: modularRecoveryContract(e.id),
    retentionSeconds: recoverySeconds(e), receiptRetentionSeconds: RECEIPT_RETENTION_SECONDS, inputHashHeader: 'X-Maha-Input-Hash', privateSecretHeader: 'X-Maha-Recovery-Secret',
    complimentaryCorrection: e.id === 'publication-pinned-brief',
    recoveryMode: 'X-Maha-Recovery-Mode: retained-result', automaticRepayment: false,
    capsulePrivate: true, requiresMahaBuyerAdapter: true },
  limitations: ['Costs are planning assumptions, not measurements or a guarantee of margin.', 'An unavailable product must not be purchased.',
    `Prepared output is retained ${recoverySeconds(e) / 86400} days; minimal purchase/transaction metadata is retained 90 days. Recovery does not extend either deadline. Hashes are not anonymization. No raw input, signature or recovery secret is retained.`,
    'Research results may retain short public titles and metadata; receipt verification is not scientific validation.'] })
export function searchEndpoints(input: unknown, options: { local?: boolean; entries?: readonly Endpoint[] } = {}) {
  const q = searchInput.parse(input), tokens = words(q.q)
  if (q.q.trim() && !tokens.length) return { matches: [], totalMatches: 0, limit: q.limit, method: 'deterministic-keyword-tags', paymentEnabled: false }
  const scored = (options.entries ?? (options.local ? ENDPOINTS : PRODUCTION_ENDPOINTS)).filter(e => visibleEndpoint(e, options.local) && (!q.domain || q.domain === e.domain)).map(e => {
    const id = new Set(words(e.id)), tags = new Set(words(e.tags.join(' '))), name = new Set(words(e.name)), description = new Set(words(e.description))
    return { e, score: tokens.reduce((n, t) => n + (id.has(t) ? 8 : 0) + (tags.has(t) ? 6 : 0) + (name.has(t) ? 4 : 0) + (description.has(t) ? 1 : 0), 0) }
  }).filter(r => !tokens.length || r.score > 0).sort((a, b) => b.score - a.score || a.e.id.localeCompare(b.e.id))
  return { matches: scored.slice(0, q.limit).map(({ e, score }) => ({ ...describeEndpoint(e), relevance: score })), totalMatches: scored.length,
    limit: q.limit, method: 'deterministic-keyword-tags', paymentEnabled: false }
}
export function describeById(id: string, local = false, domain?: Domain) {
  const e = (local ? endpointById : productionEndpointById)(id)
  return e && visibleEndpoint(e, local) && (!domain || domain === e.domain) ? describeEndpoint(e) : undefined
}
export const localDiscovery = () => process.env.NODE_ENV === 'development' && process.env.VERCEL_ENV !== 'production'
