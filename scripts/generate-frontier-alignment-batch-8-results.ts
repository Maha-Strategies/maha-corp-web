import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import {
  ALIGNMENT_BATCH_8_DECISIONS,
  ALIGNMENT_BATCH_8_SOURCE_DISCOVERIES,
  ALIGNMENT_BATCH_8_VERSION,
} from '../lib/frontier-alignment-batch-8.ts'
import {
  BATCH_8_FIRST_JUDGEMENTS,
  BATCH_8_REINSPECTIONS,
  FRONTIER_ALIGNMENT_AUDIT,
  alignmentBlockers,
  alignmentFor,
} from '../lib/frontier-source-alignment.ts'

const decisions = ALIGNMENT_BATCH_8_DECISIONS.map((decision) => {
  const final = alignmentFor(decision.recordId)
  if (!final) throw new Error(`Batch 8 record missing from alignment audit: ${decision.recordId}.`)
  return {
    ...decision,
    priorVerdict: final.priorJudgement?.verdict ?? null,
    finalVerdict: final.evidence.subjectAligned,
    finalRevisionSha256: final.recordRevisionSha256,
    alignmentBlockers: alignmentBlockers(decision.recordId),
  }
})

const verdictVocabulary = [
  'supported',
  'partially-supported',
  'mismatched',
  'insufficient-evidence',
  'inaccessible-source',
] as const
const verdictTotals = Object.fromEntries(
  verdictVocabulary.map((verdict) => [verdict, decisions.filter((entry) => entry.finalVerdict === verdict).length]),
)
const discoveryTotals = Object.fromEntries(
  ['open-copy-located', 'public-abstract-only', 'closed-no-authorized-copy'].map((status) => [
    status,
    ALIGNMENT_BATCH_8_SOURCE_DISCOVERIES.filter((entry) => entry.status === status).length,
  ]),
)
const payloadWithoutDigest = {
  version: ALIGNMENT_BATCH_8_VERSION,
  boundary: {
    reviewKind: 'internal-editorial',
    externallyReviewed: false,
    independentlyReproduced: false,
    sourceContentCommitted: false,
  },
  counts: {
    attempted: decisions.length,
    contentInspected: decisions.filter((entry) => entry.sourceContentInspected).length,
    inaccessible: decisions.filter((entry) => entry.finalVerdict === 'inaccessible-source').length,
    reInspections: BATCH_8_REINSPECTIONS.length,
    firstJudgements: BATCH_8_FIRST_JUDGEMENTS.length,
    alignmentClear: decisions.filter((entry) => entry.alignmentBlockers.length === 0).length,
    remainingCorpusUninspected: FRONTIER_ALIGNMENT_AUDIT.filter((entry) => !entry.evidence.sourceContentInspected).length,
  },
  discoveryTotals,
  verdictTotals,
  sourceDiscoveries: ALIGNMENT_BATCH_8_SOURCE_DISCOVERIES,
  decisions,
}
const resultDigest = `sha256:${createHash('sha256').update(canonicalJson(payloadWithoutDigest), 'utf8').digest('hex')}`
const payload = { ...payloadWithoutDigest, resultDigest }

mkdirSync('content/frontier-alignment', { recursive: true })
mkdirSync('docs/frontier-audit', { recursive: true })
writeFileSync('content/frontier-alignment/batch-8-results.json', `${JSON.stringify(payload, null, 2)}\n`)

const row = (cells: readonly string[]) => `| ${cells.join(' | ')} |`
const lines = [
  '# Frontier source-alignment Batch 8 results',
  '',
  `Batch \`${payload.version}\` · digest \`${payload.resultDigest}\``,
  '',
  'This is internal editorial source inspection, not external expert review or independent reproduction. Located metadata and metadata-only access routes are never treated as explanatory evidence. Retrieved source content is not committed.',
  '',
  row(['Measure', 'Count']),
  row(['---', '---']),
  ...Object.entries(payload.counts).map(([key, value]) => row([key, String(value)])),
  '',
  row(['Discovery status', 'Source contracts']),
  row(['---', '---']),
  ...Object.entries(payload.discoveryTotals).map(([key, value]) => row([key, String(value)])),
  '',
  row(['Verdict', 'Records']),
  row(['---', '---']),
  ...Object.entries(payload.verdictTotals).map(([key, value]) => row([key, String(value)])),
  '',
  '## Source discovery',
  '',
  row(['Source contract', 'Status', 'Channel', 'Artifact', 'Relationship verified', 'Content committed']),
  row(['---', '---', '---', '---', '---', '---']),
  ...payload.sourceDiscoveries.map((entry) => row([
    `\`${entry.sourceContractId}\``,
    `\`${entry.status}\``,
    `\`${entry.channel}\``,
    `\`${entry.artifactVersion}\``,
    entry.versionRelationshipVerified ? 'yes' : 'no',
    'no',
  ])),
  '',
  '## Record decisions',
  '',
  row(['Record', 'Domain', 'Prior', 'Final', 'Inspected', 'Depth', 'Clear']),
  row(['---', '---', '---', '---', '---', '---', '---']),
  ...payload.decisions.map((entry) => row([
    `\`${entry.recordId.replace('urn:maha:record:', '')}\``,
    entry.domainSlug,
    entry.priorVerdict ? `\`${entry.priorVerdict}\`` : 'first judgement',
    `\`${entry.finalVerdict}\``,
    entry.sourceContentInspected ? 'yes' : 'no',
    `\`${entry.inspectionDepth}\``,
    entry.alignmentBlockers.length === 0 ? 'yes' : 'no',
  ])),
]
writeFileSync('docs/frontier-audit/alignment-batch-8-results.md', `${lines.join('\n')}\n`)

console.log(JSON.stringify({
  wrote: ['content/frontier-alignment/batch-8-results.json', 'docs/frontier-audit/alignment-batch-8-results.md'],
  counts: payload.counts,
  discoveryTotals,
  verdictTotals,
  resultDigest,
}, null, 2))
