import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  ENDPOINT_CLASSIFICATIONS,
  QBR_ENDPOINT_CLOSURE_PLAN,
  blockerTotals,
  classificationTotals,
  liveOutcome,
  planDigest,
} from '../lib/endpoint-closure-plan.ts'
import {
  DOMAIN_ALIASES,
  RECORD_ALIASES,
  isResolvedOutcome,
  resolveEpistemicReference,
} from '../lib/epistemic-reference-resolver.ts'
import { ENDPOINT_CANDIDATES, candidateBlockers, promotableEndpointCandidates } from '../lib/bridge-endpoint-candidates.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { QUANTUM_BRIDGE_AUDIT, buildGapReport } from '../lib/quantum-bridge-audit-package.ts'
import { QUANTUM_BRIDGE_CANDIDATES } from '../lib/quantum-bridge-candidates.ts'
import { BRIDGE_SOURCE_LEDGER } from '../lib/bridge-source-ledger.ts'

const PLAN = QBR_ENDPOINT_CLOSURE_PLAN
const CANONICAL_IDS = new Set(EPISTEMIC_RECORDS.map((record) => record.id))

/* ------------------------------------------------------------ coverage --- */

test('every endpoint the resolver could not resolve is planned exactly once', () => {
  const unresolved = new Set<string>()
  for (const candidate of QUANTUM_BRIDGE_CANDIDATES) {
    for (const [side, reference] of [
      ['A', candidate.declaredSourceRef],
      ['B', candidate.declaredTargetRef],
    ] as const) {
      // Baseline: what did NOT resolve before this sprint's record alias.
      const isAliasedNow = RECORD_ALIASES.some((alias) => alias.alias === reference)
      const outcome = resolveEpistemicReference(reference).outcome
      if (!isResolvedOutcome(outcome) || isAliasedNow) unresolved.add(`${candidate.id}${side}`)
    }
  }
  const planned = PLAN.entries.map((entry) => entry.key)
  assert.equal(new Set(planned).size, planned.length, 'a key is planned twice')
  assert.deepEqual([...planned].sort(), [...unresolved].sort())
  assert.equal(planned.length, 23)
})

test('every plan entry carries exactly one classification from the declared set', () => {
  for (const entry of PLAN.entries) {
    assert.ok(
      ENDPOINT_CLASSIFICATIONS.includes(entry.classification),
      `${entry.key} has an undeclared classification`,
    )
    assert.ok(entry.reasoning.length > 80, `${entry.key} has no substantive reasoning`)
  }
  const totals = classificationTotals(PLAN)
  assert.equal(
    Object.values(totals).reduce((a, b) => a + b, 0),
    PLAN.entries.length,
  )
})

test('the submitted reference is preserved verbatim and never replaced by a normalization', () => {
  const submitted = new Map<string, string>()
  for (const candidate of QUANTUM_BRIDGE_CANDIDATES) {
    submitted.set(`${candidate.id}A`, candidate.declaredSourceRef)
    submitted.set(`${candidate.id}B`, candidate.declaredTargetRef)
  }
  for (const entry of PLAN.entries) {
    assert.equal(entry.submittedReference, submitted.get(entry.key), `${entry.key} rewrote the submitted reference`)
    if (entry.normalizedReference) {
      assert.notEqual(
        entry.normalizedReference,
        entry.submittedReference,
        `${entry.key} stored a normalization identical to the submission`,
      )
    }
  }
})

/* -------------------------------------------------------------- aliases -- */

test('record aliases cannot collide with a canonical id or with each other', () => {
  const seen = new Set<string>()
  for (const alias of RECORD_ALIASES) {
    assert.ok(!seen.has(alias.alias), `${alias.alias} is declared twice`)
    seen.add(alias.alias)
    assert.ok(!CANONICAL_IDS.has(alias.alias), `${alias.alias} shadows a canonical record id`)
  }
})

test('a record alias may only target a canonical record', () => {
  for (const alias of RECORD_ALIASES) {
    assert.ok(CANONICAL_IDS.has(alias.targetRecordId), `${alias.alias} targets a noncanonical record`)
  }
})

test('record aliases never chain', () => {
  const aliasKeys = new Set(RECORD_ALIASES.map((alias) => alias.alias))
  for (const alias of RECORD_ALIASES) {
    assert.ok(!aliasKeys.has(alias.targetRecordId), `${alias.alias} chains through another alias`)
  }
  const domainKeys = new Set(DOMAIN_ALIASES.map((alias) => alias.alias))
  for (const alias of DOMAIN_ALIASES) {
    assert.ok(!domainKeys.has(alias.target), `${alias.alias} chains through another domain alias`)
  }
})

