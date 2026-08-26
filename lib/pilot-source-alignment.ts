import { createHash } from 'node:crypto'

import { EPISTEMIC_RECORDS } from './epistemic-pilots.ts'
import { epistemicReviewTargetHash } from './epistemic-publication.ts'
import { ALIGNMENT_VERDICTS, type AlignmentVerdict } from './frontier-source-alignment.ts'

/**
 * Source-alignment audit for the fifty canonical pilot records.
 *
 * The frontier audit covers 240 records. It does not cover quantum-systems or
 * synthetic-biology, so every endpoint resolving into those domains reported
 * `audit-missing` and failed closed. That was correct behaviour and a real
 * coverage gap; this module closes it.
 *
 * These records differ structurally from the frontier cohort. The frontier
 * corpus assigned six sources across thirty concepts by position. Here each
 * record carries its own curated source - fifty records across thirty-two
 * distinct sources - and the pairings look deliberate rather than positional.
 * That is a reason to check them, not a reason to assume they are right.
 *
 * The same separations apply and are never collapsed: metadata resolution is
 * not content inspection, an abstract supports only what the abstract states,
 * a preprint is not silently treated as the version of record, internal
 * editorial reading is not external review, and nothing here is reproduced.
 */

export const PILOT_ALIGNMENT_VERSION = 'maha-pilot-source-alignment/1.0' as const
export const PILOT_ALIGNMENT_INPUT_DATE = '2026-08-26' as const

export const PILOT_DOMAINS = ['quantum-systems', 'synthetic-biology'] as const
export type PilotDomain = (typeof PILOT_DOMAINS)[number]

/** How the inspected artifact relates to the declared source. */
export const VERSION_RELATIONSHIPS = [
  'preprint-of-the-declared-version-of-record',
  'declared-version-of-record-inspected',
  'declared-version-of-record-not-retrieved',
  'no-declared-source',
] as const
export type VersionRelationship = (typeof VERSION_RELATIONSHIPS)[number]

export const PILOT_ARTIFACT_VERSIONS = [
  'version-of-record',
  'accepted-manuscript',
  'preprint',
  'repository-copy',
  'not-inspected',
] as const
export type PilotArtifactVersion = (typeof PILOT_ARTIFACT_VERSIONS)[number]

interface PilotJudgement {
  domainSlug: PilotDomain
  /** Null only for a hypothesis record that declares no source at all. */
  sourceContractId: string | null
  verdict: AlignmentVerdict
  metadataVerified: boolean
  sourceContentInspected: boolean
  inspectedContentLocation: string | null
  artifactVersion: PilotArtifactVersion
  versionRelationship: VersionRelationship
  rightsBasis: string
  reason: string
  remediation: string
}

/**
 * Nine records had their source read this sprint, across four artifacts: the
 * Koch transmon paper, the Blais circuit-QED architecture, the Fowler surface
 * code review and the Temme mitigation paper, each as the arXiv preprint of the
 * declared version of record. Everything else is metadata-verified only and is
 * recorded as insufficient-evidence, which blocks.
 */
