#!/usr/bin/env node --experimental-strip-types
/**
 * mps-dossier — operator CLI for Maha Evidence Dossier packages.
 *
 *   mps-dossier validate <input>
 *   mps-dossier compile  <input> --output <directory>
 *   mps-dossier verify   <manifest>
 *   mps-dossier render-jsonld <package>
 *
 * The CLI is offline by construction: it opens no sockets, retrieves no
 * sources, and emits no telemetry. Output is deterministic for a given input.
 * No argument carries a secret; there is nothing to authenticate against.
 */
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'

import { compilePackage } from '../src/compile.ts'
import { renderDossierJsonLdText } from '../src/jsonld.ts'
import { validateDossierDocument } from '../src/validate.ts'
import { verifyPackageDirectory } from '../src/verify.ts'
import { writeEvidenceDossierPackage } from '../src/compile.ts'
import { EVIDENCE_DOSSIER_BUILDER_BOUNDARY, EVIDENCE_DOSSIER_BUILDER_VERSION } from '../src/index.ts'
import type { EvidenceDossier } from '../src/schema.ts'

const USAGE = `mps-dossier ${EVIDENCE_DOSSIER_BUILDER_VERSION}

  mps-dossier validate <input.json>
  mps-dossier compile <input.json> --output <directory>
  mps-dossier verify <manifest.json>
  mps-dossier render-jsonld <input.json|package-directory>

${EVIDENCE_DOSSIER_BUILDER_BOUNDARY}`

function fail(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

function readJson(path: string): unknown {
  const absolute = resolve(path)
  if (!existsSync(absolute)) fail(`Input does not exist: ${absolute}`)
  try {
    return JSON.parse(readFileSync(absolute, 'utf8'))
  } catch (error) {
    fail(`Input is not valid JSON: ${error instanceof Error ? error.message : 'unknown'}`)
  }
}

function optionValue(argv: readonly string[], name: string): string | null {
  const index = argv.indexOf(name)
  if (index === -1) return null
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) fail(`${name} requires a value.`)
  return value
}

function emit(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

/** Resolves either a dossier document or an exported package directory. */
function loadDossier(target: string): EvidenceDossier {
  const absolute = resolve(target)
  const path = existsSync(join(absolute, 'dossier.json')) ? join(absolute, 'dossier.json') : absolute
  return readJson(path) as EvidenceDossier
}

export function runCli(argv: readonly string[]): void {
  const [command, ...rest] = argv
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(`${USAGE}\n`)
    return
  }

  if (command === 'validate') {
    const input = rest[0]
    if (!input) fail('validate requires an input path.')
    const report = validateDossierDocument(readJson(input))
    emit({ command: 'validate', ...report })
    if (!report.ok) process.exit(1)
    return
  }

  if (command === 'compile') {
    const input = rest[0]
    if (!input) fail('compile requires an input path.')
    const output = optionValue(rest, '--output')
    if (!output) fail('compile requires --output <directory>.')
    if (!isAbsolute(output)) fail('--output must be an absolute path.')
    const dossier = readJson(input) as EvidenceDossier
    const report = validateDossierDocument(dossier)
    if (!report.ok) {
      emit({ command: 'compile', ok: false, issues: report.issues })
      process.exit(1)
    }
    const bundle = compilePackage(dossier)
    writeEvidenceDossierPackage(bundle, resolve(output))
    emit({
      command: 'compile',
      ok: true,
      dossierId: bundle.manifest.dossierId,
      packageDigest: bundle.manifest.packageDigest,
      files: bundle.manifest.files.map((file) => ({ path: file.path, sha256: file.sha256, bytes: file.bytes })),
      output: resolve(output),
    })
    return
  }

  if (command === 'verify') {
    const manifest = rest[0]
    if (!manifest) fail('verify requires a manifest path.')
    const report = verifyPackageDirectory(manifest)
    emit({ command: 'verify', ...report })
    if (!report.ok) process.exit(1)
    return
  }

  if (command === 'render-jsonld') {
    const target = rest[0]
    if (!target) fail('render-jsonld requires a package or dossier path.')
    process.stdout.write(renderDossierJsonLdText(loadDossier(target)))
    return
  }

  fail(`Unknown command: ${command}\n\n${USAGE}`)
}

if (import.meta.url === `file://${process.argv[1]}`) runCli(process.argv.slice(2))
