/* eslint-disable @typescript-eslint/no-require-imports -- Local browser verification. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { createHash } = require('node:crypto')
const canonicalize = require('canonicalize')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const digest = value => createHash('sha256').update(canonicalize(value)).digest('hex')

;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const base = process.env.CIVIC_PREVIEW_URL || 'http://127.0.0.1:3140'
    await page.goto(`${base}/civic#ai-safety`, { waitUntil: 'networkidle', timeout: 120000 })
    const panel = page.locator('#ai-safety')
    await panel.getByRole('heading', { name: 'AI safety participation', exact: true }).waitFor()
    await panel.getByText(/The private inbox is not connected/).waitFor()
    assert.equal(await panel.getByRole('button', { name: 'Submit AI safety concern', exact: true }).isDisabled(), true)
    const actual = await page.request.get(`${base}/api/civic/ai-safety`)
    assert.equal((await actual.json()).accepting, false)
    assert.equal((await page.request.post(`${base}/api/civic/ai-safety`, { data: { ignored: true } })).status(), 503)
    assert.equal((await page.request.get(`${base}/api/admin/civic-ai-safety`)).status(), 401)
    await panel.getByLabel('Describe your AI safety concern', { exact: true }).fill('Synthetic concern about autonomous tools exceeding their permission boundary.')
    const downloadPending = page.waitForEvent('download')
    await panel.getByRole('button', { name: 'Download unsent draft', exact: true }).click()
    const download = await downloadPending
    const draft = JSON.parse(fs.readFileSync(await download.path(), 'utf8'))
    assert.equal(draft.status, 'unsent-draft'); assert.match(draft.concern, /Synthetic concern/)
    assert.equal(draft.receipt, undefined)

    // Configured UI states use fixtures only; no production database or model.
    const requests = []
    let fail = true
    await page.route('**/api/civic/ai-safety', async route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { accepting: true } })
      const input = route.request().postDataJSON(); requests.push(input)
      if (fail) return route.fulfill({ status: 503, json: { error: 'Synthetic storage outage. Keep your draft and retry.' } })
      const payload = { version: 'civic-ai-safety-1', id: input.submissionId, receivedAt: '2026-10-08T00:00:00.000Z', submissionDigest: digest(input) }
      return route.fulfill({ status: 201, json: { status: 'received', receipt: { ...payload, digest: digest(payload) } } })
    })
    await page.reload({ waitUntil: 'networkidle' })
    await panel.getByText('Private inbox connected. You can submit a concern.', { exact: true }).waitFor()
    await panel.getByLabel('Area of concern', { exact: true }).selectOption('oversight')
    await panel.getByLabel('What is your concern based on?', { exact: true }).selectOption('observation')
    const concern = 'Synthetic concern: a test tool proceeded without the approval it was expected to require.'
    await panel.getByLabel('Describe your AI safety concern', { exact: true }).fill(concern)
    await panel.getByLabel('What should the platform investigate or change?', { exact: true }).fill('Investigate how approval boundaries are tested before deployment.')
    await panel.getByRole('button', { name: 'Submit AI safety concern', exact: true }).click()
    assert.equal(requests.length, 0, 'Consent is mandatory.')
    await panel.getByLabel(/I agree to store this text/).check()
    await panel.getByLabel('Public source links (optional)', { exact: true }).fill('http://example.test/unsafe')
    await panel.getByRole('button', { name: 'Submit AI safety concern', exact: true }).click()
    await panel.getByRole('alert').waitFor()
    assert.equal(requests.length, 0)
    await panel.getByLabel('Public source links (optional)', { exact: true }).fill('https://example.test/synthetic-source')
    await page.setViewportSize({ width: 375, height: 1000 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    await panel.screenshot({ path: '/private/tmp/maha-civic-ai-safety-mobile.png' })
    await panel.getByRole('button', { name: 'Submit AI safety concern', exact: true }).click()
    await panel.getByText('Synthetic storage outage. Keep your draft and retry.', { exact: true }).waitFor()
    assert.equal(await panel.getByLabel('Describe your AI safety concern', { exact: true }).inputValue(), concern)
    assert.equal(await panel.getByRole('heading', { name: 'Concern received', exact: true }).count(), 0)
    fail = false
    await panel.getByRole('button', { name: 'Submit AI safety concern', exact: true }).click()
    await panel.getByRole('heading', { name: 'Concern received', exact: true }).waitFor()
    assert.equal(requests.length, 2); assert.equal(requests[0].submissionId, requests[1].submissionId)
    const receiptPending = page.waitForEvent('download')
    await panel.getByRole('button', { name: 'Download private receipt', exact: true }).click()
    const receiptDownload = await receiptPending
    const bundle = JSON.parse(fs.readFileSync(await receiptDownload.path(), 'utf8'))
    assert.equal(bundle.submission.concern, concern)
    assert.equal(bundle.receipt.submissionDigest, digest(bundle.submission))
    const { digest: recorded, ...payload } = bundle.receipt
    assert.equal(recorded, digest(payload))
    await page.setViewportSize({ width: 1440, height: 1000 })
    await panel.screenshot({ path: '/private/tmp/maha-civic-ai-safety-desktop.png' })
    await page.emulateMedia({ colorScheme: 'dark' })
    await panel.screenshot({ path: '/private/tmp/maha-civic-ai-safety-dark.png' })
    await panel.getByRole('button', { name: 'Start another concern', exact: true }).click()
    assert.equal(await panel.getByLabel('Describe your AI safety concern', { exact: true }).inputValue(), '')
    assert.equal(await panel.getByLabel(/I agree to store this text/).isChecked(), false)
    assert.deepEqual(errors, [])
    console.log('AI safety participation browser checks passed: unavailable intake, consent, sources, draft export, failure preservation, retry, receipt and responsive layout.')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
