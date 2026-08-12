import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

import {
  assessOfferInactivity,
  findBazaarResource,
  worstLevel,
  BAZAAR_REMOVAL_AFTER_DAYS,
  INACTIVITY_URGENT_DAYS_REMAINING,
  INACTIVITY_WARN_DAYS_REMAINING,
  type OfferInactivity,
} from '../lib/x402/bazaar-inactivity.ts'
import {
  BAZAAR_MERCHANT_URL,
  MAHA_CONTEXT_RESOURCE,
  MAHA_PAYEE,
  type BazaarResource,
} from '../lib/x402/discovery-payment-recipe.ts'
import { payableOffers } from '../lib/x402/offers.ts'

const SITE_ORIGIN = 'https://www.mahastrategies.com'

/**
 * Read-only inactivity watch over every payable offer's Bazaar listing.
 *
 * Reports; never settles. A watcher that could buy its own listing back would
 * turn a $0.01 offer into a recurring charge triggered by its own silence, so
 * the refresh stays a reviewed manual dispatch and this script's only power is
 * to exit non-zero.
 *
 * Offers come from the catalog rather than a list here, so an offer promoted
 * to payable is monitored by that fact alone.
 */

function watchList(): Array<{ offerId: string; resource: string; coveredByCanary: boolean }> {
  return payableOffers().map((offer) => {
    const resource = `${SITE_ORIGIN}${offer.path}`
    return {
      offerId: offer.id,
      resource,
      // Exactly one offer has a scheduled canary behind it. Anything else is
      // covered by a human or not at all, and must be reported as such.
      coveredByCanary: resource === MAHA_CONTEXT_RESOURCE,
    }
  })
}

async function fetchMerchantResources(): Promise<BazaarResource[]> {
  const url = new URL(BAZAAR_MERCHANT_URL)
  url.searchParams.set('payTo', MAHA_PAYEE)
  url.searchParams.set('limit', '100')
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'maha-bazaar-inactivity-watch/1.0' },
  })
  if (!response.ok) throw new Error(`Bazaar merchant discovery returned HTTP ${response.status}.`)
  const body = await response.json() as { resources?: unknown }
  return Array.isArray(body.resources) ? body.resources as BazaarResource[] : []
}

function line(report: OfferInactivity): string {
  const age = report.ageDays === null ? 'unknown' : `${report.ageDays.toFixed(1)}d ago`
  const left = report.daysRemaining === null ? 'unknown' : `${report.daysRemaining.toFixed(1)}d left`
  const calls = report.totalCallsL30Days ?? 'unknown'
  const payers = report.uniquePayersL30Days ?? 'unknown'
  const coverage = report.coveredByCanary ? 'canary-covered' : 'manual refresh only'
  return `[${report.level.toUpperCase()}] ${report.offerId} (${report.reason})\n`
    + `    last settled ${age}, ${left} before removal at ${BAZAAR_REMOVAL_AFTER_DAYS}d\n`
    + `    l30d: ${calls} calls, ${payers} unique payers · ${coverage}\n`
    + `    ${report.resource}`
}

export async function runInactivityWatch(nowMs: number = Date.now()): Promise<{
  reports: OfferInactivity[]
  level: string
}> {
  const resources = await fetchMerchantResources()
  const reports = watchList().map((offer) =>
    assessOfferInactivity(offer, findBazaarResource(resources, offer.resource), nowMs))
  return { reports, level: worstLevel(reports) }
}

async function run(): Promise<void> {
  const outputPath = process.argv.includes('--output')
    ? process.argv[process.argv.indexOf('--output') + 1]
    : undefined
  // Off by default. A watch that fails the build on a fortnight of remaining
  // margin trains people to ignore it well before the margin actually matters.
  const failOnWarn = process.argv.includes('--fail-on-warn')

  const { reports, level } = await runInactivityWatch()
  console.log(`Bazaar inactivity watch — removal at ${BAZAAR_REMOVAL_AFTER_DAYS}d, `
    + `warn under ${INACTIVITY_WARN_DAYS_REMAINING}d remaining, `
    + `urgent under ${INACTIVITY_URGENT_DAYS_REMAINING}d remaining\n`)
  for (const report of reports) console.log(`${line(report)}\n`)
  console.log(`worst level: ${level}`)

  if (outputPath) {
    await writeFile(outputPath, `${JSON.stringify({
      checkedAt: new Date().toISOString(),
      removalAfterDays: BAZAAR_REMOVAL_AFTER_DAYS,
      warnDaysRemaining: INACTIVITY_WARN_DAYS_REMAINING,
      urgentDaysRemaining: INACTIVITY_URGENT_DAYS_REMAINING,
      level,
      reports,
    }, null, 2)}\n`, 'utf8')
  }

  if (level === 'urgent' || level === 'unknown') process.exitCode = 1
  else if (level === 'warn' && failOnWarn) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
