/** Explicitly scoped post-publication checks; synthetic inputs only. */
import assert from 'node:assert/strict'
const origin = 'https://www.mahastrategies.com'
async function get(path: string) {
  const response = await fetch(origin + path)
  assert.equal(response.status, 200, path)
  return response.text()
}
const guidePath = '/knowledge/astrology/reading-guide'
for (const path of ['/knowledge/birth', guidePath, '/knowledge/astrology']) {
  const html = await get(path)
  assert.ok(html.includes(`rel="canonical" href="${origin}${path}"`), `canonical ${path}`)
  assert.ok(!/<meta name="robots" content="[^"]*noindex/.test(html), path)
  if (path !== guidePath) assert.ok(html.includes(`href="${guidePath}"`))
  else { assert.ok(html.includes('synthetic fixture')); assert.ok(html.includes('href="/knowledge/birth"')) }
}
const sitemap = await get('/sitemap.xml')
assert.equal(sitemap.split(`<loc>${origin}${guidePath}</loc>`).length - 1, 1)
assert.ok(sitemap.includes(`<loc>${origin}/knowledge/birth</loc>`))
assert.ok(!sitemap.includes('/api/v1/interpretations/'))
const input = { date: '2000-01-01', time: '12:00', timeZone: 'UTC', latitudeDegrees: 0,
  longitudeDegrees: 0, birthTimeUncertaintyMinutes: 0, timingInstantUtc: '2026-09-14T12:00:00.000Z' }
async function report(uncertainty: number) {
  const response = await fetch(origin + '/api/v1/interpretations/jyotisha/basic', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, birthTimeUncertaintyMinutes: uncertainty }),
  })
  assert.equal(response.status, 200, 'free report')
  assert.match(response.headers.get('cache-control') || '', /no-store/)
  assert.match(response.headers.get('x-robots-tag') || '', /noindex/)
  return response.json()
}
const nominal = await report(0)
assert.equal(nominal.reading.educational.profile, 'iyer-symbolic-reflection/0.1')
assert.equal(nominal.reading.educational.sections.length, 4)
assert.equal(nominal.reading.educational.planetary.length, 9)
assert.equal(nominal.reading.educational.predictiveValidation, false)
const uncertain = await report(30)
assert.ok(uncertain.reading.educational.sections.every((s: { status: string }) => s.status === 'nominal-study-only'))
const policy = await fetch('https://policy.mahastrategies.com')
assert.equal(policy.status, 200, 'Policy host remains available')
console.log(JSON.stringify({ publicPages: 3, canonical: 'passed', sitemap: 'passed',
  freeSyntheticReports: 2, uncertainty: 'passed', privacyHeaders: 'passed', policyHost: 'passed' }, null, 2))
