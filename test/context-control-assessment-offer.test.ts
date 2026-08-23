import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  ASSESSMENT_EXCLUSIONS,
  ASSESSMENT_SCOPE,
  ASSESSMENT_TIERS,
  FOUNDING_PARTNER,
  POSITIONING,
  REQUIRED_PUBLIC_ARTIFACTS,
  missingPublicArtifacts,
} from '../lib/commercial/context-control-assessment-offer.ts'

const ROOT = join(import.meta.dirname, '..')
const page = () => readFileSync(join(ROOT, 'app/pricing/page.tsx'), 'utf8')

/**
 * The gate. At $12,500 a prospect is buying a method, and the only honest way
 * to ask for it is to let them read the method first. Keyed to artifacts on
 * disk, so it cannot be opened by deciding it is open.
 */
test('pricing may not appear unless every public artifact exists', () => {
  const missing = missingPublicArtifacts(ROOT)
  const source = page()
  if (missing.length > 0) {
    for (const tier of ASSESSMENT_TIERS) {
      assert.ok(!source.includes(tier.price), `page shows ${tier.price} while ${missing.join(', ')} are missing`)
    }
    assert.ok(!source.includes(FOUNDING_PARTNER.price))
  }
  assert.deepEqual(missing, [], `the evidence package is incomplete: ${missing.join(', ')}`)
})

test('every required artifact is a served public path', () => {
  assert.equal(REQUIRED_PUBLIC_ARTIFACTS.length, 4)
  for (const path of REQUIRED_PUBLIC_ARTIFACTS) {
    assert.match(path, /^public\//, `${path} is not served`)
    assert.ok(existsSync(join(ROOT, path)), `${path} is missing`)
  }
})

test('the published prices are exactly the agreed figures', () => {
  assert.equal(ASSESSMENT_TIERS[0].price, '$12,500')
  assert.equal(ASSESSMENT_TIERS[1].price, '$25,000')
  assert.equal(FOUNDING_PARTNER.price, '$2,500')
  const source = page()
  for (const price of ['$12,500', '$25,000', '$2,500']) assert.ok(source.includes(price) || source.includes('ASSESSMENT_TIERS') || source.includes('FOUNDING_PARTNER'))
  assert.ok(!source.includes('$5,000'), 'the superseded $5,000 price is still on the page')
})

test('the founding-partner rate states its cap and is never framed as a discount', () => {
  assert.match(FOUNDING_PARTNER.limit, /first two signed customers/)
  assert.match(FOUNDING_PARTNER.requirement, /named reference/)
  assert.match(FOUNDING_PARTNER.notADiscount, /not a general or negotiable discount/i)
  assert.match(FOUNDING_PARTNER.notADiscount, /closes after two customers/i)
  const source = page()
  assert.match(source, /FOUNDING_PARTNER\.limit/)
  assert.match(source, /FOUNDING_PARTNER\.notADiscount/)
  // The word "discount" may appear only in the denial.
  for (const match of source.matchAll(/discount/gi)) {
    const window = source.slice(Math.max(0, match.index - 90), match.index + 40)
    assert.ok(/not a general|notADiscount/.test(window), `"discount" used affirmatively near: ${window.trim().slice(-70)}`)
  }
})

test('the required scope items are all stated', () => {
  const scope = ASSESSMENT_SCOPE.join(' ')
  for (const [label, pattern] of [
    ['customer-supplied sanitized workload', /customer-supplied, sanitized/i],
    ['frozen configuration and digest', /frozen and digest-recorded/i],
    ['three-path comparison', /Three paths compared/i],
    ['token and cost', /Token and cost measurement/i],
    ['retention', /evidence retention/i],
    ['citations and provenance', /citations and provenance/i],
    ['latency', /latency/i],
    ['failure paths', /failure-path behaviour/i],
    ['sanitized findings + recommendation', /proceed, revise, or stop/i],
  ] as [string, RegExp][]) {
    assert.match(scope, pattern, `scope is missing: ${label}`)
  }
  assert.match(page(), /ASSESSMENT_SCOPE\.map/)
})

test('the WSO2-specific exclusions remain on the integration page, not the general offer', () => {
  const exclusions = ASSESSMENT_EXCLUSIONS.join(' ')
  for (const [label, pattern] of [
    ['no production deployment', /No production deployment/i],
    ['no performance or savings guarantee', /No performance or savings guarantee/i],
    ['no certification or compliance opinion', /No certification or compliance opinion/i],
    ['no WSO2 partnership or endorsement', /No WSO2 partnership, endorsement, or customer validation/i],
  ] as [string, RegExp][]) {
    assert.match(exclusions, pattern, `exclusion missing: ${label}`)
  }
  const wso2Page = readFileSync(join(ROOT, 'app/integrations/wso2/page.tsx'), 'utf8')
  assert.match(wso2Page, /Independent compatibility work, not a WSO2 endorsement/)
  assert.doesNotMatch(page(), /WSO2/)
})

/**
 * The dense baseline beats the production scorer on retention. Positioning
 * that claims otherwise would be contradicted by an artifact linked from the
 * same page.
 */
test('positioning rests on determinism and evidence, never on retention superiority', () => {
  const positioning = POSITIONING.join(' ').toLowerCase()
  for (const required of ['deterministic', 'budget', 'provenance', 'hash', 'reproducible']) {
    assert.ok(positioning.includes(required), `positioning is missing ${required}`)
  }
  for (const banned of ['best retention', 'highest retention', 'retention leader', 'outperform', 'superior']) {
    assert.ok(!positioning.includes(banned), `positioning claims "${banned}"`)
  }
  // And the page says so out loud rather than merely omitting it.
  assert.match(page(), /No retention-superiority claim is made here/)
  assert.match(page(), /scores higher on evidence retention than Maha/)
})

test('the offer links to its public sample assessment and security boundary', () => {
  const source = page()
  assert.match(source, /\/assessments\/context-control-evidence-assessment-sample\.pdf/)
  assert.match(source, /\/security\/context-control-security-boundary\.pdf/)
})

test('the call to action asks for a bounded assessment, not a general enquiry', () => {
  const source = page()
  assert.match(source, /Request a bounded assessment/i)
  assert.ok(!/\bContact us\b/i.test(source), 'the page falls back to a generic contact-us pitch')
})
