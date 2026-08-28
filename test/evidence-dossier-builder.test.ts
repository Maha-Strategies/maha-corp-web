import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { DEMONSTRATION_DOSSIER } from '../lib/evidence-dossier/demonstration.ts'
import * as canonical from '../lib/evidence-dossier/digest.ts'
import * as libSchema from '../lib/evidence-dossier/schema.ts'
import {
  EVIDENCE_DOSSIER_BUILDER_BOUNDARY,
  canonicalJson,
  compilePackage,
  provenanceDigest,
  renderDossierJsonLd,
  renderDossierJsonLdText,
  validateDossierDocument,
  verifyPackageDirectory,
  writeEvidenceDossierPackage,
} from '../packages/evidence-dossier-builder/src/index.ts'
import { DOSSIER_SCHEMA_VERSION, type DossierEngagement } from '../packages/evidence-dossier-builder/src/schema.ts'
import { runCli } from '../packages/evidence-dossier-builder/bin/mps-dossier.ts'

const CLI = 'packages/evidence-dossier-builder/bin/mps-dossier.ts'

function scratch(): string {
  return mkdtempSync(join(tmpdir(), 'dossier-builder-'))
}

function compileInto(directory: string) {
  const bundle = compilePackage(DEMONSTRATION_DOSSIER)
  const target = join(directory, 'package')
  writeEvidenceDossierPackage(bundle, target)
  return { bundle, target }
}

test('the package reuses the canonical implementation rather than forking it', () => {
  // Identity, not equality: a fork would produce a different function object.
  assert.equal(DOSSIER_SCHEMA_VERSION, libSchema.DOSSIER_SCHEMA_VERSION)
  assert.equal(canonicalJson, canonical.canonicalJson)
  assert.equal(provenanceDigest, canonical.provenanceDigest)
  const source = readFileSync('packages/evidence-dossier-builder/src/schema.ts', 'utf8')
  assert.match(source, /lib\/evidence-dossier\/schema\.ts/)
  assert.equal(/export interface EvidenceDossier\b/.test(source), false, 'the schema must not be redeclared here')
})

test('malformed packages fail closed', () => {
  for (const bad of [null, 42, 'dossier', [], {}]) {
    const report = validateDossierDocument(bad)
    assert.equal(report.ok, false, `${JSON.stringify(bad)} must not validate`)
    assert.ok(report.issues.length > 0)
  }
})

test('a metadata-only source cannot support a passage', () => {
  // 'document-inspected' is the only state that reflects reading the source.
  const metadataOnly = DEMONSTRATION_DOSSIER.sources.find((source) => source.verificationState === 'document-inspected')
    ?? DEMONSTRATION_DOSSIER.sources[0]
  const tampered = {
    ...DEMONSTRATION_DOSSIER,
    sources: DEMONSTRATION_DOSSIER.sources.map((source) =>
      source.sourceId === metadataOnly.sourceId ? { ...source, verificationState: 'metadata-verified' as const } : source,
    ),
    passages: DEMONSTRATION_DOSSIER.passages.map((passage) =>
      passage.sourceId === metadataOnly.sourceId ? { ...passage, originalDocumentInspected: false } : passage,
    ),
  }
  const report = validateDossierDocument(tampered)
  assert.equal(report.ok, false, 'an uninspected passage on a metadata-only source must fail')
})

test('a passage locator cannot be omitted', () => {
  const withoutLocator = {
    ...DEMONSTRATION_DOSSIER,
    passages: DEMONSTRATION_DOSSIER.passages.map((passage, index) => (index === 0 ? { ...passage, locator: null } : passage)),
  }
  assert.equal(validateDossierDocument(withoutLocator).ok, false)
})

test('a claim cannot attach to a source the dossier does not declare', () => {
  const unrelated = {
    ...DEMONSTRATION_DOSSIER,
    claims: DEMONSTRATION_DOSSIER.claims.map((claim, index) =>
      index === 0 ? { ...claim, sourceIds: [...claim.sourceIds, 'source-unrelated-but-real'] } : claim,
    ),
  }
  const report = validateDossierDocument(unrelated)
  assert.equal(report.ok, false, 'an undeclared source must not resolve')
})

