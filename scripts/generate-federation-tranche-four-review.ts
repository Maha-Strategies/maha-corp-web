import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { buildTrancheFourReview } from '../lib/federation-tranche-four-review.ts'
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'

const ROOT = resolve(import.meta.dirname, '..')

function argument(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function verified<T extends { provenanceDigest: string }>(path: string): T {
  const value = JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T
  if (provenanceDigest(value) !== value.provenanceDigest) throw new Error(`Input digest does not verify: ${path}`)
  return value
}

function writeJson(outputRoot: string, path: string, value: unknown) {
  const target = resolve(outputRoot, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`)
}

export function generateFederationTrancheFourReview(outputRoot: string) {
  type Input = Parameters<typeof buildTrancheFourReview>[0]
  const cohort = verified<Input['cohort']>('content/federation/federation-tranche-4-cohort-v1.json')
  const candidates = verified<Input['candidates']>('content/federation/federation-route-candidates-v1.json')
  const packetPaths = [
    'content/federation/federation-tranche-1-evidence-packets-v1.json',
    'content/federation/federation-tranche-2-evidence-packets-v1.json',
    'content/federation/federation-tranche-3-evidence-packets-v1.json',
    'content/federation/federation-readiness-remediation-packets-v1.json',
  ]
  const priorPacketManifests = packetPaths.map((path) => verified<Input['priorPacketManifests'][number]>(path))
  const result = buildTrancheFourReview({ cohort, candidates, priorPacketManifests })
  const artifacts: Array<[string, unknown]> = [
    ['content/federation/federation-tranche-4-semantic-validation-v1.json', result.semanticManifest],
    ['content/federation/federation-tranche-4-dependency-validation-v1.json', result.dependencyManifest],
    ['content/federation/federation-tranche-4-evidence-packets-v1.json', result.packetManifest],
    ['content/federation/federation-tranche-4-decisions-v1.json', result.decisionManifest],
    ['content/federation/federation-tranche-4-page-specifications-v1.json', result.specificationManifest],
    ['content/federation/federation-tranche-4-readiness-v1.json', result.readiness],
  ]
  artifacts.forEach(([path, value]) => writeJson(outputRoot, path, value))

  const reportPath = 'docs/federation/federation-candidates-301-400-local-readiness.md'
  const held = result.decisionManifest.entries.filter((entry) => entry.disposition !== 'evidence-ready')
  const report = `${[
    '# Federation candidates 301–400 local readiness',
    '',
    'Status: **local-reviewed-unreleased**',
    '',
    '## Exact outcome',
    '',
    `- Frozen candidates: ${result.readiness.counts.candidates}.`,
    `- Evidence-ready: ${result.readiness.counts.evidenceReady}.`,
    `- Revise: ${result.readiness.counts.revise}; blocked: ${result.readiness.counts.blocked}; duplicative: ${result.readiness.counts.duplicative}.`,
    `- Topics: ${result.packetManifest.counts.topics}; freshly inspected: ${result.packetManifest.counts.newTopics}; carried forward at the same version and scope: ${result.packetManifest.counts.carriedForwardTopics}.`,
    `- Substantial-page specifications: ${result.readiness.counts.pageSpecifications}; public routes: 0; builds: 0.`,
    '',
    '## Held candidates',
    '',
    ...held.map((entry) => `- \`${entry.url}\` — ${entry.reason}`),
    '',
    '## Evidence boundaries',
    '',
    '- Commercialization pages remain revise unless a current exact-capability offer establishes availability, price, scope, and delivery boundary.',
    '- Current Mayon alert levels and numerical monitoring values are deliberately absent; operators must read the latest PHIVOLCS bulletin.',
    '- Author identity separates authenticated identifiers, contributor roles, authorship decisions, and claim responsibility.',
    '- International coordination separates non-binding recommendations, treaty text, entry into force, ratification, jurisdiction, and implementation.',
    '- Provenance receipts represent and verify bounded recorded metadata; they do not certify truth or scientific validity.',
    '',
    '## Build boundary',
    '',
    'No route file, sitemap entry, llms.txt entry, canonical release, Next.js build, Vercel build, deployment, or Production mutation is created. The explicit embargo remains: no build until all 4,000 routes are ready and the owner authorizes it.',
    '',
    `Readiness digest: \`${result.readiness.provenanceDigest}\``,
  ].join('\n')}\n`
  const target = resolve(outputRoot, reportPath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, report)
  return { ...result, artifacts: [...artifacts.map(([path]) => path), reportPath] }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const result = generateFederationTrancheFourReview(resolve(argument('output-root') ?? ROOT))
  console.log(JSON.stringify({ counts: result.readiness.counts, packetCounts: result.packetManifest.counts, artifacts: result.artifacts }, null, 2))
}
