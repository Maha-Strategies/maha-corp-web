import { createHash, randomUUID } from 'node:crypto'

function line(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max || /[\r\n]/.test(parsed)) throw new Error(`${field} must contain between ${min} and ${max} characters on one line.`)
  return parsed
}

export function contentPublicationId() { return `contentpub_${randomUUID().replaceAll('-', '')}` }
export function contentPublicationHash(value: string) { return `sha256:${createHash('sha256').update(value).digest('hex')}` }
export function contentPublicationPath(slug: string) { return `/insights/${slug}` }

export function parseContentPublication(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  const handoffId = line(body.handoffId, 'handoffId', 12, 80)
  const draftId = line(body.draftId, 'draftId', 12, 80)
  const candidateId = line(body.candidateId, 'candidateId', 12, 80)
  const slug = line(body.slug, 'slug', 3, 100)
  if (!/^contenthandoff_[a-f0-9]{32}$/.test(handoffId)) throw new Error('handoffId is not valid.')
  if (!/^contentdraft_[a-f0-9]{32}$/.test(draftId)) throw new Error('draftId is not valid.')
  if (!/^contentcand_[a-f0-9]{32}$/.test(candidateId)) throw new Error('candidateId is not valid.')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('slug must use lowercase letters, numbers, and hyphens only.')
  if (body.confirmation !== `PUBLISH ${slug}`) throw new Error(`confirmation must exactly equal PUBLISH ${slug}.`)
  return {
    handoffId,
    draftId,
    candidateId,
    slug,
    note: body.note === undefined || body.note === '' ? '' : line(body.note, 'note', 3, 2_000),
    idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120),
  }
}
