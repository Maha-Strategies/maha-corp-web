import { z } from 'zod'
import { MPS_TAGS, MPS_ACTIONS } from '../mps-audit-engine.ts'
import { id } from './batch5-core.ts'

/** Caller declarations only: a consistent VERIFIED label is not verification. */
export const MPS_CONTRACT_INPUT = z.object({
  passage: z.string().trim().min(1).max(6000),
  sources: z.array(z.object({ id, locator: z.string().trim().min(1).max(400) }).strict()).max(32),
  claims: z.array(z.object({ id, excerpt: z.string().trim().min(1).max(1000), tag: z.enum(MPS_TAGS),
    action: z.enum(MPS_ACTIONS), sourceIds: z.array(id).max(8),
    verificationRecorded: z.boolean() }).strict()).min(1).max(32),
}).strict().superRefine((v, ctx) => {
  if (new Set(v.sources.map(s => s.id)).size !== v.sources.length || new Set(v.claims.map(c => c.id)).size !== v.claims.length
    || v.claims.some(c => new Set(c.sourceIds).size !== c.sourceIds.length)) ctx.addIssue({ code: 'custom', message: 'Duplicate identifiers.' })
})
const code = z.enum(['excerpt-not-in-passage', 'unknown-source', 'sourced-without-reference',
  'verified-without-declared-record', 'unverified-without-remedial-action'])
export const MPS_CONTRACT_RESULT = z.object({
  claimCount: z.number().int().min(1).max(32), consistentClaimIds: z.array(id).max(32),
  findings: z.array(z.object({ claimId: id, code, sourceId: id.optional() }).strict()).max(384),
  modelCalls: z.literal(0), sourcesFetched: z.literal(false), factualVerificationPerformed: z.literal(false),
  basis: z.literal('caller-declared-tags-references-and-actions-only'),
}).strict()
export function auditMpsContract(supplied: unknown) {
  const input = MPS_CONTRACT_INPUT.parse(supplied), known = new Set(input.sources.map(s => s.id))
  const findings: z.infer<typeof MPS_CONTRACT_RESULT>['findings'] = []
  for (const c of input.claims) {
    const add = (code: z.infer<typeof MPS_CONTRACT_RESULT>['findings'][number]['code']) => findings.push({ claimId: c.id, code })
    if (!input.passage.includes(c.excerpt)) add('excerpt-not-in-passage')
    for (const sourceId of c.sourceIds) if (!known.has(sourceId)) findings.push({ claimId: c.id, code: 'unknown-source', sourceId })
    if (['SOURCED', 'VERIFIED'].includes(c.tag) && !c.sourceIds.length) add('sourced-without-reference')
    if (c.tag === 'VERIFIED' && !c.verificationRecorded) add('verified-without-declared-record')
    if (c.tag === 'UNVERIFIED' && c.action === 'none') add('unverified-without-remedial-action')
  }
  return MPS_CONTRACT_RESULT.parse({ claimCount: input.claims.length,
    consistentClaimIds: input.claims.filter(c => !findings.some(f => f.claimId === c.id)).map(c => c.id), findings,
    modelCalls: 0, sourcesFetched: false, factualVerificationPerformed: false, basis: 'caller-declared-tags-references-and-actions-only' })
}
