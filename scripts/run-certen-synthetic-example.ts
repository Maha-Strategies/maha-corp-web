import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildCertenSyntheticExample, certenExampleDigest, CERTEN_EXAMPLE_TIME, evaluateCertenSyntheticExample } from '../lib/certen-synthetic-example.ts'
import { bytesDigest } from '../lib/x402/buyer-delivery-check.ts'

async function main() {
  const args = process.argv.slice(2)
  if (args.length && (args.length !== 2 || args[0] !== '--output-dir' || !args[1])) throw new Error('Use --output-dir <new local directory> or no arguments.')
  const example = buildCertenSyntheticExample()
  const trust = { authorizationSha256: certenExampleDigest(example.authorization),
    captureSha256: bytesDigest(example.delivery.captureJson), now: CERTEN_EXAMPLE_TIME, usedNonces: [] as string[] }
  const report = evaluateCertenSyntheticExample(example, trust)
  if (report.preSignDecision !== 'eligible_for_signer_review' || report.delivery?.state !== 'payload_verified') throw new Error('Synthetic positive case failed.')
  const cases = [
    ['changed actor', (value: typeof example) => { value.intent.actor = 'synthetic:other-buyer' }],
    ['changed endpoint', (value: typeof example) => { value.intent.resourcePath = '/api/v1/other' }],
    ['changed amount', (value: typeof example) => { value.intent.amountBaseUnits = '1001' }],
    ['changed evidence', (value: typeof example) => { value.evidence[0]!.text = 'altered policy' }],
    ['missing context', (value: typeof example) => { value.selectedContext = '' }],
  ] as const
  const tamperResults = cases.map(([name, mutate]) => {
    const value = structuredClone(example); mutate(value)
    const result = evaluateCertenSyntheticExample(value, trust)
    if (result.preSignDecision !== 'withhold') throw new Error('Tamper case did not fail closed.')
    return { name, preSignDecision: result.preSignDecision, problems: result.problems }
  })
  if (args[1]) {
    // Refuse an existing directory and existing files; never overwrite a buyer's evidence.
    await mkdir(args[1], { mode: 0o700 })
    const files: Record<string, string> = {
      'example.json': JSON.stringify(example, null, 2), 'trust.json': JSON.stringify(trust, null, 2),
      'report.json': JSON.stringify({ report, tamperResults }, null, 2),
      'request.json': example.requestJson, 'response.json': example.delivery.responseJson,
      'capture.json': example.delivery.captureJson,
    }
    for (const [name, data] of Object.entries(files)) await writeFile(join(args[1], name), data, { mode: 0o600, flag: 'wx' })
  }
  console.log(JSON.stringify({ syntheticOnly: true, paymentsMade: 0, providerCallsMade: 0,
    report, tamperResults }, null, 2))
}
main().catch((error) => { console.error(error instanceof Error ? error.message : 'Synthetic example failed'); process.exitCode = 1 })
