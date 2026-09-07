import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

/**
 * A route candidate may not be reported evidence-ready unless some artifact
 * records a review that made it so.
 *
 * The v5 replacement pass introduced four candidates to take the place of four
 * rejected as semantically duplicative. Their own recovery record states the
 * precondition — "Adopt replacement <id> after exact-revision review" — and
 * that review is in no decisions artifact. The unified ledger nonetheless
 * carries them as evidence-ready and implementation-ready, inside the
 * implementation-ready count.
 *
 * This guard fails today, deliberately. It is the gap, written down and
 * executable, rather than a note in a report. Closing it means either
 * recording the exact-revision review those four are waiting on, or marking
 * them awaiting-review in the ledger until it happens. Silencing the guard is
 * neither.
 *
 * The review index below is deliberately generous: every artifact that records
 * a per-candidate outcome counts, across all three vocabularies and both
 * numbering series. A candidate reported ready without a review record has not
 * been reviewed under any naming this repository uses.
 */

const F = 'content/federation'
const read = (name: string) => JSON.parse(readFileSync(`${F}/${name}`, 'utf8'))
const has = (name: string) => existsSync(`${F}/${name}`)

/** The ledger this guard checks. Asserted below to still be the newest. */
const LATEST_LEDGER_VERSION = 5

/**
 * Every artifact that records a per-candidate review outcome.
 *
 * Candidate-map tranches 1-18 use entries[].disposition or
 * decisions[].finalState, with 11 and 12 filed under a -mythology- name.
 * Readiness tranches 19-22 use decisions[].decision. The two authority
 * artifacts use finalState and finalDecision, the latter keyed by
 * graphObjectId rather than candidateId.
 */
function reviewIndex(): Map<string, string> {
  const reviewed = new Map<string, string>()
  const record = (id: string | undefined, source: string) => {
    if (id && !reviewed.has(id)) reviewed.set(id, source)
  }

  for (let n = 1; n <= 18; n += 1) {
    for (const name of [
      `federation-tranche-${n}-decisions-v1.json`,
      `federation-tranche-${n}-mythology-decisions-v1.json`,
    ]) {
      if (!has(name)) continue
      const d = read(name)
      for (const row of d.decisions ?? d.entries ?? []) record(row.candidateId, name)
    }
  }

  for (let n = 19; n <= 40; n += 1) {
    const name = `federation-readiness-tranche-${n}-decisions-v1.json`
    if (!has(name)) continue
    const d = read(name)
    for (const row of d.decisions ?? d.entries ?? []) {
      if (row.decision !== undefined || row.finalState !== undefined) record(row.candidateId, name)
    }
  }

  const reassessment = 'federation-authority-application-reassessment-v1.json'
  if (has(reassessment)) {
    for (const row of read(reassessment).reassessments ?? []) record(row.candidateId, reassessment)
  }
  const definitionReviews = 'federation-authority-definition-reviews-v1.json'
  if (has(definitionReviews)) {
    for (const row of read(definitionReviews).reviews ?? []) record(row.graphObjectId, definitionReviews)
  }

  return reviewed
}

test('the guard checks the newest ledger, not a stale one', () => {
  const next = `federation-unified-readiness-ledger-v${LATEST_LEDGER_VERSION + 1}.json`
  assert.ok(
    !has(next),
    `${next} exists; LATEST_LEDGER_VERSION is stale and this guard is checking an superseded ledger.`,
  )
  assert.ok(has(`federation-unified-readiness-ledger-v${LATEST_LEDGER_VERSION}.json`))
})

test('no candidate is reported evidence-ready without a recorded review', () => {
  const ledger = read(`federation-unified-readiness-ledger-v${LATEST_LEDGER_VERSION}.json`)
  const reviewed = reviewIndex()
  assert.ok(reviewed.size > 1400, `review index looks wrong: only ${reviewed.size} candidates found`)

  const unreviewed = (ledger.entries as { candidateId: string; state: string; path: string; origin?: string }[])
    .filter((e) => e.state === 'evidence-ready' && !reviewed.has(e.candidateId))

  assert.deepEqual(
    unreviewed.map((e) => `${e.candidateId} ${e.path} (origin: ${e.origin ?? 'unrecorded'})`),
    [],
    'Candidates are reported evidence-ready with no review recorded in any decisions or reassessment artifact. ' +
      'federation-readiness-recovery-priority-v1.json states the precondition for the v5 replacements: "Adopt ' +
      'replacement <id> after exact-revision review." Record that review, or mark these awaiting-review in the ' +
      'ledger until it exists.',
  )
})

test('no candidate is reported implementation-ready without a recorded review', () => {
  const ledger = read(`federation-unified-readiness-ledger-v${LATEST_LEDGER_VERSION}.json`)
  const reviewed = reviewIndex()

  const unreviewed = (ledger.entries as { candidateId: string; implementationState: string; path: string }[])
    .filter((e) => e.implementationState === 'implementation-ready' && !reviewed.has(e.candidateId))

  assert.deepEqual(unreviewed.map((e) => `${e.candidateId} ${e.path}`), [],
    'Candidates are counted implementation-ready with no review recorded. Implementation readiness cannot ' +
      'outrun review: a specification prepared for an unreviewed candidate is a plan, not a readiness finding.')
})

/**
 * The rule must be capable of failing, and capable of passing. A guard that
 * cannot distinguish the two states proves nothing about either.
 */
test('the guard distinguishes reviewed from unreviewed', () => {
  const reviewed = reviewIndex()
  const ledger = read(`federation-unified-readiness-ledger-v${LATEST_LEDGER_VERSION}.json`)
  const entries = ledger.entries as { candidateId: string; state: string }[]

  const ready = entries.filter((e) => e.state === 'evidence-ready')
  assert.ok(ready.some((e) => reviewed.has(e.candidateId)), 'no evidence-ready candidate has a review — index broken')
  assert.ok(!reviewed.has('cand_not_a_real_candidate'), 'the index must not report unknown ids as reviewed')
})
