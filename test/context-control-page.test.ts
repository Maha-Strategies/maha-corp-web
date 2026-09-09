import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  ASSESSMENT_TIERS,
  FOUNDING_PARTNER,
  REQUIRED_PUBLIC_ARTIFACTS,
} from '../lib/commercial/context-control-assessment-offer.ts'

/**
 * Derived here rather than imported. The `missingPublicArtifacts` helper is
 * mid-move between the offer module and a separate operator-side evidence
 * module, so importing it from either location would break this file on one
 * side of that refactor. `REQUIRED_PUBLIC_ARTIFACTS` is stable in both.
 */
function missingPublicArtifacts(root: string): string[] {
  return REQUIRED_PUBLIC_ARTIFACTS.filter((path) => !existsSync(join(root, path)))
}

/**
 * The dedicated assessment landing page. `context-control-assessment-offer.test.ts`
 * holds the same constraints for `/pricing`, which lists this offer among many;
 * this file covers the page whose only subject is the assessment, because that
 * is the page a five-figure prospect actually lands on.
 */
const ROOT = join(import.meta.dirname, '..')
const page = () => readFileSync(join(ROOT, 'app/context-control/page.tsx'), 'utf8')

/** The gate. A price may not appear unless the method is readable first. */
test('the landing page may not show a price unless every public artifact exists', () => {
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

/**
 * The gate is only meaningful if the buyer can reach the artifacts from the
 * page that asks for the money. Checking existence on disk is not enough.
 */
test('every required artifact is linked from the page that asks for the fee', () => {
  const source = page()
  for (const path of REQUIRED_PUBLIC_ARTIFACTS) {
    const served = path.replace(/^public/, '')
    assert.ok(source.includes(served), `${served} is not linked from the landing page`)
  }
})

test('prices are rendered from the offer data, never retyped', () => {
  const source = page()
  assert.match(source, /ASSESSMENT_TIERS\.map/)
  assert.match(source, /FOUNDING_PARTNER\.price/)
  for (const literal of ['$12,500', '$25,000', '$2,500']) {
    assert.ok(!source.includes(literal), `${literal} is hardcoded instead of read from the offer module`)
  }
})

test('the founding rate states its cap and is never framed as a discount', () => {
  const source = page()
  assert.match(source, /FOUNDING_PARTNER\.limit/)
  assert.match(source, /FOUNDING_PARTNER\.notADiscount/)
  for (const match of source.matchAll(/discount/gi)) {
    const window = source.slice(Math.max(0, match.index - 90), match.index + 40)
    assert.ok(/not a general|notADiscount/.test(window), `"discount" used affirmatively near: ${window.trim().slice(-70)}`)
  }
})

test('scope and positioning are rendered from the offer data', () => {
  const source = page()
  assert.match(source, /ASSESSMENT_SCOPE\.map/)
  assert.match(source, /POSITIONING\.map/)
})

/**
 * The dense baseline beats the production scorer on retention, and it is one
 * of the four artifacts this page links. Claiming retention superiority here
 * would be contradicted by a document reachable in one click.
 */
test('positioning never claims retention superiority, and says so out loud', () => {
  const source = page()
  assert.match(source, /No retention-superiority claim is made here/)
  assert.match(source, /scores higher on evidence retention than Maha/)
  for (const banned of ['best retention', 'highest retention', 'retention leader', 'outperform', 'industry-leading']) {
    assert.ok(!source.toLowerCase().includes(banned), `the page claims "${banned}"`)
  }
})

/**
 * The vendor-specific denial lives on the integration page, where the gateway
 * is named. Repeating the vendor here would introduce the association the
 * exclusion exists to deny, so the general offer restates its limits without it.
 *
 * The one permitted occurrence is inside the evidence artifact's own URL, which
 * the gate requires this page to link. A file path is not a claim, and stating
 * the exception explicitly is better than a case-sensitive check that would let
 * vendor prose through in lower case.
 */
test('the general offer does not trade on the gateway vendor name', () => {
  const withoutArtifactHref = page().replaceAll('/benchmarks/wso2/live-evaluation-evidence.json', '')
  assert.doesNotMatch(withoutArtifactHref, /wso2/i)
})

test('the page states the exclusions a measurement buyer needs before paying', () => {
  const source = page()
  for (const [label, pattern] of [
    ['no production deployment', /No production deployment/i],
    ['no performance or savings guarantee', /No performance or savings guarantee/i],
    ['no certification or compliance opinion', /No certification or compliance opinion/i],
  ] as [string, RegExp][]) {
    assert.match(source, pattern, `exclusion missing: ${label}`)
  }
})

test('the call to action asks for a bounded assessment, not a general enquiry', () => {
  const source = page()
  assert.match(source, /Request a bounded assessment/i)
  assert.ok(!/\bContact us\b/i.test(source), 'the page falls back to a generic contact-us pitch')
})

/** A landing page nobody can reach is the problem this page was built to fix. */
test('the route is discoverable from the sitemap and from /pricing', () => {
  const sitemap = readFileSync(join(ROOT, 'app/sitemap.ts'), 'utf8')
  assert.match(sitemap, /\$\{baseUrl\}\/context-control/, 'the route is missing from the sitemap')
  const pricing = readFileSync(join(ROOT, 'app/pricing/page.tsx'), 'utf8')
  assert.match(pricing, /href="\/context-control"/, '/pricing does not link to the assessment page')
})

test('the page declares its canonical URL', () => {
  assert.match(page(), /canonical: '\/context-control'/)
})
