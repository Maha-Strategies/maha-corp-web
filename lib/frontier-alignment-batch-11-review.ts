import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import { ALIGNMENT_BATCH_11_PACKETS, type Batch11Packet } from './frontier-alignment-batch-11.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from './frontier-domain-graphs.ts'

/**
 * Internal review of the twenty Batch 11 remediation packets.
 *
 * A packet is a proposal. It records that somebody opened a source and found
 * something at a stated locator. It is not an active binding, and accepting one
 * here does not make it one: these decisions are append-only review artifacts
 * that a later, separately reviewed record revision may act on.
 *
 * Each decision is bound to the exact packet digest and the exact record
 * revision it was taken against. If either moves, the decision is stale by
 * construction and cannot be inherited by the changed thing.
 *
 * The distribution was recomputed from the evidence rather than carried over
 * from the packets. It differs: the packets report ten supported, but one of
 * those ten proposes the bioRxiv preprint of the very work the record already
 * cites. Replacing a source with itself is not a replacement, so that packet is
 * reviewed as a scope revision instead.
 */

export const BATCH_11_REVIEW_VERSION = 'maha-frontier-alignment-batch-11-review/1.0' as const

export type Batch11Disposition =
  | 'accept-source-replacement'
  | 'revise-record-scope'
  | 'reject-or-hold'

/**
 * What the decision permits a downstream revision to assert.
 *
 * Deliberately separate from the disposition. Accepting a replacement says the
 * source belongs on the record; it does not say how much the source can carry.
 * An abstract establishes that a work is about a subject and nothing further.
 */
export interface BoundedClaimScope {
  /** The claim form the record actually makes, quoted from the record. */
  recordClaimForm: string
  /** What the inspected evidence supports for that claim form. */
  supports: string
  /** What it must not be used for, stated positively rather than left implicit. */
  doesNotSupport: readonly string[]
  /** True only where a section was read closely enough to carry a number. */
  quantitativeDetailPermitted: boolean
}

export interface Batch11Decision {
  decisionId: string
  recordId: string
  disposition: Batch11Disposition
  /** Digest of the exact packet reviewed. A changed packet invalidates this. */
  packetDigest: string
  /** Identity of the exact record revision reviewed. A changed record invalidates this. */
  recordRevision: { canonicalVersion: string; recordDigest: string }
  /** Null wherever the packet bound no source. */
  sourceIdentity: string | null
  versionRelationship: string | null
  inspectedContentLocator: string | null
  rightsBasis: string | null
  boundedClaimScope: BoundedClaimScope | null
  rationale: string
  /** Stated on every decision so no reader has to infer standing from silence. */
  activeBindingChanged: false
  canonicalReleaseAuthorized: false
  supersedes: null
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

/** The record as it stands now. A decision is only valid against this revision. */
function recordRevision(recordId: string): { canonicalVersion: string; recordDigest: string } {
  const record = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === recordId)
  if (!record) throw new Error(`${recordId}: no such record; cannot bind a decision to a revision that does not exist.`)
  return {
    canonicalVersion: record.publication.canonicalVersion,
    recordDigest: digest(record),
  }
}

interface ReviewInput {
  disposition: Batch11Disposition
  supports: string
  doesNotSupport: readonly string[]
  quantitativeDetailPermitted: boolean
  rationale: string
}

/**
 * The reviewed judgement per record.
 *
 * Every entry is a judgement about what the inspected evidence can carry for
 * the claim form the record actually makes, which is a subject-identity claim:
 * "The cited source supports treating X as a distinct mechanism within the
 * stated scope." That form is why an abstract can suffice for identity while
 * still carrying no number.
 */

