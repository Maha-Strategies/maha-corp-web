import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { buildTrancheEightReview } from '../lib/federation-tranche-eight-review.ts'

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

export function generateFederationTrancheEightReview(outputRoot: string) {
  type Input = Parameters<typeof buildTrancheEightReview>[0]
  const cohort = verified<Input['cohort']>('content/federation/federation-tranche-8-cohort-v1.json')
  const candidates = verified<Input['candidates']>('content/federation/federation-route-candidates-v1.json')
  const packetPaths = [
    'content/federation/federation-tranche-1-evidence-packets-v1.json',
    'content/federation/federation-tranche-2-evidence-packets-v1.json',
    'content/federation/federation-tranche-3-evidence-packets-v1.json',
    'content/federation/federation-tranche-4-evidence-packets-v1.json',
    'content/federation/federation-tranche-5-evidence-packets-v1.json',
    'content/federation/federation-tranche-6-evidence-packets-v1.json',
    'content/federation/federation-tranche-7-evidence-packets-v1.json',
    'content/federation/federation-readiness-remediation-packets-v1.json',
  ]
  const priorPacketManifests = packetPaths.map((path) => verified<Input['priorPacketManifests'][number]>(path))
  const result = buildTrancheEightReview({ cohort, candidates, priorPacketManifests })
  const artifacts: Array<[string, unknown]> = [
    ['content/federation/federation-tranche-8-semantic-validation-v1.json', result.semanticManifest],
    ['content/federation/federation-tranche-8-dependency-validation-v1.json', result.dependencyManifest],
    ['content/federation/federation-tranche-8-evidence-packets-v1.json', result.packetManifest],
    ['content/federation/federation-tranche-8-decisions-v1.json', result.decisionManifest],
    ['content/federation/federation-tranche-8-page-specifications-v1.json', result.specificationManifest],
    ['content/federation/federation-tranche-8-readiness-v1.json', result.readiness],
  ]
  artifacts.forEach(([path, value]) => writeJson(outputRoot, path, value))

  const held = result.decisionManifest.entries.filter((entry) => entry.disposition !== 'evidence-ready')
  const reportPath = 'docs/federation/federation-candidates-701-800-local-readiness.md'
  const report = `${[
    '# Federation candidates 701–800 local readiness',
    '',
    'Status: **local-reviewed-unreleased**',
    '',
    '## Exact outcome',
    '',
    `- Frozen candidates: ${result.readiness.counts.candidates}.`,
    `- Evidence-ready: ${result.readiness.counts.evidenceReady}.`,
    `- Revise: ${result.readiness.counts.revise}; blocked: ${result.readiness.counts.blocked}; duplicative: ${result.readiness.counts.duplicative}.`,
    `- Topics: ${result.packetManifest.counts.topics}; freshly inspected or newly bound: ${result.packetManifest.counts.newTopics}; carried forward at the same version and scope: ${result.packetManifest.counts.carriedForwardTopics}.`,
    `- Substantial-page specifications: ${result.readiness.counts.pageSpecifications}; public routes: 0; builds: 0.`,
    '',
    '## Held candidates',
    '',
    ...(held.length ? held.map((entry) => `- \`${entry.url}\` — ${entry.reason}`) : ['- None.']),
    '',
    '## New evidence boundaries',
    '',
    '- Agent identity is workload identity within a declared trust domain. Human identity-assurance guidance is retained only to prove the boundary and is not transferred to machines or autonomous agents.',
    '- Public-sector procurement is limited to OMB M-25-22 and covered U.S. federal AI acquisition; it is not universal procurement law or legal advice.',
    '- Benchmark conclusions remain conditional on construct, items, protocol, provider, scaffolding, tools, budgets, grading, analysis, and the Initial Public Draft status of NIST AI 800-2.',
    '- Correction metadata reports publisher-supplied status. It does not decide truth or correction adequacy, and the local fixture proves transitions rather than substantive correctness.',
    '- “Civilizational computation” and “mental sovereignty” are explicitly authorial Maha concepts. They are not scientific consensus, literal computation, legal sovereignty, or empirical validation.',
    '- Astrology interpretation remains separated from source-event evidence, astronomical calculation, tradition-relative rules, and prospective evaluation.',
    '- Nārāyaṇa relationships are occurrence-level relationships in one named translation, not timeless identity or proof of theology.',
    '- Ashfall and deformation pages freeze no current Mayon value. PHIVOLCS remains the operational authority, and no single monitoring signal determines an eruption.',
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
  const result = generateFederationTrancheEightReview(resolve(argument('output-root') ?? ROOT))
  console.log(JSON.stringify({ counts: result.readiness.counts, packetCounts: result.packetManifest.counts, artifacts: result.artifacts }, null, 2))
}
