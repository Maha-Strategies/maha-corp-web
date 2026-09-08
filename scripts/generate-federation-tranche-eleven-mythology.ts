import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import {
  buildTrancheElevenMythology,
  type MythologyCandidateMap,
  type MythologyDependencyGraph,
} from '../lib/federation-tranche-eleven-mythology.ts'

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

export function generateFederationTrancheElevenMythology(outputRoot = ROOT) {
  const candidateMap = verified<MythologyCandidateMap>('content/federation/federation-route-candidates-v2.json')
  const dependencyGraph = verified<MythologyDependencyGraph>('content/federation/federation-dependency-graph-v2.json')
  const result = buildTrancheElevenMythology({ candidateMap, dependencyGraph })
  const artifacts: Array<[string, unknown]> = [
    ['content/federation/federation-tranche-11-mythology-cohort-v1.json', result.cohort],
    ['content/federation/federation-tranche-11-mythology-semantic-validation-v1.json', result.semanticValidation],
    ['content/federation/federation-tranche-11-mythology-dependency-validation-v1.json', result.dependencyValidation],
    ['content/federation/federation-tranche-11-mythology-source-inspections-v1.json', result.sourceInspections],
    ['content/federation/federation-tranche-11-mythology-decisions-v1.json', result.decisionManifest],
    ['content/federation/federation-tranche-11-mythology-page-specifications-v1.json', result.pageSpecifications],
    ['content/federation/federation-tranche-11-mythology-readiness-v1.json', result.readiness],
  ]
  for (const [path, value] of artifacts) writeJson(outputRoot, path, value)

  const held = result.decisionManifest.entries.filter((entry) => entry.disposition !== 'evidence-ready')
  const reportPath = 'docs/federation/federation-candidates-1001-1100-mythology-local-readiness.md'
  const report = `${[
    '# Federation candidates 1,001–1,100: mythology local readiness',
    '',
    'Status: **local-reviewed-unreleased**',
    '',
    '## Outcome',
    '',
    `- Frozen and manually adjudicated: ${result.readiness.counts.candidates}.`,
    `- Evidence-ready: ${result.readiness.counts.evidenceReady}.`,
    `- Revise: ${result.readiness.counts.revise}; blocked: ${result.readiness.counts.blocked}; duplicative: ${result.readiness.counts.duplicative}.`,
    `- Substantial-page specifications: ${result.readiness.counts.pageSpecifications}; bounded questions: ${result.pageSpecifications.counts.boundedQuestions}.`,
    `- Public routes: ${result.readiness.counts.publicRoutesCreated}; builds: ${result.readiness.counts.buildsRun}.`,
    '',
    '## Manual semantic review',
    '',
    'All 100 routes remain semantically distinct after reviewing tradition, named subject, route role, sibling routes, and prohibited inference together. The review does not treat URL or token similarity as identity. Source-text, cult/place, identity/epithet, reception, comparison-method, discovery, and machine-registry routes each carry a separate answer contract.',
    '',
    'The central refusal is cross-frame authority transfer: a Greek source cannot establish Roman reception; a Sumerian name cannot become a timeless Akkadian synonym; a Vedic hymn cannot establish later epic or Purāṇic doctrine; iconography cannot identify an Egyptian deity without context; and modern Norse reception cannot prove pre-Christian belief.',
    '',
    '## Dependency result',
    '',
    `- Structural dependency closure: ${result.dependencyValidation.counts.structurallyResolved}/${result.dependencyValidation.counts.candidates}.`,
    '- Every specialized route depends on the mythology hub and the live textual-authority and translation-boundary methods.',
    '- One dependency defect remains: the machine registry does not yet depend on the Publish release-manifest owner. It stays blocked.',
    '',
    '## Source and rights inspection',
    '',
    `- Directly inspected source records: ${result.sourceInspections.counts.sources}.`,
    `- Reusable under recorded terms or public-domain status: ${result.sourceInspections.counts.reusableWithTerms}.`,
    `- Link/original-paraphrase only: ${result.sourceInspections.counts.referenceOnly}.`,
    `- Exact-passage or full-text inspections: ${result.sourceInspections.counts.exactPassageOrFullText}.`,
    '',
    'Access and reuse are not conflated. ORACC text defaults to CC BY-SA subject to object exceptions. The inspected Rigveda translation is public domain. The modern Poetic Edda is CC BY-NC and therefore reference-only for Maha absent separate permission. UCLA’s encyclopedia is freely readable but author-copyrighted. ETCSL and GRETIL remain reference-only under the terms inspected. No source text is copied into these artifacts.',
    '',
    '## Evidence-ready pilot',
    '',
    '- Eight Mesopotamian city-and-cult routes use named ORACC deity articles and section locators.',
    '- Five Vedic-text routes are narrowly bound to one inspected Rigveda hymn in the Griffith translation, with its age and philological limits disclosed.',
    '- One Osiris reception route uses the full UCLA Encyclopedia of Egyptology article and preserves the difference between an Osirian aspect and identity with Osiris.',
    '- Two comparison-method routes use explicit comparand, criterion, scale, scope, and alternative-explanation boundaries.',
    '',
    '## Held work',
    '',
    ...held.map((entry) => `- \`${entry.url}\` — **${entry.disposition}**: ${entry.reason}`),
    '',
    '## Publication boundary',
    '',
    'Everything is candidate-only and local. No route file, public registry, sitemap entry, llms.txt entry, Next.js build, Vercel build, push, Preview, canonical release, deployment, or Production mutation was created or performed. The 16 specifications still require implementation, exact-revision review, release governance, completion of the 4,000-route corpus, and the owner’s explicit build authorization.',
    '',
    `Readiness digest: \`${result.readiness.provenanceDigest}\``,
  ].join('\n')}\n`
  const reportTarget = resolve(outputRoot, reportPath)
  mkdirSync(dirname(reportTarget), { recursive: true })
  writeFileSync(reportTarget, report)
  return { ...result, artifacts: [...artifacts.map(([path]) => path), reportPath] }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const result = generateFederationTrancheElevenMythology(resolve(argument('output-root') ?? ROOT))
  console.log(JSON.stringify({ counts: result.readiness.counts, sourceCounts: result.sourceInspections.counts, artifacts: result.artifacts }, null, 2))
}
