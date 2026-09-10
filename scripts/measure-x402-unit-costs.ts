/**
 * Measure per-invocation cost inputs for every deterministic paid endpoint.
 *
 * Local, offline and deterministic: no network, no model call, no settlement.
 * It reports what can actually be observed on this machine -- wall-clock
 * distribution, CPU time, request and response bytes -- for a small, median and
 * large payload per endpoint.
 *
 * It does not report a dollar figure for serverless execution. That needs the
 * hosting bill, which is not in this repository. Latency and CPU are the
 * measured inputs to that figure and are reported instead.
 */
import { writeFileSync } from 'node:fs'

import { buildContextBudgetLadder, buildEvidenceRetentionMatrix, buildGovernedContextVerificationPack }
  from '../lib/x402/context-product-family.ts'
import { buildMicroProduct } from '../lib/x402/micro-products.ts'
import { buildCelestialProduct } from '../lib/x402/celestial-products.ts'
import { buildBookSectionReceipt } from '../lib/x402/book-section-product.ts'
import { buildBookEditionReceipt } from '../lib/x402/book-edition-product.ts'
import { compileContextPack, parseContextPackRequest } from '../lib/context-compiler.ts'
import { buildDeepContextEvaluation, parseDeepContextRequest } from '../lib/deep-context-evaluation.ts'
import { payableOffers } from '../lib/x402/offers.ts'

const RUNS = 31

type Sized = { size: 'small' | 'median' | 'large' | 'fixed'; input: unknown; scalable: boolean }
type Row = {
  id: string
  priceUsd: number
  size: string
  scalable: boolean
  runs: number
  p50Ms: number
  p95Ms: number
  maxMs: number
  cpuMicrosPerCall: number
  requestBytes: number
  responseBytes: number
  note?: string
}

const clone = <T>(v: T): T => structuredClone(v)

/**
 * Grow the document array toward a target count and per-document text size.
 *
 * Original documents keep their ids: `requiredEvidence` entries reference them
 * by `sourceId`, so renaming them would invalidate the payload. Added documents
 * get fresh ids. The schema caps `documents` at 8 (lib/deep-context-evaluation.ts
 * MAX_DOCUMENTS), so the largest valid payload is 8 documents of long text, not
 * an unbounded array.
 */
function widenDocs(input: Record<string, unknown>, count: number, textRepeat: number): Record<string, unknown> {
  const out = clone(input)
  const docs = out.documents as Record<string, unknown>[] | undefined
  if (!Array.isArray(docs) || docs.length === 0) return out
  const grow = (d: Record<string, unknown>) => {
    const copy = clone(d)
    if (typeof copy.text === 'string' && textRepeat > 1) {
      copy.text = Array.from({ length: textRepeat }, () => copy.text as string).join('\n\n')
    }
    return copy
  }
  const grown = docs.map(grow)
  for (let i = docs.length; i < count; i += 1) {
    const copy = grow(docs[i % docs.length])
    copy.id = `filler-${i}`
    copy.title = `Filler document ${i}`
    grown.push(copy)
  }
  out.documents = grown.slice(0, count)
  return out
}

/** Repeat a named array field to `count` entries, keeping ids unique. */
function widenArray(input: Record<string, unknown>, field: string, count: number): Record<string, unknown> {
  const out = clone(input)
  const arr = out[field] as unknown[] | undefined
  if (!Array.isArray(arr) || arr.length === 0) return out
  out[field] = Array.from({ length: count }, (_, i) => {
    const item = clone(arr[i % arr.length]) as Record<string, unknown>
    if (typeof item.eventId === 'string') item.eventId = `event-${String(i).padStart(3, '0')}`
    return item
  })
  return out
}

function payloadsFor(id: string, sample: Record<string, unknown>): Sized[] {
  switch (id) {
    // documents: 1-8. Text grown so the large case approaches the offer's
    // declared maxRequestBytes rather than merely adding short documents.
    case 'context-compression':
    case 'context-budget-ladder':
    case 'evidence-retention-matrix':
    case 'governed-context-verification-pack':
    case 'deep-context-evaluation':
      return [
        { size: 'small', input: sample, scalable: true },
        { size: 'median', input: widenDocs(sample, 4, 8), scalable: true },
        { size: 'large', input: widenDocs(sample, 8, 120), scalable: true },
      ]
    // bindings: 1-20 (lib/x402/micro-contracts.ts:36).
    case 'citation-binding-check':
      return [
        { size: 'small', input: sample, scalable: true },
        { size: 'median', input: widenArray(sample, 'bindings', 10), scalable: true },
        { size: 'large', input: widenArray(sample, 'bindings', 20), scalable: true },
      ]
    // events: 1-100 (lib/x402/micro-contracts.ts:38).
    case 'audit-export-normalizer':
      return [
        { size: 'small', input: sample, scalable: true },
        { size: 'median', input: widenArray(sample, 'events', 50), scalable: true },
        { size: 'large', input: widenArray(sample, 'events', 100), scalable: true },
      ]
    default:
      // Fixed-shape input: a celestial instant, a scalar conversion, a lineage
      // pair, one name, one book section or edition. There is no larger valid
      // payload, so cost does not vary with input size and a distribution over
      // sizes would be invented rather than measured.
      return [{ size: 'fixed', input: sample, scalable: false }]
  }
}

