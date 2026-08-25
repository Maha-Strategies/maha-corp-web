import {
  DOSSIER_REVIEW_STATES,
  EPISTEMIC_STATUSES,
  CLAIM_TYPES,
  REPLICATED_EMPIRICAL,
  type DossierClaim,
  type EvidenceDossier,
} from './schema.ts'
import { isPlaceholderDigest } from './digest.ts'

/**
 * Fail-closed validation. Anything missing is an error, never a warning: a
 * dossier that cannot prove a locator, a rights basis or a real digest is not
 * publishable in any state.
 */

export interface ValidationIssue {
  code: string
  path: string
  message: string
}

/** Wording that would imply approval, defensibility or external review. */
const PROHIBITED_WORDING =
  /\b(certifie[sd]|certification|FDA[- ]approved|regulatory approval|patent[- ]defensib\w*|peer[- ]reviewed by us|independently reviewed by|scientifically prove[nd]|guarantee[sd]?)\b/i

export function validateDossier(dossier: EvidenceDossier): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const add = (code: string, path: string, message: string) => issues.push({ code, path, message })

  if (!DOSSIER_REVIEW_STATES.includes(dossier.reviewState)) {
    add('review-state-unknown', 'reviewState', `${dossier.reviewState} is not a declared review state.`)
  }

  for (const field of ['dossierId', 'title', 'inquiry', 'domainId', 'intendedUse', 'methodology', 'disclaimer'] as const) {
    if (!dossier[field] || String(dossier[field]).trim().length < 3) {
      add('field-missing', field, `${field} is required.`)
    }
  }
  if (!dossier.prohibitedUses.length) add('field-missing', 'prohibitedUses', 'At least one prohibited use is required.')
  if (!dossier.limitations.length) add('field-missing', 'limitations', 'At least one limitation is required.')

  // No wording implying approval, certification or external review.
  const prose = [dossier.disclaimer, dossier.intendedUse, dossier.methodology, ...dossier.limitations].join(' ')
  if (PROHIBITED_WORDING.test(prose)) {
    add('prohibited-wording', 'disclaimer', 'Dossier prose implies approval, certification or external review.')
  }

  const sourceIds = new Set(dossier.sources.map((source) => source.sourceId))
  const passageIds = new Set(dossier.passages.map((passage) => passage.passageId))

  for (const source of dossier.sources) {
    const path = `sources.${source.sourceId}`
    if (!source.submittedCitation) add('source-missing-citation', path, 'Submitted citation is required.')
    if (!source.rightsBasis) add('rights-basis-missing', path, 'A rights basis is required for every source.')
    if (!source.publicationType) add('source-missing-type', path, 'Publication type is required.')
    if (!source.metadataProvenance) add('source-missing-provenance', path, 'Metadata provenance is required.')
    if (source.verificationState !== 'unverifiable' && !source.identifier) {
      add('source-missing-identifier', path, 'A verified source must carry a stable identifier.')
    }
    if (source.verificationState !== 'unverifiable' && !source.verifiedAt) {
      add('source-missing-timestamp', path, 'A verified source must carry a verification timestamp.')
    }
  }

  for (const passage of dossier.passages) {
    const path = `passages.${passage.passageId}`
    if (!sourceIds.has(passage.sourceId)) add('passage-orphan', path, 'Passage references an unknown source.')
    // Missing locators fail closed.
    if (!passage.locator || !passage.locator.trim()) {
      add('locator-missing', path, 'A passage without an exact locator cannot be used.')
    }
    if (!passage.excerpt || passage.excerpt.trim().length < 10) {
      add('passage-missing-excerpt', path, 'An excerpt or rights-compliant paraphrase is required.')
    }
    if (!passage.passageHash.startsWith('sha256:')) {
      add('passage-hash-invalid', path, 'Passage hash must be a sha256 digest.')
    }
    if (isPlaceholderDigest(passage.passageHash)) {
      add('placeholder-digest', path, 'Passage hash is the empty-payload SHA-256.')
    }
    if (passage.extractionMethod === 'not-extracted' && passage.originalDocumentInspected) {
      add('extraction-contradiction', path, 'A passage cannot be inspected and not extracted.')
    }
  }

  for (const claim of dossier.claims) {
    issues.push(...validateClaim(claim, dossier, sourceIds, passageIds))
  }

  const bundle = dossier.provenanceBundle
  if (bundle.sourceCount !== dossier.sources.length) add('bundle-count-mismatch', 'provenanceBundle.sourceCount', 'Source count disagrees.')
  if (bundle.passageCount !== dossier.passages.length) add('bundle-count-mismatch', 'provenanceBundle.passageCount', 'Passage count disagrees.')
  if (bundle.claimCount !== dossier.claims.length) add('bundle-count-mismatch', 'provenanceBundle.claimCount', 'Claim count disagrees.')
  if (isPlaceholderDigest(bundle.dossierDigest)) {
    add('placeholder-digest', 'provenanceBundle.dossierDigest', 'Dossier digest is the empty-payload SHA-256.')
  }
  if (!bundle.dossierDigest.startsWith('sha256:')) {
    add('digest-invalid', 'provenanceBundle.dossierDigest', 'Dossier digest must be a sha256 digest.')
  }

  return issues
}

