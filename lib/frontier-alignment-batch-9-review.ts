import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import { ALIGNMENT_BATCH_9_REMEDIATION_PACKETS } from './frontier-alignment-batch-9.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from './frontier-domain-graphs.ts'
import { epistemicReviewTargetHash } from './epistemic-publication.ts'
import { alignmentFor } from './frontier-source-alignment.ts'

export const ALIGNMENT_BATCH_9_REVIEW_VERSION = 'maha-frontier-alignment-batch/9.1' as const
export const ALIGNMENT_BATCH_9_CANARY_VERSION = 'maha-frontier-source-override-canary/0.1' as const

export const BATCH_9_REVIEW_DECISIONS = ['accept', 'revise', 'reject'] as const
export type Batch9ReviewDecisionKind = (typeof BATCH_9_REVIEW_DECISIONS)[number]

export const BATCH_9_VERSION_RELATIONSHIPS = [
  'exact-version-of-record',
  'verified-related-prepublication-manuscript',
  'verified-repository-copy-of-record',
  'exact-authoritative-artifact',
] as const
export type Batch9VersionRelationship = (typeof BATCH_9_VERSION_RELATIONSHIPS)[number]

export type Batch9ClaimScopeFinding = 'supports-exact-bounded-claim' | 'record-revision-required' | 'does-not-support-claim'

interface Batch9DecisionInput {
  decision: Batch9ReviewDecisionKind
  versionRelationship: Batch9VersionRelationship
  sourceIdentityFinding: string
  versionRelationshipFinding: string
  rightsFinding: string
  locatorFinding: string
  claimScopeFinding: Batch9ClaimScopeFinding
  rationale: string
  requiredAction: string
}

export interface Batch9ReviewDecision {
  schemaVersion: typeof ALIGNMENT_BATCH_9_REVIEW_VERSION
  decisionId: string
  packetId: string
  packetContentSha256: string
  recordId: string
  activeRecordRevisionSha256: string
  activeSourceContractId: string
  proposedSourceContractId: string
  proposedSourceIdentifier: string
  decision: Batch9ReviewDecisionKind
  review: {
    reviewerId: 'maha-internal-editorial:batch-9-second-pass'
    reviewerKind: 'internal-editorial'
    reviewPass: 'separate-second-pass'
    reviewedAt: '2026-08-30'
    externallyReviewed: false
    independentlyReproduced: false
  }
  checks: {
    sourceIdentity: 'verified'
    sourceIdentityFinding: string
    versionRelationship: Batch9VersionRelationship
    versionRelationshipFinding: string
    rightsBasis: 'citation-with-paraphrase-only'
    rightsFinding: string
    contentInspected: true
    exactLocatorInspected: true
    locatorFinding: string
    claimScope: Batch9ClaimScopeFinding
  }
  rationale: string
  requiredAction: string
  canonicalMutationAuthorized: false
  publicProjectionAuthorized: false
  releaseAuthorized: false
  decisionSha256: string
}

export interface Batch9PrivateOverrideCandidate {
  schemaVersion: typeof ALIGNMENT_BATCH_9_CANARY_VERSION
  candidateId: string
  recordId: string
  priorRecordRevisionSha256: string
  priorSourceContractId: string
  proposedSourceContractId: string
  proposedSourceIdentifier: string
  proposedCitation: string
  proposedUrl: string
  exactLocator: string
  boundedFinding: string
  limitation: string
  claimIds: readonly string[]
  reviewDecisionId: string
  reviewDecisionSha256: string
  packetContentSha256: string
  applicationState: 'private-candidate-only'
  canonicalMutationAuthorized: false
  publicProjectionAuthorized: false
  releaseAuthorized: false
  candidateRevisionSha256: string
  provenanceSha256: string
}