test('every alias is versioned and carries a reason, and a record alias proves equivalence', () => {
  for (const alias of [...DOMAIN_ALIASES, ...RECORD_ALIASES]) {
    assert.match(alias.since, /^maha-reference-resolver\/\d+\.\d+$/)
    assert.ok(alias.reason.length > 30, `${alias.alias} has no substantive reason`)
  }
  for (const alias of RECORD_ALIASES) {
    assert.ok(
      alias.equivalenceEvidence.length > 80,
      `${alias.alias} asserts equivalence without quoting the record`,
    )
  }
})

test('an alias resolution records the alias separately from the submitted reference', () => {
  for (const alias of RECORD_ALIASES) {
    const result = resolveEpistemicReference(alias.alias)
    assert.equal(result.submittedReference, alias.alias)
    assert.equal(result.outcome.status, 'alias-resolution')
    const outcome = result.outcome as { normalizedReference: string; recordId: string }
    assert.notEqual(outcome.normalizedReference, alias.alias)
    assert.equal(outcome.recordId, alias.targetRecordId)
  }
})

test('an exact canonical id still wins over any alias', () => {
  for (const alias of RECORD_ALIASES) {
    const direct = resolveEpistemicReference(alias.targetRecordId)
    assert.equal(direct.outcome.status, 'exact-resolution')
  }
})

test('a near miss is recorded but never aliased', () => {
  const aliased = new Set(RECORD_ALIASES.map((alias) => alias.alias))
  for (const entry of PLAN.entries) {
    for (const near of entry.nearMissRecords) {
      assert.ok(CANONICAL_IDS.has(near), `${entry.key} names a near miss that does not exist: ${near}`)
    }
    if (entry.nearMissRecords.length && entry.classification !== 'existing-record-alias') {
      assert.ok(!aliased.has(entry.submittedReference), `${entry.key} was aliased despite being a near miss`)
    }
  }
})

/* ----------------------------------------------------------- candidates -- */

test('candidates never enter the canonical resolver pool', () => {
  for (const candidate of ENDPOINT_CANDIDATES) {
    assert.ok(!CANONICAL_IDS.has(candidate.id), `${candidate.id} leaked into the canonical corpus`)
    assert.ok(
      !CANONICAL_IDS.has(candidate.proposedCanonicalId),
      `${candidate.proposedCanonicalId} exists already; the candidate duplicates a record`,
    )
    const resolved = resolveEpistemicReference(`${candidate.domainSlug}:${candidate.slug}`)
    assert.ok(
      !isResolvedOutcome(resolved.outcome),
      `${candidate.id} is resolvable, so a candidate is being treated as canonical`,
    )
  }
})

test('building a candidate does not resolve the endpoint that prompted it', () => {
  for (const entry of PLAN.entries) {
    if (!entry.candidateId) continue
    assert.equal(
      liveOutcome(entry),
      'unresolved-record',
      `${entry.key} reports as resolved because a candidate exists`,
    )
  }
})

test('every planned candidate id exists and every candidate traces to a planned endpoint', () => {
  const built = new Map(ENDPOINT_CANDIDATES.map((candidate) => [candidate.id, candidate]))
  const plannedKeys = new Set(PLAN.entries.map((entry) => entry.key))
  for (const entry of PLAN.entries) {
    if (entry.candidateId) assert.ok(built.has(entry.candidateId), `${entry.key} names a candidate that was not built`)
  }
  for (const candidate of ENDPOINT_CANDIDATES) {
    assert.ok(plannedKeys.has(candidate.originEndpointKey), `${candidate.id} has no planned origin endpoint`)
  }
})

test('no candidate is promotable and every candidate is gated shut', () => {
  assert.deepEqual([...promotableEndpointCandidates()], [])
  for (const candidate of ENDPOINT_CANDIDATES) {
    assert.equal(candidate.canonical, false)
    assert.equal(candidate.noindex, true)
    assert.equal(candidate.requestedPublicPromotion, false)
    assert.equal(candidate.isPromotedToPublicPage, false)
    assert.equal(candidate.reviewState, 'draft')
    assert.equal(candidate.reviewerKind, 'internal-editorial')
    assert.match(candidate.provenanceDigest, /^sha256:[a-f0-9]{64}$/)
    assert.ok(candidateBlockers(candidate).length > 0, `${candidate.id} has no blocker yet is not promotable`)
  }
})

test('a candidate locator is only present when a real source position was read', () => {
  for (const candidate of ENDPOINT_CANDIDATES) {
    for (const source of candidate.sources) {
      if (source.locator === null) continue
      assert.match(
        source.locator,
        /Abstract|Section|Chapter|Figure|Table|Equation|Theorem|p\./i,
        `${candidate.id} carries a vague locator: ${source.locator}`,
      )
      assert.ok(source.verifiedAt, `${candidate.id} has a locator with no verification date`)
    }
  }
})

/* ------------------------------------------------ reachability & gating --- */

