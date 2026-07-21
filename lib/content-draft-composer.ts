import { createHash, randomUUID } from 'node:crypto'

export const CONTENT_DRAFT_ACTIONS = ['mark_editorial_ready', 'archive'] as const
type ContentDraftAction = typeof CONTENT_DRAFT_ACTIONS[number]

function line(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max || /[\r\n]/.test(parsed)) throw new Error(`${field} must contain between ${min} and ${max} characters on one line.`)
  return parsed
}
function paragraph(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max) throw new Error(`${field} must contain between ${min} and ${max} characters.`)
  return parsed
}
function optionalParagraph(value: unknown, field: string, min: number, max: number): string {
  if (value === undefined || value === null || value === '') return ''
  return paragraph(value, field, min, max)
}
function optionalHttpsUrl(value: unknown, field: string): string {
  if (value === undefined || value === null || value === '') return ''
  const parsed = line(value, field, 8, 2_000)
  let url: URL
  try { url = new URL(parsed) } catch { throw new Error(`${field} must be an absolute HTTPS URL.`) }
  if (url.protocol !== 'https:') throw new Error(`${field} must be an absolute HTTPS URL.`)
  return url.toString()
}

export function contentDraftId() { return `contentdraft_${randomUUID().replaceAll('-', '')}` }
export function contentDraftHash(value: string) { return `sha256:${createHash('sha256').update(value).digest('hex')}` }

export function parseContentDraft(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  const candidateId = line(body.candidateId, 'candidateId', 12, 80)
  if (!/^contentcand_[a-f0-9]{32}$/.test(candidateId)) throw new Error('candidateId is not valid.')
  const artifactUrl = optionalHttpsUrl(body.artifactUrl, 'artifactUrl')
  const artifactLabel = body.artifactLabel === undefined || body.artifactLabel === null || body.artifactLabel === '' ? '' : line(body.artifactLabel, 'artifactLabel', 3, 200)
  if (Boolean(artifactUrl) !== Boolean(artifactLabel)) throw new Error('artifactUrl and artifactLabel must be provided together.')
  return { candidateId, title: line(body.title, 'title', 20, 160), summary: paragraph(body.summary, 'summary', 80, 600), directAnswer: paragraph(body.directAnswer, 'directAnswer', 120, 1_800), method: paragraph(body.method, 'method', 120, 2_400), artifactUrl, artifactLabel, limitations: optionalParagraph(body.limitations, 'limitations', 40, 1_800), editorialReviewer: line(body.editorialReviewer, 'editorialReviewer', 3, 160), idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120) }
}

export function parseContentDraftAction(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  if (typeof body.action !== 'string' || !CONTENT_DRAFT_ACTIONS.includes(body.action as ContentDraftAction)) throw new Error('action is not supported.')
  const draftId = line(body.draftId, 'draftId', 12, 80)
  if (!/^contentdraft_[a-f0-9]{32}$/.test(draftId)) throw new Error('draftId is not valid.')
  return { draftId, action: body.action as ContentDraftAction, note: body.note === undefined || body.note === '' ? '' : paragraph(body.note, 'note', 3, 2_000), idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120) }
}

export function parseContentDraftRevision(value: unknown) {
  const draft = parseContentDraft(value)
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  const draftId = line(body.draftId, 'draftId', 12, 80)
  if (!/^contentdraft_[a-f0-9]{32}$/.test(draftId)) throw new Error('draftId is not valid.')
  return { ...draft, draftId }
}
