import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import type { CandidateMap } from '../lib/federation-4000-adjudication.ts'
import { evaluateTrancheOne, sourceFileFingerprints } from '../lib/federation-tranche-one-readiness.ts'

const ROOT = resolve(import.meta.dirname, '..')

function argument(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T
}

function writeJson(root: string, path: string, value: unknown) {
  const output = resolve(root, path)
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`)
}

function markdown(report: ReturnType<typeof evaluateTrancheOne>['readinessReport']) {
  const counts = report.counts
  const lines = [
    '# Federation tranche 1 local readiness',
    '',
    `Status: **${report.status}**`,
    '',
    '## Outcome',
    '',
    `**${counts.evidenceReady} of ${counts.selectedCandidates} candidates can enter implementation.** This is an implementation-readiness count, not a public-route, release, deployment, traffic, or revenue count.`,
    '',
    '| State | Count |',
    '| --- | ---: |',
    `| Evidence-ready | ${counts.evidenceReady} |`,
    `| Revise | ${counts.revise} |`,
    `| Blocked | ${counts.blocked} |`,
    `| Reject as duplicative | ${counts.duplicative} |`,
    '',
    '## Review coverage',
    '',
    `- Semantic adjudications manually reviewed: ${counts.semanticAdjudicationsReviewed}; corrected: ${counts.semanticAdjudicationsCorrected}.`,
    `- Selected candidates dependency-validated: ${counts.dependenciesValid}/${counts.selectedCandidates}.`,
    `- Represented topics with source packets: ${counts.representedTopics}.`,
    `- Substantial-page specifications: ${counts.substantialPageSpecifications}, exactly matching the evidence-ready set.`,
    `- Public routes created: ${counts.publicRoutesCreated}.`,
    `- Vercel builds run: ${counts.vercelBuildsRun}.`,
    '',
    '## Boundary',
    '',
    report.implementationBoundary,
    '',
    '## Non-ready candidates',
    '',
    '| Disposition | Candidate | Reason |',
    '| --- | --- | --- |',
    ...report.blockers.map((item) => `| ${item.disposition} | \`${item.url}\` | ${item.reason.replaceAll('|', '\\|')} |`),
    '',
    `Readiness digest: \`${report.provenanceDigest}\``,
    '',
  ]
  return `${lines.join('\n')}\n`
}

export function generateReadiness(outputRoot: string) {
  const candidateMap = readJson<CandidateMap>('content/federation/federation-route-candidates-v1.json')
  const semantic = readJson<Parameters<typeof evaluateTrancheOne>[1]>('content/federation/federation-semantic-adjudication-v1.json')
  const graph = readJson<Parameters<typeof evaluateTrancheOne>[2]>('content/federation/federation-dependency-graph-v1.json')
  const cohort = readJson<Parameters<typeof evaluateTrancheOne>[3]>('content/federation/federation-tranche-1-cohort-v1.json')
  const result = evaluateTrancheOne(candidateMap, semantic, graph, cohort, sourceFileFingerprints(ROOT))
  const artifacts = [
    ['content/federation/federation-manual-semantic-validation-v1.json', result.manualSemantic],
    ['content/federation/federation-tranche-1-dependency-validation-v1.json', result.dependencyValidation],
    ['content/federation/federation-tranche-1-evidence-packets-v1.json', result.evidencePackets],
    ['content/federation/federation-tranche-1-decisions-v1.json', result.decisionManifest],
    ['content/federation/federation-tranche-1-page-specifications-v1.json', result.specifications],
    ['content/federation/federation-tranche-1-readiness-v1.json', result.readinessReport],
  ] as const
  for (const [path, value] of artifacts) writeJson(outputRoot, path, value)
  const reportPath = 'docs/federation/federation-tranche-1-readiness.md'
  const reportOutput = resolve(outputRoot, reportPath)
  mkdirSync(dirname(reportOutput), { recursive: true })
  writeFileSync(reportOutput, markdown(result.readinessReport))
  return { ...result, artifacts: [...artifacts.map(([path]) => path), reportPath] }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const outputRoot = resolve(argument('output-root') ?? ROOT)
  const result = generateReadiness(outputRoot)
  console.log(JSON.stringify({ counts: result.readinessReport.counts, readinessDigest: result.readinessReport.provenanceDigest, artifacts: result.artifacts }, null, 2))
}
