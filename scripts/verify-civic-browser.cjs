/* eslint-disable @typescript-eslint/no-require-imports -- Local browser verification. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { createHash } = require('node:crypto')
const canonicalize = require('canonicalize')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${process.env.CIVIC_PREVIEW_URL || 'http://127.0.0.1:3140'}/civic`, { waitUntil: 'networkidle', timeout: 120000 })
    assert.equal(await page.locator('h1').count(), 1)
    await page.getByRole('heading', { name: 'Campaign fundraising is unavailable', exact: true }).waitFor()
    const financeUrl = new URL('/api/civic/finance', page.url()).href
    const financeStatus = await (await page.request.get(financeUrl)).json()
    assert.equal(financeStatus.acceptsPoliticalContributions, false)
    assert.equal(financeStatus.executesCampaignPayments, false)
    assert.equal((await page.request.post(financeUrl, { data: { action: 'contribute', approved: true } })).status(), 403)
    for (const name of ['Policy simulator & fact graph', 'Public transparency ledger', 'Grounded town hall', 'Forensic spending review']) await page.getByRole('heading', { name, exact: true }).waitFor()
    assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'noindex, follow')
    assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), 'https://www.mahastrategies.com/civic')
    await page.screenshot({ path: '/private/tmp/maha-civic-desktop.png', fullPage: true })
    const slider = page.getByLabel('Assumed adoption')
    await slider.fill('50')
    await page.getByText('Scenario receipt / 50% adoption', { exact: true }).waitFor()
    await page.getByText('80.75', { exact: true }).waitFor()
    await page.getByLabel('Assumed baseline', { exact: false }).fill('120')
    await page.getByLabel('Assumed impact delta').fill('-30')
    await page.getByText('105', { exact: true }).first().waitFor()
    await page.getByText('Scenario receipt / 50% adoption', { exact: true }).waitFor()
    await page.locator('#policy summary').filter({ hasText: 'Inspect receipt' }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.locator('#policy').getByRole('button', { name: 'Download receipt JSON' }).click()
    const download = await downloadPromise
    assert.equal(download.suggestedFilename(), 'civic-policy-scenario.json')
    const scenario = JSON.parse(fs.readFileSync(await download.path(), 'utf8'))
    assert.equal(scenario.variables[0].projectedValue, 105)
    assert.equal(scenario.scenario.impactOverrides['Annual Federal IT Waste Reduction'], -30)
    await page.getByLabel('Policy category').selectOption('healthcare-transparency')
    await page.getByRole('heading', { name: 'No modeled proposal in this category', exact: true }).waitFor()
    assert.equal(await page.locator('#policy input[type=range]').count(), 0)
    await page.getByLabel('Policy category').selectOption('anti-corruption')
    await page.getByText('61.5', { exact: true }).waitFor()
    await page.locator('#policy summary').filter({ hasText: 'Primary source' }).click()
    const sourceLink = page.getByRole('link', { name: 'Download archived source PDF', exact: true })
    const archive = await page.request.get(new URL(await sourceLink.getAttribute('href'), page.url()).href)
    assert.equal(archive.status(), 200)
    assert.equal(createHash('sha256').update(await archive.body()).digest('hex'), '5a2ef9dd989b441d264dffb0a8bf3051a71a1a2b2266048269816c6f68b9d630')
    await page.getByLabel('Your policy question').fill('Is the proposal current law?')
    await page.getByRole('button', { name: 'Ask the town hall', exact: true }).click()
    await page.getByText(/No legislative passage has been retrieved/).waitFor()
    const hall = page.locator('#townhall')
    for (const name of ['Answer', 'Tradeoffs', 'Economic variables', 'Counter-arguments', 'Primary legal citations']) assert.equal(await hall.getByRole('heading', { name, exact: true }).count(), 1)
    assert.equal(await hall.getByRole('table').count(), 1)
    const markdownDownloadPromise = page.waitForEvent('download')
    await hall.getByRole('button', { name: 'Download Markdown answer', exact: true }).click()
    const markdownDownload = await markdownDownloadPromise
    assert.equal(markdownDownload.suggestedFilename(), 'civic-townhall-answer.md')
    const markdown = fs.readFileSync(await markdownDownload.path(), 'utf8')
    assert.ok(markdown.includes('## Economic variables')); assert.ok(markdown.includes('## Counter-arguments'))
    await page.setViewportSize({ width: 375, height: 1000 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    await hall.screenshot({ path: '/private/tmp/maha-civic-townhall-mobile.png' })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.getByRole('button', { name: 'How will your anti-corruption policy impact federal healthcare spending?', exact: true }).click()
    await page.getByRole('button', { name: 'Ask the town hall', exact: true }).click()
    await page.getByText('This policy area has not yet been modeled with verified empirical data. Maha does not offer speculative promises.', { exact: true }).waitFor()
    assert.equal(await hall.getByRole('table').count(), 0)
    await page.getByLabel('Your policy question').fill('Who is corrupt and who should I vote for?')
    await page.getByRole('button', { name: 'Ask the town hall', exact: true }).click()
    await page.getByText('insufficient evidence', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Review spending records', exact: true }).click()
    await page.getByRole('heading', { name: '3 review leads', exact: true }).waitFor()
    await page.getByText('$18,000,000.00', { exact: true }).waitFor()
    await page.getByLabel('Dataset format').selectOption('csv')
    await page.getByLabel('Paste spending records').fill('id,agency,contractor,program,fiscalYear,amountUsdCents,budgetUsdCents,competition,sourceCitation,sourceUrl\naward-1,Agency,"A, B",Software,2026,100,100,competitive,Synthetic test,https://example.test/fixture')
    await page.getByRole('button', { name: 'Review spending records', exact: true }).click()
    await page.getByRole('heading', { name: '0 review leads', exact: true }).waitFor()
    await page.getByText('No configured rules triggered. This does not establish clean spending.', { exact: true }).waitFor()
    await page.getByLabel('Paste spending records').fill('bad csv')
    await page.getByRole('button', { name: 'Review spending records', exact: true }).click()
    await page.locator('#spending [role=alert]').waitFor()
    // Read-only store is normally unconfigured in a foundation preview.
    await page.getByRole('button', { name: 'Refresh public records', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('#ledger [role=alert]') || document.querySelector('#ledger').textContent.includes('stored events'))
    // Exercise configured live-feed states with synthetic receipts, without writing a database.
    const genesis = { ledgerId: 'maha-civic', sequence: 0, digest: '0'.repeat(64) }
    const makeReceipt = (sequence, previousDigest, event) => {
      const payload = { version: 'civic-ledger-1', ledgerId: 'maha-civic', sequence, previousDigest, event }
      return { ...payload, digest: createHash('sha256').update(canonicalize(payload)).digest('hex') }
    }
    const event = { id: 'browser-settlement', kind: 'expense', occurredAt: '2026-10-04T00:00:00Z', description: 'Synthetic machine settlement — browser fixture only', amountBaseUnits: '1234567', category: 'infrastructure', counterpartyLabel: 'Synthetic research agent', settlementChannel: 'machine-to-machine', evidence: [{ citation: 'Synthetic fixture only', url: 'https://example.test/fixture' }], transfer: { network: 'eip155:8453', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', from: '0x' + '1'.repeat(40), to: '0x' + '2'.repeat(40), transactionHash: '0x' + 'a'.repeat(64), logIndex: 0 } }
    const one = makeReceipt(1, genesis.digest, event)
    const two = makeReceipt(2, one.digest, { ...event, id: 'browser-settlement-two', amountBaseUnits: '9007199254740991000001', transfer: { ...event.transfer, logIndex: 1 } })
    let fixture = [], failRefresh = false
    await page.route('**/api/civic/ledger*', route => {
      if (failRefresh) return route.fulfill({ status: 503, json: { error: 'Synthetic refresh outage' } })
      const after = Number(new URL(route.request().url()).searchParams.get('after') || 0)
      const last = fixture.at(-1)
      const head = last ? { ledgerId: last.ledgerId, sequence: last.sequence, digest: last.digest } : genesis
      const before = fixture[after - 1]
      const preceding = before ? { ledgerId: before.ledgerId, sequence: before.sequence, digest: before.digest } : genesis
      return route.fulfill({ json: { status: 'stored-unanchored', preceding, head, receipts: fixture.slice(after), hasMore: false, limitation: 'Synthetic browser fixture. Local integrity only.' } })
    })
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByText('No public events recorded.', { exact: true }).waitFor()
    await page.getByText('Verify a Base anchor', { exact: true }).click()
    assert.equal(await page.getByRole('button', { name: 'Verify on Base', exact: true }).isDisabled(), true)
    fixture = [one]
    await page.getByRole('button', { name: 'Refresh public records', exact: true }).click()
    await page.getByRole('cell', { name: '1.234567', exact: true }).waitFor()
    await page.getByText('machine-to-machine', { exact: true }).waitFor()
    fixture = [one, two]
    // Wait for the automatic refresh, rather than clicking again.
    await page.getByRole('cell', { name: '9007199254740991.000001', exact: true }).waitFor({ timeout: 22000 })
    assert.equal(await page.locator('#ledger tbody tr').count(), 2)
    const bundleDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download verifiable page', exact: true }).click()
    const bundle = JSON.parse(fs.readFileSync(await (await bundleDownloadPromise).path(), 'utf8'))
    const verify = await page.request.post(new URL('/api/civic/ledger', page.url()).href, { data: bundle })
    assert.equal(verify.status(), 200); assert.equal((await verify.json()).status, 'integrity-valid')
    failRefresh = true
    await page.getByRole('button', { name: 'Refresh public records', exact: true }).click()
    await page.getByText('Stale snapshot · refresh failed', { exact: true }).waitFor()
    assert.equal(await page.locator('#ledger tbody tr').count(), 2)
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 1000 })
      const size = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
      assert.ok(size.scroll <= size.client, JSON.stringify(size))
    }
    await page.screenshot({ path: '/private/tmp/maha-civic-mobile.png', fullPage: true })
    await page.evaluate(() => { document.documentElement.dataset.colorScheme = 'dark' })
    await page.screenshot({ path: '/private/tmp/maha-civic-mobile-dark.png', fullPage: true })
    assert.deepEqual(errors, [])
    console.log('PASS: Campaign finance status and refusal endpoint; Category filters and immediate baseline/impact/adoption sliders with matching receipts; archived PDF hash; automatic ledger append polling, exact USDC/M2M table, verifiable export and stale-data retention;  Next.js civic render; simulation and receipt download; structured town hall sections/table, Markdown download, bounded law answer and exact unmodeled-area abstention; JSON/quoted CSV audit and invalid input; ledger unavailable/empty state; disabled empty anchoring; desktop/mobile layout; light/dark screenshots; no browser errors. Empty ledger response mocked; chain/provider calls not made.')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
