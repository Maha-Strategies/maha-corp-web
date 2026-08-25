import { canonicalJson, isPlaceholderDigest } from './canonical.ts'
import { validateDossier, type ValidationIssue } from './validator.ts'
import {
  DOSSIER_PACKAGE_VERSION,
  PACKAGE_TOP_LEVEL_FIELDS,
  evidentiaryProjection,
  type DossierPackage,
} from './package.ts'
import { unknownFields } from './normalize.ts'
import { DOSSIER_SCHEMA_VERSION } from './schema.ts'

/**
 * Validation for a whole package: the dossier body plus the revision envelope.
 * Every issue carries an exact JSON path so the operator UI can point at it.
 */

const ID = /^[a-z][a-z0-9_-]{2,63}$/
const SHA = /^sha256:[a-f0-9]{64}$/
/** An operator handle must not look like a secret or an address. */
const SECRETLIKE = /@|\bsk-|\bpk_|Bearer\s|[A-Za-z0-9_-]{40,}/

export interface ValidateOptions {
  /**
   * Optional digest function. Supplied on the server so the payload digest is
   * re-derived; omitted in the browser, which recomputes it with Web Crypto and
   * compares separately. Keeping it injectable is what stops node:crypto being
   * pulled into the client bundle.
   */
  computeDigest?: (value: unknown) => string
}

export function validatePackage(pkg: DossierPackage, options: ValidateOptions = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const add = (code: string, path: string, message: string) => issues.push({ code, path, message })

  for (const path of unknownFields(pkg as unknown as Record<string, unknown>, PACKAGE_TOP_LEVEL_FIELDS, '$')) {
    add('unknown-field', path, 'Field is not declared by the package schema.')
  }

  if (pkg.packageVersion !== DOSSIER_PACKAGE_VERSION) {
    add('package-version-unknown', '$.packageVersion', `Expected ${DOSSIER_PACKAGE_VERSION}.`)
  }
  if (pkg.schemaVersion !== DOSSIER_SCHEMA_VERSION) {
    add('schema-version-unknown', '$.schemaVersion', `Expected ${DOSSIER_SCHEMA_VERSION}.`)
  }
  for (const [field, value] of [
    ['packageId', pkg.packageId],
    ['dossierId', pkg.dossierId],
    ['revisionId', pkg.revisionId],
  ] as const) {
    if (!ID.test(String(value))) add('identifier-invalid', `$.${field}`, `${field} must match ${ID}.`)
  }

  if (pkg.parentDigest !== null && !SHA.test(pkg.parentDigest)) {
    add('parent-digest-invalid', '$.parentDigest', 'Parent digest must be a sha256 digest or null.')
  }
  if (pkg.parentDigest && isPlaceholderDigest(pkg.parentDigest)) {
    add('placeholder-digest', '$.parentDigest', 'Parent digest is the empty-payload SHA-256.')
  }

  // The payload digest must be the digest of the evidentiary projection. A
  // malformed document must produce issues rather than crash the validator.
  if (!pkg.dossier || typeof pkg.dossier !== 'object') {
    add('dossier-missing', '$.dossier', 'The package carries no dossier body.')
  } else {
    try {
      const expected = options.computeDigest ? options.computeDigest(evidentiaryProjection(pkg)) : null
      if (expected === null) {
        // Digest verification is the caller's job in this environment.
      } else
      if (pkg.canonicalPayloadDigest !== expected) {
        add(
          'payload-digest-mismatch',
          '$.canonicalPayloadDigest',
          `Recomputed digest ${expected} does not match the supplied value.`,
        )
      }
    } catch (error) {
      add('payload-digest-uncomputable', '$.canonicalPayloadDigest', (error as Error).message)
    }
  }

  if (!pkg.attribution || pkg.attribution.role !== 'internal-editorial') {
    add('attribution-invalid', '$.attribution.role', 'Only internal-editorial attribution is accepted.')
  }
  if (pkg.attribution && SECRETLIKE.test(pkg.attribution.operatorHandle)) {
    add(
      'attribution-secretlike',
      '$.attribution.operatorHandle',
      'Operator handle looks like an address or credential. Use a short non-secret handle.',
    )
  }

  if (!pkg.timestamps?.submittedAt) add('timestamp-missing', '$.timestamps.submittedAt', 'Required.')

  if (!pkg.submitted?.inquiry) add('submitted-missing', '$.submitted.inquiry', 'Submitted inquiry is required.')
  if (!pkg.submitted?.prohibitedUses?.length) {
    add('submitted-missing', '$.submitted.prohibitedUses', 'At least one prohibited use is required.')
  }

  if (pkg.reviewState !== pkg.dossier?.reviewState) {
    add('review-state-mismatch', '$.reviewState', 'Package and dossier review states disagree.')
  }

  if (pkg.dossier && typeof pkg.dossier === 'object') {
    try {
      for (const issue of validateDossier(pkg.dossier)) {
        issues.push({ ...issue, path: `$.dossier.${issue.path}` })
      }
    } catch (error) {
      add('dossier-unvalidatable', '$.dossier', (error as Error).message)
    }
  }

  return issues
}

/** The parent digest must match the digest of the revision it claims to supersede. */
export function verifyParent(pkg: DossierPackage, parent: DossierPackage | null): ValidationIssue[] {
  if (!parent) {
    return pkg.parentDigest === null
      ? []
      : [
          {
            code: 'parent-missing',
            path: '$.parentDigest',
            message: 'A parent digest was supplied but no prior revision was found.',
          },
        ]
  }
  if (pkg.parentDigest === null) {
    return [
      {
        code: 'parent-digest-required',
        path: '$.parentDigest',
        message: `Revision ${parent.revisionId} exists, so a parent digest is required.`,
      },
    ]
  }
  if (pkg.parentDigest !== parent.canonicalPayloadDigest) {
    return [
      {
        code: 'parent-digest-mismatch',
        path: '$.parentDigest',
        message: `Parent digest does not match revision ${parent.revisionId}.`,
      },
    ]
  }
  return []
}

/** Deterministic normalized export. */
export function normalizedPackageJson(pkg: DossierPackage): string {
  return canonicalJson(pkg)
}
