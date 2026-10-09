import { z } from 'zod'
import { aiSafetyReceiptSchema, aiSafetySubmissionSchema } from './ai-safety.ts'

export const shortText = (min = 1, max = 2000) => z.string().trim().min(min).max(max)
export const sha256 = z.string().regex(/^[a-f0-9]{64}$/)
export const httpsLink = z.string().url().max(1000).refine(value => {
  const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password
}, 'Use HTTPS without embedded credentials.')
export const evidenceSourceSchema = z.object({
  citation: shortText(3, 300), url: httpsLink, publishedOn: z.iso.date().nullable(),
  checkedOn: z.iso.date().nullable(), contentDigest: sha256.nullable(),
  verification: z.enum(['unreviewed-pointer', 'source-read', 'independently-corroborated']),
}).strict().refine(value => value.verification === 'unreviewed-pointer' || !!value.checkedOn, 'Reviewed sources need a checked date.')
export const riskGraphSchema = z.object({
  classification: z.enum(['unassessed', 'reported-observed-harm', 'potential-hazard', 'uncertain']),
  classificationRationale: shortText(10),
  nodes: z.array(z.object({ id: shortText(1, 80).regex(/^[a-z0-9-]+$/),
    kind: z.enum(['claim', 'source', 'system', 'question']), text: shortText(3, 4000),
    source: evidenceSourceSchema.optional(),
  }).strict()).max(40),
  edges: z.array(z.object({ from: shortText(1, 80), to: shortText(1, 80),
    relation: z.enum(['supports', 'challenges', 'affects', 'asks', 'suggested-source']), rationale: shortText(5, 1000),
  }).strict()).max(100),
}).strict().superRefine((graph, ctx) => {
  const nodes = new Map(graph.nodes.map(node => [node.id, node]))
  if (nodes.size !== graph.nodes.length) ctx.addIssue({ code: 'custom', message: 'Node IDs must be unique.' })
  for (const node of graph.nodes) if ((node.kind === 'source') !== !!node.source) ctx.addIssue({ code: 'custom', message: 'Only source nodes require source metadata.' })
  const seen = new Set<string>()
  for (const edge of graph.edges) {
    const from = nodes.get(edge.from), to = nodes.get(edge.to), key = `${edge.from}:${edge.relation}:${edge.to}`
    const valid = from && to && from !== to && !seen.has(key) && (
      (['supports', 'challenges', 'suggested-source'].includes(edge.relation) && ['source', 'claim'].includes(from.kind) && to.kind === 'claim') ||
      (edge.relation === 'affects' && from.kind === 'claim' && to.kind === 'system') ||
      (edge.relation === 'asks' && from.kind === 'question' && ['claim', 'system'].includes(to.kind)))
    if (!valid) ctx.addIssue({ code: 'custom', message: 'Invalid, duplicate or dangling evidence relationship.' })
    seen.add(key)
  }
})
export type RiskGraph = z.infer<typeof riskGraphSchema>
export const publicSummarySchema = z.object({
  id: z.string().uuid(), title: shortText(5, 120), youRaised: shortText(10, 1500),
  weInvestigated: shortText(10, 2000), whatChanged: shortText(10, 1500),
  unresolved: z.array(shortText(5, 1000)).max(10), decisionRationale: shortText(10, 2000),
  sources: z.array(evidenceSourceSchema).max(20),
}).strict()
export type PublicSummary = z.infer<typeof publicSummarySchema>
export const safetyCaseSchema = z.object({
  version: z.literal('civic-case-1'), id: z.string().uuid(), revision: z.number().int().positive(),
  updatedAt: z.string().datetime(), receipt: aiSafetyReceiptSchema,
  submission: aiSafetySubmissionSchema.nullable(), status: z.enum(['received', 'investigating', 'awaiting-citizen', 'resolved', 'out-of-scope', 'withdrawn']),
  assignedReviewer: shortText(1, 80).nullable(), nextAction: shortText(5, 1000).nullable(), dueOn: z.iso.date().nullable(),
  clarificationRequest: shortText(5, 2000).nullable(),
  messages: z.array(z.object({ id: shortText(1, 100), at: z.string().datetime(),
    author: z.enum(['citizen', 'operator']), visibility: z.enum(['citizen', 'operator']),
    kind: z.enum(['update', 'clarification', 'reply', 'correction']), text: shortText(5, 4000),
  }).strict()).max(100), graph: riskGraphSchema,
  publication: z.object({ draft: publicSummarySchema, digest: sha256, consentedDigest: sha256.nullable(),
    privacyReviewed: z.boolean(), privacyReviewer: shortText(1, 80).nullable(), publishedAt: z.string().datetime().nullable(),
  }).strict().nullable(),
}).strict()
export type SafetyCase = z.infer<typeof safetyCaseSchema>
const mutation = { id: z.string().uuid(), expectedRevision: z.number().int().positive(), operationId: z.string().uuid() }
export const citizenCaseActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('read'), id: z.string().uuid() }).strict(),
  z.object({ ...mutation, action: z.literal('reply'), text: shortText(5, 4000) }).strict(),
  z.object({ ...mutation, action: z.literal('correct'), concern: shortText(20, 4000), requestedAction: shortText(10, 1500) }).strict(),
  z.object({ ...mutation, action: z.literal('withdraw'), confirm: z.literal(true) }).strict(),
  z.object({ ...mutation, action: z.literal('approve-publication'), draftDigest: sha256 }).strict(),
  z.object({ ...mutation, action: z.literal('revoke-publication') }).strict(),
])
export const operatorCaseActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list'), before: z.string().uuid().optional() }).strict(),
  z.object({ action: z.literal('read'), id: z.string().uuid() }).strict(),
  z.object({ ...mutation, action: z.literal('update'), assignedReviewer: shortText(1, 80), nextAction: shortText(5, 1000), dueOn: z.iso.date().nullable(),
    status: z.enum(['investigating', 'awaiting-citizen', 'resolved', 'out-of-scope']), privateNote: shortText(0, 4000),
    citizenUpdate: shortText(5, 4000), clarificationRequest: shortText(5, 2000).nullable(), graph: riskGraphSchema,
  }).strict(),
  z.object({ ...mutation, action: z.literal('draft-publication'), draft: publicSummarySchema, privacyReviewed: z.boolean(), privacyReviewer: shortText(1, 80) }).strict(),
  z.object({ ...mutation, action: z.literal('publish') }).strict(),
  z.object({ ...mutation, action: z.literal('unpublish') }).strict(),
])
export const consultationPacketSchema = z.object({
  title: shortText(5, 120), question: shortText(10, 1000), scope: shortText(10, 2000),
  opensAt: z.string().datetime(), closesAt: z.string().datetime(),
  alternatives: z.array(z.object({ id: shortText(1, 60).regex(/^[a-z0-9-]+$/), title: shortText(3, 120),
    description: shortText(10, 2000), benefits: z.array(shortText(3, 500)).min(1).max(10), tradeoffs: z.array(shortText(3, 500)).min(1).max(10),
  }).strict()).min(2).max(8),
  evidence: z.array(evidenceSourceSchema).min(1).max(20), questions: z.array(shortText(5, 1000)).min(1).max(10),
  decisionCriteria: z.array(shortText(5, 500)).min(1).max(10),
}).strict().refine(packet => Date.parse(packet.opensAt) < Date.parse(packet.closesAt) && new Set(packet.alternatives.map(a => a.id)).size === packet.alternatives.length,
  'Use an ordered response window and unique alternative IDs.')
export const consultationSchema = z.object({
  version: z.literal('civic-consultation-1'), id: z.string().uuid(), revision: z.number().int().positive(),
  packet: consultationPacketSchema, packetDigest: sha256, status: z.enum(['draft', 'open', 'closed']),
  privacyReviewed: z.boolean(), responseRationale: shortText(10, 5000).nullable(), updatedAt: z.string().datetime(),
}).strict()
export type Consultation = z.infer<typeof consultationSchema>
export const consultationActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list') }).strict(),
  z.object({ action: z.literal('save-draft'), id: z.string().uuid(), expectedRevision: z.number().int().min(0), operationId: z.string().uuid(), packet: consultationPacketSchema }).strict(),
  z.object({ ...mutation, action: z.literal('open'), privacyReviewed: z.literal(true) }).strict(),
  z.object({ ...mutation, action: z.literal('close'), responseRationale: shortText(10, 5000), privacyReviewed: z.literal(true) }).strict(),
])