function sha256(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

const DECISION_INPUTS: Readonly<Record<string, Batch9DecisionInput>> = {
  'urn:maha:record:agentic-systems-mcp-prompt-injection-through-tools': {
    decision: 'accept',
    versionRelationship: 'verified-related-prepublication-manuscript',
    sourceIdentityFinding: 'The arXiv record identifies the submitted title, six authors, and version 2 as arXiv:2302.12173.',
    versionRelationshipFinding: 'The reviewed artifact is the versioned arXiv preprint; no claim is made that it is the publisher version.',
    rightsFinding: 'Only citation metadata and original paraphrase are retained; no paper text, figure, or table is committed.',
    locatorFinding: 'The abstract explicitly describes retrieved-data prompt injection changing application functionality and API calls.',
    claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The source supports the bounded attack class when “through tools” is limited to retrieved instructions influencing application functions or API calls.',
    requiredAction: 'Adopt the replacement only with the packet limitation that this is not an MCP-specific exploit result or universal exploitability claim.',
  },
  'urn:maha:record:agentic-systems-mcp-human-approval-boundaries': {
    decision: 'accept',
    versionRelationship: 'exact-authoritative-artifact',
    sourceIdentityFinding: 'The official MCP site serves the dated 2024-11-05 Tools specification at the inspected URL.',
    versionRelationshipFinding: 'The record cites the exact dated specification page that was inspected, rather than a later protocol version.',
    rightsFinding: 'The candidate retains a citation and paraphrase of the normative boundary without reproducing specification content.',
    locatorFinding: 'User Interaction Model and Security Considerations explicitly discuss human denial, confirmation, access control, and timeouts.',
    claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The dated specification directly supports treating human approval boundaries as a distinct protocol concept.',
    requiredAction: 'Preserve the distinction between SHOULD guidance and protocol-enforced behavior.',
  },
  'urn:maha:record:fusion-plasma-systems-rebco-high-field-magnets': {
    decision: 'accept',
    versionRelationship: 'verified-related-prepublication-manuscript',
    sourceIdentityFinding: 'The DOI metadata and MIT PSFC JA record identify the same Whyte et al. article and journal citation.',
    versionRelationshipFinding: 'MIT describes JA artifacts as prepublication manuscripts; the inspected PSFC/JA-16-17 artifact is therefore not presented as the version of record.',
    rightsFinding: 'The candidate stores citation metadata and bounded paraphrase only.',
    locatorFinding: 'The inspected full manuscript names REBCO tape, high-field magnets, cryogenic cooling, joints, and coil fabrication in the declared sections.',
    claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The source directly supports REBCO high-field magnets as a bounded fusion engineering mechanism.',
    requiredAction: 'Keep commercial-plant performance, readiness, and the remaining Q-BR blockers outside this revision.',
  },
  'urn:maha:record:advanced-materials-direct-gap-mos2': {
    decision: 'accept',
    versionRelationship: 'verified-related-prepublication-manuscript',
    sourceIdentityFinding: 'arXiv:1004.0546 identifies the five authors, title, and related PRL DOI 10.1103/PhysRevLett.105.136805.',
    versionRelationshipFinding: 'The inspected artifact is the preprint linked by arXiv to the published article and is labeled as such.',
    rightsFinding: 'No source passage or figure is reproduced.',
    locatorFinding: 'The abstract reports optical spectroscopy across layer counts and the monolayer crossover to a direct gap.',
    claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The source directly supports the bounded layer-dependent measurement named by the record.',
    requiredAction: 'Retain the material, layer-count, and measurement-method limits.',
  },
  'urn:maha:record:advanced-materials-two-dimensional-magnetism': {
    decision: 'accept',
    versionRelationship: 'verified-related-prepublication-manuscript',
    sourceIdentityFinding: 'arXiv:1703.05892 identifies the authors, title, version 2, and related Nature DOI 10.1038/nature22391.',
    versionRelationshipFinding: 'The inspected artifact is the linked preprint and is not represented as the publisher PDF.',
    rightsFinding: 'The candidate uses citation and original paraphrase only.',
    locatorFinding: 'The abstract reports MOKE evidence for monolayer CrI3 ferromagnetism and layer-dependent behavior.',
    claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The source supports a bounded 2D-magnetism concept for CrI3 under the reported temperature and layer conditions.',
    requiredAction: 'Do not generalize to room-temperature magnetism or other materials.',
  },
  'urn:maha:record:advanced-materials-graphene-hbn-heterostructures': {
    decision: 'accept',
    versionRelationship: 'verified-related-prepublication-manuscript',
    sourceIdentityFinding: 'arXiv:1005.4917 identifies the eleven authors, journal reference, and related DOI 10.1038/nnano.2010.172.',
    versionRelationshipFinding: 'The inspected artifact is the linked preprint of the cited article.',
    rightsFinding: 'Only citation and paraphrase are retained.',
    locatorFinding: 'The abstract reports mechanical transfer of graphene onto hBN and controlled assembly of layered heterostructures.',
    claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The source directly supports the bounded graphene-on-hBN fabrication method.',
    requiredAction: 'Do not widen the record to arbitrary encapsulated, twisted, or moire structures.',
  },
  'urn:maha:record:agentic-systems-mcp-multi-agent-role-assignment': {
    decision: 'reject',
    versionRelationship: 'verified-related-prepublication-manuscript',
    sourceIdentityFinding: 'arXiv:2303.17760 identifies the CAMEL title, five authors, version 2, and NeurIPS 2023 acceptance.',
    versionRelationshipFinding: 'The reviewed artifact is the versioned arXiv preprint.',
    rightsFinding: 'The packet stores citation and paraphrase only.',
    locatorFinding: 'The abstract describes role-playing and inception prompting but does not establish a general role-assignment mechanism.',
    claimScopeFinding: 'does-not-support-claim',
    rationale: 'Prompt-defined role-playing is not equivalent to selecting or assigning roles from capabilities, constraints, or a role-allocation policy.',
    requiredAction: 'Reject this replacement. Either rename the record to prompted role-playing or locate a source that directly studies role assignment.',
  },
  'urn:maha:record:biomolecular-engineering-droplet-microfluidic-screening': {
    decision: 'revise',
    versionRelationship: 'exact-version-of-record',
    sourceIdentityFinding: 'PMC2840095 identifies the PNAS article, authors, pages, DOI 10.1073/pnas.0910781107, and correction history.',
    versionRelationshipFinding: 'The inspected PMC article is the published PNAS record rather than an unidentified manuscript.',
    rightsFinding: 'No article passage, figure, or table is copied into the candidate.',
    locatorFinding: 'The inspected sections establish the droplet platform, sorting workflow, and reported directed-evolution screen.',
    claimScopeFinding: 'record-revision-required',
    rationale: 'The source primarily supports a screening method and platform; the generated record currently calls it a comparison.',
    requiredAction: 'Revise recordKind and claim language from comparison to method before adopting the source.',
  },
  'urn:maha:record:biomolecular-engineering-synthetic-riboswitches': {
    decision: 'accept',
    versionRelationship: 'exact-version-of-record',
    sourceIdentityFinding: 'PMC2988590 identifies the AEM article, authors, issue, pages, and DOI 10.1128/AEM.01537-10.',
    versionRelationshipFinding: 'The inspected PMC artifact is the published journal article.',
    rightsFinding: 'Only bounded paraphrase and citation metadata are retained.',
    locatorFinding: 'The inspected design, screening, and cross-species sections directly report five ligand-inducible switches tested across eight bacterial species.',
    claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The source directly supports synthetic riboswitches as a bounded engineering concept.',
    requiredAction: 'Preserve the tested ligand, host, switch, and reporter limits.',
  },
  'urn:maha:record:biomolecular-engineering-compartmentalized-cell-free-systems': {
    decision: 'revise',
    versionRelationship: 'exact-version-of-record',
    sourceIdentityFinding: 'PMC539773 identifies the PNAS article, two authors, pages, and DOI 10.1073/pnas.0408236101.',
    versionRelationshipFinding: 'The inspected PMC artifact is the published PNAS article.',
    rightsFinding: 'No source content is committed.',
    locatorFinding: 'The inspected sections establish encapsulated cell-free expression, nutrient exchange, and sustained expression in a vesicle bioreactor.',
    claimScopeFinding: 'record-revision-required',
    rationale: 'The source supports a compartmentalized cell-free system and measurements within it, while the generated record classifies the system itself as a measurement.',
    requiredAction: 'Revise recordKind to concept or method and keep the measured-expression result as a subordinate claim.',
  },
  'urn:maha:record:critical-supply-chains-magnet-recycling': {
    decision: 'accept',
    versionRelationship: 'verified-repository-copy-of-record',
    sourceIdentityFinding: 'The DOI, article front matter, title, seven authors, journal, volume, and pages agree for 10.1016/j.jclepro.2012.12.037.',
    versionRelationshipFinding: 'The inspected repository PDF carries the published Journal of Cleaner Production front matter and DOI.',
    rightsFinding: 'The candidate cites and paraphrases; it stores no article text, image, or table.',
    locatorFinding: 'Section 2 and pages 4-8 discuss permanent rare-earth magnets and direct, hydro-, pyro-, and gas-phase recovery routes.',
    claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The source supports magnet recycling as a bounded critical-supply-chain concept.',
    requiredAction: 'Retain the 2013 review date and do not infer current capacity, economics, or qualification.',
  },
  'urn:maha:record:critical-supply-chains-tantalum-concentrate-traceability': {
    decision: 'accept',
    versionRelationship: 'exact-authoritative-artifact',
    sourceIdentityFinding: 'The official OECD publication identifies the third edition and its tin, tantalum, and tungsten supplement.',
    versionRelationshipFinding: 'The inspected artifact is the exact OECD-hosted edition cited by the packet.',
    rightsFinding: 'Only citation and bounded paraphrase are retained.',
    locatorFinding: 'The five-step framework and tantalum supplement describe chain-of-custody or traceability information for upstream minerals.',
    claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The guidance directly supports traceability as a bounded due-diligence method for tantalum-bearing upstream material.',
    requiredAction: 'Do not represent the guidance as certifying a shipment, mine, smelter, or implementation.',
  },
  'urn:maha:record:fusion-plasma-systems-cable-in-conduit-conductors': {
    decision: 'accept',
    versionRelationship: 'exact-authoritative-artifact',
    sourceIdentityFinding: 'The official ITER Machine page identifies the current magnets system and its cable-in-conduit conductor architecture.',
    versionRelationshipFinding: 'The exact living page cited by the proposal was inspected; no frozen publication version is asserted.',
    rightsFinding: 'The candidate retains only citation metadata and paraphrase.',
    locatorFinding: 'The opening magnets section defines bundled superconducting strands mixed with copper and enclosed in a structural steel jacket.',
    claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The source directly supports cable-in-conduit conductors as a distinct fusion magnet concept.',
    requiredAction: 'Record the living-page status and avoid inferring a complete conductor specification or lifetime distribution.',
  },
  'urn:maha:record:fusion-plasma-systems-neutron-material-damage': {
    decision: 'revise',
    versionRelationship: 'verified-related-prepublication-manuscript',
    sourceIdentityFinding: 'arXiv:1311.5079 identifies the six authors, title, journal reference, and related DOI 10.1016/j.jnucmat.2013.03.085.',
    versionRelationshipFinding: 'The inspected artifact is the arXiv preprint linked to the journal article.',
    rightsFinding: 'Only citation and paraphrase are retained.',
    locatorFinding: 'The abstract explicitly describes neutron-transport and inventory calculations of dpa, transmutation, gas production, and lifetime estimates.',
    claimScopeFinding: 'record-revision-required',
    rationale: 'The current record calls the subject a measurement, but this source reports model-based calculations and estimates.',
    requiredAction: 'Revise recordKind and claim language to modelled calculation or estimate before adopting the source.',
  },
  'urn:maha:record:longevity-metabolism-ampk-energy-sensing': {
    decision: 'revise',
    versionRelationship: 'verified-related-prepublication-manuscript',
    sourceIdentityFinding: 'PMC5726489 identifies the accepted manuscript, authors, journal citation, and DOI 10.1038/nrm3311.',
    versionRelationshipFinding: 'The inspected artifact is explicitly an accepted manuscript of the cited review.',
    rightsFinding: 'Only citation and original paraphrase are retained.',
    locatorFinding: 'The inspected sections review adenine-nucleotide sensing, AMPK activation, and energy-homeostasis control.',
    claimScopeFinding: 'record-revision-required',
    rationale: 'The source is a secondary review supporting a mechanism or concept, while the generated record labels AMPK energy sensing as a measurement.',
    requiredAction: 'Revise recordKind and evidence maturity to reflect secondary synthesis before adopting the source.',
  },
  'urn:maha:record:longevity-metabolism-cd38-nad-consumption': {
    decision: 'accept',
    versionRelationship: 'verified-related-prepublication-manuscript',
    sourceIdentityFinding: 'PMC4911708 identifies the manuscript, authors, final Cell Metabolism citation, and DOI 10.1016/j.cmet.2016.05.006.',
    versionRelationshipFinding: 'The inspected artifact is the accepted manuscript corresponding to the cited article.',
    rightsFinding: 'No article text, figure, or table is reproduced.',
    locatorFinding: 'The summary and results report CD38 NADase activity, age-related NAD decline, knockout comparisons, and mitochondrial outcomes in mice.',
    claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The source directly supports CD38-mediated NAD consumption as a bounded mechanism in the reported mouse experiments.',
    requiredAction: 'Keep human therapeutic efficacy and universal ageing claims prohibited.',
  },
  'urn:maha:record:mechanistic-interpretability-automated-feature-interpretation': {
    decision: 'accept',
    versionRelationship: 'exact-authoritative-artifact',
    sourceIdentityFinding: 'The official OpenAI publication identifies the title, date, authors, method, dataset, and linked code.',
    versionRelationshipFinding: 'The exact technical publication cited by the packet was inspected.',
    rightsFinding: 'The candidate stores citation metadata and paraphrase only.',
    locatorFinding: 'The overview and method describe automated explanation generation, activation simulation, and scoring for GPT-2 neurons.',
    claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The source directly supports automated neuron interpretation as a bounded method.',
    requiredAction: 'Preserve the stated limitations: imperfect explanations, correlation rather than mechanism, and no complete model understanding.',
  },
  'urn:maha:record:mechanistic-interpretability-path-patching': {
    decision: 'revise',
    versionRelationship: 'verified-related-prepublication-manuscript',
    sourceIdentityFinding: 'arXiv:2304.05969 identifies the four authors, title, and version 2.',
    versionRelationshipFinding: 'The inspected artifact is the versioned arXiv preprint.',
    rightsFinding: 'Only citation and paraphrase are retained.',
    locatorFinding: 'The abstract introduces path patching as a technique for quantitatively testing localization hypotheses.',
    claimScopeFinding: 'record-revision-required',
    rationale: 'The source presents path patching as a method or technique; the generated record currently calls it a mechanism.',
    requiredAction: 'Revise recordKind to method before adopting the replacement.',
  },
  'urn:maha:record:mechanistic-interpretability-dead-features': {
    decision: 'accept',
    versionRelationship: 'exact-authoritative-artifact',
    sourceIdentityFinding: 'The Transformer Circuits publication identifies the report, authors, experiments, and linked feature browser.',
    versionRelationshipFinding: 'The exact technical report page cited by the proposal was inspected.',
    rightsFinding: 'No report passage, chart, or feature-browser content is reproduced.',
    locatorFinding: 'Global Analysis defines dead features relative to 100 million evaluation examples and reports the A/1 count.',
    claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The source directly supports dead features as a bounded sparse-autoencoder concept.',
    requiredAction: 'State that dead means inactive on the declared evaluation corpus, not impossible to activate on every input.',
  },
  'urn:maha:record:neurotechnology-bci-light-delivery-tissue-heating': {
    decision: 'accept',
    versionRelationship: 'verified-related-prepublication-manuscript',
    sourceIdentityFinding: 'PMC4512881 identifies the author manuscript, final Cell Reports citation, authors, and DOI 10.1016/j.celrep.2015.06.036.',
    versionRelationshipFinding: 'The inspected artifact is the accepted manuscript corresponding to the cited article.',
    rightsFinding: 'Only citation metadata and bounded paraphrase are retained.',
    locatorFinding: 'The summary, model, experimental validation, controls, and discussion directly address light-induced tissue heating.',
    claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The source directly supports light-delivery tissue heating as a bounded optogenetic safety measurement.',
    requiredAction: 'Keep wavelength, power, duty cycle, geometry, tissue, and duration explicit; do not infer one universal safe threshold.',
  },
}

function decisionWithoutDigest(recordId: string, input: Batch9DecisionInput): Omit<Batch9ReviewDecision, 'decisionSha256'> {
  const packet = ALIGNMENT_BATCH_9_REMEDIATION_PACKETS.find((entry) => entry.recordId === recordId)
  const active = alignmentFor(recordId)
  const record = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === recordId)
  if (!packet || !active || !record) throw new Error(`${recordId}: Batch 9 review target is missing.`)
  return {
    schemaVersion: ALIGNMENT_BATCH_9_REVIEW_VERSION,
    decisionId: `urn:maha:review:frontier-alignment-batch-9:${recordId.replace('urn:maha:record:', '')}`,
    packetId: packet.packetId,
    packetContentSha256: sha256(packet),
    recordId,
    activeRecordRevisionSha256: epistemicReviewTargetHash(record),
    activeSourceContractId: active.sourceContractId,
    proposedSourceContractId: packet.replacement.proposedSourceContractId,
    proposedSourceIdentifier: packet.replacement.identifier,
    decision: input.decision,
    review: {
      reviewerId: 'maha-internal-editorial:batch-9-second-pass',
      reviewerKind: 'internal-editorial',
      reviewPass: 'separate-second-pass',
      reviewedAt: '2026-08-30',
      externallyReviewed: false,
      independentlyReproduced: false,
    },
    checks: {
      sourceIdentity: 'verified',
      sourceIdentityFinding: input.sourceIdentityFinding,
      versionRelationship: input.versionRelationship,
      versionRelationshipFinding: input.versionRelationshipFinding,
      rightsBasis: 'citation-with-paraphrase-only',
      rightsFinding: input.rightsFinding,
      contentInspected: true,
      exactLocatorInspected: true,
      locatorFinding: input.locatorFinding,
      claimScope: input.claimScopeFinding,
    },
    rationale: input.rationale,
    requiredAction: input.requiredAction,
    canonicalMutationAuthorized: false,
    publicProjectionAuthorized: false,
    releaseAuthorized: false,
  }
}

