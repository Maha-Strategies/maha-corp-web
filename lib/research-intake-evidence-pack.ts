import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import {
  auditInputHash,
  runMpsAudit,
  validateAuditPassage,
  type MpsAuditClaim,
  type MpsAuditResult,
  type MpsAuditRunner,
} from './mps-audit-engine.ts'

export const RESEARCH_INTAKE_VERSION = '0.1' as const
export const RESEARCH_INTAKE_MAX_SECTIONS = 10
export const RESEARCH_INTAKE_PRICE_BASE_UNITS = '1000000' as const
export const RESEARCH_INTAKE_SECTION_AUDIT_PRICE_BASE_UNITS = '100000' as const

export type ResearchSourceSection = {
  sourceId: string
  sectionId: string
  title?: string
  text: string
}

export type ResearchIntakeInput = {
  clientRequestId: string
  question: string
  sections: ResearchSourceSection[]
  sourceHandling: {
    classification: 'public_or_synthetic_non_sensitive'
    anthropicProcessingAuthorized: true
  }
  intendedAudience?: string
  intendedDecision?: string
  deadline?: string
}

export type ResearchIntakeSectionAudit = {
  sourceId: string
  sectionId: string
  order: number
  inputHash: string
  claims: MpsAuditClaim[]
}

export type ResearchIntakeSectionCheckpoint = {
  sourceId: string
  sectionId: string
  order: number
  inputHash: string
  audit: MpsAuditResult
}

export class ResearchIntakeSectionFailure extends Error {
  readonly failures: ReadonlyArray<{ sourceId: string; sectionId: string; order: number; error: unknown }>

  constructor(failures: ReadonlyArray<{ sourceId: string; sectionId: string; order: number; error: unknown }>) {
    super(`${failures.length} research-intake section audit${failures.length === 1 ? '' : 's'} failed.`)
    this.name = 'ResearchIntakeSectionFailure'
    this.failures = failures
  }
}