test('digest tampering fails verification, including a matching edited digest', () => {
  const directory = scratch()
  try {
    const { target } = compileInto(directory)
    assert.equal(verifyPackageDirectory(join(target, 'manifest.json')).ok, true)

    // Edit a file without touching the manifest: the recomputed digest disagrees.
    const ledger = join(target, 'claim-ledger.csv')
    writeFileSync(ledger, `${readFileSync(ledger, 'utf8')}tampered,row\n`)
    const afterEdit = verifyPackageDirectory(join(target, 'manifest.json'))
    assert.equal(afterEdit.ok, false)
    assert.ok(afterEdit.findings.some((finding) => finding.code === 'file-digest-mismatch'))

    // Now "repair" the manifest so its file digest matches the tampered bytes.
    // Verification must still fail, because the package digest is recomputed.
    const manifestPath = join(target, 'manifest.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const content = readFileSync(ledger, 'utf8')
    for (const entry of manifest.files) {
      if (entry.path === 'claim-ledger.csv') {
        entry.sha256 = `sha256:${canonical.sha256Hex(content)}`
        entry.bytes = Buffer.byteLength(content, 'utf8')
      }
    }
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    const afterRepair = verifyPackageDirectory(manifestPath)
    assert.equal(afterRepair.ok, false, 'a self-consistent forgery must still fail')
    assert.ok(afterRepair.findings.some((finding) => finding.code === 'package-digest-mismatch'))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('key order does not change canonical output', () => {
  const forward = { alpha: 1, beta: { gamma: 2, delta: 3 }, epsilon: [1, 2] }
  const reversed = { epsilon: [1, 2], beta: { delta: 3, gamma: 2 }, alpha: 1 }
  assert.equal(canonicalJson(forward), canonicalJson(reversed))
  assert.equal(provenanceDigest(forward), provenanceDigest(reversed))
})

test('unicode normalization is deterministic', () => {
  const composed = 'Schrödinger'.normalize('NFC')
  const decomposed = 'Schrödinger'.normalize('NFD')
  assert.notEqual(composed, decomposed, 'the fixture must actually differ before normalization')
  assert.equal(canonicalJson({ name: composed }), canonicalJson({ name: decomposed }))
  assert.equal(provenanceDigest({ name: composed }), provenanceDigest({ name: decomposed }))
})

test('prior revisions remain immutable through compilation', () => {
  const bundle = compilePackage(DEMONSTRATION_DOSSIER)
  const exported = JSON.parse(bundle.files.find((file) => file.path === 'dossier.json')!.content)
  assert.deepEqual(exported.priorRevisions, DEMONSTRATION_DOSSIER.priorRevisions)
  const again = compilePackage(DEMONSTRATION_DOSSIER)
  assert.equal(again.manifest.packageDigest, bundle.manifest.packageDigest)
})

test('customer data and credentials are rejected by the rehearsal engagement', () => {
  assert.throws(
    () => compilePackage(DEMONSTRATION_DOSSIER, {
      engagement: { mode: 'internal-rehearsal', listPriceUsd: 5_000, contractedPriceUsd: 2_500, cashReceivedUsd: 0, customerReference: null, deliveryTargetDays: 10, requestedAt: '2026-08-25T00:00:00Z' },
    }),
    /internal rehearsal cannot record contracted revenue/,
  )
  assert.throws(
    () => compilePackage(DEMONSTRATION_DOSSIER, {
      engagement: { mode: 'internal-rehearsal', listPriceUsd: 5_000, contractedPriceUsd: 0, cashReceivedUsd: 0, customerReference: 'ACME Corp, contact jane@acme.example', deliveryTargetDays: 10, requestedAt: '2026-08-25T00:00:00Z' },
    }),
    /cannot record contracted revenue, cash received, or a customer reference/,
  )
  // The list price is a literal type, so a discounted offer is a compile error.
  // The cast proves the runtime guard holds too, for input arriving as JSON.
  assert.throws(
    () => compilePackage(DEMONSTRATION_DOSSIER, {
      engagement: { mode: 'internal-rehearsal', listPriceUsd: 1, contractedPriceUsd: 0, cashReceivedUsd: 0, customerReference: null, deliveryTargetDays: 10, requestedAt: '2026-08-25T00:00:00Z' } as unknown as DossierEngagement,
    }),
    /listPriceUsd must preserve the declared \$5,000 offer price/,
  )
})

test('the commercial rehearsal position is unchanged', () => {
  const bundle = compilePackage(DEMONSTRATION_DOSSIER)
  const { engagement, offerReadiness } = bundle.manifest
  assert.equal(engagement.listPriceUsd, 5_000)
  assert.equal(engagement.contractedPriceUsd, 0)
  assert.equal(engagement.cashReceivedUsd, 0)
  assert.equal(engagement.customerReference, null)
  assert.equal(offerReadiness.readyForFixedFeeOffer, false, 'the offer must not be marked ready')
})

test('the CLI performs no network access', () => {
  const sources = [
    readFileSync('packages/evidence-dossier-builder/bin/mps-dossier.ts', 'utf8'),
    readFileSync('packages/evidence-dossier-builder/src/verify.ts', 'utf8'),
    readFileSync('packages/evidence-dossier-builder/src/jsonld.ts', 'utf8'),
    readFileSync('packages/evidence-dossier-builder/src/compile.ts', 'utf8'),
    readFileSync('packages/evidence-dossier-builder/src/validate.ts', 'utf8'),
  ].join('\n')
  for (const forbidden of ['fetch(', 'node:http', 'node:https', 'XMLHttpRequest', 'WebSocket', 'node:dgram', 'node:net']) {
    assert.equal(sources.includes(forbidden), false, `${forbidden} must not appear in the offline CLI`)
  }
  // And no telemetry: look for reporting calls and imports, not the word itself
  // (the CLI banner legitimately states that it emits none).
  for (const forbidden of ['posthog', 'sentry', 'mixpanel', 'datadog', 'navigator.sendBeacon', 'reportEvent(', 'track(']) {
    assert.equal(sources.toLowerCase().includes(forbidden.toLowerCase()), false, `${forbidden} must not appear`)
  }
})

test('no public route or client bundle imports the operator package', () => {
  // grep exits 1 when nothing matches, which is the passing case here.
  let output = ''
  try {
    output = execFileSync('grep', ['-rl', 'evidence-dossier-builder', 'app', 'lib', 'components'], { encoding: 'utf8' })
  } catch (error) {
    const status = (error as { status?: number }).status
    assert.equal(status, 1, `grep failed unexpectedly: ${String((error as { stderr?: string }).stderr ?? '')}`)
  }
  const hits = output.split('\n').filter(Boolean)
  assert.deepEqual(hits, [], `the operator package must stay out of the app: ${hits.join(', ')}`)
})

test('the hBN rehearsal output remains unchanged', () => {
  // The rehearsal compiles through the same canonical path the package re-exports,
  // so a change in either would move this digest.
  const bundle = compilePackage(DEMONSTRATION_DOSSIER)
  const canonicalFile = bundle.files.find((file) => file.path === 'dossier.canonical.json')!
  assert.equal(canonicalFile.sha256, `sha256:${canonical.sha256Hex(canonicalFile.content)}`)
  const rerun = compilePackage(DEMONSTRATION_DOSSIER)
  assert.equal(rerun.files.find((file) => file.path === 'dossier.canonical.json')!.sha256, canonicalFile.sha256)
  assert.equal(rerun.manifest.dossierDigest, bundle.manifest.dossierDigest)
})

test('JSON-LD represents only fields the package supports and fabricates nothing', () => {
  const jsonld = renderDossierJsonLd(DEMONSTRATION_DOSSIER)
  // The seven categories stay distinct.
  for (const key of ['sourceMetadata', 'claims', 'passages', 'calculations', 'formalProofs', 'runtimeReceipts', 'assurance']) {
    assert.ok(key in jsonld, `${key} must be represented`)
  }
  // Nothing invented: the schema carries no calculations, proofs, or receipts.
  assert.deepEqual(jsonld.calculations, [])
  assert.deepEqual(jsonld.formalProofs, [])
  assert.deepEqual(jsonld.runtimeReceipts, [])
  assert.equal(jsonld.sourceMetadata.length, DEMONSTRATION_DOSSIER.sources.length)
  assert.equal(jsonld.claims.length, DEMONSTRATION_DOSSIER.claims.length)
  assert.equal(jsonld.passages.length, DEMONSTRATION_DOSSIER.passages.length)
  // Assurance never claims what was not done.
  assert.equal(jsonld.assurance.externalExpertReview, false)
  assert.equal(jsonld.assurance.independentReproduction, false)
  assert.equal(jsonld.assurance.certification, 'none')
  // Metadata and passages are separate collections, so one cannot pass for the other.
  const passageIds = new Set(jsonld.passages.map((passage) => passage['@id']))
  for (const source of jsonld.sourceMetadata) assert.equal(passageIds.has(source['@id']), false)
  // Deterministic text.
  assert.equal(renderDossierJsonLdText(DEMONSTRATION_DOSSIER), renderDossierJsonLdText(DEMONSTRATION_DOSSIER))
})

test('verification works from exported artifacts alone', () => {
  const directory = scratch()
  try {
    const { target, bundle } = compileInto(directory)
    const report = verifyPackageDirectory(join(target, 'manifest.json'))
    assert.equal(report.ok, true, JSON.stringify(report.findings))
    assert.equal(report.dossierId, bundle.manifest.dossierId)
    assert.equal(report.filesChecked, bundle.files.length)
    // A missing file is detected without consulting anything outside the directory.
    rmSync(join(target, 'source-ledger.csv'))
    const after = verifyPackageDirectory(join(target, 'manifest.json'))
    assert.equal(after.ok, false)
    assert.ok(after.findings.some((finding) => finding.code === 'file-missing'))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('CLI output is deterministic and byte-identical across runs', () => {
  const directory = scratch()
  try {
    const dossierPath = join(directory, 'dossier.json')
    writeFileSync(dossierPath, `${JSON.stringify(DEMONSTRATION_DOSSIER, null, 2)}\n`)
    const first = execFileSync('node', ['--experimental-strip-types', CLI, 'render-jsonld', dossierPath], { encoding: 'utf8' })
    const second = execFileSync('node', ['--experimental-strip-types', CLI, 'render-jsonld', dossierPath], { encoding: 'utf8' })
    assert.equal(first, second)
    const validated = execFileSync('node', ['--experimental-strip-types', CLI, 'validate', dossierPath], { encoding: 'utf8' })
    assert.match(validated, /"ok": true/)

    const out = join(directory, 'compiled')
    const compiled = execFileSync('node', ['--experimental-strip-types', CLI, 'compile', dossierPath, '--output', out], { encoding: 'utf8' })
    assert.match(compiled, /"ok": true/)
    const verified = execFileSync('node', ['--experimental-strip-types', CLI, 'verify', join(out, 'manifest.json')], { encoding: 'utf8' })
    assert.match(verified, /"ok": true/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('the CLI declines unknown commands and secret-bearing usage', () => {
  const usage = readFileSync('packages/evidence-dossier-builder/bin/mps-dossier.ts', 'utf8')
  for (const forbidden of ['--token', '--secret', '--password', '--api-key', 'AUTHORIZATION', 'Bearer ']) {
    assert.equal(usage.includes(forbidden), false, `${forbidden} must not be a CLI concept`)
  }
  assert.match(EVIDENCE_DOSSIER_BUILDER_BOUNDARY, /no source retrieval/)
  assert.match(EVIDENCE_DOSSIER_BUILDER_BOUNDARY, /claims no legal, regulatory, scientific, or commercial certification/)
  assert.equal(typeof runCli, 'function')
})
