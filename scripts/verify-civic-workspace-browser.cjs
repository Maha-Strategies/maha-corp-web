/* eslint-disable @typescript-eslint/no-require-imports -- Local browser verification. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const { submitSafetyConcern, makeAiSafetyRecord } = await import('../lib/civic/ai-safety-service.ts')
  const { initialSafetyCase } = await import('../lib/civic/workspace-engine.ts')
  const { handleCitizenCase, handleWorkspaceAdmin, handlePublicParticipation } = await import('../lib/civic/workspace-service.ts')
  const token = 'synthetic-browser-operator-token-not-a-real-secret'
  const rows = new Map(), records = new Map(), consultations = new Map(), keys = new Map()
  const store = {
    lookup: async (kind, id, keyHash) => kind === 'case' ? (keyHash && keys.get(id) !== keyHash ? null : rows.get(id) ?? null) : consultations.get(id) ?? null,
    list: async kind => [...(kind === 'case' ? rows : consultations).values()].map(row => row.state),
    commit: async (kind, state, revision, operationId, operationDigest, keyHash) => {
      const map = kind === 'case' ? rows : consultations, previous = map.get(state.id)
      assert.equal(previous?.state.revision ?? 0, revision)
      if (keyHash) assert.equal(keys.get(state.id), keyHash)
      map.set(state.id, { state, operationId, operationDigest })
      if (state.status === 'withdrawn') records.delete(state.id)
      return state
    },
    publicFeed: async () => ({ summaries: [...rows.values()].filter(row => row.state.publication?.publishedAt).map(row => ({ summary: row.state.publication.draft, digest: row.state.publication.digest, publishedAt: row.state.publication.publishedAt })), consultations: [...consultations.values()].filter(row => row.state.status !== 'draft').map(row => row.state) }),
  }
  const intake = { enabled: true, secret: token, operatorToken: token, trustedVercelProxy: true, store: {
    supportsCaseAccess: true, ready: async () => true,
    submit: async (record, _visitorHash, keyHash) => {
      if (records.has(record.receipt.id)) return records.get(record.receipt.id)
      keys.set(record.receipt.id, keyHash); records.set(record.receipt.id, record)
      rows.set(record.receipt.id, { state: initialSafetyCase(record), operationId: null, operationDigest: null }); return record
    }, list: async () => [...records.values()], review: async () => null,
  } }
  // Seed nothing: all private case data is created through the actual intake handler below.
  assert.equal(typeof makeAiSafetyRecord, 'function')
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
    const errors = []
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)))
    const base = process.env.CIVIC_PREVIEW_URL || 'http://127.0.0.1:3140'
    const publicPage = await context.newPage()
    await publicPage.goto(`${base}/civic#ai-safety`, { waitUntil: 'networkidle', timeout: 120000 })
    // Real disabled endpoints are checked before browser fixtures are attached.
    assert.equal((await (await publicPage.request.get(`${base}/api/civic/ai-safety`)).json()).accepting, false)
    assert.equal((await publicPage.request.post(`${base}/api/admin/civic-workbench`, { data: {} })).status(), 401)
    await context.route(/\/api\/(?:civic\/(?:ai-safety(?:\/case)?|participation)|admin\/civic-workbench)$/, async route => {
      const req = route.request(), path = new URL(req.url()).pathname
      const request = new Request(req.url(), { method: req.method(), headers: req.headers(), ...(req.method() === 'POST' ? { body: req.postData() } : {}) })
      let response
      if (path === '/api/civic/ai-safety' && req.method() === 'GET') response = Response.json({ accepting: true })
      else if (path === '/api/civic/ai-safety') response = await submitSafetyConcern(request, intake)
      else if (path === '/api/civic/ai-safety/case') response = await handleCitizenCase(request, { store, operatorToken: token })
      else if (path === '/api/admin/civic-workbench') response = await handleWorkspaceAdmin(request, { store, operatorToken: token })
      else response = await handlePublicParticipation({ store, operatorToken: token })
      await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() })
    })
    await publicPage.reload({ waitUntil: 'networkidle' })
    const safety = publicPage.locator('#ai-safety')
    await safety.getByText('Private inbox connected. You can submit a concern.', { exact: true }).waitFor()
    await safety.getByLabel('Describe your AI safety concern', { exact: true }).fill('SYNTHETIC_PRIVATE_BROWSER_CONCERN: a test tool ran without an expected approval.')
    await safety.getByLabel('What should the platform investigate or change?', { exact: true }).fill('Investigate the permission boundary using a synthetic test.')
    await safety.getByLabel(/I agree to store this text/).check()
    const kitPending = publicPage.waitForEvent('download')
    await safety.getByRole('button', { name: 'Submit AI safety concern', exact: true }).click()
    const kitDownload = await kitPending, kit = JSON.parse(fs.readFileSync(await kitDownload.path(), 'utf8'))
    assert.match(kit.accessKey, /^[a-f0-9]{64}$/)
    await safety.getByRole('heading', { name: 'Concern received', exact: true }).waitFor()
    assert.equal(rows.size, 1)

    const operator = await context.newPage()
    await operator.goto(`${base}/civic/review`, { waitUntil: 'networkidle', timeout: 120000 })
    await operator.getByLabel('Operator access token', { exact: true }).fill(token)
    await operator.getByRole('button', { name: 'Open review inbox', exact: true }).click()
    await operator.getByRole('button', { name: `Review case ${kit.id.slice(0, 8)}`, exact: true }).click()
    await operator.getByLabel('Assigned reviewer (citizen-visible alias)', { exact: true }).fill('Review team A')
    await operator.getByLabel('Next action (citizen-visible)', { exact: true }).fill('Inspect the synthetic reproduction and supporting evidence.')
    await operator.getByLabel('Case status', { exact: true }).selectOption('awaiting-citizen')
    await operator.getByLabel('Internal investigation note', { exact: true }).fill('SYNTHETIC_INTERNAL_BROWSER_NOTE — do not expose to citizens or the public.')
    await operator.getByLabel('Status update for the citizen', { exact: true }).fill('Your case has an assigned reviewer and needs one clarification.')
    await operator.getByLabel('Request for clarification (required for awaiting-citizen)', { exact: true }).fill('Which version of the synthetic tool was used?')
    await operator.getByRole('button', { name: 'Save investigation update', exact: true }).click()
    await operator.getByText('revision 2.', { exact: false }).waitFor()

    const citizen = await context.newPage()
    await citizen.goto(`${base}/civic/follow-up`, { waitUntil: 'networkidle', timeout: 120000 })
    await citizen.getByLabel('Or load your private access kit / receipt', { exact: true }).setInputFiles({ name: 'kit.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(kit)) })
    await citizen.getByRole('button', { name: 'Open private case', exact: true }).click()
    await citizen.getByRole('heading', { name: 'Case status: awaiting citizen', exact: true }).waitFor()
    assert.ok(!(await citizen.locator('body').innerText()).includes('SYNTHETIC_INTERNAL_BROWSER_NOTE'))
    await citizen.getByLabel('Your clarification', { exact: true }).fill('The synthetic tool version was browser-test-v1.')
    await citizen.getByRole('button', { name: 'Send clarification', exact: true }).click()
    await citizen.getByRole('heading', { name: 'Case status: investigating', exact: true }).waitFor()
    await operator.getByRole('button', { name: 'Reload selected case', exact: true }).click()
    await operator.getByText('revision 3.', { exact: false }).waitFor()
    await operator.getByText('Prepare consented public summary', { exact: true }).click()
    const summary = { id: crypto.randomUUID(), title: 'Synthetic public follow-through', youRaised: 'A permission-boundary question was raised in a synthetic exercise.', weInvestigated: 'A reviewer examined the synthetic reproduction and evidence gaps.', whatChanged: 'The review documented a test requirement for further investigation.', unresolved: ['Evidence from a deployed system is not available.'], decisionRationale: 'The exercise supports additional testing, without establishing a real incident.', sources: [] }
    await operator.getByLabel('Public summary draft (JSON)', { exact: true }).fill(JSON.stringify(summary))
    await operator.getByLabel(/I reviewed this exact summary and its links/).check()
    await operator.getByRole('button', { name: 'Save summary for citizen consent', exact: true }).click()
    await operator.getByText('revision 4.', { exact: false }).waitFor()
    assert.equal(await operator.getByRole('button', { name: 'Publish approved summary', exact: true }).isDisabled(), true)
    await citizen.getByRole('button', { name: 'Refresh case', exact: true }).click()
    await citizen.getByRole('heading', { name: 'Proposed public summary', exact: true }).waitFor()
    await citizen.getByRole('button', { name: 'Approve this exact summary for publication', exact: true }).click()
    await citizen.getByText('You approved this draft; operator publication is pending.', { exact: true }).waitFor()
    await operator.getByRole('button', { name: 'Reload selected case', exact: true }).click()
    await operator.getByRole('button', { name: 'Publish approved summary', exact: true }).click()
    await operator.getByText('revision 6.', { exact: false }).waitFor()

    const published = await context.newPage()
    await published.goto(`${base}/civic#participation`, { waitUntil: 'networkidle', timeout: 120000 })
    await published.getByRole('heading', { name: 'Synthetic public follow-through', exact: true }).waitFor()
    const visible = await published.locator('#participation').innerText()
    for (const secret of ['SYNTHETIC_PRIVATE_BROWSER_CONCERN', 'SYNTHETIC_INTERNAL_BROWSER_NOTE', kit.id, kit.accessKey]) assert.ok(!visible.includes(secret))
    await citizen.getByRole('button', { name: 'Refresh case', exact: true }).click()
    await citizen.getByText('Published', { exact: true }).waitFor()
    await citizen.getByText('Correct your concern', { exact: true }).click()
    await citizen.getByLabel('Corrected concern', { exact: true }).fill('Corrected synthetic concern: the approval condition needs additional investigation.')
    await citizen.getByRole('button', { name: 'Save correction', exact: true }).click()
    await citizen.getByRole('heading', { name: 'Case status: received', exact: true }).waitFor()
    await published.getByRole('button', { name: 'Refresh published participation', exact: true }).click()
    await published.getByText('No public investigation summaries are loaded. Private concerns are never shown as a public feed.', { exact: true }).waitFor()

    await operator.getByRole('button', { name: 'Prepare new discussion draft', exact: true }).click()
    await operator.getByRole('button', { name: 'Save consultation draft', exact: true }).click()
    await operator.getByRole('button', { name: /AI testing requirements — discussion draft · draft/ }).waitFor()
    await operator.getByLabel(/I reviewed this public evidence packet and response rationale/).check()
    await operator.getByRole('button', { name: 'Open reviewed consultation', exact: true }).click()
    await operator.getByRole('button', { name: /AI testing requirements — discussion draft · open/ }).waitFor()
    await published.getByRole('button', { name: 'Refresh published participation', exact: true }).click()
    await published.getByRole('heading', { name: 'AI testing requirements — discussion draft', exact: true }).waitFor()
    await published.getByLabel('Your reasoning', { exact: true }).fill('Synthetic consultation response: testing costs and benefits need independent evidence.')
    await published.getByLabel('What evidence is missing?', { exact: true }).fill('Measured testing costs from comparable systems are missing.')
    await published.getByLabel('Which assumptions should be challenged?', { exact: true }).fill('The assumed effectiveness of independent testing is unmeasured.')
    await published.getByLabel(/Store this response for private operator review/).check()
    const consultationKitPending = published.waitForEvent('download')
    await published.getByRole('button', { name: 'Submit consultation response', exact: true }).click()
    await consultationKitPending
    await published.getByText(/Your response was received privately/).waitFor()
    assert.equal(rows.size, 2)
    await operator.getByLabel('Public response rationale, unresolved issues and resulting decision', { exact: true }).fill('The synthetic consultation identified unresolved testing costs. Further independent evidence is needed before deciding on a requirement.')
    await operator.getByLabel(/I reviewed this public evidence packet and response rationale/).check()
    await operator.getByRole('button', { name: 'Close consultation and publish rationale', exact: true }).click()
    await operator.getByRole('button', { name: /AI testing requirements — discussion draft · closed/ }).waitFor()
    await published.getByRole('button', { name: 'Refresh published participation', exact: true }).click()
    await published.getByRole('heading', { name: 'Response rationale', exact: true }).waitFor()
    assert.equal(await published.getByRole('button', { name: 'Submit consultation response', exact: true }).count(), 0)

    await citizen.getByText('Withdraw this concern', { exact: true }).click()
    await citizen.getByLabel('I want to withdraw and remove this concern.', { exact: true }).check()
    await citizen.getByRole('button', { name: 'Withdraw and remove concern', exact: true }).click()
    await citizen.getByRole('heading', { name: 'Case status: withdrawn', exact: true }).waitFor()
    assert.equal(records.has(kit.id), false); assert.equal(rows.get(kit.id).state.messages.length, 0)
    assert.equal(rows.get(kit.id).state.submission, null)
    await published.getByRole('button', { name: 'Load synthetic worked example', exact: true }).click()
    await published.getByRole('button', { name: 'Calculate conditional costs', exact: true }).click()
    await published.getByRole('heading', { name: 'Conditional annual cost: $7,000', exact: true }).waitFor()
    await published.getByRole('heading', { name: 'Measured checks: 12 / 12 passed', exact: true }).waitFor()
    await published.setViewportSize({ width: 375, height: 1000 })
    assert.ok(await published.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    await published.locator('#model-evidence').screenshot({ path: '/private/tmp/maha-civic-model-evidence-mobile.png' })
    await published.locator('#participation').screenshot({ path: '/private/tmp/maha-civic-public-participation-mobile.png' })
    await citizen.setViewportSize({ width: 375, height: 1000 })
    assert.ok(await citizen.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    await citizen.screenshot({ path: '/private/tmp/maha-civic-private-withdrawal.png', fullPage: true })
    await operator.screenshot({ path: '/private/tmp/maha-civic-review-workbench.png', fullPage: true })
    assert.deepEqual(errors, [])
    console.log('Civic workspace browser checks passed: access kit, assignment, clarification, exact-draft consent, publication, correction, withdrawal, consultation, model diagnostics and evaluation report.')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