type ClaimInventoryItem = MpsAuditClaim & {
  claimId: string
  sourceId: string
  sectionId: string
  sectionOrder: number
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/
const SHA = /^sha256:[a-f0-9]{64}$/

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function boundedLine(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const normalized = value.trim().normalize('NFC')
  if (normalized.length < min || normalized.length > max || /[\r\n]/.test(normalized)) {
    throw new Error(`${field} must contain ${min}-${max} characters on one line.`)
  }
  return normalized
}

function optionalLine(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined) return undefined
  return boundedLine(value, field, 1, max)
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

export function parseResearchIntakeInput(value: unknown): ResearchIntakeInput {
  const body = object(value)
  if (!body) throw new Error('Request body must be a JSON object.')
  const allowed = new Set(['clientRequestId', 'question', 'sections', 'sourceHandling', 'intendedAudience', 'intendedDecision', 'deadline'])
  const unknown = Object.keys(body).filter((key) => !allowed.has(key))
  if (unknown.length) throw new Error(`Unknown request field: ${unknown[0]}.`)

  if (!Array.isArray(body.sections) || body.sections.length < 1 || body.sections.length > RESEARCH_INTAKE_MAX_SECTIONS) {
    throw new Error(`sections must contain 1-${RESEARCH_INTAKE_MAX_SECTIONS} supplied source sections.`)
  }
  const seen = new Set<string>()
  const sections = body.sections.map((value, index): ResearchSourceSection => {
    const section = object(value)
    if (!section) throw new Error(`sections[${index}] must be an object.`)
    const sectionAllowed = new Set(['sourceId', 'sectionId', 'title', 'text'])
    const sectionUnknown = Object.keys(section).filter((key) => !sectionAllowed.has(key))
    if (sectionUnknown.length) throw new Error(`Unknown sections[${index}] field: ${sectionUnknown[0]}.`)
    const sourceId = boundedLine(section.sourceId, `sections[${index}].sourceId`, 1, 80)
    const sectionId = boundedLine(section.sectionId, `sections[${index}].sectionId`, 1, 80)
    if (!ID.test(sourceId) || !ID.test(sectionId)) throw new Error(`sections[${index}] identifiers contain unsupported characters.`)
    const key = `${sourceId}\u0000${sectionId}`
    if (seen.has(key)) throw new Error(`Duplicate sourceId and sectionId at sections[${index}].`)
    seen.add(key)
    return {
      sourceId,
      sectionId,
      ...(section.title === undefined ? {} : { title: boundedLine(section.title, `sections[${index}].title`, 1, 200) }),
      text: validateAuditPassage(section.text),
    }
  })

  const deadline = optionalLine(body.deadline, 'deadline', 80)
  if (deadline && Number.isNaN(Date.parse(deadline))) throw new Error('deadline must be an ISO-8601 date or timestamp.')
  const intendedAudience = optionalLine(body.intendedAudience, 'intendedAudience', 240)
  const intendedDecision = optionalLine(body.intendedDecision, 'intendedDecision', 500)
  const sourceHandling = object(body.sourceHandling)
  if (!sourceHandling
    || Object.keys(sourceHandling).some((key) => !['classification', 'anthropicProcessingAuthorized'].includes(key))
    || sourceHandling.classification !== 'public_or_synthetic_non_sensitive'
    || sourceHandling.anthropicProcessingAuthorized !== true) {
    throw new Error('sourceHandling must declare public_or_synthetic_non_sensitive content and authorize Anthropic processing.')
  }
  return {
    clientRequestId: boundedLine(body.clientRequestId, 'clientRequestId', 8, 120),
    question: boundedLine(body.question, 'question', 8, 1_000),
    sections,
    sourceHandling: {
      classification: 'public_or_synthetic_non_sensitive',
      anthropicProcessingAuthorized: true,
    },
    ...(intendedAudience ? { intendedAudience } : {}),
    ...(intendedDecision ? { intendedDecision } : {}),
    ...(deadline ? { deadline } : {}),
  }
}

export function researchIntakeInputHash(input: ResearchIntakeInput): string {
  const content = {
    question: input.question,
    sections: input.sections,
    sourceHandling: input.sourceHandling,
    ...(input.intendedAudience ? { intendedAudience: input.intendedAudience } : {}),
    ...(input.intendedDecision ? { intendedDecision: input.intendedDecision } : {}),
    ...(input.deadline ? { deadline: input.deadline } : {}),
  }
  return digest(content)
}

function compactTokenSet(value: string): Set<string> {
  const stop = new Set(['about', 'after', 'before', 'could', 'from', 'have', 'into', 'more', 'should', 'that', 'their', 'there', 'these', 'they', 'this', 'those', 'through', 'under', 'were', 'what', 'when', 'where', 'which', 'with', 'would'])
  return new Set((value.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter((token) => !stop.has(token)))
}

function values(value: string): string[] {
  return value.match(/(?:\b\d+(?:\.\d+)?%?\b|\b(?:19|20)\d{2}\b|\b(?:not|no|never|increase|decrease|higher|lower)\b)/gi)?.map((item) => item.toLowerCase()) ?? []
}

function potentialConflicts(claims: ClaimInventoryItem[]) {
  const conflicts: Array<{ conflictId: string; claimIds: [string, string]; reason: string }> = []
  for (let i = 0; i < claims.length; i += 1) {
    for (let j = i + 1; j < claims.length; j += 1) {
      const left = claims[i]!
      const right = claims[j]!
      if (left.sourceId === right.sourceId && left.sectionId === right.sectionId) continue
      const overlap = [...compactTokenSet(left.excerpt)].filter((token) => compactTokenSet(right.excerpt).has(token))
      const leftValues = values(left.excerpt)
      const rightValues = values(right.excerpt)
      if (overlap.length < 2 || !leftValues.length || !rightValues.length || leftValues.join('|') === rightValues.join('|')) continue
      const claimIds: [string, string] = [left.claimId, right.claimId]
      conflicts.push({
        conflictId: `conflict_${digest(claimIds).slice(7, 23)}`,
        claimIds,
        reason: 'Claims share subject terms but contain differing quantities, dates, polarity, or directional language; human review is required.',
      })
    }
  }
  return conflicts
}

async function mapConcurrent<T, R>(items: readonly T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(items.length)
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      output[index] = await fn(items[index]!, index)
    }
  }))
  return output
}