export const ALIGNMENT_BATCH_9_REVIEW_DECISIONS: readonly Batch9ReviewDecision[] = Object.entries(DECISION_INPUTS)
  .map(([recordId, input]) => {
    const base = decisionWithoutDigest(recordId, input)
    return { ...base, decisionSha256: sha256(base) }
  })
  .sort((a, b) => a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0)

export const ALIGNMENT_BATCH_9_CANARY_RECORD_IDS = [
  'urn:maha:record:agentic-systems-mcp-human-approval-boundaries',
  'urn:maha:record:fusion-plasma-systems-rebco-high-field-magnets',
  'urn:maha:record:advanced-materials-direct-gap-mos2',
  'urn:maha:record:longevity-metabolism-cd38-nad-consumption',
  'urn:maha:record:neurotechnology-bci-light-delivery-tissue-heating',
] as const

export function compilePrivateBatch9OverrideCandidate(
  recordId: string,
  decisions: readonly Batch9ReviewDecision[] = ALIGNMENT_BATCH_9_REVIEW_DECISIONS,
): Batch9PrivateOverrideCandidate {
  const packet = ALIGNMENT_BATCH_9_REMEDIATION_PACKETS.find((entry) => entry.recordId === recordId)
  const active = alignmentFor(recordId)
  const record = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === recordId)
  const decision = decisions.find((entry) => entry.recordId === recordId)
  if (!packet || !active || !record) throw new Error(`${recordId}: source-override target is missing.`)
  if (!decision) throw new Error(`${recordId}: source-override-review-missing`)

  const { decisionSha256, ...withoutDigest } = decision
  if (sha256(withoutDigest) !== decisionSha256) throw new Error(`${recordId}: source-override-review-digest-invalid`)
  if (decision.packetContentSha256 !== sha256(packet)
    || decision.packetId !== packet.packetId
    || decision.proposedSourceContractId !== packet.replacement.proposedSourceContractId
    || decision.proposedSourceIdentifier !== packet.replacement.identifier) {
    throw new Error(`${recordId}: source-override-review-packet-mismatch`)
  }
  if (decision.activeRecordRevisionSha256 !== epistemicReviewTargetHash(record)
    || decision.activeSourceContractId !== active.sourceContractId
    || active.evidence.subjectAligned !== 'mismatched') {
    throw new Error(`${recordId}: source-override-review-stale`)
  }
  if (decision.decision === 'reject') throw new Error(`${recordId}: source-override-review-rejected`)
  if (decision.decision === 'revise') throw new Error(`${recordId}: source-override-record-revision-required`)
  if (decision.checks.claimScope !== 'supports-exact-bounded-claim'
    || !decision.checks.contentInspected
    || !decision.checks.exactLocatorInspected
    || decision.checks.sourceIdentity !== 'verified'
    || decision.canonicalMutationAuthorized
    || decision.publicProjectionAuthorized
    || decision.releaseAuthorized) {
    throw new Error(`${recordId}: source-override-review-not-eligible`)
  }

  const base = {
    schemaVersion: ALIGNMENT_BATCH_9_CANARY_VERSION,
    candidateId: `urn:maha:candidate:frontier-source-override:${record.slug}:batch-9`,
    recordId,
    priorRecordRevisionSha256: epistemicReviewTargetHash(record),
    priorSourceContractId: active.sourceContractId,
    proposedSourceContractId: packet.replacement.proposedSourceContractId,
    proposedSourceIdentifier: packet.replacement.identifier,
    proposedCitation: packet.replacement.citation,
    proposedUrl: packet.replacement.url,
    exactLocator: packet.replacement.inspection.inspectedContentLocation,
    boundedFinding: packet.replacement.inspection.findings,
    limitation: packet.replacement.inspection.limitation,
    claimIds: record.claims.map((claim) => claim.id),
    reviewDecisionId: decision.decisionId,
    reviewDecisionSha256: decision.decisionSha256,
    packetContentSha256: decision.packetContentSha256,
    applicationState: 'private-candidate-only' as const,
    canonicalMutationAuthorized: false as const,
    publicProjectionAuthorized: false as const,
    releaseAuthorized: false as const,
  }
  const candidateRevisionSha256 = sha256(base)
  return {
    ...base,
    candidateRevisionSha256,
    provenanceSha256: sha256({
      candidateRevisionSha256,
      packetContentSha256: decision.packetContentSha256,
      reviewDecisionSha256: decision.decisionSha256,
      priorRecordRevisionSha256: epistemicReviewTargetHash(record),
    }),
  }
}

