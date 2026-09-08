import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { buildTrancheNineReview } from '../lib/federation-tranche-nine-review.ts'

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

export function generateFederationTrancheNineReview(outputRoot: string) {
  type Input = Parameters<typeof buildTrancheNineReview>[0]
  const cohort = verified<Input['cohort']>('content/federation/federation-tranche-9-cohort-v1.json')
  const candidates = verified<Input['candidates']>('content/federation/federation-route-candidates-v1.json')
  const packetPaths = [
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((tranche) => `content/federation/federation-tranche-${tranche}-evidence-packets-v1.json`),
    'content/federation/federation-readiness-remediation-packets-v1.json',
  ]
  const priorPacketManifests = packetPaths.map((path) => verified<Input['priorPacketManifests'][number]>(path))
  const result = buildTrancheNineReview({ cohort, candidates, priorPacketManifests })
  const artifacts: Array<[string, unknown]> = [
    ['content/federation/federation-tranche-9-semantic-validation-v1.json', result.semanticManifest],
    ['content/federation/federation-tranche-9-dependency-validation-v1.json', result.dependencyManifest],
    ['content/federation/federation-tranche-9-evidence-packets-v1.json', result.packetManifest],
    ['content/federation/federation-tranche-9-decisions-v1.json', result.decisionManifest],
    ['content/federation/federation-tranche-9-page-specifications-v1.json', result.specificationManifest],
    ['content/federation/federation-tranche-9-readiness-v1.json', result.readiness],
  ]
  artifacts.forEach(([path, value]) => writeJson(outputRoot, path, value))

  const held = result.decisionManifest.entries.filter((entry) => entry.disposition !== 'evidence-ready')
  const reportPath = 'docs/federation/federation-candidates-801-900-local-readiness.md'
  const report = `${[
    '# Federation candidates 801–900 local readiness',
    '',
    'Status: **local-reviewed-unreleased**',
    '',
    '## Exact outcome',
    '',
    `- Frozen candidates: ${result.readiness.counts.candidates}.`,
    `- Evidence-ready: ${result.readiness.counts.evidenceReady}.`,
    `- Revise: ${result.readiness.counts.revise}; blocked: ${result.readiness.counts.blocked}; duplicative: ${result.readiness.counts.duplicative}.`,
    `- Topics: ${result.packetManifest.counts.topics}; newly bound or freshly inspected: ${result.packetManifest.counts.newTopics}; carried forward at the exact recorded version and scope: ${result.packetManifest.counts.carriedForwardTopics}.`,
    `- Substantial-page specifications: ${result.readiness.counts.pageSpecifications}; public routes: 0; builds: 0.`,
    '',
    '## Held candidates',
    '',
    ...held.map((entry) => `- \`${entry.url}\` — ${entry.reason}`),
    '',
    '## New evidence boundaries',
    '',
    '- A live DOI and deposited metadata establish identifier and bibliographic state, not passage-level claim support.',
    '- Full-text availability and reuse rights remain separate. PMC main-site bulk downloading is not an authorized substitute for the OA dataset interfaces.',
    '- Reproducibility, replication, provenance, and scientific correctness remain separate claims.',
    '- Emergency access remains identified, bounded, least-privilege, auditable, and jurisdiction-specific; it is not an unrestricted bypass.',
    '- Scientific-evidence and semiconductor-policy pages remain tied to named U.S. or EU instruments. Mechanisms and appropriations are not measured outcomes.',
    '- Government hosting and signed-document integrity do not prove that a source supports a claim or states current law.',
    '- Māyōṉ–mullai and Cēyōṉ–kuṟiñci are passage-level literary relations. Epithets do not silently become timeless identities.',
    '- Astrology workflows make inputs, frames, namespaces, and tests reproducible without claiming astrological validity.',
    '- “Epistemic clearance” and “recursive institutions” are disclosed Maha editorial labels derived from authorial and operational sources, not settled scholarship.',
    '',
    '## Build and integration boundary',
    '',
    'No route file, sitemap entry, llms.txt entry, canonical release, Next.js build, Vercel build, deployment, push, or Production mutation is created. Claude’s API/product unification paths are not imported or modified. The embargo remains: no build until all 4,000 routes are ready and the owner explicitly authorizes it.',
    '',
    `Readiness digest: \`${result.readiness.provenanceDigest}\``,
  ].join('\n')}\n`
  const target = resolve(outputRoot, reportPath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, report)
  return { ...result, artifacts: [...artifacts.map(([path]) => path), reportPath] }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const result = generateFederationTrancheNineReview(resolve(argument('output-root') ?? ROOT))
  console.log(JSON.stringify({ counts: result.readiness.counts, packetCounts: result.packetManifest.counts, artifacts: result.artifacts }, null, 2))
}
