import assert from 'node:assert/strict'
import test from 'node:test'

import { BRIDGE_SOURCE_LEDGER, ledgerEntry } from '../lib/bridge-source-ledger.ts'
import { QUANTUM_BRIDGE_AUDIT, buildGapReport } from '../lib/quantum-bridge-audit-package.ts'
import { QUANTUM_BRIDGE_CANDIDATES } from '../lib/quantum-bridge-candidates.ts'

/* ------------------------------------------------- ledger is the source -- */

/**
 * The candidate records carry their own copy of the audited verification state.
 * That copy silently drifted once already: the ledger sprint upgraded entries
 * the candidates still described as unverified, and the generated report then
 * disagreed with the ledger table printed underneath it. These tests make the
 * two representations provably identical rather than merely intended to match.
 */
test('the audited verification state on a candidate equals the ledger entry', () => {
  for (const candidate of QUANTUM_BRIDGE_CANDIDATES) {
    for (const source of candidate.sources) {
      const entry = ledgerEntry(candidate.id, source.side)
      assert.equal(
        source.verification,
        entry.verification,
        `${candidate.id}${source.side} verification drifted from the ledger`,
      )
      assert.equal(
        source.locator,
        entry.locator,
        `${candidate.id}${source.side} locator drifted from the ledger`,
      )
    }
  }
})

test('reported source totals are counted from the ledger, not the candidate copy', () => {
  const report = buildGapReport()
  const fromLedger: Record<string, number> = {}
  for (const entry of BRIDGE_SOURCE_LEDGER) {
    fromLedger[entry.verification] = (fromLedger[entry.verification] ?? 0) + 1
  }
  assert.deepEqual(report.sourceTotals, fromLedger)
  assert.equal(
    Object.values(report.sourceTotals).reduce((a, b) => a + b, 0),
    24,
    'the report must account for all 24 submitted citations',
  )
})

/* ------------------------------------------------ submitted is untouched -- */

test('correcting a citation never rewrites the submitted identifier', () => {
  // Q-BR-008B was submitted with a bioRxiv DOI; the audit found the work in
  // Current Opinion in Behavioral Sciences. Both must remain visible.
  const submitted = QUANTUM_BRIDGE_CANDIDATES.find((candidate) => candidate.id === 'Q-BR-008')
  assert.ok(submitted)
  const sideB = submitted.sources.find((source) => source.side === 'B')
  assert.ok(sideB)
  assert.equal(sideB.identifier, 'doi:10.1101/094102', 'the submitted identifier was overwritten')
  assert.equal(ledgerEntry('Q-BR-008', 'B').identifier, 'doi:10.1016/j.cobeha.2016.06.003')
  assert.notEqual(sideB.identifier, ledgerEntry('Q-BR-008', 'B').identifier)
})

/* ---------------------------------------------------------- locators ------ */

test('a locator is never recorded without saying where it was read', () => {
  for (const entry of BRIDGE_SOURCE_LEDGER) {
    if (entry.locator) {
      assert.ok(
        entry.locatorSource && entry.locatorSource.length > 5,
        `${entry.key} carries a locator with no locatorSource`,
      )
    } else {
      assert.equal(entry.locatorSource, undefined, `${entry.key} has a locatorSource but no locator`)
    }
  }
})

test('a source that was never inspected carries no locator', () => {
  // Bibliographic verification via Crossref or a catalogue proves the work
  // exists. It does not show which page supports the bounded claim, so it may
  // not produce a locator. Only sources whose text was actually read have one.
  for (const entry of BRIDGE_SOURCE_LEDGER) {
    if (!entry.locator) continue
    assert.ok(
      /abstract|section|chapter|figure|table|equation|theorem|p\./i.test(entry.locator),
      `${entry.key} locator is not an exact position: ${entry.locator}`,
    )
  }
})

test('an unverifiable source gains neither an identifier nor a locator', () => {
  const unverifiable = BRIDGE_SOURCE_LEDGER.filter((entry) => entry.verification === 'unverifiable')
  assert.equal(unverifiable.length, 4)
  for (const entry of unverifiable) {
    assert.equal(entry.identifier, null, `${entry.key} was given an identifier it does not have`)
    assert.equal(entry.locator, null, `${entry.key} was given an invented locator`)
  }
})

test('the Q-BR-011 side B source is still not replaced by a substitute', () => {
  const entry = ledgerEntry('Q-BR-011', 'B')
  assert.equal(entry.verification, 'unverifiable')
  assert.equal(entry.identifier, null)
  assert.equal(entry.suggestedRevision, undefined, 'Q-BR-011B must not carry a rescue substitute')
})

test('a proposed substitute stays a pending decision and never becomes the citation', () => {
  for (const entry of BRIDGE_SOURCE_LEDGER) {
    if (!entry.suggestedRevision) continue
    assert.equal(entry.suggestedRevision.decision, 'pending-human-decision')
    assert.equal(entry.verification, 'unverifiable', `${entry.key} was upgraded by a suggestion`)
    assert.equal(entry.identifier, null, `${entry.key} adopted its suggested identifier`)
  }
})

/* ------------------------------------------- newly resolved bibliography -- */

test('Q-BR-001B is verified against a catalogue record but carries no locator', () => {
  const entry = ledgerEntry('Q-BR-001', 'B')
  assert.equal(entry.verification, 'verified-correct')
  assert.equal(entry.identifier, 'isbn:9780444850096')
  assert.equal(entry.locator, null, 'the volume text was not inspected, so there is no locator')
  assert.ok(entry.verifiedAt)
})

test('no citation is left in the not-independently-verified state', () => {
  const unchecked = BRIDGE_SOURCE_LEDGER.filter(
    (entry) => entry.verification === 'not-independently-verified',
  )
  assert.deepEqual(
    unchecked.map((entry) => entry.key),
    [],
    'every submitted citation has now been checked against an authoritative index',
  )
})

/* -------------------------------------------------------- gate unchanged -- */

test('clearing bibliographic gaps does not promote any bridge', () => {
  for (const bridge of QUANTUM_BRIDGE_AUDIT) {
    assert.equal(bridge.verdict, 'BLOCK', `${bridge.id} changed verdict`)
    assert.equal(bridge.promotionEligible, false)
  }
})

test('every bridge still carries an unresolved endpoint blocker', () => {
  // This is what holds the batch at BLOCK. Source verification improving must
  // not be mistaken for the corpus gap closing.
  for (const bridge of QUANTUM_BRIDGE_AUDIT) {
    assert.ok(
      bridge.blockerCodes.includes('endpoint-unresolved-record'),
      `${bridge.id} no longer names an unresolved endpoint`,
    )
  }
})

test('bridges whose sources are now fully located still cannot be promoted', () => {
  for (const bridge of QUANTUM_BRIDGE_AUDIT) {
    const located = ['A', 'B'].every((side) => ledgerEntry(bridge.id, side as 'A' | 'B').locator)
    if (!located) continue
    assert.equal(bridge.promotionEligible, false, `${bridge.id} was promoted on locators alone`)
  }
})
