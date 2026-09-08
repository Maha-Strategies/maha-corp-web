import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { buildReadinessRemediations, buildTrancheThreeReview } from '../lib/federation-continuation.ts'
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'

const ROOT = resolve(import.meta.dirname, '..')

function argument(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T
}

function verified<T extends { provenanceDigest: string }>(path: string): T {
  const value = readJson<T>(path)
  if (provenanceDigest(value) !== value.provenanceDigest) throw new Error(`Input digest does not verify: ${path}`)
  return value
}

function writeJson(outputRoot: string, path: string, value: unknown) {
  const target = resolve(outputRoot, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`)
}

export function generateFederationContinuation(outputRoot: string) {
  type Candidates = Parameters<typeof buildTrancheThreeReview>[0]['candidates']
  type Cohort = Parameters<typeof buildTrancheThreeReview>[0]['cohort']
  type Packets = Parameters<typeof buildTrancheThreeReview>[0]['priorPacketManifests'][number]
  type Decisions = Parameters<typeof buildReadinessRemediations>[0]['trancheOneDecisions']
  const candidates = verified<Candidates>('content/federation/federation-route-candidates-v1.json')
  const cohort = verified<Cohort>('content/federation/federation-tranche-3-cohort-v1.json')
  const trancheOnePackets = verified<Packets>('content/federation/federation-tranche-1-evidence-packets-v1.json')
  const trancheTwoPackets = verified<Packets>('content/federation/federation-tranche-2-evidence-packets-v1.json')
  const trancheOneDecisions = verified<Decisions>('content/federation/federation-tranche-1-decisions-v1.json')
  const trancheTwoDecisions = verified<Decisions>('content/federation/federation-tranche-2-decisions-v1.json')
  const remediationDeterminations = verified<{ provenanceDigest: string }>('content/federation/federation-tranche-2-remediation-determinations-v1.json')
  const baseline = verified<{ provenanceDigest: string; totals: { observedCanonicalRoutes: number; targetCanonicalRoutes: number; candidateGap: number } }>('content/federation/federation-route-baseline-v1.json')

  const remediations = buildReadinessRemediations({ candidates, trancheOnePackets, trancheTwoPackets, trancheOneDecisions, trancheTwoDecisions, remediationDeterminationsDigest: remediationDeterminations.provenanceDigest })
  const trancheThree = buildTrancheThreeReview({ cohort, candidates, priorPacketManifests: [trancheOnePackets, trancheTwoPackets] })
  const artifacts: Array<[string, unknown]> = [
    ['content/federation/federation-readiness-remediation-review-v1.json', remediations.review],
    ['content/federation/federation-readiness-remediation-packets-v1.json', remediations.packetManifest],
    ['content/federation/federation-readiness-remediation-decisions-v1.json', remediations.decisionManifest],
    ['content/federation/federation-readiness-remediation-page-specifications-v1.json', remediations.specificationManifest],
    ['content/federation/federation-tranche-3-semantic-validation-v1.json', trancheThree.semanticManifest],
    ['content/federation/federation-tranche-3-dependency-validation-v1.json', trancheThree.dependencyManifest],
    ['content/federation/federation-tranche-3-evidence-packets-v1.json', trancheThree.packetManifest],
    ['content/federation/federation-tranche-3-decisions-v1.json', trancheThree.decisionManifest],
    ['content/federation/federation-tranche-3-page-specifications-v1.json', trancheThree.specificationManifest],
    ['content/federation/federation-tranche-3-readiness-v1.json', trancheThree.readiness],
  ]
  artifacts.forEach(([path, value]) => writeJson(outputRoot, path, value))
  const reportPath = 'docs/federation/federation-candidates-201-300-local-readiness.md'
  const report = `${[
    '# Federation candidates 201–300 and readiness remediation',
    '',
    'Status: **local-reviewed-unreleased**',
    '',
    '## Exact outcome',
    '',
    '- Claude promotions reviewed: 5; accepted with recorded narrowing: 5.',
    '- Health-data prerequisite: 1 narrowed operational permission definition accepted; 11 downstream Maha OS holds clear in the combined compiler.',
    `- Candidates 201–300: ${trancheThree.readiness.counts.evidenceReady} evidence-ready, ${trancheThree.readiness.counts.revise} revise, ${trancheThree.readiness.counts.blocked} blocked, ${trancheThree.readiness.counts.duplicative} duplicative.`,
    '- Combined candidates 1–300: 273 evidence-ready and 27 non-ready.',
    '',
    '## What remains held',
    '',
    'Five Tranche 3 commercialization pages remain revise because implementation evidence does not establish a current offer for those exact capabilities. The public-reason development page still lacks a matching authorial passage. The agentic-query-letter governance page still lacks an inspected canonical protocol. The generic editorial-review definition is duplicative of the observed Publish editorial-workflow documentation.',
    '',
    '## 4,000-route map',
    '',
    `The frozen baseline remains ${baseline.totals.observedCanonicalRoutes} observed routes plus ${baseline.totals.candidateGap} candidates to reach ${baseline.totals.targetCanonicalRoutes}. This work reviews 300 candidates but publishes none. If the 273 ready contracts are eventually adopted without collision, they would move the projection to ${baseline.totals.observedCanonicalRoutes + 273}; that is a projection, not a live count.`,
    '',
    '## Publication boundary',
    '',
    'No route file, sitemap entry, llms.txt entry, canonical release, Next.js build, Vercel build, deployment, or Production mutation is created by this tranche. Owner adapters and an explicit build authorization remain required.',
    '',
    `Tranche 3 readiness digest: \`${trancheThree.readiness.provenanceDigest}\``,
    `Remediation review digest: \`${remediations.review.provenanceDigest}\``,
  ].join('\n')}\n`
  const reportOutput = resolve(outputRoot, reportPath)
  mkdirSync(dirname(reportOutput), { recursive: true })
  writeFileSync(reportOutput, report)
  return { remediations, trancheThree, artifacts: [...artifacts.map(([path]) => path), reportPath] }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const result = generateFederationContinuation(resolve(argument('output-root') ?? ROOT))
  console.log(JSON.stringify({ remediationCounts: result.remediations.review.counts, trancheThreeCounts: result.trancheThree.readiness.counts, artifacts: result.artifacts }, null, 2))
}
