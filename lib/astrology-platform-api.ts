import { z } from 'zod'
import { astrologyChartInput, secondaryChartInput, checkedBirthReport } from './astrology-input.ts'
import { astrologyAccount, getAstrologyEntitlement, canAccessAdvancedTools, AstrologyAccessError, chartDigest, encryptVault, decryptVault, createAstrologyCheckout, recoverAstrologyCheckout, vaultEntries, saveVaultEntry, reserveMonthlyDossier, type VaultEntry } from './astrology-entitlements.ts'
import { strategicGeometry, transitOverlay, corporateSynastry, slowPlanetIngresses } from './astrology-strategy.ts'
import { generateExecutiveDossier } from './dossier/astrology-dossier.ts'
import { astrologyBillingConfig, astrologyStripe } from './billing/stripe.ts'
import { getRedis } from './redis.ts'
import { scopedRedisKey } from './redis-namespace.ts'
import { createHash } from 'node:crypto'
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' }
export const platformInput = z.object({ operation: z.enum(['entitlement', 'recover', 'checkout', 'portal', 'aspects', 'transits', 'ingress', 'synastry', 'list', 'save', 'open', 'pdf']), chart: astrologyChartInput.optional(), secondary: secondaryChartInput.optional(), instantUtc: z.iso.datetime().optional(), product: z.enum(['dossier', 'executive_monthly', 'executive_annual']).optional(), requestId: z.string().regex(/^[a-zA-Z0-9_-]{8,120}$/).optional(), sessionId: z.string().max(160).optional(), digest: z.string().regex(/^[a-f0-9]{64}$/).optional(), label: z.string().trim().min(1).max(80).optional(), consentToStore: z.literal(true).optional() }).strict()
export function dossierBundleDigest(input: z.infer<typeof platformInput>) {
  if (!input.chart) throw new AstrologyAccessError(400, 'Calculate a chart first.')
  return createHash('sha256').update(JSON.stringify([chartDigest(input.chart), input.secondary ? chartDigest(input.secondary.chart) : null, input.secondary?.kind ?? null])).digest('hex')
}
export async function handleAstrologyPlatform(request: Request, dependencies: {
  account?: typeof astrologyAccount; entitlement?: typeof getAstrologyEntitlement; rate?: (userId: string) => Promise<number>;
} = {}) {
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers })
  if (request.method !== 'POST' || new URL(request.url).search) return json({ error: 'Use a private POST request.' }, 400)
  const origin = request.headers.get('origin'); if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'Open this feature from the Maha app.' }, 403)
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return json({ error: 'JSON is required.' }, 415)
  try {
    const reader = request.body?.getReader(); if (!reader) return json({ error: 'Request is empty.' }, 400)
    const chunks: Uint8Array[] = []; let size = 0
    try { while (true) { const {value, done} = await reader.read(); if (done) break; size += value.byteLength; if (size > 32768) { await reader.cancel(); return json({ error: 'Request is too large.' }, 413) } chunks.push(value) } } finally { reader.releaseLock() }
    let body: unknown; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return json({ error: 'Invalid JSON.' }, 400) }
    const parsed = platformInput.safeParse(body); if (!parsed.success) return json({ error: 'Check the supplied account, chart and operation.' }, 400)
    const input = parsed.data, userId = await (dependencies.account ?? astrologyAccount)(request)
    const limit = dependencies.rate ? await dependencies.rate(userId) : await getRedis().eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n", [scopedRedisKey(`astrology:requests:${userId}`)], [])
    if (typeof limit !== 'number' || limit > 30) return json({ error: 'Please wait before making another platform request.' }, 429)
    if (input.operation === 'recover') { if (!input.sessionId) return json({error: 'Checkout reference required.'}, 400); await recoverAstrologyCheckout(userId, input.sessionId) }
    const entitlement = await (dependencies.entitlement ?? getAstrologyEntitlement)(userId)
    if (['entitlement', 'recover'].includes(input.operation)) return json({ entitlement })
    if (input.operation === 'list') return json({ entries: (await vaultEntries(userId, entitlement)).map(e => ({ chartDigest: e.chartDigest, label: e.label, purchasedAt: e.purchasedAt, kind: e.kind })) })
    if (input.operation === 'portal') {
      const sessions = await getRedis().smembers<string[]>(scopedRedisKey(`astrology:account:${userId}:checkouts`))
      for (const id of sessions) {
        const s = await astrologyStripe().checkout.sessions.retrieve(id)
        if (s.client_reference_id === userId && s.metadata?.billing_kind === 'maha_astrology' && s.customer) { const portal = await astrologyStripe().billingPortal.sessions.create({ customer: typeof s.customer === 'string' ? s.customer : s.customer.id, return_url: new URL('/astrology', request.url).toString() }); return json({ url: portal.url }) }
      }
      return json({ error: 'No account-owned Stripe customer is available.' }, 404)
    }
    if (input.operation === 'open' || (input.operation === 'pdf' && input.digest)) {
      const entry = (await vaultEntries(userId, entitlement)).find(e => e.chartDigest === input.digest)
      if (!entry) return json({ error: 'This chart is not in your authorized vault.' }, 403)
      const bundle = JSON.parse(decryptVault(entry.encryptedChart, userId)) as { chart: z.infer<typeof astrologyChartInput>; secondary?: z.infer<typeof secondaryChartInput> }
      const primary = checkedBirthReport(astrologyChartInput.parse(bundle.chart)), secondary = bundle.secondary ? { ...secondaryChartInput.parse(bundle.secondary), report: checkedBirthReport(bundle.secondary.chart) } : undefined
      if (input.operation === 'open') return json({ report: primary, secondary })
      if (entry.kind !== 'dossier') return json({ error: 'This saved chart has no purchased dossier.' }, 402)
      const pdf = entry.encryptedPdf ? Buffer.from(decryptVault(entry.encryptedPdf, userId), 'base64') : await generateExecutiveDossier(primary, secondary)
      if (!entry.encryptedPdf) await saveVaultEntry(userId, { ...entry, encryptedPdf: encryptVault(pdf.toString('base64'), userId) })
      return new Response(new Uint8Array(pdf), { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="maha-executive-dossier.pdf"' } })
    }
    if (input.operation === 'checkout' && input.product !== 'dossier') {
      if (!input.product || !input.requestId) return json({ error: 'Choose a product and request reference.' }, 400)
      if (entitlement.isSubscriber) return json({ error: 'Manage your existing subscription before starting another.' }, 409)
      return json({ url: await createAstrologyCheckout(request, userId, input.product, input.requestId) })
    }
    if (!input.chart) return json({ error: 'A calculated chart is required.' }, 400)
    if (['aspects', 'transits', 'ingress', 'synastry'].includes(input.operation) && !canAccessAdvancedTools(entitlement)) return json({ error: 'Executive subscription or an active 30-day pass required.' }, 402)
    if (['save', 'pdf'].includes(input.operation) && !entitlement.isSubscriber) return json({ error: 'Use a dossier purchase or an Executive subscription.' }, 402)
    if (input.operation === 'checkout' && (!input.product || !input.requestId)) return json({ error: 'Product and request reference required.' }, 400)
    let report: ReturnType<typeof checkedBirthReport>, secondary: { kind: 'corporate' | 'partner'; label: string; report: ReturnType<typeof checkedBirthReport> } | undefined
    try { report = checkedBirthReport(input.chart); secondary = input.secondary ? { ...input.secondary, report: checkedBirthReport(input.secondary.chart) } : undefined } catch { return json({ error: 'Check the birth inputs and evaluation date.' }, 400) }
    if (input.operation === 'aspects') return json({ strategic: strategicGeometry(report) })
    if (input.operation === 'ingress') {
      const start = new Date(input.instantUtc ?? input.chart.referenceInstantUtc), end = new Date(start); end.setUTCFullYear(end.getUTCFullYear()+3)
      if (!Number.isFinite(start.getTime()) || end.getUTCFullYear()>2100) return json({ error:'Choose an ingress search start before 2098.' },400)
      const ingress = slowPlanetIngresses(start.toISOString(),end.toISOString()).find(row=>row.planet==='Saturn')
      if (!ingress) return json({ error:'No Saturn sign ingress found in the three-year search horizon.' },404)
      return json({ ingress, transit: transitOverlay(report.natalChart, ingress.instantUtc) })
    }
    if (input.operation === 'transits') return json({ transit: transitOverlay(report.natalChart, input.instantUtc ?? input.chart.referenceInstantUtc) })
    if (input.operation === 'synastry') { if (!secondary) return json({ error: 'Enter the second chart.' }, 400); return json({ synastry: corporateSynastry(report.natalChart, secondary.report.natalChart, secondary.kind), secondary }) }
    if (!input.consentToStore) return json({ error: 'Explicit consent to encrypted chart storage is required.' }, 400)
    if (!astrologyBillingConfig()) return json({ error: 'Private vault and checkout configuration is incomplete.' }, 503)
    const digest = dossierBundleDigest(input), existing = (await vaultEntries(userId, entitlement)).find(e => e.chartDigest === digest)
    if (input.operation === 'checkout' && existing?.kind === 'dossier') return json({ error: 'This dossier is already in your vault.' }, 409)
    const entry: VaultEntry = { chartDigest: digest, label: input.label || 'Untitled chart', purchasedAt: new Date().toISOString(), kind: input.operation === 'save' ? 'saved' : 'dossier', origin: 'saved', encryptedChart: encryptVault(JSON.stringify({ chart: input.chart, secondary: input.secondary }), userId) }
    if (input.operation === 'checkout') {
      entry.encryptedPdf = encryptVault((await generateExecutiveDossier(report, secondary)).toString('base64'), userId)
      return json({ url: await createAstrologyCheckout(request, userId, 'dossier', input.requestId!, entry) })
    }
    if (input.operation === 'save') { await saveVaultEntry(userId, entry); return json({ digest, saved: true }) }
    if (input.operation === 'pdf') {
      const reservation = existing?.kind === 'dossier' ? null : await reserveMonthlyDossier(userId)
      try {
        const pdf = existing?.encryptedPdf ? Buffer.from(decryptVault(existing.encryptedPdf, userId), 'base64') : await generateExecutiveDossier(report, secondary)
        await saveVaultEntry(userId, { ...entry, origin: existing?.kind === 'dossier' ? existing.origin : reservation!.origin, encryptedPdf: encryptVault(pdf.toString('base64'), userId) })
        return new Response(new Uint8Array(pdf), { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="maha-executive-dossier.pdf"' } })
      } catch (error) { if (reservation) await reservation.refund(); throw error }
    }
    return json({ error: 'Unsupported operation.' }, 400)
  } catch (error) { return json({ error: error instanceof AstrologyAccessError ? error.message : 'The request could not be completed. Check account and compiler configuration, then retry.' }, error instanceof AstrologyAccessError ? error.status : 503) }
}