const PILOT_JUDGEMENTS: Readonly<Record<string, PilotJudgement>> = {
  'adenine-base-editing': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-gaudelli-abe-2017',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Programmable base editing of A•T to G•C in genomic DNA without DNA cle\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'cell-free-gene-expression': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-noireaux-cell-free-2004',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'A vesicle bioreactor as a step toward an artificial cell assembly\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'cell-line-versus-primary-cell-evidence': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-lazzarotto-change-seq-2020',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'CHANGE-seq reveals genetic and epigenetic effects on CRISPR–Cas9 genom\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'change-seq-off-target-nomination': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-lazzarotto-change-seq-2020',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'CHANGE-seq reveals genetic and epigenetic effects on CRISPR–Cas9 genom\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'circuit-quantum-electrodynamics': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-blais-circuit-qed-2004',
    verdict: 'supported',
    metadataVerified: true,
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:cond-mat/0402216 abstract',
    artifactVersion: 'preprint',
    versionRelationship: 'preprint-of-the-declared-version-of-record',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'The abstract proposes a realizable architecture using one-dimensional transmission line resonators to reach the strong-coupling limit of cavity QED in superconducting circuits, which is the record subject.',
    remediation: 'None. The mapping is curated and confirmed.',
  },
  'coherence-t1-t2-measurements': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-arute-random-circuits-2019',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Quantum supremacy using a programmable superconducting processor\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'crispr-cas9-nuclease-editing': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-jinek-cas9-2012',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'A Programmable Dual-RNA–Guided DNA Endonuclease in Adaptive Bacterial \', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'cryogenic-superconducting-control-stack': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-arute-random-circuits-2019',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Quantum supremacy using a programmable superconducting processor\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'cytosine-base-editing': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-komor-cbe-2016',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Programmable editing of a target base in genomic DNA without double-st\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'directed-evolution-workflows': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-esvelt-pace-2011',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'A system for the continuous directed evolution of biomolecules\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'dispersive-qubit-readout': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-blais-circuit-qed-2004',
    verdict: 'partially-supported',
    metadataVerified: true,
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:cond-mat/0402216 abstract',
    artifactVersion: 'preprint',
    versionRelationship: 'preprint-of-the-declared-version-of-record',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'The abstract references high-fidelity quantum non-demolition measurement of multiple qubit states, which bears on readout, but does not name the dispersive regime. The declared locator points at sections II-V that were not read, so the dispersive analysis itself is unconfirmed.',
    remediation: 'Read sections II-V for the dispersive-regime analysis before confirming.',
  },
  'double-strand-break-repair-outcomes': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-cong-multiplex-editing-2013',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Multiplex Genome Engineering Using CRISPR/Cas Systems\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'editing-efficiency-and-byproduct-measurement': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-anzalone-prime-2019-graph',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Search-and-replace genome editing without double-strand breaks or dono\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'error-mitigation-versus-correction': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-temme-error-mitigation-2017',
    verdict: 'partially-supported',
    metadataVerified: true,
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:1612.02058 abstract',
    artifactVersion: 'preprint',
    versionRelationship: 'preprint-of-the-declared-version-of-record',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'The abstract frames both schemes as mitigation for short-depth circuits without additional qubit resources, which implies the contrast with error correction, but it does not state the comparison explicitly.',
    remediation: 'Read the discussion for an explicit comparison, or narrow the record to the mitigation schemes.',
  },
  'ex-vivo-genome-editing-workflow': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-frangoul-crispr-2021',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'CRISPR-Cas9 Gene Editing for Sickle Cell Disease and β-Thalassemia\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'fault-tolerance-threshold-condition': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-fowler-surface-code-2012',
    verdict: 'partially-supported',
    metadataVerified: true,
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:1208.0928 abstract',
    artifactVersion: 'preprint',
    versionRelationship: 'preprint-of-the-declared-version-of-record',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'The abstract gives numerical estimates of logical-qubit fault tolerance, which bears on the threshold, but does not state the threshold condition as such. The declared locator names numerical threshold estimates in sections that were not read.',
    remediation: 'Read the threshold sections named in the locator before confirming.',
  },
  'fault-tolerant-industrial-advantage': {
    domainSlug: 'quantum-systems',
    sourceContractId: null,
    verdict: 'insufficient-evidence',
    metadataVerified: false,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'no-declared-source',
    rightsBasis: 'not-applicable-no-source',
    reason:
      'This is a hypothesis-kind record that declares no source and carries no claim. There is nothing to align and nothing to support, so it can never be alignment-clear. That is the correct state for a placeholder, not a defect to repair.',
    remediation: 'Leave unsourced while it remains a hypothesis placeholder, or bind evidence if it is ever asserted.',
  },
  'general-clinical-readiness-prime-editing': {
    domainSlug: 'synthetic-biology',
    sourceContractId: null,
    verdict: 'insufficient-evidence',
    metadataVerified: false,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'no-declared-source',
    rightsBasis: 'not-applicable-no-source',
    reason:
      'This is a hypothesis-kind record that declares no source and carries no claim. There is nothing to align and nothing to support, so it can never be alignment-clear. That is the correct state for a placeholder, not a defect to repair.',
    remediation: 'Leave unsourced while it remains a hypothesis placeholder, or bind evidence if it is ever asserted.',
  },
  'genetic-toggle-switch': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-gardner-toggle-2000',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Construction of a genetic toggle switch in Escherichia coli\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'genome-editor-delivery-systems': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-gillmore-in-vivo-2021',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'CRISPR-Cas9 In Vivo Gene Editing for Transthyretin Amyloidosis\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'guide-rna-and-pam-recognition': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-jinek-cas9-2012',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'A Programmable Dual-RNA–Guided DNA Endonuclease in Adaptive Bacterial \', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'guide-seq-off-target-detection': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-tsai-guide-seq-2015',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'GUIDE-seq enables genome-wide profiling of off-target cleavage by CRIS\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'hardware-benchmark-scope': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-cross-quantum-volume-2019',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Validating quantum computers using randomized model circuits\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'in-vitro-versus-in-vivo-evidence': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-gillmore-in-vivo-2021',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'CRISPR-Cas9 In Vivo Gene Editing for Transthyretin Amyloidosis\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'in-vivo-genome-editing-workflow': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-gillmore-in-vivo-2021',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'CRISPR-Cas9 In Vivo Gene Editing for Transthyretin Amyloidosis\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'interleaved-randomized-benchmarking': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-magesan-interleaved-rb-2012',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Efficient Measurement of Quantum Gate Error by Interleaved Randomized \', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'josephson-junction-nonlinearity': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-blais-circuit-qed-2004',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:cond-mat/0402216 abstract',
    artifactVersion: 'preprint',
    versionRelationship: 'preprint-of-the-declared-version-of-record',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'The abstract concerns the cavity-QED architecture and does not treat the Josephson junction nonlinearity as such. Only the abstract was read and the declared locator names sections that were not, so nonalignment is not established either.',
    remediation: 'Read the circuit-Hamiltonian sections, or bind a source that treats junction nonlinearity directly.',
  },
  'linear-optical-quantum-computation': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-klm-linear-optics-2001',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'A scheme for efficient quantum computation with linear optics\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'logical-error-suppression': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-google-logical-error-2023',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Suppressing quantum errors by scaling a surface code logical qubit\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'neutral-atom-optical-tweezer-arrays': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-bluvstein-neutral-atom-2023',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Logical quantum processor based on reconfigurable atom arrays\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'off-target-nomination-versus-confirmation': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-lazzarotto-change-seq-2020',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'CHANGE-seq reveals genetic and epigenetic effects on CRISPR–Cas9 genom\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'physical-and-logical-qubits': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-shor-qec-1995',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Scheme for reducing decoherence in quantum computer memory\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'pooled-crispr-screening': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-shalem-crispr-screen-2014',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Genome-Scale CRISPR-Cas9 Knockout Screening in Human Cells\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'prime-editing': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-anzalone-prime-editing-2019',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Search-and-replace genome editing without double-strand breaks or dono\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'prime-editing-guide-rna-mechanism': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-anzalone-prime-2019-graph',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Search-and-replace genome editing without double-strand breaks or dono\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'quantum-error-correction': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-shor-qec-1995',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Scheme for reducing decoherence in quantum computer memory\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'quantum-error-mitigation': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-temme-error-mitigation-2017',
    verdict: 'supported',
    metadataVerified: true,
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:1612.02058 abstract',
    artifactVersion: 'preprint',
    versionRelationship: 'preprint-of-the-declared-version-of-record',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'The abstract presents two mitigation schemes: extrapolation to the zero-noise limit using Richardson deferred approach, and cancellation by resampling randomized circuits under a quasi-probability distribution. That is the record subject.',
    remediation: 'None. The mapping is curated and confirmed.',
  },
  'quantum-volume-benchmark': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-cross-quantum-volume-2019',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Validating quantum computers using randomized model circuits\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'random-circuit-sampling': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-arute-random-circuits-2019',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Quantum supremacy using a programmable superconducting processor\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'randomized-benchmarking': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-magesan-rb-2011',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Scalable and Robust Randomized Benchmarking of Quantum Processes\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'repressilator-gene-oscillator': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-elowitz-repressilator-2000',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'A synthetic oscillatory network of transcriptional regulators\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'rydberg-blockade-entangling-gates': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-evered-rydberg-gates-2023',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'High-fidelity parallel entangling gates on a neutral-atom quantum comp\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'silicon-spin-qubits': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-loss-divincenzo-spin-1998',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Quantum computation with quantum dots\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'single-cell-perturbation-readout': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-dixit-perturb-seq-2016',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Perturb-Seq: Dissecting Molecular Circuits with Scalable Single-Cell R\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'somatic-versus-germline-editing': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-liang-embryo-editing-2015',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'CRISPR/Cas9-mediated gene editing in human tripronuclear zygotes\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'stabilizer-syndrome-measurement': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-fowler-surface-code-2012',
    verdict: 'supported',
    metadataVerified: true,
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:1208.0928 abstract',
    artifactVersion: 'preprint',
    versionRelationship: 'preprint-of-the-declared-version-of-record',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'The abstract introduces the concept of the stabilizer using two qubits and extends it to stabilizers acting on a two-dimensional array of physical qubits, which is the repeated parity measurement this record bounds.',
    remediation: 'None. The mapping is curated and confirmed.',
  },
  'surface-code-error-correction': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-fowler-surface-code-2012',
    verdict: 'supported',
    metadataVerified: true,
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:1208.0928 abstract',
    artifactVersion: 'preprint',
    versionRelationship: 'preprint-of-the-declared-version-of-record',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'The abstract introduces the surface code implemented on a two-dimensional array of physical qubits and describes logical qubit formation, braiding and the gate set, which is the record subject.',
    remediation: 'None. The mapping is curated and confirmed.',
  },
  'targeted-amplicon-sequencing': {
    domainSlug: 'synthetic-biology',
    sourceContractId: 'source-tsai-guide-seq-2015',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'GUIDE-seq enables genome-wide profiling of off-target cleavage by CRIS\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
  'transmon-qubit': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-koch-transmon-2007',
    verdict: 'supported',
    metadataVerified: true,
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:cond-mat/0703002 abstract',
    artifactVersion: 'preprint',
    versionRelationship: 'preprint-of-the-declared-version-of-record',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'The abstract defines the transmon as operating at a significantly increased Josephson-to-charging energy ratio, predicts a drastic reduction in sensitivity to charge noise relative to the Cooper pair box, and states that charge dispersion decreases exponentially with EJ/EC while anharmonicity falls only as a weak power law. That is the record subject.',
    remediation: 'None. The mapping is curated and confirmed.',
  },
  'trapped-ion-qccd-architecture': {
    domainSlug: 'quantum-systems',
    sourceContractId: 'source-pino-qccd-2021',
    verdict: 'insufficient-evidence',
    metadataVerified: true,
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    versionRelationship: 'declared-version-of-record-not-retrieved',
    rightsBasis: 'citation-with-paraphrase',
    reason:
      'Crossref resolves the declared identifier to \'Demonstration of the trapped-ion quantum CCD computer architecture\', so the work exists and its metadata matches. The content was not read in this sprint, and registry resolution says nothing about whether the source supports this record subject.',
    remediation: 'Inspect the declared source against this record subject, then confirm or replace the mapping.',
  },
}

