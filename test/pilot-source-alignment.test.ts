import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  PILOT_ALIGNMENT_AUDIT,
  PILOT_DOMAINS,
  isPilotAlignmentClear,
  pilotAlignmentBlockers,
  pilotAlignmentFor,
  pilotAuditDigest,
  pilotVerdictTotals,
} from '../lib/pilot-source-alignment.ts'
import { PILOT_BATCH_12_SLUGS } from '../lib/pilot-source-alignment-batch-12.ts'
import { PILOT_BATCH_13_SLUGS } from '../lib/pilot-source-alignment-batch-13.ts'
import { PILOT_BATCH_14_SLUGS } from '../lib/pilot-source-alignment-batch-14.ts'
import { ALIGNMENT_VERDICTS, FRONTIER_ALIGNMENT_AUDIT, verdictTotals } from '../lib/frontier-source-alignment.ts'
import { endpointUsabilityTotals, resolveUsableEndpoint } from '../lib/endpoint-fitness.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { QUANTUM_BRIDGE_CANDIDATES } from '../lib/quantum-bridge-candidates.ts'
import { QUANTUM_BRIDGE_AUDIT, buildGapReport } from '../lib/quantum-bridge-audit-package.ts'
import { FRONTIER_CANARY_CONTROL_RECORDS, FRONTIER_CANARY_RECORDS } from '../lib/frontier-canonicalization.ts'

const REFERENCES = QUANTUM_BRIDGE_CANDIDATES.flatMap((candidate) => [
  candidate.declaredSourceRef,
  candidate.declaredTargetRef,
])

/* ------------------------------------------------------------ coverage --- */

test('the pilot audit covers exactly fifty records, twenty-five per domain', () => {
  assert.equal(PILOT_ALIGNMENT_AUDIT.length, 50)
  const ids = PILOT_ALIGNMENT_AUDIT.map((entry) => entry.recordId)
  assert.equal(new Set(ids).size, 50, 'a pilot record is judged twice')
  for (const domain of PILOT_DOMAINS) {
    assert.equal(PILOT_ALIGNMENT_AUDIT.filter((entry) => entry.domainSlug === domain).length, 25)
  }
  const canonical = EPISTEMIC_RECORDS.filter((record) =>
    (PILOT_DOMAINS as readonly string[]).includes(record.domainSlug),
  )
  assert.deepEqual([...ids].sort(), canonical.map((record) => record.id).sort())
})

test('the audit is sorted so generated artifacts are stable', () => {
  const ids = PILOT_ALIGNMENT_AUDIT.map((entry) => entry.recordId)
  assert.deepEqual(ids, [...ids].sort())
})

test('the pilot and frontier audits are disjoint', () => {
  const frontier = new Set(FRONTIER_ALIGNMENT_AUDIT.map((entry) => entry.recordId))
  for (const entry of PILOT_ALIGNMENT_AUDIT) {
    assert.ok(!frontier.has(entry.recordId), `${entry.slug} is in both audits`)
  }
})

/* ---------------------------------------------------- evidence separated -- */

test('only the declared verdict vocabulary is used', () => {
  for (const entry of PILOT_ALIGNMENT_AUDIT) {
    assert.ok(ALIGNMENT_VERDICTS.includes(entry.verdict), `${entry.slug} uses an undeclared verdict`)
    assert.ok(entry.reason.length > 60, `${entry.slug} has no substantive reason`)
    assert.ok(entry.remediation.length > 20)
  }
})

test('every inspected source records an exact inspected-content location', () => {
  for (const entry of PILOT_ALIGNMENT_AUDIT) {
    if (entry.sourceContentInspected) {
      assert.ok(entry.inspectedContentLocation, `${entry.slug} inspected with no location`)
      assert.notEqual(entry.artifactVersion, 'not-inspected')
    } else {
      assert.equal(entry.inspectedContentLocation, null, `${entry.slug} records a location it never read`)
      assert.equal(entry.artifactVersion, 'not-inspected')
    }
  }
})

test('metadata-only evidence cannot claim subject support', () => {
  const metadataOnly = PILOT_ALIGNMENT_AUDIT.filter(
    (entry) => entry.metadataVerified && !entry.sourceContentInspected,
  )
  assert.ok(metadataOnly.length > 0, 'the metadata-only cohort vanished, so this guard is inert')
  for (const entry of metadataOnly) {
    assert.notEqual(entry.verdict, 'supported', `${entry.slug} claims support without inspection`)
    assert.notEqual(entry.verdict, 'mismatched', `${entry.slug} claims mismatch without inspection`)
    assert.equal(isPilotAlignmentClear(entry.recordId), false)
  }
})