const REVIEW: Record<string, ReviewInput> = {
  'fusion-plasma-systems-tokamak-plasma-equilibrium': {
    disposition: 'accept-source-replacement',
    supports: 'Treating tokamak plasma equilibrium as a distinct mechanism, and the Grad-Shafranov force-balance condition read at an exact subsection.',
    doesNotSupport: [
      'Any ITER-specific engineering parameter, which came from the displaced magnet page and is not carried by this source.',
      'Any numeric equilibrium result, since only the derivation subsection was read.',
    ],
    quantitativeDetailPermitted: true,
    rationale: 'The displaced source described coil hardware; a machine description cannot establish an equilibrium physics result. The replacement derives the axisymmetric equilibrium equation directly at a named subsection, which is the mechanism the record names.',
  },
  'agentic-systems-mcp-tool-allowlisting': {
    disposition: 'revise-record-scope',
    supports: 'Scope-limited tool exposure and human-in-the-loop denial, at two exact locators in specification revision 2026-07-28.',
    doesNotSupport: [
      'That the Model Context Protocol specification defines a tool allowlist. It does not. A full read found allowlist used twice, for OAuth URL schemes and for client-ID domains, never for tools.',
      'Any per-tool permitted-set mechanism.',
    ],
    quantitativeDetailPermitted: false,
    rationale: 'The record names tool allowlisting. The specification specifies no such mechanism, so no replacement can be accepted for that subject. The record is revised to the narrower thing the specification does define. Two pages were read in full; the rest of the revision was not, so this is a narrowing rather than a finding that no allowlist exists anywhere in the specification.',
  },
  'critical-supply-chains-high-purity-quartz-deposits': {
    disposition: 'revise-record-scope',
    supports: 'The high-purity quartz purity specification, under 100 ppm total impurities, and the existence of United States production.',
    doesNotSupport: [
      'Any deposit or resource assessment. The only deposit-level content located was an image caption naming a North Carolina mine, which is not an assessment.',
      'Any reserve, tonnage or grade figure.',
    ],
    quantitativeDetailPermitted: false,
    rationale: 'The record names deposits. The inspected page defines the commodity and confirms production but assesses no deposit, and the dated Mineral Commodity Summaries chapter that would carry a resource assessment returned HTTP 403 and was not read. Definition-only is therefore the most the evidence supports.',
  },
  'advanced-materials-color-centers-in-diamond': {
    disposition: 'accept-source-replacement',
    supports: 'Treating colour centres in diamond as a distinct mechanism, established from the abstract of a dedicated review of the nitrogen-vacancy centre.',
    doesNotSupport: [
      'Any quantitative property of the centre. Only the abstract was read.',
      'Any claim about diamond as a power-device material, which is what the displaced source was about.',
    ],
    quantitativeDetailPermitted: false,
    rationale: 'The displaced source was a power-device assessment whose text was never readable and which never treated colour centres. The replacement is a dedicated review of the subject, tied to its version of record by publisher DOI. Abstract-level inspection establishes subject identity, which is exactly the claim form this record makes, and nothing beyond it.',
  },
  'biomolecular-engineering-structure-prediction-filtering': {
    disposition: 'revise-record-scope',
    supports: 'The explicit in silico filtering step, with its pAE and backbone-RMSD acceptance thresholds, read at a named section of the bioRxiv preprint.',
    doesNotSupport: [
      'A locator into the Nature version of record. The preprint carries a different title and different section structure, so this locator does not transfer.',
      'Any claim that the published article states these thresholds in these terms, which was not verified because the publisher copy sat behind an authentication redirect.',
    ],
    quantitativeDetailPermitted: true,
    rationale: 'This packet is NOT a source replacement and is not reviewed as one. The record already cites this work; the packet proposes the preprint of the same work. Replacing a source with itself is not a replacement. What the inspection genuinely adds is an exact locator for the filtering step the prior evidence could not establish from the abstract, so the record\'s scope is revised to that locator rather than its binding being swapped.',
  },
  'mechanistic-interpretability-representation-probing-boundary': {
    disposition: 'accept-source-replacement',
    supports: 'Treating the representation probing boundary as a distinct mechanism, with selectivity defined against control tasks at a named figure caption.',
    doesNotSupport: [
      'Any numeric selectivity value for a particular probe or corpus.',
      'Any claim about superposition, which is what the displaced source was about.',
    ],
    quantitativeDetailPermitted: true,
    rationale: 'The displaced source was inspected and contains no probing methodology. The replacement states the boundary directly: probe accuracy alone cannot distinguish a property encoded in the representation from one the probe learned, and it supplies control tasks and selectivity as the method for telling those apart.',
  },
  'mechanistic-interpretability-activation-patching': {
    disposition: 'accept-source-replacement',
    supports: 'Treating activation patching as a distinct mechanism, with the clean, corrupted and restore procedure specified at section 2.1.',
    doesNotSupport: [
      'The paper\'s own methodological recommendations about patching metrics, which are its contribution and not what this record binds.',
      'Any numeric result from the paper\'s experiments.',
    ],
    quantitativeDetailPermitted: true,
    rationale: 'The displaced source applies activation-resampling interventions but does not specify the general technique, which is why it only partially supported the record. The replacement names the technique in its title and specifies the procedure at an exact section, under CC BY 4.0.',
  },
  'longevity-metabolism-mitophagy-flux': {
    disposition: 'accept-source-replacement',
    supports: 'Treating mitophagy flux as a distinct, operationalised measured quantity, defined as an induced-to-basal ratio at a named section.',
    doesNotSupport: [
      'Generalisation of that ratio beyond the flow-cytometry protocol and pancreatic beta-cell system in which it is defined.',
      'Any flux value, rate or reference range.',
    ],
    quantitativeDetailPermitted: true,
    rationale: 'The displaced source treats mitophagy mechanisms but the word flux appeared zero times at the level inspected, so it could not carry the measurement the record names. The replacement operationalises flux explicitly. This is the weakest domain fidelity in the accepted set: the source is a protocol paper in one cell type bound to a longevity-metabolism record, and the scope above is bounded accordingly.',
  },
  'advanced-materials-gallium-nitride-epitaxy': {
    disposition: 'accept-source-replacement',
    supports: 'Treating gallium nitride epitaxy as a distinct mechanism, with heteroepitaxial MOCVD growth and substrate mismatch read at section 4.1.',
    doesNotSupport: [
      'Any dislocation density, growth rate or wafer specification.',
      'Any claim beyond the space-photovoltaics framing in which the review treats epitaxy.',
    ],
    quantitativeDetailPermitted: true,
    rationale: 'The displaced source was never readable. The replacement treats heteroepitaxial GaN growth at a named section under CC BY 4.0. Its overall scope is space photovoltaics rather than epitaxy, so the binding is accepted for the epitaxy section specifically and the scope records that.',
  },
  'advanced-materials-sic-wide-bandgap-substrates': {
    disposition: 'accept-source-replacement',
    supports: 'Treating SiC wide-bandgap substrates as a distinct mechanism, with physical vapour transport growth of the bulk crystal read in the introduction.',
    doesNotSupport: [
      'Any commercial substrate specification, diameter or defect-density figure.',
      'Any claim about SiC device performance, which the source does not address.',
    ],
    quantitativeDetailPermitted: true,
    rationale: 'The displaced source was never readable. The replacement treats bulk 4H-SiC growth by PVT, the process that produces substrate material, under CC BY 4.0 with the published version and the inspected copy being the same text.',
  },
  'advanced-materials-cvd-graphene-grain-boundaries': {
    disposition: 'accept-source-replacement',
    supports: 'Treating CVD graphene grain boundaries as a distinct mechanism, established from the abstract\'s statement that CVD graphene is intrinsically polycrystalline with grains stitched by disordered boundaries.',
    doesNotSupport: [
      'Any transport measurement across a grain boundary. Only the abstract was read.',
      'Any growth-condition or mobility figure.',
    ],
    quantitativeDetailPermitted: false,
    rationale: 'The displaced review was full-text searched during earlier recovery and contained neither CVD nor grain boundar, so it could not carry this subject. The replacement states the relation directly. Abstract-level inspection establishes subject identity and no more.',
  },
  'advanced-materials-dielectric-screening': {
    disposition: 'accept-source-replacement',
    supports: 'Treating dielectric screening as a distinct mechanism, established from the abstract\'s statement that two-dimensional macroscopic screening is non-local and q-dependent.',
    doesNotSupport: [
      'Any screening length, dielectric constant or binding-energy figure. Only the abstract was read.',
      'Any claim specific to a material system other than the two-dimensional insulators the source treats.',
    ],
    quantitativeDetailPermitted: false,
    rationale: 'The displaced review was full-text searched during earlier recovery and contained no occurrence of screening at all. The replacement treats the subject directly and distinguishes the two-dimensional form. Abstract-level inspection establishes subject identity and no more.',
  },
  'critical-supply-chains-helium-liquefaction-logistics': {
    disposition: 'reject-or-hold',
    supports: '',
    doesNotSupport: [],
    quantitativeDetailPermitted: false,
    rationale: 'No inspectable source for a bounded liquefaction-and-transport chain was established. The commodity chapter covers helium production and storage but not the chain the record names. The packet proposes nothing and this decision changes nothing; the record keeps its existing binding and blockers.',
  },
  'critical-supply-chains-dysprosium-ore-to-oxide': {
    disposition: 'reject-or-hold',
    supports: '',
    doesNotSupport: [],
    quantitativeDetailPermitted: false,
    rationale: 'No inspectable source specifying the ore-to-oxide separation route was established. The packet proposes nothing and this decision changes nothing; the record keeps its existing binding and blockers.',
  },
  'neurotechnology-bci-adaptive-stimulation-policies': {
    disposition: 'reject-or-hold',
    supports: '',
    doesNotSupport: [],
    quantitativeDetailPermitted: false,
    rationale: 'No comparative-policy source was inspected. The existing binding demonstrates one adaptive rule, which is not the policy framework the record names. The packet proposes nothing and this decision changes nothing; the record keeps its existing binding and blockers.',
  },
  'critical-supply-chains-euv-photoresist-precursors': {
    disposition: 'reject-or-hold',
    supports: '',
    doesNotSupport: [],
    quantitativeDetailPermitted: false,
    rationale: 'No inspectable source treating EUV resist precursor materials or their supply was established. The packet proposes nothing and this decision changes nothing; the record keeps its existing binding and blockers.',
  },
  'critical-supply-chains-photoacid-generator-supply': {
    disposition: 'reject-or-hold',
    supports: '',
    doesNotSupport: [],
    quantitativeDetailPermitted: false,
    rationale: 'No inspectable source treating photoacid generator chemistry together with its supply position was established. The packet proposes nothing and this decision changes nothing; the record keeps its existing binding and blockers.',
  },
  'advanced-materials-diamond-thermal-conductivity': {
    disposition: 'reject-or-hold',
    supports: '',
    doesNotSupport: [],
    quantitativeDetailPermitted: false,
    rationale: 'No open source reporting measured diamond thermal conductivity was established. The existing binding remains behind an IEEE paywall and its content is still unread. The packet proposes nothing and this decision changes nothing; the record keeps its existing binding and blockers.',
  },
  'advanced-materials-diamond-wafer-substrates': {
    disposition: 'reject-or-hold',
    supports: '',
    doesNotSupport: [],
    quantitativeDetailPermitted: false,
    rationale: 'No open source on heteroepitaxial diamond wafer growth was established. The existing binding remains unread. The packet proposes nothing and this decision changes nothing; the record keeps its existing binding and blockers.',
  },
  'advanced-materials-dry-transfer-contamination': {
    disposition: 'reject-or-hold',
    supports: '',
    doesNotSupport: [],
    quantitativeDetailPermitted: false,
    rationale: 'Attempted and failed. The strongest candidate redirected to an authentication endpoint, which was not followed, so no text was read and no substitute was inspected. The packet proposes nothing and this decision changes nothing; the record keeps its existing binding and blockers.',
  },
}

