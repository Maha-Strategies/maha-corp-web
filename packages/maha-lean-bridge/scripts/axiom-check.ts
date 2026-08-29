import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { qualifiedName, type ProofManifest } from '../src/schema.ts'

/**
 * Rejects unfinished proofs by asking Lean, not by reading text.
 *
 * A proof closed with `sorry` still compiles: Lean emits a warning, not an
 * error, so `lake build` exits zero. What it cannot hide is the axiom
 * dependency, because `sorry` elaborates to `sorryAx`. This script reads that
 * dependency out of the elaborated environment for every theorem in the
 * manifest and fails if any of them rests on it.
 *
 * The permitted axioms are Lean's own three. Anything else — including a
 * user-declared `axiom` someone added to make a proof go through — is reported.
 */

const PACKAGE = resolve(import.meta.dirname, '..')
const PERMITTED = new Set(['propext', 'Classical.choice', 'Quot.sound'])

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

const problems: string[] = []
if (/sorryAx/.test(output)) problems.push('A theorem depends on sorryAx: the proof is unfinished.')

// Each line reads: 'Name' depends on axioms: [a, b, c]
for (const line of output.split('\n')) {
  const parsed = /^'([^']+)' depends on axioms: \[([^\]]*)\]/.exec(line.trim())
  if (!parsed) continue
  const used = parsed[2].split(',').map((a) => a.trim()).filter(Boolean)
  const unexpected = used.filter((axiom) => !PERMITTED.has(axiom))
  if (unexpected.length > 0) problems.push(`${parsed[1]} depends on ${unexpected.join(', ')}`)
}

// A theorem that produced no line at all was not found in the environment.
const reported = new Set(
  output
    .split('\n')
    .map((line) => /^'([^']+)' depends on/.exec(line.trim())?.[1])
    .filter((name): name is string => Boolean(name)),
)
for (const name of names) {
  if (!reported.has(name)) problems.push(`${name} produced no axiom report; it may not exist in the build.`)
}

if (problems.length > 0) {
  console.error('Axiom check failed:')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

console.log(JSON.stringify({ theoremsChecked: names.length, permittedAxiomsOnly: true }, null, 2))