test('a resolving DOI alone never produces alignment-clear', () => {
  const resolvedButBlocked = PILOT_ALIGNMENT_AUDIT.filter(
    (entry) => entry.metadataVerified && !isPilotAlignmentClear(entry.recordId),
  )
  assert.ok(resolvedButBlocked.length > 0)
})

test('external review and reproduction are false everywhere', () => {
  for (const entry of PILOT_ALIGNMENT_AUDIT) {
    assert.equal(entry.evidence.externallyReviewed, false)
    assert.equal(entry.evidence.independentlyReproduced, false)
  }
})

test('a record declaring no source can never be alignment-clear', () => {
  const sourceless = PILOT_ALIGNMENT_AUDIT.filter((entry) => entry.sourceContractId === null)
  assert.equal(sourceless.length, 2)
  for (const entry of sourceless) {
    assert.equal(isPilotAlignmentClear(entry.recordId), false)
    assert.ok(pilotAlignmentBlockers(entry.recordId).includes('source-not-declared'))
    assert.equal(entry.verdict, 'insufficient-evidence')
  }
})

/* ------------------------------------------------------ endpoint fitness -- */

test('a pilot audit makes a structurally resolved endpoint evaluable, not automatically usable', () => {
  // The syndrome-extraction alias previously reported audit-missing. It now has
  // a real verdict, and it is usable only because that verdict is clear.
  const result = resolveUsableEndpoint('quantum-systems:syndrome-extraction-cycle')
  assert.equal(result.structure.outcome.status, 'alias-resolution')
  const recordId = (result.structure.outcome as { recordId: string }).recordId
  assert.ok(pilotAlignmentFor(recordId), 'the alias target is not in the pilot audit')
  assert.equal(result.fitness!.state, 'alignment-clear')
  assert.equal(result.usability, 'usable')
})

test('a pilot record that is only metadata-verified leaves its endpoint unusable', () => {
  const blocked = PILOT_ALIGNMENT_AUDIT.find(
    (entry) => entry.metadataVerified && !entry.sourceContentInspected,
  )!
  const result = resolveUsableEndpoint(blocked.recordId)
  assert.equal(result.structure.outcome.status, 'exact-resolution')
  assert.notEqual(result.fitness!.state, 'alignment-clear')
  assert.equal(result.usability, 'structurally-resolved-but-epistemically-blocked')
})

test('a record covered by neither audit still fails closed', () => {
  const uncovered = EPISTEMIC_RECORDS.find(
    (record) =>
      !pilotAlignmentFor(record.id) && !FRONTIER_ALIGNMENT_AUDIT.some((entry) => entry.recordId === record.id),
  )
  if (!uncovered) return // every canonical record is audited; nothing to prove
  const result = resolveUsableEndpoint(uncovered.id)
  assert.equal(result.fitness!.state, 'audit-missing')
  assert.equal(result.usability, 'structurally-resolved-but-epistemically-blocked')
})

test('structural resolution totals did not change', () => {
  const totals = endpointUsabilityTotals(REFERENCES)
  assert.equal(totals.structurallyResolved, 2)
  assert.equal(totals.unresolved, 22)
  assert.equal(buildGapReport().endpointTotals['alias-resolution'], 2)
})

test('endpoint usability reflects the new audits exactly', () => {
  assert.deepEqual(endpointUsabilityTotals(REFERENCES), {
    structurallyResolved: 2,
    usable: 1,
    structurallyResolvedButBlocked: 1,
    unresolved: 22,
  })
  // The REBCO alias stays blocked: its frontier audit is unchanged.
  assert.equal(
    resolveUsableEndpoint('fusion-plasma:rebco-high-field-magnets').fitness!.state,
    'source-mismatched',
  )
})

/* --------------------------------------------------------- invariants ---- */

test('no Q-BR verdict changes because an endpoint gained an audit', () => {
  assert.equal(QUANTUM_BRIDGE_AUDIT.length, 12)
  for (const bridge of QUANTUM_BRIDGE_AUDIT) {
    assert.equal(bridge.verdict, 'BLOCK')
    assert.equal(bridge.promotionEligible, false)
  }
  const totals = buildGapReport().blockerTotals
  assert.equal(totals['endpoint-unresolved-record'], 12)
  assert.equal(totals['source-missing-locator'], 12)
  assert.equal(totals['source-unverifiable'], 4)
})

