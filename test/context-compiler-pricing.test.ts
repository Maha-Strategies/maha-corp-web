import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_METERED_CREDITS_PER_CALL,
  TOKENS_SAVED_PER_CREDIT,
  buildBillingDisclosure,
  meteredBillingEnabled,
  parseCallerCeiling,
  quoteMeteredCredits,
} from '../lib/context-compiler-pricing.ts'

// A flat per-request price is wrong in both directions: too expensive for a
// 2 KB retrieval payload and nearly free for a 300 KB agent trace, which is
// exactly backwards, since the large call is the valuable one. These tests fix
// the properties that make charging on measured saving defensible rather than
// merely favourable to us.

test('a call that saved nothing costs nothing extra', () => {
  assert.equal(quoteMeteredCredits({ tokensSaved: 0 }).meteredCredits, 0)
})

test('a workload the compiler made worse is never billed for the damage', () => {
  // Measured negative-reduction workloads exist -- scraped pages at -19.3%,
  // tabular data at -58.0%. `tokensSaved` floors at zero upstream; this floors
  // again rather than trusting that, because a negative charge or a charge for
  // harm is the failure that would matter.
  for (const tokensSaved of [-1, -5_000, -1_000_000]) {
    assert.equal(quoteMeteredCredits({ tokensSaved }).meteredCredits, 0)
  }
})

test('only whole units of saving are charged, so there is no rounding cliff', () => {
  // One token short of a unit is free, not rounded up into a full credit.
  assert.equal(quoteMeteredCredits({ tokensSaved: TOKENS_SAVED_PER_CREDIT - 1 }).meteredCredits, 0)
  assert.equal(quoteMeteredCredits({ tokensSaved: TOKENS_SAVED_PER_CREDIT }).meteredCredits, 1)
  assert.equal(quoteMeteredCredits({ tokensSaved: TOKENS_SAVED_PER_CREDIT * 2 - 1 }).meteredCredits, 1)
  assert.equal(quoteMeteredCredits({ tokensSaved: TOKENS_SAVED_PER_CREDIT * 3 }).meteredCredits, 3)
})

test('the benchmark mean case is covered by the flat credit alone', () => {
  // MCRB-1 measured 4,935.1 tokens avoided on average. Under this model the
  // typical retrieval call adds nothing, and the meter only engages where the
  // saving is genuinely large. That is the intended shape, recorded so a
  // future rate change has to face it deliberately.
  assert.equal(quoteMeteredCredits({ tokensSaved: 4_935 }).meteredCredits, 0)
})

test('the published large-document recipe bills what its saving earns', () => {
  // 22,340 -> 5,733 estimated tokens, so 16,607 saved: three whole units.
  assert.equal(quoteMeteredCredits({ tokensSaved: 16_607 }).meteredCredits, 3)
})

test('one call can never exceed the service ceiling', () => {
  const quote = quoteMeteredCredits({ tokensSaved: 100_000_000 })
  assert.equal(quote.meteredCredits, MAX_METERED_CREDITS_PER_CALL)
  assert.equal(quote.appliedCeiling, MAX_METERED_CREDITS_PER_CALL)
  // Hitting the service ceiling is not the caller's cap being applied.
  assert.equal(quote.cappedByCaller, false)
})

test('a caller can bind its own spend below the service ceiling', () => {
  const quote = quoteMeteredCredits({ tokensSaved: TOKENS_SAVED_PER_CREDIT * 10, callerCeiling: 2 })
  assert.equal(quote.meteredCredits, 2)
  assert.equal(quote.cappedByCaller, true)
})

test('a caller ceiling cannot be used to raise the service ceiling', () => {
  const quote = quoteMeteredCredits({ tokensSaved: 100_000_000, callerCeiling: 10_000 })
  assert.equal(quote.meteredCredits, MAX_METERED_CREDITS_PER_CALL)
})

test('a caller ceiling of zero means zero, not absent', () => {
  const quote = quoteMeteredCredits({ tokensSaved: TOKENS_SAVED_PER_CREDIT * 5, callerCeiling: 0 })
  assert.equal(quote.meteredCredits, 0)
})

test('a malformed ceiling header is absent, never zero and never unlimited', () => {
  // Reading a typo as "charge me nothing" would make the meter avoidable by
  // sending junk; reading it as "no limit" would discard an instruction the
  // caller meant. Absent is the only safe reading, and the documented default
  // then applies.
  for (const value of ['', ' ', 'abc', '-1', '1.5', '1e3', 'null', '٣']) {
    assert.equal(parseCallerCeiling(value), null, `expected ${JSON.stringify(value)} to parse as absent`)
  }
  assert.equal(parseCallerCeiling(null), null)
  assert.equal(parseCallerCeiling('0'), 0)
  assert.equal(parseCallerCeiling(' 12 '), 12)
})

test('a non-finite saving is treated as no saving', () => {
  for (const tokensSaved of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(quoteMeteredCredits({ tokensSaved }).meteredCredits, 0)
  }
})