function validateClaim(
  claim: DossierClaim,
  dossier: EvidenceDossier,
  sourceIds: Set<string>,
  passageIds: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const path = `claims.${claim.claimId}`
  const add = (code: string, message: string) => issues.push({ code, path, message })

  if (!claim.submittedStatement) add('claim-missing-submitted', 'Submitted statement must be preserved.')
  if (!claim.auditedStatement) add('claim-missing-audited', 'Audited statement is required.')
  if (!CLAIM_TYPES.includes(claim.claimType)) add('claim-type-unknown', `${claim.claimType} is not a declared claim type.`)
  if (!claim.verificationScope) add('claim-missing-scope', 'Verification scope is required.')
  if (!claim.uncertainty) add('claim-missing-uncertainty', 'Uncertainty is required.')
  if (isPlaceholderDigest(claim.provenanceDigest)) add('placeholder-digest', 'Claim digest is the empty-payload SHA-256.')

  const statusKnown =
    EPISTEMIC_STATUSES.includes(claim.epistemicStatus as never) || claim.epistemicStatus === REPLICATED_EMPIRICAL
  if (!statusKnown) add('epistemic-status-unknown', `${claim.epistemicStatus} is not a declared epistemic status.`)

  for (const sourceId of claim.sourceIds) {
    if (!sourceIds.has(sourceId)) add('claim-orphan-source', `References unknown source ${sourceId}.`)
  }
  for (const passageId of claim.passageIds) {
    if (!passageIds.has(passageId)) add('claim-orphan-passage', `References unknown passage ${passageId}.`)
  }

  // A claim resting on a passage requires that passage to have been inspected.
  if (claim.epistemicStatus === 'passage-supports-bounded-claim') {
    if (!claim.passageIds.length) add('claim-without-passage', 'This status requires at least one passage.')
    const supporting = dossier.passages.filter((passage) => claim.passageIds.includes(passage.passageId))
    if (supporting.some((passage) => !passage.originalDocumentInspected)) {
      add('claim-passage-not-inspected', 'This status requires the original document to have been inspected.')
    }
  }

  // Replication requires two genuinely independent empirical sources.
  if (claim.epistemicStatus === REPLICATED_EMPIRICAL) {
    const sources = dossier.sources.filter((source) => claim.sourceIds.includes(source.sourceId))
    const independentEmpirical = sources.filter(
      (source) => source.verificationState === 'document-inspected' && source.publicationType !== 'model-or-simulation',
    )
    if (independentEmpirical.length < 2) {
      add(
        'replication-unsupported',
        'replicated-empirical requires at least two independent inspected empirical sources.',
      )
    }
    if (claim.claimType === 'modelled-result') {
      add('replication-from-model', 'A modelled result cannot be replicated empirical.')
    }
  }

  return issues
}

export function assertValidDossier(dossier: EvidenceDossier): void {
  const issues = validateDossier(dossier)
  if (issues.length) {
    throw new Error(`Dossier failed validation:\n${issues.map((issue) => `  ${issue.code} at ${issue.path}: ${issue.message}`).join('\n')}`)
  }
}