export interface PilotAlignmentEntry extends PilotJudgement {
  recordId: string
  slug: string
  recordRevisionSha256: string
  evidence: {
    metadataVerified: boolean
    sourceContentInspected: boolean
    inspectedContentLocation: string | null
    subjectAligned: AlignmentVerdict
    independentlyReproduced: false
    externallyReviewed: false
  }
}

export const PILOT_ALIGNMENT_AUDIT: readonly PilotAlignmentEntry[] = EPISTEMIC_RECORDS
  .filter((record) => (PILOT_DOMAINS as readonly string[]).includes(record.domainSlug))
  .map((record) => {
    const judgement = PILOT_JUDGEMENTS[record.slug]
    if (!judgement) throw new Error(`${record.slug} is a pilot record with no alignment judgement.`)
    return {
      ...judgement,
      recordId: record.id,
      slug: record.slug,
      recordRevisionSha256: epistemicReviewTargetHash(record),
      evidence: {
        metadataVerified: judgement.metadataVerified,
        sourceContentInspected: judgement.sourceContentInspected,
        inspectedContentLocation: judgement.inspectedContentLocation,
        subjectAligned: judgement.verdict,
        independentlyReproduced: false as const,
        externallyReviewed: false as const,
      },
    }
  })
  .sort((left, right) => left.recordId.localeCompare(right.recordId))

