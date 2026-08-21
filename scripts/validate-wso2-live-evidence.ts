/**
 * Zero-cost, network-free validation of the committed live-evaluation artifact.
 *
 * This is the command a technical reviewer runs. It re-derives every aggregate
 * from the per-workload rows, refuses any forbidden field, and prints the
 * artifact's SHA-256 so the printed digest can be compared with the one quoted
 * on the public page.
 */
import { readFileSync } from 'node:fs'

import {
  WSO2_LIVE_EVIDENCE_PATH,
  WSO2_LIVE_EVIDENCE_PATHS,
  parseWso2LiveEvidence,
  sha256File,
} from '../lib/integrations/wso2-live-evidence.ts'

const path = process.argv.find((value) => value.startsWith('--artifact='))?.slice('--artifact='.length) ?? WSO2_LIVE_EVIDENCE_PATH
const artifact = parseWso2LiveEvidence(JSON.parse(readFileSync(path, 'utf8')))

console.log(JSON.stringify({
  status: 'valid',
  artifact: path,
  artifactSha256: `sha256:${sha256File(path)}`,
  runLabel: artifact.runLabel,
  observedAt: artifact.observedAt,
  corpusLabelFreezeDigest: artifact.corpus.labelFreezeDigest,
  syntheticCorpus: artifact.corpus.synthetic,
  workloads: artifact.workloads.length,
  calls: artifact.workloads.length * WSO2_LIVE_EVIDENCE_PATHS.length,
  aggregatesRederivedFromRows: true,
  comparison: artifact.comparison,
  perPath: Object.fromEntries(WSO2_LIVE_EVIDENCE_PATHS.map((candidate) => [candidate, {
    providerInputTokens: artifact.aggregates[candidate].providerInputTokens,
    costUsd: artifact.aggregates[candidate].costUsd,
    deterministicFacts: artifact.aggregates[candidate].deterministicFacts,
    adjudicatedFacts: artifact.aggregates[candidate].adjudicatedFacts,
  }])),
  sourceCheckpointSha256: artifact.generation.sourceCheckpointSha256,
  primaryEvidenceCommitted: artifact.generation.primaryEvidenceCommitted,
}, null, 2))
