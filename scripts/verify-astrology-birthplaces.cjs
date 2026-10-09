/* eslint-disable @typescript-eslint/no-require-imports -- Local browser verification. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.ASTROLOGY_LOCAL_URL || 'http://localhost:3138'
if (!/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Local preview only')

;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${base}/astrology`, { waitUntil: 'networkidle', timeout: 120000 })
    const city = page.getByLabel('Birthplace', { exact: true })
    const latitude = page.getByLabel('Latitude', { exact: true })
    const longitude = page.getByLabel('Longitude', { exact: true })
    const zone = page.getByLabel('Birth time zone', { exact: true })
    const find = page.getByRole('button', { name: 'Find', exact: true })
    // Backspace must preserve each edit, including trailing spaces/punctuation
    // that the shortcut lookup normalizes to an existing city.
    await city.focus()
    await city.evaluate(input => input.setSelectionRange(input.value.length, input.value.length))
    let remaining = await city.inputValue()
    while (remaining.length) {
      remaining = remaining.slice(0, -1)
      await city.press('Backspace')
      assert.equal(await city.inputValue(), remaining)
    }
    assert.equal(await latitude.inputValue(), '')
    assert.equal(await longitude.inputValue(), '')
    assert.equal(await zone.inputValue(), '')
    await city.pressSequentially('Mumbai')
    assert.equal(await city.inputValue(), 'Mumbai')
    await city.evaluate(input => input.setSelectionRange(0, 0))
    await city.press('Delete')
    assert.equal(await city.inputValue(), 'umbai')
    await city.fill('Mumbai')
    await page.getByRole('status').filter({ hasText: 'Selected Mumbai' }).waitFor()
    assert.equal(await latitude.inputValue(), '19.076')
    assert.equal(await longitude.inputValue(), '72.8777')
    assert.equal(await zone.inputValue(), 'Asia/Kolkata')
    const zoneList = await zone.getAttribute('list')
    assert.ok(await page.locator(`[id="${zoneList}"] option`).count() > 400)

    let live = 'not requested'
    if (process.env.ASTROLOGY_LIVE_GEOCODING === 'true') {
      await city.fill('Kandy')
      await find.click()
      await page.getByRole('list', { name: 'Matching birthplaces' }).waitFor({ timeout: 20000 })
      const match = page.getByRole('list', { name: 'Matching birthplaces' }).getByRole('button').first()
      live = await match.innerText()
      await match.click()
      assert.equal(await zone.inputValue(), 'Asia/Colombo')
      assert.ok(Number(await latitude.inputValue()) > 7 && Number(await latitude.inputValue()) < 8)
    }

    const requests = []
    let releaseOld
    const oldResponse = new Promise(resolve => { releaseOld = resolve })
    await page.route('**/api/geocoding/places', async route => {
      assert.equal(route.request().method(), 'POST')
      const body = route.request().postDataJSON()
      assert.deepEqual(Object.keys(body), ['query'])
      requests.push(body.query)
      if (body.query === 'Older query') {
        await oldResponse
        return route.fulfill({ json: { results: [{ id: 'old', label: 'Old city', latitude: 1, longitude: 2, timeZone: 'UTC' }] } }).catch(() => {})
      }
      if (body.query === 'Empty query') return route.fulfill({ json: { results: [] } })
      if (body.query === 'Unavailable query') return route.fulfill({ status: 502, json: { error: 'unavailable' } })
      return route.fulfill({ json: { results: [
        { id: 'one', label: 'Springfield, Illinois, United States', latitude: 39.8017, longitude: -89.6436, timeZone: 'America/Chicago' },
        { id: 'two', label: 'Springfield, Massachusetts, United States', latitude: 42.1015, longitude: -72.5898, timeZone: 'America/New_York' },
      ] } })
    })
    await city.fill('Springfield')
    assert.equal(await latitude.inputValue(), '')
    assert.equal(await longitude.inputValue(), '')
    assert.equal(await zone.inputValue(), '')
    await city.press('Enter')
    await page.getByRole('button', { name: /Springfield, Massachusetts/ }).click()
    assert.equal(await latitude.inputValue(), '42.1015')
    assert.equal(await zone.inputValue(), 'America/New_York')
    await city.fill('Older query')
    const olderRequest = page.waitForRequest(request => request.url().endsWith('/api/geocoding/places') && request.postDataJSON().query === 'Older query')
    await find.click()
    await olderRequest
    await city.fill('Mumbai')
    releaseOld()
    await page.getByRole('status').filter({ hasText: 'Selected Mumbai' }).waitFor()
    assert.equal(await latitude.inputValue(), '19.076')
    assert.equal(await page.getByRole('button', { name: /Old city/ }).count(), 0)
    for (const query of ['Empty query', 'Unavailable query']) {
      await city.fill(query); await find.click()
      await page.getByRole('status').filter({ hasText: query === 'Empty query' ? 'No matching place found' : 'temporarily unavailable' }).waitFor()
      assert.equal(await latitude.inputValue(), '')
    }
    await latitude.fill('51.5074'); await longitude.fill('-0.1278'); await zone.fill('Europe/London')
    assert.equal(await page.locator('input[name=placeLabel]').inputValue(), '')
    await page.getByLabel('Birth date', { exact: true }).fill('2000-01-01')
    await page.getByLabel('Birth time', { exact: true }).fill('12:00')
    await page.getByRole('button', { name: 'Explore my chart' }).click()
    await page.getByRole('heading', { name: 'Your chart, ready to explore.' }).waitFor({ timeout: 60000 })
    assert.equal(await zone.inputValue(), 'Europe/London')
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 900 })
      const layout = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
      assert.ok(layout.scroll <= layout.client, JSON.stringify({ width, ...layout }))
    }
    assert.deepEqual(errors, [])
    console.log(JSON.stringify({ liveGeocoding: live, queryOnlyRequests: requests.length, checks: 'shortcuts, time zones, match selection, stale requests, no-match/errors, manual fallback, live chart submission, mobile layout' }))
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