/* ------------------------------------------------------------- guards ----- */

{
  if (PILOT_ALIGNMENT_AUDIT.length !== 50) {
    throw new Error(`The pilot audit must cover exactly 50 records; found ${PILOT_ALIGNMENT_AUDIT.length}.`)
  }
  const ids = PILOT_ALIGNMENT_AUDIT.map((entry) => entry.recordId)
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate record in the pilot alignment audit.')

  const known = new Set(PILOT_ALIGNMENT_AUDIT.map((entry) => entry.slug))
  for (const slug of Object.keys(PILOT_JUDGEMENTS)) {
    if (!known.has(slug)) throw new Error(`${slug} is judged but is not a pilot record.`)
  }
  for (const domain of PILOT_DOMAINS) {
    const count = PILOT_ALIGNMENT_AUDIT.filter((entry) => entry.domainSlug === domain).length
    if (count !== 25) throw new Error(`${domain} must contribute 25 pilot records; found ${count}.`)
  }
  for (const entry of PILOT_ALIGNMENT_AUDIT) {
    if (!(ALIGNMENT_VERDICTS as readonly string[]).includes(entry.verdict)) {
      throw new Error(`${entry.slug} declares an undeclared verdict: ${entry.verdict}.`)
    }
    if (entry.sourceContentInspected && !entry.inspectedContentLocation) {
      throw new Error(`${entry.slug} was inspected but records no exact location.`)
    }
    if (!entry.sourceContentInspected && entry.inspectedContentLocation) {
      throw new Error(`${entry.slug} records an inspected location without inspection.`)
    }
    // Metadata resolution can never assert subject support, and a source that
    // was never opened can never be mismatched either: both need reading.
    if (!entry.sourceContentInspected && (entry.verdict === 'supported' || entry.verdict === 'mismatched')) {
      throw new Error(`${entry.slug} declares ${entry.verdict} without content inspection.`)
    }
    if (entry.sourceContentInspected && entry.artifactVersion === 'not-inspected') {
      throw new Error(`${entry.slug} claims inspection but records no artifact version.`)
    }
    if (entry.evidence.externallyReviewed !== false || entry.evidence.independentlyReproduced !== false) {
      throw new Error(`${entry.slug} claims external review or reproduction.`)
    }
  }
}

