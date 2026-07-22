import { createHash, randomUUID } from 'node:crypto'

export type ProspectInput = {
  sourceKind: 'manual' | 'market_opportunity' | 'inbound_referral'
  sourceReference: string
  companyName: string
  companyWebsite: string | null
  contactName: string | null
  contactEmail: string | null
  contactRole: string | null
  contactBasis: 'public_business_contact' | 'prior_relationship' | 'inbound_referral'
  offerId: string
  relevanceNote: string
}

function line(value: unknown, field: string, min: number, max: number, optional = false): string | null {
  if ((value === undefined || value === null || value === '') && optional) return null
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max || /[\r\n]/.test(parsed)) throw new Error(`${field} must contain between ${min} and ${max} characters on one line.`)
  return parsed
}

function https(value: unknown): string | null {
  const raw = line(value, 'companyWebsite', 8, 2_000, true)
  if (!raw) return null
  let url: URL
  try { url = new URL(raw) } catch { throw new Error('companyWebsite must be an absolute HTTPS URL.') }
  if (url.protocol !== 'https:') throw new Error('companyWebsite must be an absolute HTTPS URL.')
  return url.toString()
}

export function createProspectId() { return `prospect_${randomUUID().replaceAll('-', '')}` }
export function createOutboundDraftId() { return `outdraft_${randomUUID().replaceAll('-', '')}` }
export function outboundHash(value: string) { return `sha256:${createHash('sha256').update(value).digest('hex')}` }

export function parseProspect(value: unknown): ProspectInput & { idempotencyKey: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  if (!['manual', 'market_opportunity', 'inbound_referral'].includes(body.sourceKind as string)) throw new Error('sourceKind is not supported.')
  if (!['public_business_contact', 'prior_relationship', 'inbound_referral'].includes(body.contactBasis as string)) throw new Error('contactBasis is not supported.')
  const contactEmail = line(body.contactEmail, 'contactEmail', 5, 254, true)
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new Error('contactEmail must be a valid email address.')
  const offerId = line(body.offerId, 'offerId', 3, 100)
  if (!/^[a-z0-9][a-z0-9-]{2,100}$/.test(offerId!)) throw new Error('offerId is invalid.')
  return {
    sourceKind: body.sourceKind as ProspectInput['sourceKind'], sourceReference: line(body.sourceReference, 'sourceReference', 3, 200)!,
    companyName: line(body.companyName, 'companyName', 2, 160)!, companyWebsite: https(body.companyWebsite),
    contactName: line(body.contactName, 'contactName', 2, 120, true), contactEmail: contactEmail?.toLowerCase() ?? null,
    contactRole: line(body.contactRole, 'contactRole', 2, 120, true), contactBasis: body.contactBasis as ProspectInput['contactBasis'],
    offerId: offerId!, relevanceNote: line(body.relevanceNote, 'relevanceNote', 20, 2000)!, idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120)!,
  }
}

// A transparent readiness score, not a likelihood-to-buy prediction. It only
// answers whether the minimum review information for a respectful outreach
// draft has been supplied.
export function prospectFitScore(input: ProspectInput): number {
  return Math.min(100,
    25 + (input.companyWebsite ? 15 : 0) + (input.contactName ? 10 : 0) + (input.contactEmail ? 15 : 0)
    + (input.contactRole ? 10 : 0) + (input.sourceKind !== 'manual' ? 10 : 0)
    + (input.contactBasis === 'inbound_referral' ? 15 : input.contactBasis === 'prior_relationship' ? 10 : 5),
  )
}

export function parseProspectAction(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  const action = body.action
  if (!['start_review', 'qualify', 'reject', 'prepare_draft'].includes(action as string)) throw new Error('action is not supported.')
  const prospectId = line(body.prospectId, 'prospectId', 10, 80)!
  if (!/^prospect_[a-f0-9]{32}$/.test(prospectId)) throw new Error('prospectId is invalid.')
  return { prospectId, action: action as 'start_review' | 'qualify' | 'reject' | 'prepare_draft', note: line(body.note, 'note', 3, 2000, true) ?? '', idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120)! }
}

export function parseDraftAction(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  if (!['approve_draft', 'record_manual_send', 'record_reply', 'mark_won', 'mark_lost'].includes(body.action as string)) throw new Error('action is not supported.')
  const draftId = line(body.draftId, 'draftId', 10, 80)!
  if (!/^outdraft_[a-f0-9]{32}$/.test(draftId)) throw new Error('draftId is invalid.')
  return { draftId, action: body.action as 'approve_draft' | 'record_manual_send' | 'record_reply' | 'mark_won' | 'mark_lost', note: line(body.note, 'note', 3, 2000, true) ?? '', idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120)! }
}

export function draftSuggestion(prospect: Pick<ProspectInput, 'companyName' | 'contactName' | 'offerId' | 'relevanceNote'>) {
  const greeting = prospect.contactName ? `Hello ${prospect.contactName},` : 'Hello,'
  const offer = prospect.offerId === 'mps-prepaid-audit-access' ? 'claim-level MPS audit access' : prospect.offerId === 'utility-receipts-to-csv' ? 'receipt-to-CSV processing' : prospect.offerId.replaceAll('-', ' ')
  return {
    subject: `A question about ${prospect.companyName}'s evidence workflow`,
    body: `${greeting}\n\nI came across ${prospect.relevanceNote}\n\nMaha Strategies offers ${offer} for teams that need a clear, reviewable path from a question to an evidence-backed decision. If this is relevant to your work, would a short conversation be useful?\n\nIf this is not the right person or time, no response is needed.\n\nBest,\nMayone Maha Rajan\nMaha Strategies`,
  }
}
