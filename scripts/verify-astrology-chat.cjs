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
    await page.request.post(`${base}/api/astrology/chat`, { data: {}, timeout: 120000 })
    await page.goto(`${base}/astrology`, { waitUntil: 'networkidle', timeout: 120000 })
    const navigation = page.getByRole('navigation', { name: 'Explore your report' })
    const chat = page.getByRole('region', { name: 'AI chart companion' })
    await navigation.getByRole('button', { name: 'Ask AI', exact: true }).click()
    const question = chat.getByLabel('Your question', { exact: true })
    const send = chat.getByRole('button', { name: 'Ask AI', exact: true })
    await chat.getByRole('button', { name: 'Explain D1 and D9 in simple terms.', exact: true }).click()
    assert.equal(await question.inputValue(), 'Explain D1 and D9 in simple terms.')
    const paidLiveTest = process.env.ASTROLOGY_LIVE_CHAT === 'true'
    if (!paidLiveTest) await page.route('**/api/astrology/chat', route => route.fulfill({ json: {
      answer: 'D1 is the birth chart. D9 is the Navamsa mapping of those positions. This is the fictional example chart.', sources: [], mode: 'ai-generated',
    } }))
    const liveResponse = page.waitForResponse(response => response.url().endsWith('/api/astrology/chat') && response.request().method() === 'POST', { timeout: 60000 })
    await send.click()
    const liveResult = await liveResponse
    assert.equal(liveResult.status(), 200, await liveResult.text())
    await chat.getByRole('log').locator('article').filter({ hasText: 'MAHA · AI GENERATED' }).first().waitFor({ timeout: 60000 })
    const liveAnswer = await chat.getByRole('log').locator('article').last().innerText()
    assert.ok(/D1|birth chart/i.test(liveAnswer) && /D9|Navamsa/i.test(liveAnswer))
    assert.equal(await question.inputValue(), '')
    await navigation.getByRole('button', { name: 'Chart', exact: true }).click()
    await navigation.getByRole('button', { name: 'Ask AI', exact: true }).click()
    assert.equal(await chat.getByRole('log').locator('article').count(), 2)
    const submitted = []
    await page.route('**/api/astrology/chat', route => {
      const body = route.request().postDataJSON()
      submitted.push(body)
      if (body.question === 'Simulate a failure') return route.fulfill({ status: 502, json: { error: 'Please try again.' } })
      return route.fulfill({ json: { answer: 'A follow-up explanation of the example chart.', sources: [], mode: 'ai-generated' } })
    })
    await question.fill('Explain that more simply.'); await send.click()
    await chat.getByRole('log').getByText('A follow-up explanation of the example chart.', { exact: true }).waitFor()
    assert.equal(submitted[0].history.length, 2)
    assert.ok(submitted[0].chart)
    await chat.getByLabel('Include example chart facts', { exact: true }).uncheck()
    assert.equal(await chat.getByRole('log').locator('article').count(), 0)
    await question.fill('How can I organize a busy week?'); await send.click()
    await chat.getByRole('log').getByText('A follow-up explanation of the example chart.', { exact: true }).waitFor()
    assert.equal(submitted[1].chart, null)
    await question.fill('Simulate a failure'); await send.click()
    await chat.getByRole('alert').filter({ hasText: 'Please try again.' }).waitFor()
    assert.equal(await question.inputValue(), 'Simulate a failure')
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 1000 })
      const layout = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
      assert.ok(layout.scroll <= layout.client, JSON.stringify({ width, ...layout }))
    }
    await chat.getByRole('button', { name: 'Clear chat' }).click()
    assert.equal(await chat.getByRole('log').locator('article').count(), 0)
    assert.equal(await question.inputValue(), '')
    assert.deepEqual(errors, [])
    console.log(JSON.stringify({ paidLiveTest, liveAnswer, browserErrors: errors, checks: 'AI answer display, suggestions, history, persistence across tabs, chart opt-out, retryable errors, clear chat, mobile layout' }))
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
