import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

import {
  BASE_NETWORK,
  BASE_USDC,
  BAZAAR_MERCHANT_URL,
  MAHA_PAYEE,
  type BazaarResource,
} from '../lib/x402/discovery-payment-recipe.ts'
import { MPS_AUTONOMOUS_AUDIT_OFFER } from '../lib/x402/offers.ts'

const SUBJECT = 'https://www.mahastrategies.com/api/v1/mps/audit'
const EVIDENCE = 'mps-verification.json'
const ATTEMPTS = 30
const INTERVAL_MS = 60_000

export function isMpsIndexed(resources: BazaarResource[]): boolean {
  return resources.some((candidate) => {
    if (candidate.resource !== SUBJECT || !candidate.extensions?.bazaar) return false
    return candidate.accepts?.some((requirement) =>
      requirement.scheme === 'exact'
      && requirement.network === BASE_NETWORK
      && requirement.amount === MPS_AUTONOMOUS_AUDIT_OFFER.amount
      && requirement.asset.toLowerCase() === BASE_USDC.toLowerCase()
      && requirement.payTo.toLowerCase() === MAHA_PAYEE.toLowerCase()) ?? false
  })
}

async function indexed(): Promise<boolean> {
  const url = new URL(BAZAAR_MERCHANT_URL)
  url.searchParams.set('payTo', MAHA_PAYEE)
  url.searchParams.set('limit', '100')
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'maha-mps-index-observer/0.1' },
  })
  if (!response.ok) throw new Error(`Bazaar merchant discovery returned HTTP ${response.status}.`)
  const body = await response.json() as { resources?: unknown }
  if (!Array.isArray(body.resources)) throw new Error('Bazaar merchant discovery omitted resources.')
  return isMpsIndexed(body.resources as BazaarResource[])
}

async function run(): Promise<void> {
  const evidence = JSON.parse(await readFile(EVIDENCE, 'utf8')) as Record<string, unknown>
  if (evidence.outcome !== 'settled_and_verified_pending_index') {
    throw new Error(`Refusing index observation for settlement state ${String(evidence.outcome)}.`)
  }
  const startedAt = new Date().toISOString()
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    if (await indexed()) {
      evidence.bazaar = { indexed: true, observedAt: new Date().toISOString(), attempts: attempt, readOnly: true }
      evidence.outcome = 'settled_verified_and_indexed'
      await writeFile(EVIDENCE, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
      console.log(`Bazaar indexed the MPS offer after ${attempt} read-only observation(s).`)
      return
    }
    if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
  }
  evidence.bazaar = {
    indexed: false,
    observationStartedAt: startedAt,
    observedThrough: new Date().toISOString(),
    attempts: ATTEMPTS,
    readOnly: true,
    nextAction: 'Continue read-only observation. Do not authorize or retry payment for indexing delay.',
  }
  await writeFile(EVIDENCE, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
  console.log('Settlement remains verified; Bazaar indexing was not observed in this bounded window. No payment retry is warranted.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