test('metered billing is off unless a deployment turns it on exactly', () => {
  // Existing keys were sold as one credit per request. Nobody's burn rate
  // changes because a deploy shipped.
  assert.equal(meteredBillingEnabled({} as NodeJS.ProcessEnv), false)
  for (const value of ['', 'false', 'TRUE', '1', 'yes', ' true']) {
    assert.equal(
      meteredBillingEnabled({ CONTEXT_COMPILER_METERED_BILLING: value } as unknown as NodeJS.ProcessEnv),
      value === ' true',
      `expected ${JSON.stringify(value)} not to enable billing`,
    )
  }
  assert.equal(meteredBillingEnabled({ CONTEXT_COMPILER_METERED_BILLING: 'true' } as unknown as NodeJS.ProcessEnv), true)
})

test('the charge never exceeds a tenth of the value it prices', () => {
  // The rate has to stay obviously favourable to the buyer or the product's
  // own argument -- call this when calling it is cheaper -- stops holding. At
  // $0.002 per credit and a $3/M reference input price, one credit prices
  // $0.015 of avoided cost.
  const creditUsd = 0.002
  const referenceInputUsdPerToken = 3 / 1_000_000
  for (const tokensSaved of [5_000, 50_000, 300_000]) {
    const { meteredCredits } = quoteMeteredCredits({ tokensSaved })
    const charged = meteredCredits * creditUsd
    const valueAvoided = tokensSaved * referenceInputUsdPerToken
    assert.ok(charged <= valueAvoided * 0.15, `charged ${charged} against ${valueAvoided} avoided`)
  }
})

// ---------------------------------------------------------------------------
// The disclosure returned to the caller
// ---------------------------------------------------------------------------

const quoteFor = (tokensSaved: number, callerCeiling?: number) =>
  quoteMeteredCredits({ tokensSaved, callerCeiling })

test('a disclosure reports what was taken, never what was owed', () => {
  // The failure this prevents: reporting an intended charge as a real one, so
  // the caller reconciles against a ledger that disagrees. The block exists to
  // be checkable, which it is not if it reports intentions.
  const quote = quoteFor(TOKENS_SAVED_PER_CREDIT * 3)
  assert.equal(quote.meteredCredits, 3)

  const failed = buildBillingDisclosure({ quote, enabled: true, charge: { kind: 'unavailable' } })
  assert.equal(failed.meteredCredits, 0)
  assert.equal(failed.unbilledReason, 'ledger_unavailable')

  const succeeded = buildBillingDisclosure({ quote, enabled: true, charge: { kind: 'charged', remainingCredits: 97 } })
  assert.equal(succeeded.meteredCredits, 3)
  assert.equal(succeeded.remainingCredits, 97)
})

test('a depleted balance is distinguishable from an unreadable ledger', () => {
  // One says the customer is out of credit and should buy more; the other says
  // our infrastructure failed and they owe nothing. Conflating them bills the
  // wrong party's problem to the customer.
  const quote = quoteFor(TOKENS_SAVED_PER_CREDIT * 2)
  assert.equal(
    buildBillingDisclosure({ quote, enabled: true, charge: { kind: 'depleted' } }).unbilledReason,
    'credit_balance_depleted',
  )
  assert.equal(
    buildBillingDisclosure({ quote, enabled: true, charge: { kind: 'unavailable' } }).unbilledReason,
    'ledger_unavailable',
  )
})

test('while disabled nothing is charged, but the model is still shown', () => {
  const disclosure = buildBillingDisclosure({ quote: quoteFor(TOKENS_SAVED_PER_CREDIT * 4), enabled: false })
  assert.equal(disclosure.model, 'flat')
  assert.equal(disclosure.meteredCredits, 0)
  assert.equal(disclosure.flatCredits, 1)
  // An operator can read what the meter would have cost before enabling it.
  assert.equal(disclosure.unbilledReason, 'billing_disabled')
  assert.equal(disclosure.tokensSaved, TOKENS_SAVED_PER_CREDIT * 4)
})

test('a call with no saving discloses a flat charge and no complaint', () => {
  const disclosure = buildBillingDisclosure({ quote: quoteFor(10), enabled: true })
  assert.equal(disclosure.model, 'flat_plus_metered')
  assert.equal(disclosure.meteredCredits, 0)
  assert.equal(disclosure.unbilledReason, undefined)
})

test("a caller's own cap is disclosed rather than applied silently", () => {
  const disclosure = buildBillingDisclosure({
    quote: quoteFor(TOKENS_SAVED_PER_CREDIT * 10, 2),
    enabled: true,
    charge: { kind: 'charged', remainingCredits: 500 },
  })
  assert.equal(disclosure.meteredCredits, 2)
  assert.equal(disclosure.unbilledReason, 'capped_by_caller')
})

test('a ledger that reports no remaining balance omits the field rather than guessing zero', () => {
  const disclosure = buildBillingDisclosure({
    quote: quoteFor(TOKENS_SAVED_PER_CREDIT),
    enabled: true,
    charge: { kind: 'charged', remainingCredits: null },
  })
  assert.equal(disclosure.meteredCredits, 1)
  assert.ok(!('remainingCredits' in disclosure), 'an unknown balance must not be reported as 0')
})
