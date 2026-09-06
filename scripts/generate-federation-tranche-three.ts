import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import type { CandidateMap } from '../lib/federation-4000-adjudication.ts'
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { selectTrancheThree } from '../lib/federation-tranche-three.ts'

const ROOT = resolve(import.meta.dirname, '..')

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T
}

export function generateTrancheThree(outputRoot = ROOT) {
  const candidateMap = readJson<CandidateMap>('content/federation/federation-route-candidates-v1.json')
  const semantic = readJson<Parameters<typeof selectTrancheThree>[1]>('content/federation/federation-semantic-adjudication-v1.json')
  const graph = readJson<Parameters<typeof selectTrancheThree>[2]>('content/federation/federation-dependency-graph-v1.json')
  const demand = readJson<Parameters<typeof selectTrancheThree>[3]>('content/federation/federation-gsc-demand-calibration-v1.json')
  const priorCohorts = [1, 2].map((tranche) => readJson<Parameters<typeof selectTrancheThree>[4][number]>(`content/federation/federation-tranche-${tranche}-cohort-v1.json`))
  for (const artifact of [candidateMap, semantic, graph, demand, ...priorCohorts]) {
    if (provenanceDigest(artifact) !== artifact.provenanceDigest) throw new Error(`Input digest does not verify: ${artifact.provenanceDigest}`)
  }
  const cohort = selectTrancheThree(candidateMap, semantic, graph, demand, priorCohorts)
  const output = resolve(outputRoot, 'content/federation/federation-tranche-3-cohort-v1.json')
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(cohort, null, 2)}\n`)
  return cohort
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const cohort = generateTrancheThree()
  console.log(JSON.stringify({ counts: cohort.counts, provenanceDigest: cohort.provenanceDigest }, null, 2))
}
