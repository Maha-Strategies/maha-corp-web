/**
 * Adjudication of the example claims in the commercial blueprint.
 *
 * The blueprint was used as a product brief only. Nothing in it was treated as
 * evidence, and every checkable element of its demonstration record was
 * rechecked independently. Both of its example claims were rejected.
 */

export const EXAMPLE_AUDIT_VERSION = 'maha-antigravity-example-audit/1.0' as const

export type ExampleVerdict = 'accepted' | 'corrected' | 'rejected'

export interface ExampleFinding {
  ref: string
  submitted: string
  verdict: ExampleVerdict
  finding: string
  checkedAgainst: string
}

export const ANTIGRAVITY_EXAMPLE_FINDINGS: readonly ExampleFinding[] = [
  {
    ref: 'clm_01 primary source DOI',
    submitted: 'doi 10.1117/1.JMM.21.3.031202, quoted as measuring 97.8% (+/- 0.3%) single-pass EUV transmission.',
    verdict: 'rejected',
    finding:
      'The submitted DOI is unregistered: the global handle system returns responseCode 100 (handle not found) and no matching Crossref record was located. The cited document therefore could not be retrieved and the quoted passage could not be authenticated against it, so the submitted claim is unverifiable and is rejected. This is a finding about the submitted metadata, not a determination that no related publication exists; a paper with this content may be indexed under a different identifier, and an exhaustive authoritative search was not performed.',
    checkedAgainst: 'doi.org handle API; Crossref REST API; doi.org HTTP resolution',
  },
  {
    ref: 'clm_02 primary source DOI',
    submitted: 'doi 10.1117/12.2584112, quoted as observing CNT mass loss under 20 Pa hydrogen radical plasma.',
    verdict: 'rejected',
    finding:
      'The submitted DOI is unregistered: responseCode 100 and no matching Crossref record, the same result as clm_01. The passage could not be authenticated against the cited identifier, so the submitted claim is unverifiable and is rejected. No conclusion is drawn about whether a related publication exists under different metadata.',
    checkedAgainst: 'doi.org handle API; Crossref REST API; doi.org HTTP resolution',
  },
  {
    ref: 'clm_01 epistemic status',
    submitted: 'REPLICATED_EMPIRICAL, asserted from a single cited source.',
    verdict: 'rejected',
    finding:
      'Replication requires at least two genuinely independent empirical sources reporting materially equivalent results under comparable conditions. One source cannot establish replication. The dossier validator now refuses this status without the required support.',
    checkedAgainst: 'Internal rule; enforced by validateDossier',
  },
  {
    ref: 'clm_02 power conflation',
    submitted:
      'Claim text says "600W EUV source power" while the quoted passage says "600 W equivalent flux" of hydrogen radical plasma.',
    verdict: 'rejected',
    finding:
      'Source power, intermediate-focus power, wafer-plane power, absorbed power, equivalent flux and plasma power are distinct quantities. The submitted claim silently substitutes one for another, and the substitution is what makes the claim sound like a scanner-level result.',
    checkedAgainst: 'Internal consistency of the submitted record',
  },
  {
    ref: 'clm_02 environment extrapolation',
    submitted:
      'Conflict note contrasts hydrogen-radical degradation with a source claiming zero degradation under inert argon.',
    verdict: 'rejected',
    finding:
      'Argon, vacuum, hydrogen gas and hydrogen-radical environments are not interchangeable, so the comparison does not establish a contradiction. The referenced counter-source, clm_ref_098, does not appear anywhere in the blueprint, so the disagreement cannot be checked at all.',
    checkedAgainst: 'Dangling reference in the submitted record',
  },
  {
    ref: 'reviewState',
    submitted: 'VERIFIED_CANONICAL',
    verdict: 'rejected',
    finding:
      'Not a declared review state, and it asserts canonical status for a record whose sources do not resolve. The schema replaces it with a four-step ladder starting at illustrative-draft, and transitions may not skip internal audit.',
    checkedAgainst: 'Internal rule; enforced by isLegalReviewTransition',
  },
  {
    ref: 'provenanceDigest',
    submitted: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    verdict: 'rejected',
    finding:
      'This is the SHA-256 of the empty input. It is a placeholder presented as provenance, and it would be identical in every dossier ever produced. The digest implementation throws rather than emit it, and the validator rejects any record carrying it.',
    checkedAgainst: 'Known constant; enforced by provenanceDigest and validateDossier',
  },
  {
    ref: 'disclaimer wording',
    submitted: 'Maha Strategies LLC certifies source passage attribution and claim boundary extraction only.',
    verdict: 'corrected',
    finding:
      'The scope limitation is reasonable but "certifies" implies an attestation the firm cannot make. The demonstration dossier says it attests to passage location and claim boundary only, and the validator rejects certification wording in dossier prose.',
    checkedAgainst: 'Internal rule; enforced by validateDossier prohibited wording',
  },
  {
    ref: 'demonstration topic',
    submitted: 'High-NA EUV carbon nanotube pellicle thermal dissipation.',
    verdict: 'rejected',
    finding:
      'The topic itself is legitimate, but neither submitted identifier resolves, so neither passage could be authenticated, and no substitute was found that could be opened and quoted with an exact locator within this sprint. Rather than rebuild the topic on sources that could not be inspected, the demonstration was moved to EUV photoresist stochastics, where the primary source could be downloaded and read.',
    checkedAgainst: 'doi.org handle API; Crossref; publisher availability',
  },
]

export function exampleVerdictTotals(): Record<ExampleVerdict, number> {
  const totals: Record<ExampleVerdict, number> = { accepted: 0, corrected: 0, rejected: 0 }
  for (const finding of ANTIGRAVITY_EXAMPLE_FINDINGS) totals[finding.verdict] += 1
  return totals
}
