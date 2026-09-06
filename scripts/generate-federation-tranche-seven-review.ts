import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { buildTrancheSevenReview } from '../lib/federation-tranche-seven-review.ts'

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

export function generateFederationTrancheSevenReview(outputRoot: string) {
  type Input = Parameters<typeof buildTrancheSevenReview>[0]
  const cohort = verified<Input['cohort']>('content/federation/federation-tranche-7-cohort-v1.json')
  const candidates = verified<Input['candidates']>('content/federation/federation-route-candidates-v1.json')
  const packetPaths = [
    'content/federation/federation-tranche-1-evidence-packets-v1.json',
    'content/federation/federation-tranche-2-evidence-packets-v1.json',
    'content/federation/federation-tranche-3-evidence-packets-v1.json',
    'content/federation/federation-tranche-4-evidence-packets-v1.json',
    'content/federation/federation-tranche-5-evidence-packets-v1.json',
    'content/federation/federation-tranche-6-evidence-packets-v1.json',
    'content/federation/federation-readiness-remediation-packets-v1.json',
  ]
  const priorPacketManifests = packetPaths.map((path) => verified<Input['priorPacketManifests'][number]>(path))
  const result = buildTrancheSevenReview({ cohort, candidates, priorPacketManifests })
  const artifacts: Array<[string, unknown]> = [
    ['content/federation/federation-tranche-7-semantic-validation-v1.json', result.semanticManifest],
    ['content/federation/federation-tranche-7-dependency-validation-v1.json', result.dependencyManifest],
    ['content/federation/federation-tranche-7-evidence-packets-v1.json', result.packetManifest],
    ['content/federation/federation-tranche-7-decisions-v1.json', result.decisionManifest],
    ['content/federation/federation-tranche-7-page-specifications-v1.json', result.specificationManifest],
    ['content/federation/federation-tranche-7-readiness-v1.json', result.readiness],
  ]
  artifacts.forEach(([path, value]) => writeJson(outputRoot, path, value))

  const held = result.decisionManifest.entries.filter((entry) => entry.disposition !== 'evidence-ready')
  const reportPath = 'docs/federation/federation-candidates-601-700-local-readiness.md'
  const report = `${[
    '# Federation candidates 601–700 local readiness',
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
    '- Context packages and delivery receipts establish deterministic binding and retention properties, not truth, answer quality, payment, or external acknowledgement.',
    '- Rights and version metadata record assertions and typed relations; neither grants rights nor proves content equivalence.',
    '- Consent receipts and sensor provenance structure declared events and authority but do not prove identity, legal validity, calibration, comprehension, integrity, or ongoing permission.',
    '- Abstract-only evidence remains non-explanatory. Author manuscripts remain distinct from final published articles.',
    '- Calibration, ephemeris, ayanāṃśa, registration, and falsifiability workflows improve reproducibility but make no claim that astrology is scientifically validated.',
    '- Tamil primary text, translation, scholarship, reception, and theology remain separate. Passage silence about pālai is not a universal absence claim.',
    '- Smithsonian eruption history is a living secondary compilation; current operational authority remains PHIVOLCS, and no current alert value is frozen.',
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
  const result = generateFederationTrancheSevenReview(resolve(argument('output-root') ?? ROOT))
  console.log(JSON.stringify({ counts: result.readiness.counts, packetCounts: result.packetManifest.counts, artifacts: result.artifacts }, null, 2))
}
