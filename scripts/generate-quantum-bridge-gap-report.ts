import { mkdirSync, writeFileSync } from 'node:fs'

import {
  QUANTUM_BRIDGE_AUDIT,
  buildGapReport,
  endpointTable,
} from '../lib/quantum-bridge-audit-package.ts'
import { QUANTUM_BRIDGE_CANDIDATES } from '../lib/quantum-bridge-candidates.ts'
import { BRIDGE_SOURCE_LEDGER } from '../lib/bridge-source-ledger.ts'
import { ENDPOINT_DISPOSITIONS, dispositionTotals } from '../lib/bridge-endpoint-dispositions.ts'
import { ENDPOINT_CANDIDATES, candidateBlockers, promotableEndpointCandidates } from '../lib/bridge-endpoint-candidates.ts'
import {
  QBR_ENDPOINT_CLOSURE_PLAN,
  classificationTotals,
  liveOutcome,
  planDigest,
} from '../lib/endpoint-closure-plan.ts'

/**
 * Emits the machine- and human-readable gap report for the Q-BR batch.
 * Reads only committed modules; contacts nothing and mutates no production data.
 */

const report = buildGapReport()
const endpoints = endpointTable()

mkdirSync('content/bridges', { recursive: true })
mkdirSync('docs/bridges', { recursive: true })

writeFileSync(
  'content/bridges/quantum-bridge-gap-report.json',
  `${JSON.stringify(
    {
      ...report,
      endpointClosure: {
        planVersion: QBR_ENDPOINT_CLOSURE_PLAN.planVersion,
        planDigest: planDigest(QBR_ENDPOINT_CLOSURE_PLAN),
        classificationTotals: classificationTotals(QBR_ENDPOINT_CLOSURE_PLAN),
        candidateCount: ENDPOINT_CANDIDATES.length,
        promotableCandidateCount: promotableEndpointCandidates().length,
      },
      endpoints,
      bridges: QUANTUM_BRIDGE_AUDIT,
      sourceLedger: BRIDGE_SOURCE_LEDGER,
      endpointDispositions: ENDPOINT_DISPOSITIONS,
      endpointCandidates: ENDPOINT_CANDIDATES.map((candidate) => ({
        ...candidate,
        blockers: candidateBlockers(candidate),
      })),
    },
    null,
    2,
  )}\n`,
)

const row = (cells: string[]) => `| ${cells.join(' | ')} |`
const lines: string[] = []
lines.push('# Q-BR bridge batch — gap report', '')
lines.push(`Resolver \`${report.resolverVersion}\` · audit package \`${report.auditPackageVersion}\``, '')
lines.push('This report is generated. Do not edit it by hand.', '')

lines.push('## Verdicts', '')
lines.push(row(['Verdict', 'Count']), row(['---', '---']))
for (const [verdict, count] of Object.entries(report.verdictTotals)) lines.push(row([verdict, String(count)]))
lines.push('')

lines.push('## Endpoint resolution (24 references)', '')
lines.push(row(['Outcome', 'Count']), row(['---', '---']))
for (const [status, count] of Object.entries(report.endpointTotals)) lines.push(row([status, String(count)]))
lines.push('')
lines.push(row(['ID', 'Side', 'Submitted reference', 'Outcome', 'Record']), row(['---', '---', '---', '---', '---']))
for (const endpoint of endpoints) {
  lines.push(
    row([
      endpoint.id,
      endpoint.side,
      `\`${endpoint.submittedReference}\``,
      endpoint.status,
      endpoint.recordId ? `\`${endpoint.recordId}\`` : '—',
    ]),
  )
}
lines.push('')

lines.push('## Source verification (24 citations)', '')
lines.push(row(['State', 'Count']), row(['---', '---']))
for (const [state, count] of Object.entries(report.sourceTotals)) lines.push(row([state, String(count)]))
lines.push('')

lines.push('## Blockers', '')
lines.push(row(['Code', 'Bridges affected']), row(['---', '---']))
for (const [code, count] of Object.entries(report.blockerTotals).sort()) lines.push(row([code, String(count)]))
lines.push('')

lines.push('## Remediable to review', '')
lines.push(row(['ID', 'Remediation required']), row(['---', '---']))
for (const entry of report.remediableToRevise) lines.push(row([entry.id, entry.remediation || '—']))
lines.push('')

