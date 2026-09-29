import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { buildCompanyProfile, buildCompanyPortfolioJsonLd, COMPANY_ACTIVITIES, COMPANY_BOUNDARIES, COMPANY_KNOWLEDGE_FIELDS, COMPANY_PORTFOLIO_PATH, COMPANY_PROFILE_DATE } from '../lib/company-profile.ts'
import { MAHA_DESCRIPTOR, MAHA_ORGANIZATION_ID, MAHA_SITE_URL } from '../lib/entity.ts'
import { GET } from '../app/company.json/route.ts'
import { buildLlmsManifest } from '../lib/llms-manifest.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
// Reuse the installed MCP SDK's schema validator only in tests; no new runtime dependency.
const requireFromSdk = createRequire(new URL('../node_modules/@modelcontextprotocol/sdk/package.json', import.meta.url))
const Ajv = requireFromSdk('ajv')
const addFormats = requireFromSdk('ajv-formats')
const validator = new Ajv({ allErrors: true, strict: true })
addFormats(validator)
const validate = validator.compile(JSON.parse(read('public/schemas/company-profile-1.0.json')))

test('public profile validates against its published schema, including negative controls', () => {
  assert.equal(validate(buildCompanyProfile()), true, JSON.stringify(validate.errors))
  const wrongStatus = structuredClone(buildCompanyProfile()) as unknown as { activities: { status: string }[] }
  wrongStatus.activities[2].status = 'clinically-validated'
  assert.equal(validate(wrongStatus), false)
  const missingBoundary = JSON.parse(JSON.stringify(buildCompanyProfile()))
  delete missingBoundary.activities[2].boundary
  assert.equal(validate(missingBoundary), false)
  assert.equal(validate({ ...buildCompanyProfile(), customerData: {} }), false)
})

test('company identity and all field identifiers are stable, unique and bounded', () => {
  const profile = buildCompanyProfile()
  assert.equal(profile.organization['@id'], MAHA_ORGANIZATION_ID)
  assert.equal(profile.description, MAHA_DESCRIPTOR)
  assert.equal(profile.asOf, COMPANY_PROFILE_DATE)
  assert.equal(profile.knowledgeFields.length, 24)
  assert.equal(new Set(profile.knowledgeFields.map((field) => field.id)).size, 24)
  assert.equal(new Set(profile.activities.map((activity) => activity.id)).size, profile.activities.length)
  for (const field of profile.knowledgeFields) {
    assert.ok(field.currentWork.length > 25)
    assert.ok(field.possibleDirection.length > 25)
    assert.equal(field.url, `${MAHA_SITE_URL}${COMPANY_PORTFOLIO_PATH}#field-${field.id}`)
  }
  assert.equal(profile.activities.find((a) => a.id === 'caldera')?.status, 'internal-simulation')
  assert.equal(profile.activities.find((a) => a.id === 'longevity-research')?.status, 'exploratory-research')
  assert.match(profile.activities.find((a) => a.id === 'longevity-research')!.boundary, /No Maha longevity intervention/)
})

test('custom JSON and standard JSON-LD share names, status and explicit limitations', () => {
  const graph = buildCompanyPortfolioJsonLd()
  const list = graph['@graph'][1]
  assert.ok('itemListElement' in list && list.itemListElement)
  assert.equal(list.numberOfItems, COMPANY_ACTIVITIES.length + COMPANY_KNOWLEDGE_FIELDS.length)
  for (const activity of COMPANY_ACTIVITIES) {
    const entry = list.itemListElement.find((item) => item.item.name === activity.name)!.item
    assert.equal(entry.creativeWorkStatus, activity.status)
    assert.ok(entry.description.includes(activity.boundary))
  }
  for (const field of COMPANY_KNOWLEDGE_FIELDS) {
    const entry = list.itemListElement.find((item) => item.item.name === field.name)!.item
    assert.equal(entry.creativeWorkStatus, field.state)
    assert.ok(entry.description.includes(field.currentWork))
    assert.ok(entry.description.includes(field.possibleDirection))
  }
})

test('GET returns a public JSON document without authentication or request-side effects', async () => {
  const response = GET()
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type')!, /application\/json/)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.match(response.headers.get('link')!, /rel="describedby"/)
  assert.equal(response.headers.get('set-cookie'), null)
  assert.deepEqual(await response.json(), buildCompanyProfile())
})

test('all outgoing product links exist locally and no private or unreleased routes leak', () => {
  for (const path of COMPANY_ACTIVITIES.flatMap((a) => [...a.links])) {
    const isDomain = path === '/knowledge/longevity-metabolism' && read('lib/frontier-domain-graphs.ts').includes("slug: 'longevity-metabolism'")
    assert.ok(isDomain || existsSync(new URL(`../app${path}/page.tsx`, import.meta.url)), path)
  }
  assert.doesNotMatch(JSON.stringify(buildCompanyProfile()), /\/Users\/|\/private\/|\.codex|bryan|brydiver|CogentFlow|NSGoods|\/knowledge\/physical-ai|\/knowledge\/nanotechnology/i)
  assert.ok(COMPANY_BOUNDARIES.some((b) => b.includes('indexing')))
  assert.ok(COMPANY_BOUNDARIES.some((b) => b.includes('clinical')))
})

test('existing discovery surfaces and sitemap link the same canonical profile', () => {
  const profileUrl = `${MAHA_SITE_URL}/company.json`
  const card = JSON.parse(read('content/discovery/agent-card.json'))
  assert.equal(card.companyProfile, profileUrl)
  const registry = JSON.parse(read('public/maha-machine-readable-registry.json'))
  assert.equal(registry.resources.find((r: { id: string }) => r.id === 'company-technology-profile').url, profileUrl)
  const guide = buildLlmsManifest([])
  assert.ok(guide.includes(profileUrl))
  assert.ok(guide.includes(MAHA_DESCRIPTOR))
  assert.ok(guide.includes(COMPANY_DIRECTION_TEXT()))
  assert.ok(read('app/sitemap.ts').includes('`${baseUrl}${COMPANY_PORTFOLIO_PATH}`'))
  assert.ok(read('app/layout.tsx').includes('href="/company.json"'))
})

function COMPANY_DIRECTION_TEXT() { return buildCompanyProfile().direction }
