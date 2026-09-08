import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import type { CandidateMap } from '../lib/federation-4000-adjudication.ts'
import { selectTrancheTwo } from '../lib/federation-tranche-two.ts'
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'

const ROOT = resolve(import.meta.dirname, '..')

function argument(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T
}

export function generateTrancheTwo(outputRoot: string) {
  const candidateMap = readJson<CandidateMap>('content/federation/federation-route-candidates-v1.json')
  const semantic = readJson<Parameters<typeof selectTrancheTwo>[1]>('content/federation/federation-semantic-adjudication-v1.json')
  const graph = readJson<Parameters<typeof selectTrancheTwo>[2]>('content/federation/federation-dependency-graph-v1.json')
  const demand = readJson<Parameters<typeof selectTrancheTwo>[3]>('content/federation/federation-gsc-demand-calibration-v1.json')
  const trancheOne = readJson<Parameters<typeof selectTrancheTwo>[4]>('content/federation/federation-tranche-1-cohort-v1.json')
  for (const artifact of [candidateMap, semantic, graph, demand, trancheOne]) {
    if (provenanceDigest(artifact) !== artifact.provenanceDigest) throw new Error(`Input digest does not verify: ${artifact.provenanceDigest}`)
  }
  const cohort = selectTrancheTwo(candidateMap, semantic, graph, demand, trancheOne)
  const output = resolve(outputRoot, 'content/federation/federation-tranche-2-cohort-v1.json')
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(cohort, null, 2)}\n`)
  return cohort
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const cohort = generateTrancheTwo(resolve(argument('output-root') ?? ROOT))
  console.log(JSON.stringify({ counts: cohort.counts, provenanceDigest: cohort.provenanceDigest }, null, 2))
}
