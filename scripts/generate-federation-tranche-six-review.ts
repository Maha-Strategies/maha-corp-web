import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { buildTrancheSixReview } from '../lib/federation-tranche-six-review.ts'

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

export function generateFederationTrancheSixReview(outputRoot: string) {
  type Input = Parameters<typeof buildTrancheSixReview>[0]
  const cohort = verified<Input['cohort']>('content/federation/federation-tranche-6-cohort-v1.json')
  const candidates = verified<Input['candidates']>('content/federation/federation-route-candidates-v1.json')
  const packetPaths = [
    'content/federation/federation-tranche-1-evidence-packets-v1.json',
    'content/federation/federation-tranche-2-evidence-packets-v1.json',
    'content/federation/federation-tranche-3-evidence-packets-v1.json',
    'content/federation/federation-tranche-4-evidence-packets-v1.json',
    'content/federation/federation-tranche-5-evidence-packets-v1.json',
    'content/federation/federation-readiness-remediation-packets-v1.json',
  ]
  const priorPacketManifests = packetPaths.map((path) => verified<Input['priorPacketManifests'][number]>(path))
  const result = buildTrancheSixReview({ cohort, candidates, priorPacketManifests })
  const artifacts: Array<[string, unknown]> = [
    ['content/federation/federation-tranche-6-semantic-validation-v1.json', result.semanticManifest],
    ['content/federation/federation-tranche-6-dependency-validation-v1.json', result.dependencyManifest],
    ['content/federation/federation-tranche-6-evidence-packets-v1.json', result.packetManifest],
    ['content/federation/federation-tranche-6-decisions-v1.json', result.decisionManifest],
    ['content/federation/federation-tranche-6-page-specifications-v1.json', result.specificationManifest],
    ['content/federation/federation-tranche-6-readiness-v1.json', result.readiness],
  ]
  artifacts.forEach(([path, value]) => writeJson(outputRoot, path, value))

  const held = result.decisionManifest.entries.filter((entry) => entry.disposition !== 'evidence-ready')
  const reportPath = 'docs/federation/federation-candidates-501-600-local-readiness.md'
  const report = `${[
    '# Federation candidates 501–600 local readiness',
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
    '## New evidence boundaries',
    '',
    '- Caregiver access is U.S.-specific and role-, law-, person-, and context-dependent; family relationship is never treated as universal authority.',
    '- Export-control and health-AI pages preserve jurisdiction, version, applicability, and professional-review boundaries; they are not legal or clinical advice.',
    '- Astrology infrastructure preserves unknown inputs, intervals, civil-time ambiguity, and tzdb limitations and makes no claim that astrology is scientifically validated.',
    '- Authorial concepts establish what Mayone Maharajan proposes, not priority, empirical validity, reception, or consensus.',
    '- Tamil literary pairings are kept separate from translation, commentary, historical inference, theology, and the modern Mayon Volcano namesake.',
    '- Volcano observations are time-sensitive; only current PHIVOLCS statements control operational interpretation, and no current alert value is frozen here.',
    '- Build provenance records how an artifact was produced but does not by itself prove compiler correctness, reproducibility, or scientific validity.',
    '',
    '## Build and integration boundary',
    '',
    'No route file, sitemap entry, llms.txt entry, canonical release, Next.js build, Vercel build, deployment, or Production mutation is created. Claude’s API/product unification paths are not imported or modified. The embargo remains: no build until all 4,000 routes are ready and the owner explicitly authorizes it.',
    '',
    `Readiness digest: \`${result.readiness.provenanceDigest}\``,
  ].join('\n')}\n`
  const target = resolve(outputRoot, reportPath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, report)
  return { ...result, artifacts: [...artifacts.map(([path]) => path), reportPath] }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const result = generateFederationTrancheSixReview(resolve(argument('output-root') ?? ROOT))
  console.log(JSON.stringify({ counts: result.readiness.counts, packetCounts: result.packetManifest.counts, artifacts: result.artifacts }, null, 2))
}
