import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import {
  ALIGNMENT_BATCH_11_PACKETS,
  ALIGNMENT_BATCH_11_VERSION,
  batch11Totals,
} from '../lib/frontier-alignment-batch-11.ts'
import { alignmentFor } from '../lib/frontier-source-alignment.ts'

/**
 * Emits the Batch 11 remediation packets.
 *
 * Deterministic by construction: packets are sorted by recordId, the payload is
 * canonicalised before hashing, and no timestamp or environment value is read.
 * Running this twice on the same input produces identical bytes, which is what
 * lets the committed file be diffed rather than trusted.
 *
 * The generator refuses to emit if a packet names a record the live alignment
 * audit does not carry, so a packet cannot drift onto a record that no longer
 * exists.
 */

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

const packets = [...ALIGNMENT_BATCH_11_PACKETS].sort((a, b) =>
  a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0,
)

for (const packet of packets) {
  if (!alignmentFor(packet.recordId)) {
    throw new Error(`${packet.recordId}: no active alignment record; refusing to emit a packet for it.`)
  }
  // A fail-closed packet must propose nothing. Emitting one with a source would
  // silently turn "we could not establish this" into a proposal.
  if (packet.verdict === 'unresolved-fail-closed' && (packet.source !== null || packet.inspection !== null)) {
    throw new Error(`${packet.recordId}: a fail-closed packet must carry no source and no inspection.`)
  }
  if (packet.verdict !== 'unresolved-fail-closed' && (packet.source === null || packet.inspection === null)) {
    throw new Error(`${packet.recordId}: a non-fail-closed packet must carry both a source and an inspection.`)
  }
}

const payload = {
  schemaVersion: ALIGNMENT_BATCH_11_VERSION,
  totals: batch11Totals(),
  // Stated so a reader does not have to infer the batch's standing from silence.
  standing: {
    canonicalMutationAuthorized: false,
    activeBindingsChanged: 0,
    canonicalReleasesCreated: 0,
    externallyReviewed: false,
    independentlyReproduced: false,
    note: 'Private, noncanonical proposals. No packet replaces an active source, revises a record, clears a blocker, or authorizes publication.',
  },
  packets,
}

mkdirSync('content/frontier-alignment', { recursive: true })
const serialized = `${JSON.stringify(JSON.parse(canonicalJson({ ...payload, resultDigest: digest(payload) })), null, 2)}\n`
writeFileSync('content/frontier-alignment/batch-11-remediation-packets.json', serialized)

process.stdout.write(`${JSON.stringify({ ...batch11Totals(), resultDigest: digest(payload) }, null, 2)}\n`)
