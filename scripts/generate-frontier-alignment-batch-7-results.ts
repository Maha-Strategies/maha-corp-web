import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { ALIGNMENT_BATCH_7_DECISIONS, ALIGNMENT_BATCH_7_VERSION } from '../lib/frontier-alignment-batch-7.ts'
import { alignmentBlockers, alignmentFor } from '../lib/frontier-source-alignment.ts'

const decisions = ALIGNMENT_BATCH_7_DECISIONS.map((decision) => {
  const final = alignmentFor(decision.recordId)
  if (!final) throw new Error(`Batch 7 record missing from alignment audit: ${decision.recordId}.`)
  return {
    ...decision,
    // Batch 8 may nest Batch 7 as the active prior judgement. This artifact is
    // the immutable Batch 7 snapshot, so walk one level further when needed.
    priorVerdict: final.priorJudgement?.batchId === 'batch-7'
      ? final.priorJudgement.priorJudgement?.verdict ?? null
      : final.priorJudgement?.verdict ?? null,
    finalVerdict: final.evidence.subjectAligned,
    finalRevisionSha256: final.recordRevisionSha256,
    alignmentBlockers: alignmentBlockers(decision.recordId),
  }
})

const verdictTotals = Object.fromEntries(
  ['supported', 'partially-supported', 'mismatched', 'insufficient-evidence', 'inaccessible-source'].map((verdict) => [
    verdict,
    decisions.filter((entry) => entry.finalVerdict === verdict).length,
  ]),
)
const payloadWithoutDigest = {
  version: ALIGNMENT_BATCH_7_VERSION,
  counts: {
    attempted: decisions.length,
    contentInspected: decisions.filter((entry) => entry.sourceContentInspected).length,
    inaccessible: decisions.filter((entry) => entry.finalVerdict === 'inaccessible-source').length,
    reInspections: decisions.filter((entry) => entry.priorBatchId !== null).length,
    firstJudgements: decisions.filter((entry) => entry.priorBatchId === null).length,
    alignmentClear: decisions.filter((entry) => entry.alignmentBlockers.length === 0).length,
    // Historical post-Batch-7 snapshot. Later batches must not rewrite it.
    remainingCorpusUninspected: 59,
  },
  verdictTotals,
  decisions,
}
const resultDigest = `sha256:${createHash('sha256').update(canonicalJson(payloadWithoutDigest), 'utf8').digest('hex')}`
const payload = { ...payloadWithoutDigest, resultDigest }

mkdirSync('content/frontier-alignment', { recursive: true })
mkdirSync('docs/frontier-audit', { recursive: true })
writeFileSync('content/frontier-alignment/batch-7-results.json', `${JSON.stringify(payload, null, 2)}\n`)

const row = (cells: readonly string[]) => `| ${cells.join(' | ')} |`
const lines = [
  '# Frontier source-alignment Batch 7 results',
  '',
  `Batch \`${payload.version}\` · digest \`${payload.resultDigest}\``,
  '',
  'This is internal editorial source inspection, not external expert review or independent reproduction. Metadata-only material is not treated as explanatory evidence.',
  '',
  row(['Measure', 'Count']),
  row(['---', '---']),
  ...Object.entries(payload.counts).map(([key, value]) => row([key, String(value)])),
  '',
  row(['Verdict', 'Count']),
  row(['---', '---']),
  ...Object.entries(payload.verdictTotals).map(([key, value]) => row([key, String(value)])),
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
writeFileSync('docs/frontier-audit/alignment-batch-7-results.md', `${lines.join('\n')}\n`)

console.log(JSON.stringify({ wrote: ['content/frontier-alignment/batch-7-results.json', 'docs/frontier-audit/alignment-batch-7-results.md'], counts: payload.counts, verdictTotals }, null, 2))
