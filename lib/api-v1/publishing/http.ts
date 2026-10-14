import { apiJson } from '../with402Payment.ts'
import { PUBLICATION_RECOVERY_SECONDS, RECEIPT_RETENTION_SECONDS } from '../types.ts'
import { endpointById } from '../endpoints.registry.ts'
import { withLocalReleases } from './releases.ts'

export const PUBLISHING_FREE_PATHS = ['/api/v1/library/publications/registry', '/api/v1/library/publications/events'] as const
export function localPublishingRequest(request: Request, env = process.env) {
  const url = new URL(request.url)
  return ['test', 'development'].includes(env.NODE_ENV ?? '') && !env.VERCEL && !env.VERCEL_ENV
    && url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
}
export async function publicationMetadata(request: Request, kind: 'registry' | 'events') {
  if (!localPublishingRequest(request)) return apiJson({ error: 'local_publishing_only' }, 404)
  const params = new URL(request.url).searchParams, allowed = kind === 'registry' ? ['q'] : ['cursor', 'limit']
  if ([...params.keys()].some(k => !allowed.includes(k) || params.getAll(k).length !== 1)) return apiJson({ error: 'invalid_query' }, 400)
  const query = params.get('q') ?? '', limit = params.get('limit') ?? '20'
  if (query.length > 160 || kind === 'events' && (!/^[1-9][0-9]{0,2}$/.test(limit) || Number(limit) > 100)) return apiJson({ error: 'invalid_query' }, 400)
  try { return withLocalReleases(journal => {
    if (kind === 'events') {
      return apiJson({ localPreview: true, humanApproval: 'pending', free: true, ...journal.feed(params.get('cursor'), Number(limit)) })
    }
    const e = endpointById('publication-pinned-brief')!
    return apiJson({ localPreview: true, humanApproval: 'pending', free: true, entries: journal.registry(query),
      retrieval: { endpoint: e.path, proposedAtomicAmount: e.amount, paymentEnabled: false,
        recoverySeconds: PUBLICATION_RECOVERY_SECONDS, receiptRetentionSeconds: RECEIPT_RETENTION_SECONDS,
        withdrawalPolicy: 'New sales stop. Existing paid result remains recoverable until its original deadline.',
        correctionPolicy: 'Every intervening release must be corrected with unchanged license; no new payment.',
        retentionPolicy: 'Access always expires at the original deadline. Local cleanup runs on journal access or explicit prune: output expires after its access window and minimal receipt metadata after 90 days. Offline disks and backups require separate handling. Publication artifacts/events are a separate editorial archive, retained until deliberate archive retirement.',
        rights: 'Local-preview internal-use license only; no new public citation, redistribution or training permission.' } })
  }) } catch (error) {
    const cursorError = error instanceof Error && /cursor/.test(error.message)
    return apiJson({ error: cursorError ? 'invalid_or_unverifiable_feed_cursor' : 'publication_journal_unavailable' }, cursorError ? 409 : 503)
  }
}
