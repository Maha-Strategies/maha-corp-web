import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

import { canonicalJson, normalizeSourceText } from '../src/canonicalize.ts'
import { PROOF_MANIFEST_SCHEMA_VERSION, type ManifestTheorem, type ProofManifest } from '../src/schema.ts'

/**
 * Generates the proof manifest from the Lean sources.
 *
 * The manifest records what the package claims to prove and from which exact
 * bytes. It does not, by itself, establish that anything was proved: that comes
 * from the verifier running Lean. Generation and verification are kept apart on
 * purpose, so a manifest can never assert its own correctness.
 *
 * Determinism: files are walked in sorted order, theorems are sorted by
 * qualified name, digests are taken over line-ending-normalized text, and no
 * absolute path or timestamp is recorded.
 */

const PACKAGE = resolve(import.meta.dirname, '..')

function leanSources(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (entry.name === '.lake' || entry.name === 'build') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...leanSources(full))
    else if (entry.name.endsWith('.lean')) found.push(full)
  }
  return found
}

/**
 * Extracts theorem declarations and their namespaces.
 *
 * This is a source index, not a proof checker. A declaration only reaches the
 * manifest if Lean also builds it and reports no `sorryAx` dependency, which the
 * verifier checks separately.
 */
function extractTheorems(path: string, text: string): ManifestTheorem[] {
  const relativePath = relative(PACKAGE, path).split(sep).join('/')
  const digest = `sha256:${createHash('sha256').update(normalizeSourceText(text), 'utf8').digest('hex')}`
  const namespaces: string[] = []
  const theorems: ManifestTheorem[] = []
  const lines = normalizeSourceText(text).split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const open = /^\s*namespace\s+([A-Za-z_][A-Za-z0-9_.']*)/.exec(line)
    if (open) {
      namespaces.push(open[1])
      continue
    }
    if (/^\s*end\s+[A-Za-z_][A-Za-z0-9_.']*\s*$/.test(line) && namespaces.length > 0) {
      namespaces.pop()
      continue
    }
    const declaration = /^\s*(?:private\s+|protected\s+)?theorem\s+([A-Za-z_][A-Za-z0-9_.']*)/.exec(line)
    if (!declaration) continue

    // The statement runs to the proof separator, so the recorded statement is
    // what was proved rather than how it was proved.
    const collected: string[] = []
    for (let cursor = index; cursor < lines.length; cursor += 1) {
      const current = lines[cursor]
      const cut = current.indexOf(':=')
      if (cut >= 0) {
        collected.push(current.slice(0, cut))
        break
      }
      collected.push(current)
    }
    theorems.push({
      theoremName: declaration[1],
      theoremNamespace: namespaces.join('.'),
      sourceFile: relativePath,
      sourceSha256: digest,
      formalStatement: collected.join(' ').replace(/\s+/g, ' ').trim(),
    })
  }
  return theorems
}

export function buildManifest(toolchain: string, leanVersion: string): ProofManifest {
  const theorems = leanSources(join(PACKAGE, 'Maha'))
    .flatMap((path) => extractTheorems(path, readFileSync(path, 'utf8')))
    .sort((a, b) => {
      const left = `${a.theoremNamespace}.${a.theoremName}`
      const right = `${b.theoremNamespace}.${b.theoremName}`
      return left < right ? -1 : left > right ? 1 : 0
    })

  return {
    schemaVersion: PROOF_MANIFEST_SCHEMA_VERSION,
    toolchain,
    leanVersion,
    buildConfiguration: 'release',
    verificationCommand: 'lake build',
    theorems,
  }
}

if (import.meta.filename === process.argv[1]) {
  const toolchain = readFileSync(join(PACKAGE, 'lean-toolchain'), 'utf8').trim()
  const leanVersion = toolchain.replace(/^.*:v/, '')
  const manifest = buildManifest(toolchain, leanVersion)
  const serialized = `${JSON.stringify(JSON.parse(canonicalJson(manifest)), null, 2)}\n`
  writeFileSync(join(PACKAGE, 'fixtures/formal-proof-manifest.json'), serialized)
  process.stdout.write(
    `${JSON.stringify({ theorems: manifest.theorems.length, digest: `sha256:${createHash('sha256').update(canonicalJson(manifest), 'utf8').digest('hex')}` }, null, 2)}\n`,
  )
}
