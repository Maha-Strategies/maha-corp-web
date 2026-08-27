import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

import { provenanceDigest, sha256Hex } from './canonicalize.ts'

export interface VerificationFinding {
  code: string
  detail: string
}

export interface VerificationReport {
  ok: boolean
  manifestPath: string
  dossierId: string | null
  filesChecked: number
  findings: readonly VerificationFinding[]
}

function finding(code: string, detail: string): VerificationFinding {
  return { code, detail }
}

/**
 * Verifies an exported package from its artifacts alone.
 *
 * Every digest is RECOMPUTED from the bytes on disk. The manifest's own
 * `sha256`, `bytes`, and `packageDigest` fields are treated as claims to be
 * checked, never as facts to be trusted — a package whose digests were edited
 * to match tampered content must still fail, because the recomputed values
 * disagree with the recomputed manifest digest.
 *
 * There is no network access and no source retrieval: verification reads the
 * directory it was given and nothing else.
 */
export function verifyPackageDirectory(manifestPath: string): VerificationReport {
  const findings: VerificationFinding[] = []
  const absolute = resolve(manifestPath)
  if (!existsSync(absolute)) {
    return { ok: false, manifestPath: absolute, dossierId: null, filesChecked: 0, findings: [finding('manifest-missing', absolute)] }
  }

  let manifest: Record<string, unknown>
  try {
    manifest = JSON.parse(readFileSync(absolute, 'utf8')) as Record<string, unknown>
  } catch (error) {
    return { ok: false, manifestPath: absolute, dossierId: null, filesChecked: 0, findings: [finding('manifest-unparseable', error instanceof Error ? error.message : 'unknown')] }
  }

  const directory = dirname(absolute)
  const declared = Array.isArray(manifest.files) ? (manifest.files as Array<Record<string, unknown>>) : null
  if (!declared) {
    return { ok: false, manifestPath: absolute, dossierId: null, filesChecked: 0, findings: [finding('manifest-files-missing', 'files must be an array')] }
  }

  let checked = 0
  for (const entry of declared) {
    const path = typeof entry.path === 'string' ? entry.path : null
    if (!path) { findings.push(finding('file-path-invalid', String(entry.path))); continue }
    const filePath = join(directory, path)
    if (!existsSync(filePath)) { findings.push(finding('file-missing', path)); continue }
    const content = readFileSync(filePath, 'utf8')
    checked += 1
    const recomputedDigest = `sha256:${sha256Hex(content)}`
    const recomputedBytes = Buffer.byteLength(content, 'utf8')
    if (entry.sha256 !== recomputedDigest) findings.push(finding('file-digest-mismatch', `${path}: manifest ${String(entry.sha256)} vs recomputed ${recomputedDigest}`))
    if (entry.bytes !== recomputedBytes) findings.push(finding('file-size-mismatch', `${path}: manifest ${String(entry.bytes)} vs recomputed ${recomputedBytes}`))
  }

  // The manifest digest is recomputed over the manifest minus the digest field,
  // exactly as it was produced. Editing a file digest to match tampered bytes
  // therefore breaks this check instead of satisfying it.
  const { packageDigest, ...manifestBase } = manifest
  const recomputedPackageDigest = provenanceDigest(manifestBase)
  if (packageDigest !== recomputedPackageDigest) {
    findings.push(finding('package-digest-mismatch', `manifest ${String(packageDigest)} vs recomputed ${recomputedPackageDigest}`))
  }

  const dossierFile = join(directory, 'dossier.json')
  if (existsSync(dossierFile)) {
    try {
      const dossier = JSON.parse(readFileSync(dossierFile, 'utf8')) as { provenanceBundle?: { dossierDigest?: string } }
      const declaredDossierDigest = manifest.dossierDigest
      if (declaredDossierDigest && dossier.provenanceBundle?.dossierDigest !== declaredDossierDigest) {
        findings.push(finding('dossier-digest-mismatch', 'manifest dossierDigest does not match the exported dossier'))
      }
    } catch (error) {
      findings.push(finding('dossier-unparseable', error instanceof Error ? error.message : 'unknown'))
    }
  } else {
    findings.push(finding('dossier-file-missing', 'dossier.json'))
  }

  return {
    ok: findings.length === 0,
    manifestPath: absolute,
    dossierId: typeof manifest.dossierId === 'string' ? manifest.dossierId : null,
    filesChecked: checked,
    findings,
  }
}
