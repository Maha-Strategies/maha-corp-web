import { createHash } from 'node:crypto'

const DEFAULT_BASE_URL = 'https://www.mahastrategies.com'

type Json = Record<string, unknown>

function object(value: unknown, label: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Json
}

function requestId(arguments_: readonly string[]): string {
  return createHash('sha256').update(arguments_.join('|')).digest('hex').slice(0, 24)
}

function recordIds(arguments_: readonly string[]): string[] {
  const values = arguments_.flatMap((argument, index) => argument === '--record-id' ? [arguments_[index + 1]] : [])
  if (values.some((value) => !value)) throw new Error('--record-id requires a record URN.')
  return values as string[]
}

export async function runEpistemicPublishingFactory(environment: NodeJS.ProcessEnv = process.env, arguments_ = process.argv.slice(2)): Promise<void> {
  const apply = arguments_.includes('--apply')
  const baseUrl = (environment.PRODUCTION_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  const token = environment.EPISTEMIC_OPERATIONS_TOKEN?.trim()
  if (!token || Buffer.byteLength(token, 'utf8') < 32) throw new Error('EPISTEMIC_OPERATIONS_TOKEN must contain at least 32 bytes.')
  if (!/(^|\.)mahastrategies\.com$/.test(new URL(baseUrl).host)) throw new Error(`Refusing non-Production host ${baseUrl}.`)
  const selected = recordIds(arguments_)
  const body = {
    operation: apply ? 'compile' : 'preview',
    recordIds: selected,
    idempotencyKey: `epistemic-factory:${requestId([baseUrl, ...selected, apply ? 'apply' : 'preview'])}`,
  }
  const response = await fetch(`${baseUrl}/api/admin/epistemic-factory`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = object(await response.json().catch(() => ({})), 'factory response')
  if (!response.ok) {
    const error = object(payload.error ?? {}, 'factory error')
    throw new Error(`Factory returned ${response.status}: ${String(error.code ?? 'unknown')} ${String(error.message ?? '')}`)
  }
  const run = object(payload.run, 'factory run')
  const counts = object(run.counts, 'factory counts')
  console.log(`${apply ? 'COMPILED' : 'PREVIEW'} noncanonical publishing factory`)
  console.log(`Run: ${String(run.runId)}`)
  console.log(`Targets: ${String(run.targetCount)}`)
  console.log(`Automated checks passed: ${String(counts.automatedChecksPassed)}; review required: ${String(counts.reviewRequired)}; blocked: ${String(counts.blocked)}`)
  console.log(`Canonical: ${String(counts.canonical)}; sitemap eligible: ${String(counts.sitemapEligible)}`)
  console.log(String(payload.boundary ?? ''))
  if (!apply) console.log('No state changed. Re-run with --apply to persist the immutable run, audits, and reviewer packets.')
}

if (import.meta.url === `file://${process.argv[1]}`) await runEpistemicPublishingFactory()
