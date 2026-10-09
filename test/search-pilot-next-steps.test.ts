import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { pilotNextSteps } from '../lib/search-pilot-next-steps.ts'
import { SEARCH_CLICK_PILOT } from '../lib/search-click-pilot.ts'
import { EVIDENCE_COMMERCIAL_OFFERS } from '../lib/evidence-commercial-offers.ts'
import { getMathematicalConcept } from '../lib/mathematics-knowledge.ts'
import { parsePublicConversionEvent } from '../lib/conversion-measurement.ts'

test('only the ten pilot pages receive offers', () => {
  for (const path of Object.keys(SEARCH_CLICK_PILOT)) assert.ok(pilotNextSteps(path))
  assert.equal(pilotNextSteps('/knowledge/control'), null)
  assert.equal(pilotNextSteps('/knowledge/mathematics/gamma-function?claim=private'), null)
})

test('all displayed offer details derive from the commercial registry', () => {
  for (const path of Object.keys(SEARCH_CLICK_PILOT)) {
    for (const shown of pilotNextSteps(path)!.offers) {
      const offer = Object.values(EVIDENCE_COMMERCIAL_OFFERS).find((entry) => entry.offerId === shown.id)!
      assert.equal(shown.name, offer.name)
      assert.equal(shown.href, offer.path)
      assert.equal(shown.scope, offer.scope)
      assert.equal(shown.boundary, offer.evidenceBoundary)
      assert.equal(shown.price, offer.priceUsd ? `$${offer.priceUsd} USD` : 'Free')
      if (offer.state === 'qualification-first-purchase-disabled') assert.match(shown.action, /purchase unavailable/)
    }
  }
})

test('context distinguishes document triage from source-inspection scoping', () => {
  assert.equal(pilotNextSteps('/knowledge/religion/textual-authority')!.offers[1].id, 'mps-preflight')
  assert.equal(pilotNextSteps('/knowledge/mathematics/gamma-function')!.offers[1].id, 'verified-evidence-dossier')
  assert.match(pilotNextSteps('/knowledge/astrology/calculations/placidus-houses')!.resource.href, /calculations$/)
})

test('pilot click names are accepted as unverified CTA events, with unknown experiment', () => {
  for (const path of Object.keys(SEARCH_CLICK_PILOT)) {
    const steps = pilotNextSteps(path)!
    for (const eventName of [...steps.offers.map((entry) => entry.event), steps.resource.event, 'cta_pilot_source_locator']) {
      const parsed = parsePublicConversionEvent({ eventId: 'conv_12345678-1234-1234-1234-123456789012', eventType: 'cta_click', eventName, sourcePath: path, experimentId: null })
      assert.equal(parsed.experimentId, null)
      assert.equal(parsed.eventType, 'cta_click')
      assert.deepEqual(Object.keys(parsed).sort(), ['eventId', 'eventName', 'eventType', 'experimentId', 'sourcePath'].sort())
    }
  }
})

test('two source panels map to existing claims, not synthesized verification results', () => {
  for (const [slug, locator] of [['gamma-function', '5.5.1'], ['incomplete-gamma-functions', '8.2.1']]) {
    assert.ok(getMathematicalConcept(slug)!.invariants.some((claim) => claim.includes(locator)))
  }
  const panel = readFileSync(new URL('../components/SearchPilotSources.tsx', import.meta.url), 'utf8')
  assert.match(panel, /not a new expert review/)
  assert.match(panel, /does not prove the claim true/)
  assert.doesNotMatch(panel, /EMPIRICALLY_VERIFIED|signed receipt.*sha256:/)
})

test('runtime components do not import private records or attach submitted content', () => {
  for (const file of ['components/SearchPilotSources.tsx', 'components/SearchPilotNextSteps.tsx', 'lib/search-pilot-next-steps.ts']) {
    const code = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(code, /from ['"].*(?:content\/|inspection-record|review-packet)|localStorage|sessionStorage|document\.cookie|document\.referrer/)
  }
})