/** The claim form every one of these records makes, quoted once. */
const RECORD_CLAIM_FORM =
  'The cited source supports treating {subject} as a distinct mechanism within the stated {domain} scope.'

/**
 * Builds the decision for one packet.
 *
 * Digests are computed from the packet and the record as they stand, so a
 * decision cannot outlive either. Nothing here mutates a binding.
 */
function decide(packet: Batch11Packet): Batch11Decision {
  const slug = packet.recordId.split(':').pop() as string
  const review = REVIEW[slug]
  if (!review) throw new Error(`${packet.recordId}: no review decision recorded for this packet.`)

  const held = review.disposition === 'reject-or-hold'
  if (held && packet.source !== null) {
    throw new Error(`${packet.recordId}: a held decision cannot be taken against a packet that binds a source.`)
  }
  if (!held && packet.source === null) {
    throw new Error(`${packet.recordId}: a non-held decision requires a packet that bound a source.`)
  }
  // Abstract-level evidence can identify a subject; it cannot carry a number.
  if (review.quantitativeDetailPermitted && packet.inspection?.depth === 'abstract-and-identity') {
    throw new Error(`${packet.recordId}: abstract-level inspection cannot permit quantitative detail.`)
  }

  return {
    decisionId: `urn:maha:decision:frontier-alignment-batch-11:${slug}`,
    recordId: packet.recordId,
    disposition: review.disposition,
    packetDigest: digest(packet),
    recordRevision: recordRevision(packet.recordId),
    sourceIdentity: packet.source ? `${packet.source.title} | ${packet.source.identifier ?? 'no identifier'} | ${packet.source.inspectedCopy}` : null,
    versionRelationship: packet.inspection?.versionRelationship ?? null,
    inspectedContentLocator: packet.inspection?.locator ?? null,
    rightsBasis: packet.inspection?.rightsBasis ?? null,
    boundedClaimScope: held
      ? null
      : {
          recordClaimForm: RECORD_CLAIM_FORM,
          supports: review.supports,
          doesNotSupport: review.doesNotSupport,
          quantitativeDetailPermitted: review.quantitativeDetailPermitted,
        },
    rationale: review.rationale,
    activeBindingChanged: false,
    canonicalReleaseAuthorized: false,
    supersedes: null,
  }
}

export const BATCH_11_DECISIONS: readonly Batch11Decision[] = [...ALIGNMENT_BATCH_11_PACKETS]
  .sort((a, b) => (a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0))
  .map(decide)

/** Counts derived from the decisions, never asserted alongside them. */
export function batch11DecisionTotals() {
  const by = (d: Batch11Disposition) => BATCH_11_DECISIONS.filter((x) => x.disposition === d).length
  return {
    reviewed: BATCH_11_DECISIONS.length,
    acceptSourceReplacement: by('accept-source-replacement'),
    reviseRecordScope: by('revise-record-scope'),
    rejectOrHold: by('reject-or-hold'),
    quantitativeDetailPermitted: BATCH_11_DECISIONS.filter((d) => d.boundedClaimScope?.quantitativeDetailPermitted).length,
    activeBindingsChanged: 0,
    canonicalReleasesAuthorized: 0,
  }
}
