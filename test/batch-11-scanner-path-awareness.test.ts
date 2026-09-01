import assert from 'node:assert/strict'
import test from 'node:test'

import { STATIC_POLICY_EXEMPTIONS, scanForProhibitedContent } from '../lib/batch-11-evidence-verifier.ts'

/**
 * The exemption is one literal at one path, and must stay that narrow.
 *
 * Run 33505731891 succeeded and was refused as leaking private corpus. What it
 * actually carried was its own promise not to: "no audit corpus, review packet,
 * credential or private evidence enters a served bundle". The scanner cannot
 * tell a promise from the thing promised against, so it flagged the policy.
 *
 * These pin the shape of the fix. Widening it into a pattern, or letting it
 * understand negation, would make every one of these pass - which is why they
 * are written as the ways the exemption could be abused rather than as a
 * restatement of what it permits.
 */

const POLICY = STATIC_POLICY_EXEMPTIONS[0]
const EXCERPT = 'reject-or-hold: the reviewer wrote that the source does not support the claim'
const trusted = { digestVerified: true }

/** The artifact shape the exemption is anchored to. */
const wrapped = (invariants: unknown) => ({ artifact: { requiredInvariants: invariants }, checks: [], teardown: null })

test('the exemption is a single exact literal at a single exact path', () => {
  assert.equal(STATIC_POLICY_EXEMPTIONS.length, 1)
  assert.equal(POLICY.path, 'artifact.requiredInvariants[]')
  assert.equal(POLICY.text, 'no audit corpus, review packet, credential or private evidence enters a served bundle')
})

test('the exact invariant at its exact path is not content', () => {
  const scanned = scanForProhibitedContent(wrapped(['some other invariant', POLICY.text]), trusted)
  assert.deepEqual(scanned.sensitive, [])
  assert.deepEqual(scanned.secrets, [])
})

/* --- the five ways it must still fail ------------------------------------- */

test('the same text in another field still fails', () => {
  for (const forged of [
    { artifact: { reason: POLICY.text }, checks: [], teardown: null },
    { artifact: { requiredInvariants: { nested: [POLICY.text] } }, checks: [], teardown: null },
    { artifact: { notes: { requiredInvariants: [POLICY.text] } }, checks: [], teardown: null },
    { checks: [{ detail: POLICY.text }], artifact: {}, teardown: null },
  ]) {
    assert.deepEqual(scanForProhibitedContent(forged, trusted).sensitive, ['private corpus excerpt'],
      `${JSON.stringify(forged).slice(0, 70)} must still be scanned`)
  }
})

test('appended content still fails', () => {
  for (const appended of [
    `${POLICY.text}.`,
    `${POLICY.text} ${EXCERPT}`,
    `${EXCERPT} ${POLICY.text}`,
    ` ${POLICY.text}`,
    POLICY.text.replace('bundle', 'bundle '),
    POLICY.text.toUpperCase(),
  ]) {
    assert.deepEqual(scanForProhibitedContent(wrapped([appended]), trusted).sensitive, ['private corpus excerpt'],
      `${JSON.stringify(appended).slice(0, 60)} must still be scanned`)
  }
})

test('a private excerpt beside the exact invariant still fails', () => {
  // The permitted sentence is redacted; its neighbour is not.
  const scanned = scanForProhibitedContent(wrapped([POLICY.text, EXCERPT]), trusted)
  assert.deepEqual(scanned.sensitive, ['private corpus excerpt'])
})

test('a substituted path still fails', () => {
  for (const path of ['requiredInvariants', 'evidence.requiredInvariants', 'artifact.invariants', 'artifact.requiredInvariant']) {
    const forged: Record<string, unknown> = { checks: [], teardown: null, artifact: {} }
    const parts = path.split('.')
    let cursor = forged
    for (const [index, key] of parts.entries()) {
      if (index === parts.length - 1) cursor[key] = [POLICY.text]
      else { cursor[key] = cursor[key] ?? {}; cursor = cursor[key] as Record<string, unknown> }
    }
    assert.deepEqual(scanForProhibitedContent(forged, trusted).sensitive, ['private corpus excerpt'],
      `${path} must still be scanned`)
  }
})

test('an unverified digest gets no exemption at all', () => {
  // Requirement: the artifact must first prove it is the one the run produced.
  assert.deepEqual(scanForProhibitedContent(wrapped([POLICY.text])).sensitive, ['private corpus excerpt'])
  assert.deepEqual(scanForProhibitedContent(wrapped([POLICY.text]), { digestVerified: false }).sensitive,
    ['private corpus excerpt'])
})

/* --- everything else stays blocked, including at the exempt path ---------- */

test('every other category is still blocked at the exempt path itself', () => {
  const cases: [unknown, string][] = [
    [EXCERPT, 'private corpus excerpt'],
    ['the review packet is attached', 'private corpus excerpt'],
    ['participantEmail was recorded', 'participant data'],
    ['natal chart for the enquiry', 'natal data'],
    ['customerName: A Person', 'customer data'],
    ['paymentIntent pi_123', 'payment data'],
    ['someone@example.com', 'email address'],
  ]
  for (const [text, expected] of cases) {
    const scanned = scanForProhibitedContent(wrapped([POLICY.text, text]), trusted)
    assert.ok(scanned.sensitive.includes(expected), `${JSON.stringify(text)} must be flagged as ${expected}`)
  }
})

test('secret shapes are blocked everywhere, exempt path included', () => {
  const secrets = [
    ['sbp', '_', 'a'.repeat(40)].join(''),
    `Bearer ${'b'.repeat(40)}`,
    `eyJ${'c'.repeat(30)}.${'d'.repeat(30)}.${'e'.repeat(30)}`,
    'postgresql://user:hunter2@db.abcdefghijklmnopqrst.supabase.co:5432/postgres',
    'https://abcdefghijklmnopqrst.supabase.co',
  ]
  for (const secret of secrets) {
    const scanned = scanForProhibitedContent(wrapped([POLICY.text, secret]), trusted)
    assert.ok(scanned.secrets.length > 0, `${secret.slice(0, 28)} must be flagged as secret-shaped`)
  }
})

test('key-based rules survive the redaction rewrite', () => {
  // Redaction rebuilds the object, so a rule that matches a JSON key rather
  // than a value would be silently lost if values alone were scanned.
  const scanned = scanForProhibitedContent(
    { artifact: { requiredInvariants: [POLICY.text], authorizationBasis: 'anything' }, checks: [], teardown: null },
    trusted,
  )
  assert.ok(scanned.sensitive.includes('unhashed authority value'), 'key-matching rules must still fire')
})

test('redaction preserves structure, so nothing hides behind it', () => {
  // Object shape, array length and sibling values are all unchanged; only the
  // one permitted literal becomes a placeholder that matches no rule.
  const before = wrapped([POLICY.text, 'harmless', EXCERPT])
  const scanned = scanForProhibitedContent(before, trusted)
  assert.deepEqual(scanned.sensitive, ['private corpus excerpt'], 'the excerpt two places along must survive redaction')
  assert.deepEqual((before.artifact.requiredInvariants as string[]).length, 3, 'the input must not be mutated')
  assert.equal((before.artifact.requiredInvariants as string[])[0], POLICY.text)
})