test('frontier audit totals include the bounded Batch 8 evidence moves', () => {
  assert.deepEqual(verdictTotals(), {
    supported: 94,
    'partially-supported': 47,
    mismatched: 86,
    'insufficient-evidence': 9,
    'inaccessible-source': 4,
  })
  assert.equal(FRONTIER_ALIGNMENT_AUDIT.length, 240)
})

test('the canary cohort is unchanged', () => {
  assert.equal(FRONTIER_CANARY_RECORDS.length, 40)
  assert.equal(FRONTIER_CANARY_CONTROL_RECORDS.length, 200)
})

test('pilot verdict totals are pinned', () => {
  assert.deepEqual(pilotVerdictTotals(), {
    supported: 47,
    'partially-supported': 0,
    mismatched: 0,
    'insufficient-evidence': 3,
    'inaccessible-source': 0,
  })
  assert.equal(PILOT_ALIGNMENT_AUDIT.filter((entry) => entry.sourceContentInspected).length, 47)
  assert.equal(PILOT_ALIGNMENT_AUDIT.filter((entry) => isPilotAlignmentClear(entry.recordId)).length, 47)
})

test('Batch 14 contributes exactly seven full-text-inspected alignment-clear records', () => {
  assert.equal(PILOT_BATCH_14_SLUGS.length, 7)
  for (const slug of PILOT_BATCH_14_SLUGS) {
    const entry = PILOT_ALIGNMENT_AUDIT.find((candidate) => candidate.slug === slug)
    assert.ok(entry)
    assert.equal(entry.sourceContentInspected, true)
    assert.equal(entry.verdict, 'supported')
    assert.equal(isPilotAlignmentClear(entry.recordId), true)
  }
})

test('Batch 13 contributes exactly fourteen inspected alignment-clear records', () => {
  assert.equal(PILOT_BATCH_13_SLUGS.length, 14)
  for (const slug of PILOT_BATCH_13_SLUGS) {
    const entry = PILOT_ALIGNMENT_AUDIT.find((candidate) => candidate.slug === slug)
    assert.ok(entry, `${slug} is absent from the pilot audit`)
    assert.equal(entry.sourceContentInspected, true)
    assert.equal(entry.verdict, 'supported')
    assert.ok(entry.inspectedContentLocation)
    assert.equal(isPilotAlignmentClear(entry.recordId), true)
  }
})

test('Batch 12 contributes exactly twenty-one inspected alignment-clear records', () => {
  assert.equal(PILOT_BATCH_12_SLUGS.length, 21)
  for (const slug of PILOT_BATCH_12_SLUGS) {
    const entry = PILOT_ALIGNMENT_AUDIT.find((candidate) => candidate.slug === slug)
    assert.ok(entry, `${slug} is absent from the pilot audit`)
    assert.equal(entry.sourceContentInspected, true)
    assert.equal(entry.verdict, 'supported')
    assert.ok(entry.inspectedContentLocation)
    assert.equal(isPilotAlignmentClear(entry.recordId), true)
  }
})

/* --------------------------------------------------- guards are actually live */

async function expectGuardRejection(name: string, mutate: (source: string) => string, pattern: RegExp) {
  const dir = new URL('../lib/', import.meta.url).pathname
  const original = readFileSync(join(dir, 'pilot-source-alignment.ts'), 'utf8')
  const probe = join(dir, `__pilot_probe_${name}.ts`)
  writeFileSync(probe, mutate(original))
  try {
    await assert.rejects(() => import(`${probe}?v=${Date.now()}`), pattern)
  } finally {
    rmSync(probe, { force: true })
  }
}

test('the guard rejects a missing pilot judgement', async () => {
  const victim = PILOT_ALIGNMENT_AUDIT.find(
    (entry) =>
      !PILOT_BATCH_12_SLUGS.includes(entry.slug as never) &&
      !PILOT_BATCH_13_SLUGS.includes(entry.slug as never) &&
      !PILOT_BATCH_14_SLUGS.includes(entry.slug as never),
  )!.slug
  await expectGuardRejection(
    'missing',
    (source) => {
      const start = source.indexOf(`  '${victim}': {`)
      const end = source.indexOf('\n  },', start) + '\n  },'.length
      return source.slice(0, start) + source.slice(end)
    },
    /no alignment judgement/,
  )
})

test('the guard rejects an undeclared verdict at runtime', async () => {
  const victim = PILOT_ALIGNMENT_AUDIT.find(
    (entry) =>
      !PILOT_BATCH_12_SLUGS.includes(entry.slug as never) &&
      !PILOT_BATCH_13_SLUGS.includes(entry.slug as never) &&
      !PILOT_BATCH_14_SLUGS.includes(entry.slug as never),
  )!.slug
  await expectGuardRejection(
    'verdict',
    (source) => {
      const start = source.indexOf(`  '${victim}': {`)
      const at = source.indexOf("    verdict: '", start)
      const end = source.indexOf("',", at) + 2
      return source.slice(0, at) + "    verdict: 'not-a-real-verdict'," + source.slice(end)
    },
    /undeclared verdict/,
  )
})

