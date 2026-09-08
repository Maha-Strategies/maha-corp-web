import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import {
  buildTrancheTwelveMythology,
} from '../lib/federation-tranche-twelve-mythology.ts'
import type {
  MythologyCandidateMap,
  MythologyDependencyGraph,
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

export function generateFederationTrancheTwelveMythology(outputRoot = ROOT) {
  const result = buildTrancheTwelveMythology({
    candidateMap: verified<MythologyCandidateMap>('content/federation/federation-route-candidates-v2.json'),
    dependencyGraph: verified<MythologyDependencyGraph>('content/federation/federation-dependency-graph-v2.json'),
    priorCohort: verified('content/federation/federation-tranche-11-mythology-cohort-v1.json'),
  })
  const artifacts: Array<[string, unknown]> = [
    ['content/federation/federation-tranche-12-mythology-cohort-v1.json', result.cohort],
    ['content/federation/federation-tranche-12-mythology-semantic-validation-v1.json', result.semanticValidation],
    ['content/federation/federation-tranche-12-mythology-dependency-validation-v1.json', result.dependencyValidation],
    ['content/federation/federation-tranche-12-mythology-source-inspections-v1.json', result.sourceInspections],
    ['content/federation/federation-tranche-12-mythology-decisions-v1.json', result.decisionManifest],
    ['content/federation/federation-tranche-12-mythology-page-specifications-v1.json', result.pageSpecifications],
    ['content/federation/federation-tranche-12-mythology-readiness-v1.json', result.readiness],
  ]
  for (const [path, value] of artifacts) writeJson(outputRoot, path, value)

  const held = result.decisionManifest.entries.filter((entry) => entry.disposition !== 'evidence-ready')
  const reportPath = 'docs/federation/federation-tranche-12-mythology-local-readiness.md'
  const report = `${[
    '# Federation Tranche 12: mythology local readiness',
    '',
    'Status: **local-reviewed-unreleased**',
    '',
    '## Cohort',
    '',
    '- This is the exact 100-candidate complement of Tranche 11 inside the frozen 200-route mythology allocation.',
    '- Tranche 11 overlap: 0; combined mythology coverage: 200/200.',
    `- Public routes created: ${result.readiness.counts.publicRoutesCreated}; builds run: ${result.readiness.counts.buildsRun}.`,
    '',
    '## Outcome',
    '',
    `- Manually adjudicated: ${result.readiness.counts.candidates}.`,
    `- Evidence-ready: ${result.readiness.counts.evidenceReady}.`,
    `- Revise: ${result.readiness.counts.revise}; blocked: ${result.readiness.counts.blocked}; duplicative: ${result.readiness.counts.duplicative}.`,
    `- Substantial-page specifications: ${result.readiness.counts.pageSpecifications}; bounded questions: ${result.pageSpecifications.counts.boundedQuestions}.`,
    '',
    '## Semantic and dependency review',
    '',
    'All 100 routes remain distinct after reviewing tradition, named subject, route role, sibling contracts, source frame, and prohibited inference together. Source lineage, cult and place, Eddic source, reception, colonial mediation, community rights, and comparative method are not interchangeable merely because their URLs share a figure name.',
    '',
    `All ${result.dependencyValidation.counts.structurallyResolved} candidates resolve through the Tranche 11 mythology hub and the existing textual-authority and translation-boundary definitions. No Tranche 12 route is a machine registry, so Tranche 11’s missing Publish release-manifest edge does not recur here.`,
    '',
    '## Source and rights review',
    '',
    `- Source records: ${result.sourceInspections.counts.sources}; carried and revalidated: ${result.sourceInspections.counts.carriedAndRevalidated}.`,
    `- Exact-passage or full-text inspections: ${result.sourceInspections.counts.exactPassageOrFullText}.`,
    `- Reusable under recorded open/public-domain terms: ${result.sourceInspections.counts.reusableWithTerms}; reference-only: ${result.sourceInspections.counts.referenceOnly}.`,
    '- Reference-only material may be cited and summarized in new bounded prose; no translation, article, image, or manuscript page is copied into the artifacts.',
    '- Local Contexts and ICCROM establish that community collaboration is required; they do not authorize Maha to publish Yoruba, Asante, Dahomey, or Kush-specific knowledge.',
    '',
    '## Evidence-ready specifications',
    '',
    '- Mesopotamian: one Aššur source-text route and one Tiamat city-and-cult route.',
    '- Sanskrit/Vedic: Rudra RV 2.33 and Vāc/Devī RV 10.125, limited to Griffith’s historical translation witness.',
    '- Egyptian: Thoth cult/place and reception routes from the full peer-reviewed UEE article.',
    '- Norse: seven Eddic-source routes at named poems and stanzas; all seven reception routes remain held.',
    '- Japanese: eleven source-lineage or cult/reception routes supported by the Encyclopedia of Shinto; Izanagi/Izanami cult reception remains held.',
    '- Mesoamerican: four source-identity and three colonial-reception specifications from exact Digital Florentine Codex folios; Maya is blocked rather than inferred from a Mexica source.',
    '- Comparative: both method routes.',
    '',
    '## Held candidates',
    '',
    ...held.map((entry) => `- \`${entry.url}\` — **${entry.disposition}**: ${entry.reason}`),
    '',
    '## Publication boundary',
    '',
    'Everything remains local candidate material. No route file, public registry, sitemap, llms.txt, Next.js or Vercel build, push, Preview, canonical release, deployment, or Production mutation was created or performed. Specifications still require implementation, exact-revision review, release governance, completion of the 4,000-route corpus, and the owner’s explicit Vercel-build authorization.',
    '',
    `Readiness digest: \`${result.readiness.provenanceDigest}\``,
  ].join('\n')}\n`
  const reportTarget = resolve(outputRoot, reportPath)
  mkdirSync(dirname(reportTarget), { recursive: true })
  writeFileSync(reportTarget, report)
  return { ...result, artifacts: [...artifacts.map(([path]) => path), reportPath] }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const result = generateFederationTrancheTwelveMythology(resolve(argument('output-root') ?? ROOT))
  console.log(JSON.stringify({ counts: result.readiness.counts, sourceCounts: result.sourceInspections.counts, artifacts: result.artifacts }, null, 2))
}
