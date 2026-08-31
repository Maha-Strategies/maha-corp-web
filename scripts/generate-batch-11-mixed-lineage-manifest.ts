import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import {
  assertDeclarationCoverage,
  lineageManifestDigest,
  reconcileLineage,
  type RegistryObservation,
} from '../lib/batch-11-mixed-lineage-release.ts'

/**
 * Emits the mixed-lineage release manifest from the frozen registry observation.
 *
 * Deterministic: entries are sorted by record id, canonicalised before hashing,
 * and no timestamp or environment value is read. The observation is a committed
 * file rather than a live fetch, so the manifest is reproducible offline and a
 * registry change shows up as a diff instead of silently altering the output.
 */

assertDeclarationCoverage()

const observation = JSON.parse(
  readFileSync('content/frontier-alignment/batch-11-registry-observation.json', 'utf8'),
) as RegistryObservation

const manifest = reconcileLineage(observation)

// A blocked entry is emitted, never dropped: the manifest has to show what
// failed, or a reader cannot tell a clean cohort from a filtered one.
mkdirSync('content/frontier-alignment', { recursive: true })
const payload = { ...manifest, manifestDigest: lineageManifestDigest(manifest) }
writeFileSync(
  'content/frontier-alignment/batch-11-mixed-lineage-manifest.json',
  `${JSON.stringify(JSON.parse(canonicalJson(payload)), null, 2)}\n`,
)

process.stdout.write(
  `${JSON.stringify({ totals: manifest.totals, manifestDigest: payload.manifestDigest, observationDigest: `sha256:${createHash('sha256').update(canonicalJson(observation), 'utf8').digest('hex')}` }, null, 2)}\n`,
)
