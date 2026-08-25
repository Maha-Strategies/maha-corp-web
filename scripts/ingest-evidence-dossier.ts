import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'

import { normalizeValue, parseBoundedJson, sanitizeExportFilename, NormalizationError } from '../lib/evidence-dossier/normalize.ts'
import { validatePackage, verifyParent } from '../lib/evidence-dossier/package-validator.ts'
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { buildReviewerPacket, serializePacket } from '../lib/evidence-dossier/packet.ts'
import { createFixtureStore, StorageConflictError } from '../lib/evidence-dossier/storage.ts'
import { refuseTransition } from '../lib/evidence-dossier/revision.ts'
import type { DossierPackage } from '../lib/evidence-dossier/package.ts'

/**
 * Internal ingestion command.
 *
 *   npm run evidence-dossier:ingest -- --file path/to/package.json
 *
 * Validates, verifies lineage, appends to a local append-only store and emits a
 * reviewer packet. It publishes nothing and promotes nothing.
 *
 * No secret is accepted as an argument. The only inputs are file paths and an
 * optional store directory; nothing here reads a credential.
 */

interface Options {
  file: string
  store: string
  out: string | null
  dryRun: boolean
}

function parseArguments(argv: readonly string[]): Options {
  const options: Options = { file: '', store: '.dossier-store', out: null, dryRun: false }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (flag === '--file') { options.file = value ?? ''; index += 1 }
    else if (flag === '--store') { options.store = value ?? options.store; index += 1 }
    else if (flag === '--out') { options.out = value ?? null; index += 1 }
    else if (flag === '--dry-run') options.dryRun = true
    else if (flag.startsWith('--')) throw new Error(`Unknown flag ${flag}.`)
  }
  if (!options.file) throw new Error('Usage: --file path/to/package.json [--store dir] [--out dir] [--dry-run]')
  // Guard against anyone trying to pass material through the command line.
  if (/^--?(token|secret|key|password)/i.test(options.file)) {
    throw new Error('Refusing a credential-shaped argument. This command accepts file paths only.')
  }
  return options
}

function fail(summary: string, detail: unknown): never {
  // Deliberately prints paths and codes, never payload content.
  console.error(JSON.stringify({ ok: false, summary, detail }, null, 2))
  process.exit(1)
}

async function main() {
  const options = parseArguments(process.argv.slice(2))

  let pkg: DossierPackage
  try {
    const raw = readFileSync(options.file, 'utf8')
    pkg = normalizeValue(parseBoundedJson(raw)) as DossierPackage
  } catch (error) {
    if (error instanceof NormalizationError) fail('normalization-failed', { path: error.path, message: error.message })
    fail('unreadable-input', { message: (error as Error).message })
  }

  const issues = validatePackage(pkg, { computeDigest: provenanceDigest })
  if (issues.length) {
    fail('validation-failed', issues.map((issue) => ({ code: issue.code, path: issue.path, message: issue.message })))
  }

  const store = createFixtureStore(options.store)
  const parent = pkg.parentDigest ? await store.head(pkg.packageId) : null
  const lineage = verifyParent(pkg, parent)
  if (lineage.length) {
    fail('lineage-failed', lineage.map((issue) => ({ code: issue.code, path: issue.path, message: issue.message })))
  }

  if (parent) {
    const refusal = refuseTransition({ from: parent, toState: pkg.reviewState })
    if (refusal && pkg.reviewState !== parent.reviewState) {
      fail('transition-refused', refusal)
    }
  } else if (pkg.reviewState !== 'illustrative-draft') {
    fail('transition-refused', {
      code: 'first-revision-must-be-draft',
      message: 'A first revision must start at illustrative-draft.',
    })
  }

  if (!options.dryRun) {
    try {
      await store.append(pkg)
    } catch (error) {
      if (error instanceof StorageConflictError) fail('storage-conflict', { message: error.message })
      throw error
    }
  }

  const packet = buildReviewerPacket(pkg)
  if (options.out) {
    mkdirSync(options.out, { recursive: true })
    const name = sanitizeExportFilename(`${pkg.packageId}-${pkg.revisionId}-packet`)
    writeFileSync(`${options.out}/${name}.json`, `${JSON.stringify(packet, null, 2)}\n`)
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        packageId: pkg.packageId,
        revisionId: pkg.revisionId,
        reviewState: pkg.reviewState,
        payloadDigest: pkg.canonicalPayloadDigest,
        parentDigest: pkg.parentDigest,
        claims: pkg.dossier.claims.length,
        sources: pkg.dossier.sources.length,
        comparisons: pkg.dossier.comparisons.length,
        packetBytes: serializePacket(packet).length,
        appended: !options.dryRun,
        published: false,
        promoted: false,
        source: basename(options.file),
      },
      null,
      2,
    ),
  )
}

await main()