export const ALIGNMENT_BATCH_9_PRIVATE_CANARY: readonly Batch9PrivateOverrideCandidate[] =
  ALIGNMENT_BATCH_9_CANARY_RECORD_IDS.map((recordId) => compilePrivateBatch9OverrideCandidate(recordId))

export const ALIGNMENT_BATCH_9_ACCEPTED_CANDIDATES: readonly Batch9PrivateOverrideCandidate[] =
  ALIGNMENT_BATCH_9_REVIEW_DECISIONS
    .filter((decision) => decision.decision === 'accept')
    .map((decision) => compilePrivateBatch9OverrideCandidate(decision.recordId))

function assertBatch9ReviewIntegrity(): void {
  if (ALIGNMENT_BATCH_9_REVIEW_DECISIONS.length !== 20
    || new Set(ALIGNMENT_BATCH_9_REVIEW_DECISIONS.map((entry) => entry.recordId)).size !== 20
    || new Set(ALIGNMENT_BATCH_9_REVIEW_DECISIONS.map((entry) => entry.decisionId)).size !== 20) {
    throw new Error('Batch 9 must contain twenty unique append-only review decisions.')
  }
  if (Object.keys(DECISION_INPUTS).length !== ALIGNMENT_BATCH_9_REMEDIATION_PACKETS.length) {
    throw new Error('Batch 9 review decisions and remediation packets diverged.')
  }
  for (const decision of ALIGNMENT_BATCH_9_REVIEW_DECISIONS) {
    const packet = ALIGNMENT_BATCH_9_REMEDIATION_PACKETS.find((entry) => entry.recordId === decision.recordId)
    const active = alignmentFor(decision.recordId)
    const record = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === decision.recordId)
    if (!packet || !active || !record) throw new Error(`${decision.recordId}: Batch 9 review input is missing.`)
    if (decision.packetContentSha256 !== sha256(packet)
      || decision.activeRecordRevisionSha256 !== epistemicReviewTargetHash(record)
      || decision.activeSourceContractId !== active.sourceContractId) {
      throw new Error(`${decision.recordId}: Batch 9 review is stale or unbound.`)
    }
    const { decisionSha256, ...withoutDigest } = decision
    if (decisionSha256 !== sha256(withoutDigest)) throw new Error(`${decision.recordId}: Batch 9 decision digest is invalid.`)
    if (decision.review.externallyReviewed || decision.review.independentlyReproduced
      || decision.canonicalMutationAuthorized || decision.publicProjectionAuthorized || decision.releaseAuthorized) {
      throw new Error(`${decision.recordId}: Batch 9 review crossed a governance boundary.`)
    }
    if (decision.decision === 'accept' && decision.checks.claimScope !== 'supports-exact-bounded-claim') {
      throw new Error(`${decision.recordId}: Batch 9 accepted a claim requiring revision.`)
    }
    if (decision.decision === 'reject' && decision.checks.claimScope !== 'does-not-support-claim') {
      throw new Error(`${decision.recordId}: Batch 9 rejected a source without a claim-scope finding.`)
    }
  }
  if (ALIGNMENT_BATCH_9_PRIVATE_CANARY.length !== 5
    || new Set(ALIGNMENT_BATCH_9_PRIVATE_CANARY.map((entry) => entry.recordId)).size !== 5
    || ALIGNMENT_BATCH_9_PRIVATE_CANARY.some((entry) => entry.applicationState !== 'private-candidate-only')) {
    throw new Error('Batch 9 private canary is invalid.')
  }
  const acceptedCount = ALIGNMENT_BATCH_9_REVIEW_DECISIONS.filter((entry) => entry.decision === 'accept').length
  if (ALIGNMENT_BATCH_9_ACCEPTED_CANDIDATES.length !== acceptedCount
    || ALIGNMENT_BATCH_9_ACCEPTED_CANDIDATES.some((entry) => entry.applicationState !== 'private-candidate-only')) {
    throw new Error('Batch 9 accepted candidate revisions are incomplete or crossed their private boundary.')
  }
}

assertBatch9ReviewIntegrity()