export async function buildResearchIntakeEvidencePack(inputValue: unknown, runner: MpsAuditRunner) {
  const input = parseResearchIntakeInput(inputValue)
  const sectionResults = await auditResearchIntakeSections(input, runner)
  return assembleResearchIntakeEvidencePack(input, sectionResults)
}

/**
 * Audits only sections that do not already have a verified checkpoint.
 *
 * A paid pack is a collection of independently recoverable section jobs, not
 * one ten-call transaction. The caller persists each checkpoint immediately.
 * On recovery it reloads those checkpoints and resubmits the original input;
 * completed sections are verified against their exact input hashes and never
 * sent to the model again.
 */
export async function auditResearchIntakeSections(
  inputValue: ResearchIntakeInput,
  runner: MpsAuditRunner,
  options: {
    existing?: readonly ResearchIntakeSectionCheckpoint[]
    persist?: (checkpoint: ResearchIntakeSectionCheckpoint) => Promise<void>
    concurrency?: number
  } = {},
): Promise<MpsAuditResult[]> {
  const input = parseResearchIntakeInput(inputValue)
  const existingByOrder = new Map<number, ResearchIntakeSectionCheckpoint>()
  for (const checkpoint of options.existing ?? []) {
    if (existingByOrder.has(checkpoint.order)) throw new Error(`Duplicate checkpoint for section order ${checkpoint.order}.`)
    const section = input.sections[checkpoint.order - 1]
    if (!section
      || checkpoint.sourceId !== section.sourceId
      || checkpoint.sectionId !== section.sectionId
      || checkpoint.inputHash !== auditInputHash(section.text)
      || checkpoint.audit.input_hash !== checkpoint.inputHash) {
      throw new Error(`Checkpoint for section order ${checkpoint.order} is not bound to the supplied section.`)
    }
    existingByOrder.set(checkpoint.order, checkpoint)
  }

  const results = new Array<MpsAuditResult>(input.sections.length)
  for (const [order, checkpoint] of existingByOrder) results[order - 1] = checkpoint.audit
  const missing = input.sections
    .map((section, index) => ({ section, index }))
    .filter(({ index }) => !results[index])
  const failures: Array<{ sourceId: string; sectionId: string; order: number; error: unknown }> = []

  await mapConcurrent(missing, options.concurrency ?? 3, async ({ section, index }) => {
    try {
      const audit = await runMpsAudit(section.text, runner)
      const checkpoint: ResearchIntakeSectionCheckpoint = {
        sourceId: section.sourceId,
        sectionId: section.sectionId,
        order: index + 1,
        inputHash: audit.input_hash,
        audit,
      }
      await options.persist?.(checkpoint)
      results[index] = audit
    } catch (error) {
      failures.push({ sourceId: section.sourceId, sectionId: section.sectionId, order: index + 1, error })
    }
  })
  if (failures.length) throw new ResearchIntakeSectionFailure(failures.sort((a, b) => a.order - b.order))
  return results
}

