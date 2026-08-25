import { mkdirSync, writeFileSync } from 'node:fs'

import {
  QUANTUM_BRIDGE_AUDIT,
  buildGapReport,
  endpointTable,
} from '../lib/quantum-bridge-audit-package.ts'
import { QUANTUM_BRIDGE_CANDIDATES } from '../lib/quantum-bridge-candidates.ts'

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
  `${JSON.stringify({ ...report, endpoints, bridges: QUANTUM_BRIDGE_AUDIT }, null, 2)}\n`,
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
