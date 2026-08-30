import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { evaluateAxiomPolicy } from '../src/axioms.ts'
import { qualifiedName, type ProofManifest } from '../src/schema.ts'

/**
 * Rejects unfinished proofs by asking Lean, not by reading text.
 *
 * A proof closed with `sorry` still compiles: Lean emits a warning, not an
 * error, so `lake build` exits zero. What it cannot hide is the axiom
 * dependency, because `sorry` elaborates to `sorryAx`. This script reads that
 * dependency out of the elaborated environment for every theorem in the
 * manifest.
 *
 * The policy itself lives in src/axioms.ts and is shared with the offline
 * verifier, so CI and a customer's own verification cannot reach different
 * conclusions about the same output.
 */

const PACKAGE = resolve(import.meta.dirname, '..')

const manifest = JSON.parse(
  readFileSync(join(PACKAGE, 'fixtures/formal-proof-manifest.json'), 'utf8'),
) as ProofManifest

const names = manifest.theorems.map(qualifiedName)
if (names.length === 0) {
  console.error('The proof manifest is empty; nothing to check.')
  process.exit(1)
}

const probe = join(PACKAGE, 'AxiomProbe.lean')
writeFileSync(probe, `${['import Maha', ...names.map((n) => `#print axioms ${n}`)].join('\n')}\n`)

let output: string
try {
  output = execFileSync('lake', ['env', 'lean', 'AxiomProbe.lean'], {
    cwd: PACKAGE,
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
  })
} catch (error) {
  const shell = error as { stdout?: string; stderr?: string }
  console.error('Lean failed while reading axiom dependencies:')
  console.error(`${shell.stdout ?? ''}${shell.stderr ?? ''}`)
  process.exit(1)
} finally {
  rmSync(probe, { force: true })
}

const policy = evaluateAxiomPolicy(output, names)

if (!policy.ok) {
  console.error('Axiom check failed:')
  for (const problem of policy.problems) console.error(`  - ${problem}`)
  process.exit(1)
}

console.log(
  JSON.stringify(
    {
      theoremsChecked: names.length,
      axiomFree: policy.axiomFree,
      restingOnPermittedAxiomsOnly: policy.restingOnPermittedAxiomsOnly,
    },
    null,
    2,
  ),
)
