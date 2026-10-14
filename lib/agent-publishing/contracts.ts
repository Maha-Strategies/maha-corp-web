import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import type { PaymentRequirement } from '../x402/protocol.ts'

export const RETRIEVAL_PATH = '/api/v1/publications/retrieve'
export const OFFER_ID = 'agent-evidence-brief-local-v1'
export const PRICE_ATOMIC = '50000'
export const RECOVERY_DAYS = 30
export const LOCAL_REQUIREMENT: PaymentRequirement = {
  scheme: 'exact', network: 'eip155:31337', amount: PRICE_ATOMIC,
  asset: '0x0000000000000000000000000000000000000001',
  payTo: '0x0000000000000000000000000000000000000002', maxTimeoutSeconds: 300,
  extra: { name: 'Maha Local Test Token', version: '1' },
}
export const LOCAL_BOUNDARY = 'Local development only. Cryptographically signed authorizations and simulated settlement; no token balance, funds transfer, RPC call or public publication.'

export function canonical(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value.normalize('NFC'))
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`
}
export function digest(value: unknown) { return `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}` }
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100)
const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/)
const line = z.string().trim().min(1).max(2000)
const source = z.object({ id: slug, title: line, url: z.url().refine(value => value.startsWith('https://')), locator: line, inspectedOn: z.iso.date() }).strict()
export const briefSchema = z.object({
  publicationId: slug, releaseId: z.string().regex(/^\d+\.\d+\.\d+$/),
  collectionId: z.literal('agent-infrastructure-evidence'), title: line, summary: line,
  releasedOn: z.iso.date(), author: z.literal('Codex — AI drafting and source review'),
  editorial: z.object({ humanApproval: z.literal('pending'), scope: z.literal('local-development-only'), sourceReview: line }).strict(),
  sources: z.array(source).min(1).max(10),
  findings: z.array(z.object({ id: slug, statement: line, sourceIds: z.array(slug).min(1).max(10) }).strict()).min(1).max(10),
  markdown: z.string().min(500).max(25_000), limitations: z.array(line).min(1).max(10),
}).strict().superRefine((brief, ctx) => {
  if (brief.markdown.split(/\s+/).length > 2500) ctx.addIssue({ code: 'custom', message: 'Brief exceeds 2500 words.' })
  const ids = brief.sources.map(s => s.id)
  if (new Set(ids).size !== ids.length || new Set(brief.findings.map(f => f.id)).size !== brief.findings.length) ctx.addIssue({ code: 'custom', message: 'Duplicate evidence identifiers.' })
  if (brief.findings.some(f => f.sourceIds.some(id => !ids.includes(id)))) ctx.addIssue({ code: 'custom', message: 'Unbound finding source.' })
})
export type Brief = z.infer<typeof briefSchema>
export const LICENSE = {
  id: 'maha-local-internal-use-v1', grant: 'Non-exclusive internal analysis, grounding and caching of this local preview. Preserve source attribution and review disclosures.',
  redistributionAllowed: false, resaleAllowed: false, modelTrainingRightsGranted: false,
  copyrightTransferred: false, publicPublicationAuthorized: false,
} as const
export function compileRelease(supplied: unknown) {
  const brief = briefSchema.parse(supplied)
  const payload = { schemaVersion: 'maha-agent-publication/1', ...brief,
    contentSha256: digest(brief.markdown), license: LICENSE, licenseSha256: digest(LICENSE), boundary: LOCAL_BOUNDARY }
  return { ...payload, artifactSha256: digest(payload) }
}
export type Release = ReturnType<typeof compileRelease>
export function briefFromRelease(record: Release): Brief {
  return briefSchema.parse(Object.fromEntries(Object.keys(briefSchema.shape).map(key => [key, record[key as keyof Release]])))
}
export function validateRelease(value: unknown): Release {
  const record = value as Release
  const expected = compileRelease(briefFromRelease(record))
  if (canonical(expected) !== canonical(record)) throw new Error('artifact_integrity_failed')
  return expected
}
export const retrievalSchema = z.object({ publicationId: slug, releaseId: z.string().regex(/^\d+\.\d+\.\d+$/), artifactSha256: hash, licenseSha256: hash }).strict()
export type RetrievalInput = z.infer<typeof retrievalSchema>
export type PurchaseIdentity = { purchaseId: string; recoverySecret: string }
export function createPurchaseIdentity(): PurchaseIdentity {
  return { purchaseId: randomBytes(16).toString('hex'), recoverySecret: randomBytes(32).toString('hex') }
}
export function purchaseHash(input: RetrievalInput, identity: PurchaseIdentity) {
  return digest({ version: 'maha-publication-purchase/1', offerId: OFFER_ID, ...identity, input })
}
export function purchaseHeaders(input: RetrievalInput, identity: PurchaseIdentity) {
  return { 'x-maha-idempotency-key': identity.purchaseId, 'x-maha-recovery-secret': identity.recoverySecret, 'x-maha-input-hash': purchaseHash(input, identity) }
}
export function readPurchase(headers: Headers, input: RetrievalInput) {
  const identity = { purchaseId: headers.get('x-maha-idempotency-key') ?? '', recoverySecret: headers.get('x-maha-recovery-secret') ?? '' }
  if (!/^[a-f0-9]{32}$/.test(identity.purchaseId) || !/^[a-f0-9]{64}$/.test(identity.recoverySecret) || headers.get('x-maha-input-hash') !== purchaseHash(input, identity)) throw new Error('invalid_purchase_binding')
  return { purchaseId: identity.purchaseId, secretHash: digest(identity.recoverySecret), inputHash: purchaseHash(input, identity) }
}
export type PurchaseBinding = ReturnType<typeof readPurchase>
export function retrievalInput(release: Pick<Release, 'publicationId' | 'releaseId' | 'artifactSha256' | 'licenseSha256'>): RetrievalInput {
  return { publicationId: release.publicationId, releaseId: release.releaseId, artifactSha256: release.artifactSha256, licenseSha256: release.licenseSha256 }
}
export function localPublishingAllowed(request: Request, env: NodeJS.ProcessEnv = process.env) {
  const url = new URL(request.url)
  try {
    localRequestOrigin(request)
    return env.MAHA_AGENT_PUBLISHING_LOCAL === '1' && ['development', 'test'].includes(env.NODE_ENV ?? '') && !env.VERCEL && !env.VERCEL_ENV
      && url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  } catch { return false }
}
/** Next dev may normalize request.url to localhost; the validated Host is the buyer's actual origin. */
export function localRequestOrigin(request: Request) {
  const host = request.headers.get('host')
  const url = host ? new URL(`http://${host}`) : new URL(request.url)
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password
    || (host && (url.pathname !== '/' || url.search || url.hash || url.host !== host.toLowerCase()))) throw new Error('invalid_local_host')
  return url.origin
}
