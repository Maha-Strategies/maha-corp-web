import { mkdirSync, writeFileSync } from 'node:fs'

import {
  compileRecoveryPackets,
  compileOutstandingRecoveryPackets,
  finalizeRecoveryObservation,
  type RecoveryObservation,
} from '../lib/source-recovery.ts'
import { executeRecoveryRequests } from '../lib/source-recovery-live.ts'

const live = process.argv.includes('--live')
const write = process.argv.includes('--write')
const outstanding = process.argv.includes('--outstanding')
const summaryOnly = process.argv.includes('--summary-only')
const limitArgument = process.argv.find((argument) => argument.startsWith('--limit='))
const limit = limitArgument ? Number(limitArgument.slice('--limit='.length)) : null
if (write && live) throw new Error('Live recovery output is review input and may not overwrite deterministic committed packets.')
if (limit !== null && (!live || !Number.isInteger(limit) || limit < 1 || limit > 20)) throw new Error('--limit must be an integer from 1 to 20 and is available only with --live.')

const compile = outstanding ? compileOutstandingRecoveryPackets : compileRecoveryPackets
const basePackets = limit === null ? compile() : compile().slice(0, limit)
let packets = basePackets

if (live) {
  const observationsBySource: Record<string, RecoveryObservation[]> = {}
  const flattened = basePackets.flatMap((packet) => packet.requests.map((request) => ({ sourceContractId: packet.sourceContractId, request })))
  const raw = await executeRecoveryRequests(flattened.map((item) => item.request), 5)
  for (const packet of basePackets) observationsBySource[packet.sourceContractId] = []
  raw.forEach((observation, index) => {
    const packet = basePackets.find((item) => item.sourceContractId === flattened[index].sourceContractId)!
    observationsBySource[packet.sourceContractId].push(finalizeRecoveryObservation(
      packet.sourceTitle,
      packet.sourceIdentifier,
      observation,
    ))
  })
  const selectedSourceIds = new Set(basePackets.map((packet) => packet.sourceContractId))
  packets = compile(observationsBySource).filter((packet) => selectedSourceIds.has(packet.sourceContractId))
}

const summary = {
  schemaVersion: 'maha-source-recovery-summary/1.0',
  contracts: packets.length,
  affectedRecords: new Set(packets.flatMap((packet) => packet.affectedRecordIds)).size,
  dispositions: Object.fromEntries(
    [...new Set(packets.map((packet) => packet.disposition))].sort().map((status) => [status, packets.filter((packet) => packet.disposition === status).length]),
  ),
  packets,
}

if (!live || write) {
  mkdirSync('content/source-recovery', { recursive: true })
  mkdirSync('docs/source-recovery', { recursive: true })
  const basename = outstanding ? 'outstanding-packets' : 'canary-packets'
  writeFileSync(`content/source-recovery/${basename}.json`, `${JSON.stringify(summary, null, 2)}\n`)

  const lines = [
    outstanding ? '# Outstanding source-recovery queue' : '# Inaccessible-source recovery canary',
    '',
    'This is a deterministic, noncanonical search plan. It locates candidate copies; it does not inspect source content, create locators, change alignment verdicts, or authorize publication.',
    '',
    `Contracts: ${packets.length} · affected records: ${summary.affectedRecords}`,
    '',
    '| Priority | Source contract | Domain | Current state | Search requests |',
    '| ---: | --- | --- | --- | ---: |',
    ...packets.map((packet) => `| ${packet.priority} | \`${packet.sourceContractId}\` | ${packet.domainSlug} | ${packet.currentAlignmentStates.join(', ')} | ${packet.requests.length} |`),
    '',
    '## Operating boundary',
    '',
    `- Run \`npm run ${outstanding ? 'recover:sources:outstanding' : 'recover:sources'}\` to regenerate this plan without network access.`,
    `- Run \`npm run ${outstanding ? 'recover:sources:outstanding:live' : 'recover:sources:live'}\` to query allowlisted public metadata and repository endpoints and print normalized observations to stdout.`,
    '- Live results are not committed automatically. A candidate reaches `manual-inspection-ready` only after source identity, artifact type, version relationship, and an HTTPS copy are established.',
    '- A human or internal editor must still open the artifact and record an exact inspected-content locator before any alignment judgement can change.',
    '',
  ]
  writeFileSync(`docs/source-recovery/${outstanding ? 'outstanding' : 'canary'}.md`, lines.join('\n'))
}

console.log(JSON.stringify(summaryOnly ? {
  schemaVersion: summary.schemaVersion,
  contracts: summary.contracts,
  affectedRecords: summary.affectedRecords,
  dispositions: summary.dispositions,
  inspectionAuthorized: false,
  canonicalMutationAuthorized: false,
} : summary, null, 2))
