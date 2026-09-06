import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { buildTrancheTenReview } from '../lib/federation-tranche-ten-review.ts'

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

export function generateFederationTrancheTenReview(outputRoot: string) {
  type Input = Parameters<typeof buildTrancheTenReview>[0]
  const cohort = verified<Input['cohort']>('content/federation/federation-tranche-10-cohort-v1.json')
  const candidates = verified<Input['candidates']>('content/federation/federation-route-candidates-v1.json')
  const packetPaths = [
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((tranche) => `content/federation/federation-tranche-${tranche}-evidence-packets-v1.json`),
    'content/federation/federation-readiness-remediation-packets-v1.json',
  ]
  const priorPacketManifests = packetPaths.map((path) => verified<Input['priorPacketManifests'][number]>(path))
  const result = buildTrancheTenReview({ cohort, candidates, priorPacketManifests })
  const artifacts: Array<[string, unknown]> = [
    ['content/federation/federation-tranche-10-semantic-validation-v1.json', result.semanticManifest],
    ['content/federation/federation-tranche-10-dependency-validation-v1.json', result.dependencyManifest],
    ['content/federation/federation-tranche-10-evidence-packets-v1.json', result.packetManifest],
    ['content/federation/federation-tranche-10-decisions-v1.json', result.decisionManifest],
    ['content/federation/federation-tranche-10-page-specifications-v1.json', result.specificationManifest],
    ['content/federation/federation-tranche-10-readiness-v1.json', result.readiness],
  ]
  artifacts.forEach(([path, value]) => writeJson(outputRoot, path, value))

  const held = result.decisionManifest.entries.filter((entry) => entry.disposition !== 'evidence-ready')
  const reportPath = 'docs/federation/federation-candidates-901-1000-local-readiness.md'
  const report = `${[
    '# Federation candidates 901–1,000 local readiness',
    '',
    'Status: **local-reviewed-unreleased**',
    '',
    '## Exact outcome',
    '',
    `- Frozen candidates: ${result.readiness.counts.candidates}.`,
    `- Evidence-ready: ${result.readiness.counts.evidenceReady}.`,
    `- Revise: ${result.readiness.counts.revise}; blocked: ${result.readiness.counts.blocked}; duplicative: ${result.readiness.counts.duplicative}.`,
    `- Topics: ${result.packetManifest.counts.topics}; freshly inspected or refreshed: ${result.packetManifest.counts.newTopics}; carried at the exact recorded version and scope: ${result.packetManifest.counts.carriedForwardTopics}.`,
    `- Substantial-page specifications: ${result.readiness.counts.pageSpecifications}; public routes: 0; builds: 0.`,
    '',
    '## Held candidates',
    '',
    ...held.map((entry) => `- \`${entry.url}\` — ${entry.reason}`),
    '',
    '## New evidence boundaries',
    '',
    '- Automated contracting is supported by an UNCITRAL model law, not automatically enacted law in any jurisdiction.',
    '- Model evaluation remains context-, risk-, metric-, population-, and deployment-condition specific. A passing evaluation is not universal certification.',
    '- The U.S. Evidence Act is statute; executive scientific-integrity direction is a separate and changeable instrument.',
    '- Data-retention controls require a declared lifecycle and policy but do not supply one universal retention period or prove deletion.',
    '- Coordinate-frame transformations establish astronomical geometry, not astrological interpretation or predictive validity.',
    '- A literary landscape relation, named translation, commentary, reception history, and theology remain different evidence frames.',
    '- PHIVOLCS remains the operational authority for Mayon. No alert level or gas value is copied into this durable packet.',
    '- The Maha Principle and recursive institutions remain disclosed authorial concepts, not settled scholarship or empirically validated doctrine.',
    '- Three calculation-labelled astrology candidates remain held because no matching recomputable fixture exists.',
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
  const result = generateFederationTrancheTenReview(resolve(argument('output-root') ?? ROOT))
  console.log(JSON.stringify({ counts: result.readiness.counts, packetCounts: result.packetManifest.counts, artifacts: result.artifacts }, null, 2))
}
