import { strict as assert } from 'node:assert'

/**
 * Invariants over the regenerated uplift artifacts.
 *
 * These replace assertions that pinned a derived count. A pinned count breaks
 * whenever the corpus legitimately improves, so the failure carries no
 * information: the fix was always to edit the number, which means the assertion
 * was never protecting anything. Worse, it trains you to update expectations
 * rather than read them -- the exact reflex that lets a real regression through.
 *
 * Each property below states the rule the count was standing in for.
 */

type DepthAudit = {
  totalAudited: number
  corpusSize: number
  verdicts: { route: string; state: string }[]
  byGroup: Record<string, { audited: number; states: Record<string, number> }>
  depthDistribution: Record<string, number>
}

type UpliftReport = {
  pageStates: {
    legacyUnchanged: number; structurallyUplifted: number; firstPartyDocumented: number
    independentlySourceSupported: number; blocked: number; total: number
  }
  informationValue: { reproducibleCalculations: number; wordCountUsed: boolean }
}

type CompiledPages = { pages: { route: string; sections?: { dimension: string; items: string[] }[] }[] }

/**
 * First-party pages are counted in their own state and nowhere else.
 *
 * The count itself is derived and may move whenever a supplier page gains
 * documentation. What must hold is that the group is non-empty, that every page
 * in it carries a first-party depth state, and that it is never folded into
 * independent support.
 */
export function assertFirstPartyPartition(audit: DepthAudit, report: UpliftReport): void {
  const group = audit.byGroup.firstPartyDocumented
  assert.ok(group, 'the first-party group must exist')
  assert.ok(group.audited > 0, 'first-party pages must be counted somewhere')

  for (const state of Object.keys(group.states)) {
    assert.ok(state.startsWith('first-party-documented'),
      `${state} is counted in the first-party group but does not read as first-party`)
  }
  assert.equal(
    Object.values(group.states).reduce((a, b) => a + b, 0), group.audited,
    'the first-party states must account for every page in the group')

  // The two figures are produced by different code paths over the same corpus.
  assert.equal(group.audited, report.pageStates.firstPartyDocumented,
    'the depth audit and the uplift report disagree about how many pages are first-party')

  const supported = audit.byGroup.independentlySupported?.audited ?? 0
  assert.ok(!Object.keys(audit.byGroup.independentlySupported?.states ?? {})
    .some((s) => s.startsWith('first-party')),
    'a first-party page is being counted as independently supported')
  assert.ok(supported >= 0)
}

/** Every page state partition must account for the whole corpus, exactly once. */
export function assertStatesPartitionCorpus(audit: DepthAudit, report: UpliftReport): void {
  const s = report.pageStates
  assert.equal(
    s.legacyUnchanged + s.structurallyUplifted + s.firstPartyDocumented
    + s.independentlySourceSupported + s.blocked, s.total,
    'the five page states must sum to the corpus')

  assert.equal(Object.values(audit.depthDistribution).reduce((a, b) => a + b, 0), audit.totalAudited,
    'the depth distribution must sum to the audited total')
  assert.equal(audit.totalAudited, audit.corpusSize,
    'the denominator must be the corpus, not a sample')
  assert.equal(new Set(audit.verdicts.map((v) => v.route)).size, audit.verdicts.length,
    'each page must be audited exactly once')
  assert.equal(audit.verdicts.length, audit.totalAudited)
}

/**
 * A rendered calculation must be reproducible, rather than absent.
 *
 * The old assertion pinned the count to zero, so adding a legitimate
 * calculation -- a stated goal -- would have failed the suite. What matters is
 * that anything rendered carries the inputs to reproduce it.
 */
export function assertCalculationsAreReproducible(report: UpliftReport, compiled: CompiledPages): void {
  assert.equal(report.informationValue.wordCountUsed, false, 'word count must never become a gate')

  const rendered = compiled.pages.flatMap((page) =>
    (page.sections ?? []).filter((s) => s.dimension === 'deterministic-calculation')
      .map((s) => ({ route: page.route, items: s.items })))

  assert.equal(rendered.length, report.informationValue.reproducibleCalculations,
    'the reported calculation count must match what is actually rendered')

  for (const calc of rendered) {
    assert.ok(calc.items.length >= 3,
      `${calc.route} renders a calculation with too few steps to reproduce`)
    const text = calc.items.join(' ')
    assert.ok(/=|→|->/.test(text),
      `${calc.route} renders a calculation with no visible derivation`)
  }
}

/** The uplift may deepen a page. It may never add or move a route. */
export function assertNoRouteChange(report: { routesChanged: number; duplicatePagesAdded: number }): void {
  assert.equal(report.routesChanged, 0, 'the uplift must not change any route')
  assert.equal(report.duplicatePagesAdded, 0, 'the uplift must not add a duplicate page')
}
