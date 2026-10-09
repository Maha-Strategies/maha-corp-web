/* eslint-disable @typescript-eslint/no-require-imports -- Standalone local browser test. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.CORPORATE_LOCAL_URL || 'http://127.0.0.1:3125'
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('Local loopback only')
async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await context.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.origin !== base) return route.abort()
      if (url.pathname === '/api/geocoding/places') return route.fulfill({ json: { results: [{ id: 'synthetic-cheyenne', label: 'Cheyenne, Wyoming, USA', latitude: 41.14, longitude: -104.8197, elevationMeters: 1848, timeZone: 'America/Denver' }] } })
      return route.continue()
    })
    const page = await context.newPage()
    page.on('pageerror', error => console.error('Browser error:', error.message))
    page.on('requestfailed', request => { if (request.url().startsWith(base)) console.error('Local request failed:', new URL(request.url()).pathname) })
    await page.goto(base + '/knowledge/corporate', { waitUntil: 'domcontentloaded', timeout: 300000 })
    await page.getByLabel('Organization name', { exact: true }).fill('Synthetic visitor test')
    await page.getByLabel('Formation event type', { exact: true }).selectOption('certificate-issued')
    await page.getByLabel('Event date (local)', { exact: true }).fill('2025-12-17')
    await page.getByLabel('Representative time (local, 24h)', { exact: false }).fill('07:43')
    await page.getByLabel('Find a place', { exact: true }).fill('Cheyenne')
    try { await page.getByRole('button', { name: 'Cheyenne, Wyoming, USA', exact: true }).click() }
    catch (error) { console.error('Place search visible state:', await page.getByLabel('Find a place', { exact: true }).inputValue(), await page.locator('form').innerText()); throw error }
    await page.getByLabel('Country code (ISO 2-letter)', { exact: true }).fill('US')
    await page.getByLabel('Registration authority', { exact: true }).fill('Synthetic registry')
    await page.getByLabel('Evidence reference and locator', { exact: true }).fill('Synthetic test, no actual certificate')
    await page.getByLabel('Period/transit reference date', { exact: false }).fill('2028-01-01')
    const submit = page.getByRole('button', { name: 'Compute organization report', exact: true })
    await submit.focus(); await page.keyboard.press('Enter')
    await page.getByRole('heading', { name: 'Your layered report', exact: true }).waitFor({ timeout: 120000 })
    assert.equal(page.url(), base + '/knowledge/corporate')
    await page.getByRole('heading', { name: 'D9 and dignity: calculated categories', exact: true }).waitFor()
    assert.ok((await page.locator('body').innerText()).includes('2028-01-01T12:00:00.000Z'))
    const disclosure = page.locator('summary').filter({ hasText: 'Inspect Sun factors and time alternatives' })
    await disclosure.focus(); await page.keyboard.press('Enter')
    assert.equal(await disclosure.evaluate(el => el.parentElement.open), true)
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
    const results = []
    for (const scheme of ['dark', 'light']) for (const width of [1280, 375]) {
      await page.evaluate(scheme => { document.documentElement.dataset.colorScheme = scheme }, scheme)
      await page.setViewportSize({ width, height: 900 })
      const layout = await page.evaluate(() => ({ viewport: innerWidth, client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
      assert.ok(layout.viewport > 0 && layout.scroll <= layout.client, JSON.stringify(layout))
      const axe = await page.evaluate(async () => (await window.axe.run(document.querySelector('main'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })))
      results.push({ scheme, width, violations: axe })
    }
    console.log(JSON.stringify(results, null, 2))
    assert.ok(results.every(r => r.violations.length === 0), 'Accessibility findings require review')
    assert.equal(await page.getByLabel('Organization name', { exact: true }).inputValue(), 'Synthetic visitor test', 'Successful reports must not silently reset event inputs')
    await page.getByLabel('Private verification receipt (optional)', { exact: true }).fill('a'.repeat(64))
    await submit.click()
    await page.getByRole('alert').filter({ hasText: 'Private verification is not configured' }).waitFor()
    const storage = await page.evaluate(() => ({ local: Object.entries(localStorage), session: Object.entries(sessionStorage) }))
    assert.ok(!JSON.stringify(storage).includes('Synthetic visitor'))
    console.log('PASS: actual corporate form → server action → rendered report in isolated Next harness; timing, keyboard disclosures, dark/light 1280/375px layout, axe WCAG checks, and receipt-not-configured error. Geocoding mocked; no external requests permitted. Not a full-site or production-build check.')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
