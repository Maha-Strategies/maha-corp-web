import { createHash, randomUUID } from 'node:crypto'
import { sourceMetadataComplete } from './content-source-quality.ts'

function line(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== 'string') throw new Error(`${field} must be text.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max || /[\r\n]/.test(parsed)) throw new Error(`${field} must contain between ${min} and ${max} characters on one line.`)
  return parsed
}
function evidence(value: unknown) {
  if (!Array.isArray(value) || value.length < 3 || value.length > 5 || !sourceMetadataComplete(value)) throw new Error('Evidence needs 3–5 specific sources with actual titles and source notes.')
  const domains = new Set<string>()
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`evidence[${index}] is invalid.`)
    const source = raw as Record<string, unknown>
    const url = line(source.url, `evidence[${index}].url`, 8, 2_000)
    let parsed: URL; try { parsed = new URL(url) } catch { throw new Error(`evidence[${index}].url must be an HTTPS URL.`) }
    if (parsed.protocol !== 'https:' || domains.has(parsed.hostname)) throw new Error('Evidence sources must use independent HTTPS domains.')
    domains.add(parsed.hostname)
    const publishedOn = line(source.publishedOn, `evidence[${index}].publishedOn`, 10, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedOn)) throw new Error(`evidence[${index}].publishedOn must be an ISO date.`)
    if (!['primary', 'official', 'public_data', 'internal'].includes(String(source.sourceType))) throw new Error(`evidence[${index}].sourceType is not supported.`)
    return { url: parsed.toString(), title: line(source.title, `evidence[${index}].title`, 8, 240), sourceType: source.sourceType, publishedOn, note: line(source.note, `evidence[${index}].note`, 30, 750) }
  })
}

export function contentAmendmentId() { return `contentamend_${randomUUID().replaceAll('-', '')}` }
export function contentAmendmentHash(value: string) { return `sha256:${createHash('sha256').update(value).digest('hex')}` }
export function parseContentSourceAmendment(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  const publicationId = line(body.publicationId, 'publicationId', 12, 80)
  const slug = line(body.slug, 'slug', 3, 100)
  if (!/^contentpub_[a-f0-9]{32}$/.test(publicationId) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Publication reference is invalid.')
  if (body.confirmation !== `AMEND ${slug}`) throw new Error(`confirmation must exactly equal AMEND ${slug}.`)
  return { publicationId, slug, confirmation: body.confirmation, evidence: evidence(body.evidence), note: line(body.note, 'note', 3, 2_000), idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120) }
}