export function assembleResearchIntakeEvidencePack(input: ResearchIntakeInput, audits: MpsAuditResult[]) {
  if (audits.length !== input.sections.length) throw new Error('Every supplied section must have exactly one MPS audit result.')
  const manifest = input.sections.map((section, index) => {
    const audit = audits[index]!
    if (!SHA.test(audit.input_hash) || audit.input_hash !== auditInputHash(section.text)) throw new Error(`Audit ${index + 1} is not bound to its supplied section.`)
    return {
      order: index + 1,
      sourceId: section.sourceId,
      sectionId: section.sectionId,
      ...(section.title ? { title: section.title } : {}),
      sourceSectionHash: audit.input_hash,
      characterCount: section.text.length,
    }
  })
  const sectionAudits: ResearchIntakeSectionAudit[] = audits.map((audit, index) => ({
    sourceId: input.sections[index]!.sourceId,
    sectionId: input.sections[index]!.sectionId,
    order: index + 1,
    inputHash: audit.input_hash,
    claims: audit.claims,
  }))
  const claimInventory: ClaimInventoryItem[] = sectionAudits.flatMap((audit) => audit.claims.map((claim) => ({
    claimId: `claim_${digest({ sourceId: audit.sourceId, sectionId: audit.sectionId, excerpt: claim.excerpt }).slice(7, 23)}`,
    sourceId: audit.sourceId,
    sectionId: audit.sectionId,
    sectionOrder: audit.order,
    ...claim,
  })))
  const citationGaps = claimInventory
    .filter((claim) => claim.tag === 'UNVERIFIED' || claim.action === 'cite' || claim.action === 'verify')
    .map((claim) => ({ claimId: claim.claimId, sourceId: claim.sourceId, sectionId: claim.sectionId, tag: claim.tag, action: claim.action }))
  const conflicts = potentialConflicts(claimInventory)
  const unresolvedQuestions = [
    ...(!input.intendedAudience ? ['Who will use the eventual research output?'] : []),
    ...(!input.intendedDecision ? ['What decision must the eventual research support?'] : []),
    ...(!input.deadline ? ['When is the eventual research output needed?'] : []),
    ...(citationGaps.length ? [`Which primary or authoritative sources resolve the ${citationGaps.length} citation or verification gaps?`] : []),
    ...(conflicts.length ? [`Which evidence resolves the ${conflicts.length} potential cross-section conflicts?`] : []),
  ]
  const orderedManifest = { version: RESEARCH_INTAKE_VERSION, question: input.question, sections: manifest }
  const manifestDigest = digest(orderedManifest)
  const receiptBase = {
    version: RESEARCH_INTAKE_VERSION,
    offerId: 'research-intake-evidence-pack',
    clientRequestId: input.clientRequestId,
    inputHash: researchIntakeInputHash(input),
    economicBasis: {
      priceBaseUnits: RESEARCH_INTAKE_PRICE_BASE_UNITS,
      asset: 'USDC',
      decimals: 6,
      includedSectionAuditCapacity: RESEARCH_INTAKE_MAX_SECTIONS,
      sectionAuditReferencePriceBaseUnits: RESEARCH_INTAKE_SECTION_AUDIT_PRICE_BASE_UNITS,
      auditsPerformed: sectionAudits.length,
      unusedCapacity: RESEARCH_INTAKE_MAX_SECTIONS - sectionAudits.length,
    },
    question: input.question,
    intakeContext: {
      intendedAudience: input.intendedAudience ?? null,
      intendedDecision: input.intendedDecision ?? null,
      deadline: input.deadline ?? null,
    },
    sourceHandling: input.sourceHandling,
    orderedSourceSectionManifest: manifest,
    manifestDigest,
    sectionAudits,
    consolidatedClaimInventory: claimInventory,
    citationGaps,
    potentialConflicts: conflicts,
    boundaries: [
      'Machine-generated research intake packet, not a research brief.',
      'Uses only supplied source sections; no new research or source acquisition is performed.',
      'Input is declared public or synthetic and non-sensitive, and supplied sections are transmitted to Anthropic for model processing.',
      'MPS statuses and potential conflicts are automated triage requiring human review.',
      'Does not provide factual certification, human judgment, legal advice, or a recommendation.',
    ],
    unresolvedQuestions,
    proposedHumanResearchScope: {
      objective: `Investigate the supplied question: ${input.question}`,
      analystTasks: [
        'Confirm scope, decision owner, audience, deadline, and acceptance criteria.',
        'Acquire and assess authoritative sources needed to close citation gaps.',
        'Resolve potential conflicts and document remaining uncertainty.',
        'Produce a separately commissioned human research deliverable if authorized.',
      ],
      suppliedSectionCount: input.sections.length,
      claimCount: claimInventory.length,
      excluded: ['new research', 'source acquisition', 'factual certification', 'recommendation'],
    },
    retentionBoundaries: {
      fullSourceSectionsStored: false,
      verbatimClaimExcerptsRetained: true,
      suppliedMetadataRetained: true,
    },
  }
  return { ...receiptBase, receiptDigest: digest(receiptBase) }
}