/* ------------------------------------------------------------- lookup ----- */

export function pilotAlignmentFor(recordId: string): PilotAlignmentEntry | null {
  return PILOT_ALIGNMENT_AUDIT.find((entry) => entry.recordId === recordId) ?? null
}

/** Reasons a pilot record may not back a substantial page or bridge endpoint. */
export function pilotAlignmentBlockers(recordId: string): readonly string[] {
  const entry = pilotAlignmentFor(recordId)
  if (!entry) return ['alignment-audit-missing']
  const blockers: string[] = []
  switch (entry.verdict) {
    case 'mismatched': blockers.push('source-subject-mismatched'); break
    case 'inaccessible-source': blockers.push('source-inaccessible'); break
    case 'partially-supported': blockers.push('source-subject-partially-supported'); break
    case 'insufficient-evidence': blockers.push('source-alignment-insufficient-evidence'); break
    default: break
  }
  if (!entry.sourceContentInspected) blockers.push('source-not-inspected')
  if (!entry.metadataVerified) blockers.push('source-metadata-unverified')
  if (!entry.sourceContractId) blockers.push('source-not-declared')
  return [...new Set(blockers)].sort()
}

export function isPilotAlignmentClear(recordId: string): boolean {
  return pilotAlignmentBlockers(recordId).length === 0
}

export function pilotVerdictTotals(): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const verdict of ALIGNMENT_VERDICTS) totals[verdict] = 0
  for (const entry of PILOT_ALIGNMENT_AUDIT) totals[entry.verdict] += 1
  return totals
}

export function pilotAuditDigest(): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(PILOT_ALIGNMENT_AUDIT)).digest('hex')}`
}
