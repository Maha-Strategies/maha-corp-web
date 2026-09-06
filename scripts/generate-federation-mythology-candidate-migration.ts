import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { migrateCandidateMapV2 } from '../lib/federation-mythology-candidate-migration.ts'

const ROOT = resolve(import.meta.dirname, '..')
const readJson = (root: string, path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'))

export function writeMythologyCandidateMigration(outputRoot = ROOT) {
  const trancheCohorts = Array.from({ length: 10 }, (_, index) => readJson(ROOT, `content/federation/federation-tranche-${index + 1}-cohort-v1.json`))
  const result = migrateCandidateMapV2({
    baseline: readJson(ROOT, 'content/federation/federation-route-baseline-v1.json'),
    v1Map: readJson(ROOT, 'content/federation/federation-route-candidates-v1.json'),
    v1Semantic: readJson(ROOT, 'content/federation/federation-semantic-adjudication-v1.json'),
    v1Dependency: readJson(ROOT, 'content/federation/federation-dependency-graph-v1.json'),
    v1Demand: readJson(ROOT, 'content/federation/federation-gsc-demand-calibration-v1.json'),
    trancheCohorts,
  })
  const outputs = [
    ['content/federation/federation-candidate-lineage-v2.json', result.lineage],
    ['content/federation/federation-route-candidates-v2.json', result.candidateMap],
    ['content/federation/federation-semantic-adjudication-v2.json', result.semantic],
    ['content/federation/federation-dependency-graph-v2.json', result.dependency],
    ['content/federation/federation-gsc-demand-calibration-v2.json', result.demand],
  ] as const
  for (const [path, value] of outputs) {
    const target = resolve(outputRoot, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`)
  }
  const reportPath = resolve(outputRoot, 'docs/federation/federation-mythology-candidate-migration.md')
  const retiredGroups = Object.entries(result.lineage.supersededCandidates.reduce((counts: Record<string, number>, entry: { groupId: string }) => {
    counts[entry.groupId] = (counts[entry.groupId] ?? 0) + 1
    return counts
  }, {})).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
  const mythologyAllocation = Object.entries(result.lineage.mythologyAllocation)
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, `# Cross-cultural mythology candidate-map migration\n\n` +
    `Status: local candidate migration only. No route was compiled, built, released, pushed, previewed, or deployed.\n\n` +
    `## Result\n\n` +
    `- Observed routes: ${result.report.observedRoutes.toLocaleString('en-US')}\n` +
    `- Active candidates: ${result.report.activeCandidates.toLocaleString('en-US')}\n` +
    `- Projected routes: ${result.report.projectedRoutes.toLocaleString('en-US')}\n` +
    `- Reviewed candidates preserved byte-for-byte: ${result.report.selectedCandidatesPreserved.toLocaleString('en-US')}\n` +
    `- V1 candidates retained: ${result.report.v1CandidatesRetained.toLocaleString('en-US')}\n` +
    `- Unselected V1 candidates superseded: ${result.report.v1CandidatesSuperseded}\n` +
    `- Prior semantic exclusions superseded: ${result.report.priorSemanticExclusionsSuperseded}\n` +
    `- Cross-cultural mythology candidates added: ${result.report.mythologyCandidatesAdded}\n` +
    `- New candidates with observed demand: ${result.report.newDemandKnown} (demand remains unknown)\n\n` +
    `## Mythology allocation\n\n` +
    mythologyAllocation.map(([collection, count]) => `- ${collection}: ${count}`).join('\n') + `\n\n` +
    `## Superseded candidates by prior group\n\n` +
    retiredGroups.map(([group, count]) => `- ${group}: ${count}`).join('\n') + `\n\n` +
    `All 43 prior semantic exclusions are in this set. The other 157 were unselected dependency leaves; no reviewed candidate or dependency target was eligible.\n\n` +
    `## Active property allocation\n\n` +
    result.candidateMap.allocation.map((entry: { siteId: string; observed: number; activeCandidates: number; projected: number }) => `- ${entry.siteId}: ${entry.observed} observed + ${entry.activeCandidates} active candidates = ${entry.projected} projected`).join('\n') + `\n\n` +
    `## Retirement rule\n\n` +
    `All prior candidates already adjudicated as a duplicate, replacement, or ownership revision are superseded. The remainder are the lowest-retention unselected dependency leaves after applying observed-demand, strategic-continuity, definition, dependency, and semantic-saturation factors. Every candidate selected in Tranches 1–10 remains byte-identical.\n\n` +
    `## Mythology boundary\n\n` +
    `The 200 additions cover Greek/Roman, Mesopotamian, Sanskrit/Vedic/Epic/Purāṇic, Egyptian, Norse/Germanic, Chinese, Japanese, Mesoamerican, four African source-and-rights pilots, comparative methodology, one discovery hub, and one machine registry. They are candidates, not evidence-ready pages. Primary text, translation, commentary, historical inference, reception, and theology must remain separate. Shared names, functions, images, or motifs never establish identical deities or common origin.\n\n` +
    `## Next gate\n\n` +
    `Freeze Tranche 11 only after reviewing the new semantic entries and dependency order. Source identity, exact locator, rights, scope, boundary, alignment, exact-revision review, canonical release, and compilation remain required.\n`)
  return { ...result, reportPath }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const outputArgument = process.argv.find((value) => value.startsWith('--output-root='))?.slice('--output-root='.length)
  const result = writeMythologyCandidateMigration(resolve(outputArgument ?? ROOT))
  console.log(JSON.stringify({ ...result.report, candidateMapDigest: result.candidateMap.provenanceDigest, lineageDigest: result.lineage.provenanceDigest }, null, 2))
}
