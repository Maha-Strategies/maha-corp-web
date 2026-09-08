import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import type { CandidateMap } from '../lib/federation-4000-adjudication.ts'
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { selectFederationTranche } from '../lib/federation-tranche-three.ts'

const ROOT = resolve(import.meta.dirname, '..')

function argument(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T
}

export function generateTrancheEight(outputRoot = ROOT) {
  const candidateMap = readJson<CandidateMap>('content/federation/federation-route-candidates-v1.json')
  const semantic = readJson<Parameters<typeof selectFederationTranche>[1]>('content/federation/federation-semantic-adjudication-v1.json')
  const graph = readJson<Parameters<typeof selectFederationTranche>[2]>('content/federation/federation-dependency-graph-v1.json')
  const demand = readJson<Parameters<typeof selectFederationTranche>[3]>('content/federation/federation-gsc-demand-calibration-v1.json')
  const priorCohorts = [1, 2, 3, 4, 5, 6, 7].map((tranche) => readJson<Parameters<typeof selectFederationTranche>[4][number]>(`content/federation/federation-tranche-${tranche}-cohort-v1.json`))
  for (const artifact of [candidateMap, semantic, graph, demand, ...priorCohorts]) {
    if (provenanceDigest(artifact) !== artifact.provenanceDigest) throw new Error(`Input digest does not verify: ${artifact.provenanceDigest}`)
  }
  const cohort = selectFederationTranche(candidateMap, semantic, graph, demand, priorCohorts, 8)
  const output = resolve(outputRoot, 'content/federation/federation-tranche-8-cohort-v1.json')
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(cohort, null, 2)}\n`)
  return cohort
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const cohort = generateTrancheEight(resolve(argument('output-root') ?? ROOT))
  console.log(JSON.stringify({ counts: cohort.counts, provenanceDigest: cohort.provenanceDigest }, null, 2))
}
