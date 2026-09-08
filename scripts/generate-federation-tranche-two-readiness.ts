import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import type { CandidateMap } from '../lib/federation-4000-adjudication.ts'
import { evaluateTrancheTwo, trancheTwoSourceFingerprints } from '../lib/federation-tranche-two-readiness.ts'

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

function writeJson(root: string, path: string, value: unknown) {
  const output = resolve(root, path)
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`)
}

function markdown(report: ReturnType<typeof evaluateTrancheTwo>['readinessReport']) {
  const counts = report.counts
  return `${[
    '# Federation tranche 2 local readiness',
    '',
    `Status: **${report.status}**`,
    '',
    '## Outcome',
    '',
    `**${counts.evidenceReady} of ${counts.selectedCandidates} candidates can enter implementation.** This is an evidence-readiness result, not a route, release, build, deployment, traffic, or revenue count.`,
    '',
    '| State | Count |',
    '| --- | ---: |',
    `| Evidence-ready | ${counts.evidenceReady} |`,
    `| Revise | ${counts.revise} |`,
    `| Blocked | ${counts.blocked} |`,
    `| Reject as duplicative | ${counts.duplicative} |`,
    '',
    '## Coverage',
    '',
    `- Candidates manually reviewed for semantic distinctness: ${counts.semanticCandidatesReviewed}; corrections: ${counts.semanticCorrections}.`,
    `- Dependency-valid candidates: ${counts.dependenciesValid}/${counts.selectedCandidates}.`,
    `- Topic/property packets: ${counts.representedTopics}; ${counts.priorPacketsReused} reused without version change and ${counts.newTopicPacketsInspected} newly inspected.`,
    `- Substantial-page specifications: ${counts.substantialPageSpecifications}, exactly the evidence-ready set.`,
    `- Public routes created: ${counts.publicRoutesCreated}.`,
    `- Next builds run: ${counts.nextBuildsRun}; Vercel builds run: ${counts.vercelBuildsRun}.`,
    '',
    '## Boundary',
    '',
    report.implementationBoundary,
    '',
    '## Non-ready candidates',
    '',
    '| Disposition | Candidate | Reason |',
    '| --- | --- | --- |',
    ...report.blockers.map((entry) => `| ${entry.disposition} | \`${entry.url}\` | ${entry.reason.replaceAll('|', '\\|')} |`),
    '',
    `Readiness digest: \`${report.provenanceDigest}\``,
    '',
  ].join('\n')}\n`
}

export function generateTrancheTwoReadiness(outputRoot: string) {
  const candidateMap = verified<CandidateMap>('content/federation/federation-route-candidates-v1.json')
  const graph = verified<Parameters<typeof evaluateTrancheTwo>[1]>('content/federation/federation-dependency-graph-v1.json')
  const cohort = verified<Parameters<typeof evaluateTrancheTwo>[2]>('content/federation/federation-tranche-2-cohort-v1.json')
  const trancheOne = verified<Parameters<typeof evaluateTrancheTwo>[3]>('content/federation/federation-tranche-1-cohort-v1.json')
  const priorPackets = verified<Parameters<typeof evaluateTrancheTwo>[4]>('content/federation/federation-tranche-1-evidence-packets-v1.json')
  const result = evaluateTrancheTwo(candidateMap, graph, cohort, trancheOne, priorPackets, trancheTwoSourceFingerprints(ROOT))
  const artifacts = [
    ['content/federation/federation-tranche-2-semantic-validation-v1.json', result.manualSemantic],
    ['content/federation/federation-tranche-2-dependency-validation-v1.json', result.dependencyValidation],
    ['content/federation/federation-tranche-2-evidence-packets-v1.json', result.evidencePackets],
    ['content/federation/federation-tranche-2-decisions-v1.json', result.decisionManifest],
    ['content/federation/federation-tranche-2-page-specifications-v1.json', result.specifications],
    ['content/federation/federation-tranche-2-readiness-v1.json', result.readinessReport],
  ] as const
  for (const [path, value] of artifacts) writeJson(outputRoot, path, value)
  const reportPath = 'docs/federation/federation-tranche-2-readiness.md'
  const reportOutput = resolve(outputRoot, reportPath)
  mkdirSync(dirname(reportOutput), { recursive: true })
  writeFileSync(reportOutput, markdown(result.readinessReport))
  return { ...result, artifacts: [...artifacts.map(([path]) => path), reportPath] }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const result = generateTrancheTwoReadiness(resolve(argument('output-root') ?? ROOT))
  console.log(JSON.stringify({ counts: result.readinessReport.counts, readinessDigest: result.readinessReport.provenanceDigest, artifacts: result.artifacts }, null, 2))
}