lines.push('## Conceptually invalid', '')
lines.push('These are not fixed by creating records or supplying locators.', '')
for (const entry of report.conceptuallyInvalid) lines.push(`- **${entry.id}** — ${entry.reason}`)
lines.push('')

lines.push('## Namespace inventory', '')
lines.push(row(['Domain', 'Records', 'Canonical graph', 'Public projection', 'Backing module']))
lines.push(row(['---', '---', '---', '---', '---']))
for (const entry of [...report.namespaces.canonical, ...report.namespaces.pilotOnly]) {
  lines.push(
    row([
      entry.domainSlug,
      String(entry.recordCount),
      entry.canonicalGraph ? 'yes' : 'no',
      entry.publicProjection ? 'yes' : 'no',
      `\`${entry.backingModule}\``,
    ]),
  )
}
lines.push('')
lines.push('### Declared aliases', '')
lines.push(row(['Alias', 'Target', 'Since', 'Reason']), row(['---', '---', '---', '---']))
for (const alias of report.namespaces.aliases) {
  lines.push(row([`\`${alias.alias}\``, `\`${alias.target}\``, alias.since, alias.reason]))
}
lines.push('')

lines.push('## Source verification ledger (24 citations)', '')
lines.push(row(['Key', 'State', 'Identifier', 'Locator']), row(['---', '---', '---', '---']))
for (const entry of BRIDGE_SOURCE_LEDGER) {
  lines.push(
    row([
      entry.key,
      entry.verification,
      entry.identifier ? `\`${entry.identifier}\`` : '—',
      entry.locator ?? '—',
    ]),
  )
}
lines.push('')

lines.push('## Endpoint dispositions (23 unresolved)', '')
lines.push(row(['Disposition', 'Count']), row(['---', '---']))
for (const [name, count] of Object.entries(dispositionTotals())) lines.push(row([name, String(count)]))
lines.push('')
lines.push(row(['Key', 'Submitted reference', 'Disposition', 'In batch']), row(['---', '---', '---', '---']))
for (const entry of ENDPOINT_DISPOSITIONS) {
  lines.push(
    row([entry.key, `\`${entry.submittedReference}\``, entry.disposition, entry.inCreationBatch ? 'yes' : 'no']),
  )
}
lines.push('')

lines.push('## Endpoint candidates created', '')
lines.push(row(['Candidate', 'Domain', 'Class', 'Blockers']), row(['---', '---', '---', '---']))
for (const candidate of ENDPOINT_CANDIDATES) {
  lines.push(
    row([candidate.title, candidate.domainSlug, candidate.recordClass, candidateBlockers(candidate).join(', ') || 'none']),
  )
}
lines.push('')

lines.push('## Endpoint closure', '')
lines.push(
  `Plan \`${QBR_ENDPOINT_CLOSURE_PLAN.planVersion}\` · digest \`${planDigest(QBR_ENDPOINT_CLOSURE_PLAN)}\`. Full reasoning in \`docs/bridges/endpoint-resolution-plan.md\`.`,
  '',
)
lines.push(
  `Candidates built: **${ENDPOINT_CANDIDATES.length}**, of which **${promotableEndpointCandidates().length}** are promotable. A candidate is not a canonical record, so building one does not resolve its endpoint.`,
  '',
)
lines.push(row(['Classification', 'Count']), row(['---', '---']))
for (const [name, count] of Object.entries(classificationTotals(QBR_ENDPOINT_CLOSURE_PLAN))) {
  lines.push(row([name, String(count)]))
}
lines.push('')
lines.push(row(['Key', 'Classification', 'Live resolver outcome']), row(['---', '---', '---']))
for (const entry of QBR_ENDPOINT_CLOSURE_PLAN.entries) {
  lines.push(row([entry.key, entry.classification, liveOutcome(entry)]))
}
lines.push('')

writeFileSync('docs/bridges/quantum-bridge-gap-report.md', `${lines.join('\n')}\n`)

console.log(
  JSON.stringify(
    {
      wrote: ['content/bridges/quantum-bridge-gap-report.json', 'docs/bridges/quantum-bridge-gap-report.md'],
      verdicts: report.verdictTotals,
      endpoints: report.endpointTotals,
      sources: report.sourceTotals,
      candidates: QUANTUM_BRIDGE_CANDIDATES.length,
    },
    null,
    2,
  ),
)
