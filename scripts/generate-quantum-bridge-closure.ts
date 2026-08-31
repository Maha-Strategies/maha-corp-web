import { mkdirSync, writeFileSync } from 'node:fs'

import {
  QUANTUM_BRIDGE_CLOSURE,
  QUANTUM_BRIDGE_CLOSURE_VERSION,
  quantumBridgeClosureDigest,
} from '../lib/quantum-bridge-closure.ts'

mkdirSync('content/bridges', { recursive: true })
mkdirSync('docs/bridges', { recursive: true })

const register = {
  version: QUANTUM_BRIDGE_CLOSURE_VERSION,
  registerDigest: quantumBridgeClosureDigest(),
  counts: {
    total: QUANTUM_BRIDGE_CLOSURE.length,
    revise: QUANTUM_BRIDGE_CLOSURE.filter((entry) => entry.finalDisposition === 'REVISE').length,
    reject: QUANTUM_BRIDGE_CLOSURE.filter((entry) => entry.finalDisposition === 'REJECT').length,
    promotionEligible: 0,
  },
  records: QUANTUM_BRIDGE_CLOSURE,
}

writeFileSync('content/bridges/quantum-bridge-closure.json', `${JSON.stringify(register, null, 2)}\n`)

const row = (cells: readonly string[]) => `| ${cells.join(' | ')} |`
const lines = [
  '# Quantum bridge closure register',
  '',
  `Closure \`${register.version}\` · digest \`${register.registerDigest}\``,
  '',
  'This generated register closes the editorial disposition of the original twelve specifications. It does not promote a bridge, create a canonical record, or erase the original `BLOCK` verdict.',
  '',
  row(['Specification', 'Disposition', 'Original verdict', 'Promotion eligible', 'Blockers']),
  row(['---', '---', '---', '---', '---']),
  ...register.records.map((entry) => row([
    entry.bridgeId,
    entry.finalDisposition,
    entry.submittedVerdict,
    'no',
    entry.blockerSnapshot.map((code) => `\`${code}\``).join(', '),
  ])),
  '',
  '## Required action',
  '',
  ...register.records.flatMap((entry) => [
    `### ${entry.bridgeId} · ${entry.finalDisposition}`,
    '',
    entry.rationale,
    '',
    `**Next action:** ${entry.requiredNextAction}`,
    '',
    `**Reconsideration:** ${entry.reconsiderationRule}`,
    '',
  ]),
]
writeFileSync('docs/bridges/quantum-bridge-closure.md', `${lines.join('\n')}\n`)

console.log(JSON.stringify({ wrote: ['content/bridges/quantum-bridge-closure.json', 'docs/bridges/quantum-bridge-closure.md'], counts: register.counts }, null, 2))
