import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { generateFederationPlan, type FrozenBaseline } from '../lib/federation-4000-plan.ts'

const ROOT = resolve(import.meta.dirname, '..')

function argument(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

export function writeFederationPlan(options: { baselinePath: string; outputRoot: string }) {
  const baseline = JSON.parse(readFileSync(resolve(options.baselinePath), 'utf8')) as FrozenBaseline
  const { architecture, candidateMap } = generateFederationPlan(baseline)
  const architecturePath = resolve(options.outputRoot, 'content/federation/federation-architecture-v1.json')
  const candidatePath = resolve(options.outputRoot, 'content/federation/federation-route-candidates-v1.json')
  for (const [path, value] of [[architecturePath, architecture], [candidatePath, candidateMap]] as const) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
  }
  return { architecturePath, candidatePath, architecture, candidateMap }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const outputRoot = resolve(argument('output-root') ?? ROOT)
  const result = writeFederationPlan({
    baselinePath: resolve(argument('baseline') ?? resolve(ROOT, 'content/federation/federation-route-baseline-v1.json')),
    outputRoot,
  })
  console.log(JSON.stringify({
    architecturePath: result.architecturePath,
    candidatePath: result.candidatePath,
    observedCanonicalRoutes: result.candidateMap.summary.observedCanonicalRoutes,
    frozenCandidates: result.candidateMap.summary.frozenCandidates,
    projectedCanonicalRoutes: result.candidateMap.summary.projectedCanonicalRoutes,
    architectureDigest: result.architecture.provenanceDigest,
    candidateMapDigest: result.candidateMap.provenanceDigest,
  }, null, 2))
}
