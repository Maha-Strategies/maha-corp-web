import { z } from 'zod'

// Shared input contract; no model, database or Node dependencies in the browser.
export const AI_SAFETY_TOPICS = {
  'loss-of-control': 'Loss of control over advanced AI',
  misuse: 'Malicious use and dangerous capabilities',
  'privacy-rights': 'Privacy, surveillance and rights',
  'unfair-decisions': 'Unfair or unreliable AI decisions',
  'work-public-services': 'Work, infrastructure and public services',
  oversight: 'Accountability, testing and oversight',
  other: 'Another AI safety concern',
} as const
export const AI_SAFETY_BASES = {
  observation: 'Something I observed',
  'published-source': 'A published source',
  concern: 'A concern or hypothesis',
} as const
const text = (min: number, max: number) => z.string().trim().min(min).max(max)
const publicLink = z.string().trim().max(1000).url().refine(value => {
  const url = new URL(value)
  return url.protocol === 'https:' && !url.username && !url.password
}, 'Use an HTTPS link without credentials.')
export const aiSafetySubmissionSchema = z.object({
  submissionId: z.string().uuid(),
  topic: z.enum(Object.keys(AI_SAFETY_TOPICS) as [keyof typeof AI_SAFETY_TOPICS, ...(keyof typeof AI_SAFETY_TOPICS)[]]),
  basis: z.enum(Object.keys(AI_SAFETY_BASES) as [keyof typeof AI_SAFETY_BASES, ...(keyof typeof AI_SAFETY_BASES)[]]),
  concern: text(20, 4000),
  requestedAction: text(10, 1500),
  sourceUrls: z.array(publicLink).max(3),
  consentToPrivateReview: z.literal(true),
  consultationResponse: z.object({ consultationId: z.string().uuid(), packetDigest: z.string().regex(/^[a-f0-9]{64}$/),
    alternativeId: z.string().regex(/^[a-z0-9-]+$/).max(60), missingEvidence: text(5, 1500), assumptionChallenge: text(5, 1500),
  }).strict().optional(),
}).strict()
export type AiSafetySubmission = z.infer<typeof aiSafetySubmissionSchema>
const digest = z.string().regex(/^[a-f0-9]{64}$/)
export const aiSafetyReceiptSchema = z.object({
  version: z.literal('civic-ai-safety-1'), id: z.string().uuid(), receivedAt: z.string().datetime(),
  submissionDigest: digest, digest,
}).strict()
export type AiSafetyReceipt = z.infer<typeof aiSafetyReceiptSchema>
export const aiSafetyReviewSchema = z.object({
  id: z.string().uuid(), status: z.enum(['reviewed', 'needs-research', 'out-of-scope']),
  note: text(10, 2000),
}).strict()
export const aiSafetyRecordSchema = z.object({
  receipt: aiSafetyReceiptSchema, submission: aiSafetySubmissionSchema,
  status: z.enum(['received', 'reviewed', 'needs-research', 'out-of-scope']),
  review: z.object({ reviewedAt: z.string().datetime(), note: text(10, 2000) }).strict().nullable(),
}).strict()
export type AiSafetyRecord = z.infer<typeof aiSafetyRecordSchema>
