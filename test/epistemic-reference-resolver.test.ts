import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  DOMAIN_ALIASES,
  REFERENCE_RESOLVER_VERSION,
  isResolvedOutcome,
  namespaceInventory,
  resolveEpistemicReference,
} from '../lib/epistemic-reference-resolver.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'

test('every alias is explicit, versioned, and carries a reason', () => {
  assert.ok(DOMAIN_ALIASES.length > 0)
  for (const alias of DOMAIN_ALIASES) {
    assert.match(alias.since, /^maha-reference-resolver\/\d+\.\d+$/, `${alias.alias} is not versioned`)
    assert.ok(alias.reason.length > 30, `${alias.alias} has no auditable reason`)
    assert.notEqual(alias.alias, alias.target)
  }
})

test('an alias is declared at most once and never chains', () => {
  const seen = new Set<string>()
  for (const alias of DOMAIN_ALIASES) {
    assert.ok(!seen.has(alias.alias), `${alias.alias} is declared twice`)
    seen.add(alias.alias)
  }
  for (const alias of DOMAIN_ALIASES) {
    assert.ok(!seen.has(alias.target), `${alias.target} is both an alias and a target`)
  }
})

test('an exact canonical id resolves before any namespace interpretation', () => {
  const record = EPISTEMIC_RECORDS[0]
  const result = resolveEpistemicReference(record.id)
  assert.equal(result.outcome.status, 'exact-resolution')
  assert.equal(result.submittedReference, record.id)
})

test('a resolved outcome carries the canonical record revision digest', () => {
  const record = EPISTEMIC_RECORDS[0]
  const outcome = resolveEpistemicReference(record.id).outcome
  assert.ok(isResolvedOutcome(outcome))
  assert.match((outcome as { recordRevisionSha256: string }).recordRevisionSha256, /^sha256:[a-f0-9]{64}$/)
})

test('an alias resolution records the alias and the normalized reference separately', () => {
  const result = resolveEpistemicReference('fusion-plasma:rebco-high-field-magnets')
  assert.equal(result.outcome.status, 'alias-resolution')
  const outcome = result.outcome as {
    appliedAlias: { alias: string; target: string }
    normalizedReference: string
    recordId: string
  }
  assert.equal(outcome.appliedAlias.alias, 'fusion-plasma')
  assert.equal(outcome.appliedAlias.target, 'fusion-plasma-systems')
  assert.equal(outcome.normalizedReference, 'fusion-plasma-systems:rebco-high-field-magnets')
  // The submitted reference is untouched by normalization.
  assert.equal(result.submittedReference, 'fusion-plasma:rebco-high-field-magnets')
})

test('a nearest-slug suggestion is advisory and never becomes a resolution', () => {
  const result = resolveEpistemicReference('quantum-systems:surface-code-threshold')
  assert.equal(result.outcome.status, 'unresolved-record')
  const outcome = result.outcome as { nearestSlugSuggestion: string | null }
  assert.ok(outcome.nearestSlugSuggestion, 'expected an advisory suggestion for this reference')
  assert.equal(isResolvedOutcome(result.outcome), false)
  assert.equal(result.submittedReference, 'quantum-systems:surface-code-threshold')
})

test('a record in a non-canonical content system is incompatible, not resolved', () => {
  // A real Phase-4 pilot entry: the domain and slug both exist, but the class does not.
  const result = resolveEpistemicReference('mathematics:bayesian-updating')
  assert.equal(result.outcome.status, 'incompatible-record-class')
  const outcome = result.outcome as { foundIn: string; reason: string }
  assert.equal(outcome.foundIn, 'EPISTEMIC_PHASE4_PILOT_ENTRIES')
  assert.match(outcome.reason, /not a canonical graph record/i)
  assert.equal(isResolvedOutcome(result.outcome), false)
})

test('an alias may reach a non-canonical namespace without granting resolution', () => {
  const result = resolveEpistemicReference('semiconductor-manufacturing:plasma-etch-and-pattern-transfer')
  assert.equal(result.outcome.status, 'incompatible-record-class')
  assert.equal(isResolvedOutcome(result.outcome), false)
})

test('a genuinely unknown domain is reported as an unresolved domain', () => {
  const result = resolveEpistemicReference('not-a-real-domain:whatever')
  assert.equal(result.outcome.status, 'unresolved-domain')
})

test('route existence cannot satisfy record resolution', () => {
  // The resolver must not read route components as corpus data.
  const source = readFileSync(new URL('../lib/epistemic-reference-resolver.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /from '\.\.\/app\//)
  assert.doesNotMatch(source, /app\/.*page/)
  // /knowledge routes exist publicly; that must not make a knowledge reference resolvable.
  const result = resolveEpistemicReference('knowledge:some-public-article')
  assert.equal(isResolvedOutcome(result.outcome), false)
})

test('the namespace inventory separates canonical graph domains from pilot-only ones', () => {
  const inventory = namespaceInventory()
  assert.equal(inventory.resolverVersion, REFERENCE_RESOLVER_VERSION)
  assert.ok(inventory.canonical.length >= 10)
  for (const entry of inventory.canonical) assert.equal(entry.canonicalGraph, true)
  for (const entry of inventory.pilotOnly) {
    assert.equal(entry.canonicalGraph, false)
    assert.equal(entry.publicProjection, false)
  }
  const pilotDomains = inventory.pilotOnly.map((entry) => entry.domainSlug)
  // These were reported as "absent domains" by the first audit. They exist.
  for (const domain of ['mathematics', 'semiconductor', 'neuromorphic-biocomputing']) {
    assert.ok(pilotDomains.includes(domain), `${domain} should be inventoried as pilot-only`)
  }
})