async function invoke(id: string, input: unknown): Promise<unknown> {
  if (id === 'context-compression') return compileContextPack(parseContextPackRequest(clone(input)))
  if (id === 'deep-context-evaluation') return buildDeepContextEvaluation(parseDeepContextRequest(clone(input)))
  if (id === 'context-budget-ladder') return buildContextBudgetLadder(clone(input))
  if (id === 'evidence-retention-matrix') return buildEvidenceRetentionMatrix(clone(input))
  if (id === 'governed-context-verification-pack') return buildGovernedContextVerificationPack(clone(input))
  if (id.startsWith('celestial-')) return buildCelestialProduct(id as never, clone(input))
  if (id === 'book-section-the-imagined-life') return buildBookSectionReceipt('the-imagined-life', clone(input))
  if (id === 'book-section-the-volcanic-engine') return buildBookSectionReceipt('the-volcanic-engine', clone(input))
  if (id === 'book-edition-the-imagined-life') return buildBookEditionReceipt('the-imagined-life', clone(input))
  if (id === 'book-edition-the-volcanic-engine') return buildBookEditionReceipt('the-volcanic-engine', clone(input))
  return buildMicroProduct(id as never, clone(input))
}

/** Endpoints whose cost is dominated by a model call this harness cannot make. */
const MODEL_BACKED = new Set(['mps-autonomous-audit', 'research-intake-evidence-pack'])

const rows: Row[] = []
const skipped: { id: string; reason: string }[] = []

for (const offer of payableOffers()) {
  const priceUsd = Number(offer.amount) / 1e6
  if (MODEL_BACKED.has(offer.id)) {
    skipped.push({ id: offer.id, reason: 'model-backed: cost is dominated by a Claude call this harness does not make' })
    continue
  }
  const sample = offer.discovery.input as Record<string, unknown>
  for (const payload of payloadsFor(offer.id, sample)) {
    let response: unknown
    try {
      response = await invoke(offer.id, payload.input)
    } catch (error) {
      skipped.push({ id: `${offer.id} (${payload.size})`, reason: `payload rejected: ${(error as Error).message}` })
      continue
    }
    const times: number[] = []
    const cpu = process.cpuUsage()
    for (let i = 0; i < RUNS; i += 1) {
      const t = performance.now()
      await invoke(offer.id, payload.input)
      times.push(performance.now() - t)
    }
    const usage = process.cpuUsage(cpu)
    times.sort((a, b) => a - b)
    rows.push({
      id: offer.id,
      priceUsd,
      size: payload.size,
      scalable: payload.scalable,
      runs: RUNS,
      p50Ms: Number(times[Math.floor(RUNS * 0.5)].toFixed(4)),
      p95Ms: Number(times[Math.floor(RUNS * 0.95)].toFixed(4)),
      maxMs: Number(times[RUNS - 1].toFixed(4)),
      cpuMicrosPerCall: Math.round((usage.user + usage.system) / RUNS),
      requestBytes: Buffer.byteLength(JSON.stringify(payload.input)),
      responseBytes: Buffer.byteLength(JSON.stringify(response)),
      ...(payload.scalable ? {} : { note: 'fixed-shape input; cost does not vary with payload size' }),
    })
  }
}

const out = {
  measuredOn: new Date().toISOString(),
  runsPerPayload: RUNS,
  method: 'In-process invocation of each endpoint\'s build function. No network, no model call, no settlement.',
  notMeasured: 'Serverless execution cost in dollars: requires the hosting bill, which is not in this repository.',
  rows,
  skipped,
}
writeFileSync('/private/tmp/claude-501/-Users-mayonerajan-Projects-maha-corp-web/b615985c-ba09-4562-b363-1b02f7b91dd9/scratchpad/unit-costs.json',
  `${JSON.stringify(out, null, 2)}\n`)

console.log(`measured ${rows.length} endpoint/payload combinations across ${new Set(rows.map(r => r.id)).size} endpoints`)
for (const s of skipped) console.log(`  skipped: ${s.id} -- ${s.reason}`)
