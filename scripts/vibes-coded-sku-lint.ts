import { readFile } from 'node:fs/promises'

import { VIBES_CODED_PRICE_CENTS, VIBES_CODED_SKU_SLUG } from '../lib/vibes-coded-seller.ts'

const origin = (process.env.VIBES_CODED_ORIGIN ?? 'https://vibes-coded.com').replace(/\/$/, '')
const timeoutMs = 8_000

async function schema(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
}

async function main() {
  const requestSchema = await schema('public/governed-context-verification-pack-request.schema.json')
  const responseSchema = await schema('public/governed-context-verification-pack-response.schema.json')
  const payload = {
    slug: VIBES_CODED_SKU_SLUG,
    title: 'Governed Context Verification Pack',
    description: 'Compiles source-linked context, evaluates exact evidence retention, returns stable integrity hashes and policy/budget results, and delivers metadata-only evidence. It does not verify claims or retain source/result bodies.',
    price_cents: VIBES_CODED_PRICE_CENTS,
    method: 'POST',
    target_url: `${process.env.MAHA_PUBLIC_ORIGIN ?? 'https://www.mahastrategies.com'}/api/v1/seller-endpoints/${VIBES_CODED_SKU_SLUG}/call`,
    request_schema: requestSchema,
    response_schema: responseSchema,
    limitations: ['Best-effort extractive selection', 'Model-neutral token estimates', 'Exact evidence presence is not claim verification', 'Metadata-only delivery receipt'],
    content_policy_accepted: false,
    dry_run: true,
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${origin}/api/v1/outcomes/seller-first-sku-lint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'MahaStrategiesSellerLint/1.0 (+https://www.mahastrategies.com)' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
    })
    const body = await response.text()
    const output = { preflight: 'seller-first-sku-lint', paidCall: false, published: false, status: response.status, result: (() => { try { return JSON.parse(body) } catch { return { text: body.slice(0, 1000) } } })() }
    console.log(JSON.stringify(output, null, 2))
    if (!response.ok) process.exitCode = 1
  } finally {
    clearTimeout(timer)
  }
}

main().catch((error) => {
  console.error(`Vibes-Coded SKU lint unavailable: ${error instanceof Error ? error.message : 'network error'}`)
  process.exitCode = 2
})