test('the guard rejects a supported verdict without content inspection', async () => {
  const victim = PILOT_ALIGNMENT_AUDIT.find((entry) => !entry.sourceContentInspected)!.slug
  await expectGuardRejection(
    'uninspected',
    (source) => {
      const start = source.indexOf(`  '${victim}': {`)
      const at = source.indexOf("    verdict: '", start)
      const end = source.indexOf("',", at) + 2
      return source.slice(0, at) + "    verdict: 'supported'," + source.slice(end)
    },
    /without content inspection/,
  )
})

test('the guard rejects an inspected record with no exact location', async () => {
  const victim = PILOT_ALIGNMENT_AUDIT.find(
    (entry) =>
      entry.sourceContentInspected &&
      !PILOT_BATCH_12_SLUGS.includes(entry.slug as never) &&
      !PILOT_BATCH_13_SLUGS.includes(entry.slug as never) &&
      !PILOT_BATCH_14_SLUGS.includes(entry.slug as never),
  )!.slug
  await expectGuardRejection(
    'nolocation',
    (source) => {
      const start = source.indexOf(`  '${victim}': {`)
      const at = source.indexOf('    inspectedContentLocation:', start)
      const end = source.indexOf('\n', source.indexOf("',", at)) + 1
      return source.slice(0, at) + '    inspectedContentLocation: null,\n' + source.slice(end)
    },
    /records no exact location/,
  )
})

test('the guard rejects a judged slug that is not a pilot record', async () => {
  await expectGuardRejection(
    'stray',
    (source) =>
      source.replace(
        'const PILOT_JUDGEMENTS: Readonly<Record<string, PilotJudgement>> = {\n',
        "const PILOT_JUDGEMENTS: Readonly<Record<string, PilotJudgement>> = {\n  'not-a-pilot-record': { domainSlug: 'quantum-systems', sourceContractId: null, verdict: 'insufficient-evidence', metadataVerified: false, sourceContentInspected: false, inspectedContentLocation: null, artifactVersion: 'not-inspected', versionRelationship: 'no-declared-source', rightsBasis: 'x', reason: 'a stray judgement that does not correspond to any pilot record in the canonical corpus', remediation: 'remove this stray entry' },\n",
      ),
    /is judged but is not a pilot record/,
  )
})

/* ------------------------------------------------------- determinism ----- */

test('the pilot report regenerates byte for byte', () => {
  assert.match(pilotAuditDigest(), /^sha256:[a-f0-9]{64}$/)
  const root = new URL('..', import.meta.url).pathname
  const generated = ['docs/pilot-audit/pilot-alignment-report.md', 'content/pilot-audit/pilot-alignment-audit.json']
  const before = generated.map((path) => readFileSync(join(root, path), 'utf8'))
  execFileSync(process.execPath, ['--experimental-strip-types', join(root, 'scripts/generate-pilot-alignment-report.ts')], { cwd: root })
  generated.forEach((path, index) => {
    assert.equal(readFileSync(join(root, path), 'utf8'), before[index], `${path} is not deterministic`)
  })
})

test('generated pilot artifacts carry no capture timestamp', () => {
  const root = new URL('..', import.meta.url).pathname
  for (const path of ['docs/pilot-audit/pilot-alignment-report.md', 'content/pilot-audit/pilot-alignment-audit.json']) {
    assert.doesNotMatch(readFileSync(join(root, path), 'utf8'), /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
  }
})

/* ------------------------------------------------------ nothing is public */

test('no pilot audit artifact reaches a route, sitemap or llms.txt', () => {
  const appRoot = new URL('../app', import.meta.url).pathname
  const walk = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? walk(path) : [path]
    })
  const routeSources = walk(appRoot)
    .filter((path) => /\.(tsx|ts)$/.test(path))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n')
  for (const marker of ['pilot-source-alignment', 'pilot-audit', 'endpoint-fitness']) {
    assert.ok(!routeSources.includes(marker), `${marker} is referenced from a route`)
  }
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
  const llms = readFileSync(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8')
  for (const source of [sitemap, llms]) {
    assert.doesNotMatch(source, /pilot-audit|pilot-source-alignment|endpoint-fitness/)
  }
})