test('no candidate or plan entry reaches a public route, sitemap, or llms.txt', () => {
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
  for (const candidate of ENDPOINT_CANDIDATES) {
    assert.ok(!routeSources.includes(candidate.id), `${candidate.id} is referenced from a route`)
    assert.ok(!routeSources.includes(candidate.proposedCanonicalId), `${candidate.proposedCanonicalId} is routed`)
  }
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
  const llms = readFileSync(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8')
  for (const source of [sitemap, llms]) {
    assert.doesNotMatch(source, /urn:maha:candidate|endpoint-closure|Q-BR-/)
  }
})

test('a pilot-only domain stays visibly incompatible with canonical resolution', () => {
  const pilotEndpoints = PLAN.entries.filter((entry) => entry.classification === 'incompatible-record-class')
  assert.ok(pilotEndpoints.length > 0)
  for (const entry of pilotEndpoints) {
    assert.ok(
      entry.blockers.includes('domain-is-pilot-only'),
      `${entry.key} is incompatible but does not say the domain is pilot-only`,
    )
    assert.ok(!isResolvedOutcome(resolveEpistemicReference(entry.submittedReference).outcome))
    assert.equal(entry.proposedCanonicalId, null, `${entry.key} proposes a canonical id in a pilot domain`)
  }
})

test('endpoint closure clears no source, locator, rights, or claim-strength blocker', () => {
  const unrelated = [
    'source-missing-locator',
    'source-unverifiable',
    'source-missing-identifier',
    'rights-basis-unverified',
    'claim-strength-rejected',
    'classification-unmappable',
  ]
  const totals = buildGapReport().blockerTotals
  // The batch had these before this sprint and endpoint work cannot touch them.
  assert.equal(totals['source-missing-locator'], 12)
  assert.equal(totals['source-unverifiable'], 4)
  assert.equal(totals['source-missing-identifier'], 4)
  assert.equal(totals['rights-basis-unverified'], 4)
  assert.equal(totals['claim-strength-rejected'], 7)
  assert.equal(totals['classification-unmappable'], 7)
  for (const code of unrelated) assert.ok((totals[code] ?? 0) > 0, `${code} vanished during endpoint closure`)
})

test('no bridge is promoted by endpoint closure', () => {
  for (const bridge of QUANTUM_BRIDGE_AUDIT) {
    assert.equal(bridge.verdict, 'BLOCK', `${bridge.id} changed verdict`)
    assert.equal(bridge.promotionEligible, false)
  }
})

test('the resolved endpoint count is reported honestly', () => {
  const totals = buildGapReport().endpointTotals
  assert.equal(totals['alias-resolution'], 2, 'exactly one domain alias and one record alias resolve')
  assert.equal(totals['unresolved-record'], 22)
  assert.equal(totals['exact-resolution'] ?? 0, 0)
  assert.equal(
    Object.values(totals).reduce((a, b) => a + b, 0),
    24,
  )
})

test('no source locator was invented anywhere in the batch', () => {
  for (const entry of BRIDGE_SOURCE_LEDGER) {
    if (entry.locator) assert.ok(entry.locatorSource, `${entry.key} has a locator with no reading recorded`)
    if (entry.verification === 'unverifiable') assert.equal(entry.locator, null)
  }
})

/* ------------------------------------------------------------ determinism - */

test('the plan digest is stable and depends on plan content', () => {
  assert.match(planDigest(PLAN), /^sha256:[a-f0-9]{64}$/)
  assert.equal(planDigest(PLAN), planDigest(PLAN))
  const mutated = {
    ...PLAN,
    entries: PLAN.entries.map((entry, index) =>
      index === 0 ? { ...entry, reasoning: `${entry.reasoning} changed` } : entry,
    ),
  }
  assert.notEqual(planDigest(mutated), planDigest(PLAN))
})

test('blocker totals are sorted so the generated report is stable', () => {
  const keys = Object.keys(blockerTotals(PLAN))
  assert.deepEqual(keys, [...keys].sort())
})

test('regenerating the artifacts reproduces the committed files byte for byte', () => {
  const root = new URL('..', import.meta.url).pathname
  const generated = [
    'docs/bridges/endpoint-resolution-plan.md',
    'docs/bridges/endpoint-candidate-inventory.md',
    'docs/bridges/endpoint-closure-reviewer-packet.md',
    'content/bridges/endpoint-resolution-plan.json',
    'content/bridges/endpoint-candidate-inventory.json',
    'docs/bridges/quantum-bridge-gap-report.md',
    'content/bridges/quantum-bridge-gap-report.json',
  ]
  const before = generated.map((path) => readFileSync(join(root, path), 'utf8'))
  for (const script of [
    'scripts/generate-endpoint-closure-artifacts.ts',
    'scripts/generate-quantum-bridge-gap-report.ts',
  ]) {
    execFileSync(process.execPath, ['--experimental-strip-types', join(root, script)], { cwd: root })
  }
  generated.forEach((path, index) => {
    assert.equal(readFileSync(join(root, path), 'utf8'), before[index], `${path} is not deterministic`)
  })
})
