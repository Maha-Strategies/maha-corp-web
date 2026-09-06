import {
  buildFederationTrancheReview,
  type FederationReviewPacket,
  type FederationReviewSource,
} from './federation-tranche-four-review.ts'

const reviewedOn = '2026-09-06'
const publicRights = 'Publicly accessible authority; link and bounded paraphrase only. No source text is redistributed.'
const governmentRights = 'Official government source; link and bounded paraphrase only. No full text is retained in the packet.'
const localRights = 'Maha-controlled repository source; symbol names, headings, and file identity only. No credential, customer value, runtime payload, or receipt body is retained.'
const authorRights = 'Maha-controlled authorial manuscript; bounded paraphrase and locator only. The packet does not redistribute the manuscript.'

const source = (
  sourceId: string,
  title: string,
  responsibleBody: string,
  versionOrDate: string,
  url: string,
  sourceClass: string,
  locator: string,
  scope: string,
  boundary: string,
  rightsBasis = publicRights,
  inspectionDepth = 'section',
): FederationReviewSource => ({ sourceId, title, responsibleBody, versionOrDate, url, sourceClass, rightsBasis, inspectionDepth, locator, scope, boundary })

const packet = (
  topicKey: string,
  reason: string,
  sources: FederationReviewSource[],
  disposition = 'evidence-ready',
  implementationCondition?: string,
): FederationReviewPacket => ({
  topicKey,
  disposition,
  reason,
  sourceIdentityChecked: true,
  locatorChecked: true,
  rightsChecked: true,
  scopeChecked: true,
  boundaryChecked: true,
  ...(implementationCondition ? { implementationCondition } : {}),
  sources,
})

export const TRANCHE_FIVE_NEW_PACKETS: Record<string, FederationReviewPacket> = {
  'agentic-publishing:licensed-delivery': packet('agentic-publishing:licensed-delivery', 'The public contract and receipt schema support a bounded account of entitlement-gated delivery, exact released evidence, replay identity, receipt binding, and acknowledgement without claiming that a commercial delivery occurred.', [
    source('local-mcp-evidence-public-contract', 'Maha licensed-evidence public contract', 'Maha Strategies', `repository source inspected ${reviewedOn}`, 'repo:lib/mcp-evidence-public-contract.ts', 'local-public-contract', 'MCP_EVIDENCE_TOOL; MCP_EVIDENCE_LICENSE_TERMS; availabilityBoundary and redistributionBoundary', 'A license grants authenticated machine-format access to an exact active canonical release through one declared read-only tool, subject to plan quota and evidence boundaries.', 'Entitlement does not improve evidence quality, convey third-party redistribution rights, prove availability, or establish that a customer received anything.', localRights, 'code-symbol'),
    source('local-substantial-delivery-receipt', 'Substantial-page MCP delivery receipt', 'Maha Strategies', `repository source inspected ${reviewedOn}`, 'repo:lib/substantial-mcp-delivery-receipt.ts', 'local-implementation', 'delivery-reference identity, receipt digest, acknowledgement identity and verifier', 'A deterministic delivery reference can bind execution, exact release and page revision, source coverage, delivery, and acknowledgement.', 'The local schema does not prove a remote delivery, payment, customer acceptance, or production operation.', localRights, 'code-symbol'),
  ]),
  'maha-os:biometric-data-boundary': packet('maha-os:biometric-data-boundary', 'EU law supplies a precise legal definition and processing boundary that can constrain a private-system operator guide without pretending to create a universal biometric policy.', [
    source('gdpr-biometric-boundary', 'Regulation (EU) 2016/679 (General Data Protection Regulation)', 'European Parliament and Council', 'OJ L 119, 4 May 2016', 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679', 'law', 'Articles 4(14), 9 and 22; Recital 51', 'Biometric data are defined by specific technical processing used to allow or confirm unique identification; special-category and automated-decision rules impose additional conditions.', 'Applicability, lawful basis, exceptions, member-state law, system purpose, and individual facts require qualified legal analysis; not every image or sensor value is biometric data in this legal sense.', governmentRights),
  ]),
  'maha-policy:algorithmic-impact-assessment': packet('maha-policy:algorithmic-impact-assessment', 'The Government of Canada provides a concrete impact-assessment mechanism and an unusually clear scope test; it is useful as one jurisdiction-specific model, not a universal compliance template.', [
    source('canada-aia', 'Algorithmic Impact Assessment tool', 'Treasury Board of Canada Secretariat', `living official tool inspected ${reviewedOn}`, 'https://www.canada.ca/en/government/system/digital-government/digital-government-innovations/responsible-use-ai/algorithmic-impact-assessment.html', 'government-policy-tool', 'Introduction; Using and scoring the assessment; impact levels; publication instructions', 'The questionnaire evaluates system, algorithm, decision, impact, and data factors to determine an impact level and associated mitigations under the Directive on Automated Decision-Making.', 'The tool is mandatory only within its Canadian federal policy scope and does not establish universal risk, legal compliance, or correctness of an operator’s answers.', governmentRights),
    source('canada-aia-scope', 'Guide on the Scope of the Directive on Automated Decision-Making', 'Treasury Board of Canada Secretariat', `living official guidance inspected ${reviewedOn}`, 'https://www.canada.ca/en/government/system/digital-government/digital-government-innovations/responsible-use-ai/guide-scope-directive-automated-decision-making.html', 'government-policy-guidance', 'Five key elements of scope; administrative decision; replaces or assists judgment; production environment', 'The Directive applies to scoped Canadian federal automated systems that make or assist administrative decisions and meet all stated scope elements.', 'Many AI and government uses fall outside the Directive; voluntary reuse does not turn the tool into binding law elsewhere.', governmentRights),
  ]),
  'maha-research:equation-locator': packet('maha-research:equation-locator', 'JATS provides a standard structural equation container, stable identifiers, labels, and multiple representations; a locator still has to identify the exact expression and surrounding assumptions.', [
    source('jats-disp-formula-1-4', 'JATS Archiving and Interchange Tag Library: Formula, Display', 'NISO and U.S. National Library of Medicine', 'ANSI/NISO Z39.96-2024, JATS 1.4', 'https://jats.nlm.nih.gov/archiving/tag-library/1.4/element/disp-formula.html', 'markup-standard', 'Element <disp-formula>; Usage/Remarks; Base Attribute id; child label and alternatives', 'A displayed expression can carry an id and label and can encode mathematics as characters, MathML, TeX/LaTeX, or graphics.', 'Structural identification does not prove derivation, variable definitions, assumptions, equivalence among renderings, claim support, or reproduction rights.'),
  ]),
  'maha-research:metadata-only-evidence': packet('maha-research:metadata-only-evidence', 'Crossref explicitly distinguishes an openly distributed metadata record from the hosted content; successful registration or resolution can support identity and relations, not passage-level explanation.', [
    source('crossref-content-registration-metadata', 'Content Registration', 'Crossref', `living documentation inspected ${reviewedOn}`, 'https://www.crossref.org/services/content-registration/', 'metadata-service-documentation', 'What content registration stores; persistent identifier and hosted-content link; research-object relationships', 'Crossref stores and distributes metadata records and persistent links to content hosted elsewhere, including typed relationships among research objects.', 'A registered DOI or metadata record does not mean the content was inspected, is accessible, is the intended version, supports a claim, or carries reuse rights.'),
    source('crossref-metadata-minimum', 'Metadata best practices', 'Crossref', `living documentation inspected ${reviewedOn}`, 'https://www.crossref.org/documentation/principles-practices/best-practices/', 'metadata-service-documentation', 'Opening statement on minimum registration requirements and optional metadata', 'Minimal metadata can register an object while optional fields improve discovery and connection to the scholarly record.', 'Registration success is not a completeness or quality assessment and cannot be upgraded into explanatory evidence.'),
  ]),
  'maha-research:random-seed': packet('maha-research:random-seed', 'NumPy documents both seed-based deterministic streams and the strict environment conditions needed for stream compatibility; the local witness records seeds as provenance rather than a correctness claim.', [
    source('numpy-random-compatibility', 'Compatibility policy — Random sampling', 'NumPy project', `version 2.0 policy inspected ${reviewedOn}`, 'https://numpy.org/doc/2.0/reference/random/compatibility.html', 'software-documentation', 'Stream-compatibility conditions; Generator and BitGenerator guarantees; environmental caveats', 'The same BitGenerator, seed, call sequence, arguments, build, environment, and machine should produce the same stream under the documented policy.', 'A seed alone is insufficient across changed algorithms, versions, builds, machines, call ordering, or numerical dependencies; reproducibility does not prove scientific correctness.'),
    source('local-witness-random-seed', 'Maha computational provenance witness', 'Maha Strategies', `repository source inspected ${reviewedOn}`, 'repo:packages/maha-witness/README.md', 'local-implementation-documentation', 'Receipt contents: environment and seed metadata; current limits', 'Witness receipts can record declared random seeds alongside environment and adapter metadata.', 'Recording a seed does not show that every nondeterministic input was controlled, that the run can be reproduced elsewhere, or that its result is valid.', localRights, 'named-section'),
  ]),
  'maha-research:repository-copy': packet('maha-research:repository-copy', 'Crossref’s explicit work relationships and version vocabulary support treating a repository copy as a separately identified version whose relationship to the version of record must be checked.', [
    source('crossref-version-control', 'Version control, corrections, and retractions', 'Crossref', `living documentation inspected ${reviewedOn}`, 'https://www.crossref.org/documentation/principles-practices/best-practices/versioning/', 'metadata-service-documentation', 'Version vocabulary; preprint, author accepted manuscript, version of record, and updated version; DOI relationship guidance', 'Drafts, preprints, accepted manuscripts, versions of record, and updates are different version roles, and significant relationships should be declared.', 'A repository location does not prove which version is present, that it is identical to the version of record, or that its license permits redistribution.'),
    source('crossref-relationships', 'Relationships', 'Crossref', `living documentation inspected ${reviewedOn}`, 'https://www.crossref.org/documentation/schema-library/markup-guide-metadata-segments/relationships/', 'metadata-schema-documentation', 'Intra-work relation types: manuscript, preprint, replacement, translation, variant, and version', 'Typed reciprocal relationships can distinguish manuscripts, preprints, versions, replacements, translations, and variants.', 'A declared metadata relationship is an assertion and must be checked against source identity and content before one copy substitutes for another.'),
  ]),
  'maha-strategies:governed-autonomy': packet('maha-strategies:governed-autonomy', 'This is a Maha-defined synthesis: autonomy is bounded by named authority, evidence, approval, capability, execution, receipt, and refusal states rather than equated with unrestricted action.', [
    source('maha-principle-governed-autonomy', 'The Maha Principle', 'Mayone Maharajan', 'working authorial manuscript inspected 2026-09-06', 'repo:content/books/the-maha-principle/The-Maha-Principle.md', 'authorial-primary-source', 'The Network and the Feed; Chapter 6 humane governance; Chapter 7 verification framework; Whole-Food Information', 'The manuscript develops humane governance, directed use of information infrastructure, source verification, and resilient decision systems.', 'This is authorial doctrine, not a settled philosophical term, empirical validation, or consensus.', authorRights, 'book-section'),
    source('local-governed-approval', 'Governed workflow approval store', 'Maha Strategies', `repository source inspected ${reviewedOn}`, 'repo:lib/workflows/approvals.ts', 'local-implementation', 'approvalIdFor; decide; consume', 'One local mechanism binds an approval identity to action and policy digests and consumes the decision once.', 'Code shape does not prove meaningful human review, deployed enforcement, safe autonomy, or external validation.', localRights, 'code-symbol'),
  ]),
  'maha-strategies:maha-principle': packet('maha-strategies:maha-principle', 'The page family is explicitly an authorial-concept surface: it may define, apply, and criticize the manuscript’s own framework but may not present that framework as consensus or measured fact.', [
    source('maha-principle-primary', 'The Maha Principle', 'Mayone Maharajan', 'working authorial manuscript inspected 2026-09-06', 'repo:content/books/the-maha-principle/The-Maha-Principle.md', 'authorial-primary-source', 'The Network and the Feed; Chapter 7 verification framework; Whole-Food Information; Chapter 6 humane governance', 'The author’s account of information infrastructure, directed knowledge use, source verification, humane governance, and resilient redundancy.', 'The manuscript establishes what its author proposes; it does not establish uptake, empirical validation, philosophical priority, commercial readiness, or consensus.', authorRights, 'book-section'),
  ]),
  'maha-strategies:quota-enforcement': packet('maha-strategies:quota-enforcement', 'HTTP RateLimit fields standardize how a server communicates quota policy and state, while the local atomic decision preserves accepted, exhausted, and unavailable as distinct outcomes.', [
    source('rfc-9333-ratelimit', 'RateLimit Fields for HTTP', 'IETF', 'RFC 9333, September 2023', 'https://www.rfc-editor.org/rfc/rfc9333.html', 'internet-standard', '§§2–3 terminology; §§4–5 RateLimit-Policy and RateLimit fields; §6 security considerations', 'A server can communicate quota policy, remaining quota, and reset timing while retaining discretion over enforcement and response behavior.', 'RateLimit fields do not authenticate a client, grant entitlement, require a specific algorithm, guarantee service availability, or prove that distributed enforcement is atomic.'),
    source('local-credential-rate-limit', 'Maha credential rate-limit decision', 'Maha Strategies', `repository source inspected ${reviewedOn}`, 'repo:lib/credential-rate-limit.ts', 'local-implementation', 'CredentialRateLimitDecision; consumeCredentialRateLimit', 'The local call distinguishes accepted, rate-limited, and unavailable outcomes and refuses malformed or failed provider responses.', 'The function does not prove the backing RPC is atomic, correctly configured, globally enforced, commercially available, or associated with a particular plan.', localRights, 'code-symbol'),
  ]),
  'maha-strategies:rectification-limits': packet('maha-strategies:rectification-limits', 'The local astrology protocol treats an uncertain event time as an interval, reports feature stability across it, and refuses to turn rectification into source evidence or precise fact.', [
    source('local-astrology-rectification-limits', 'Astrology workflow protocols', 'Maha Strategies', `repository source inspected ${reviewedOn}`, 'repo:lib/astrology-workflow-protocols.ts', 'local-public-contract', 'uncertain-time interval workflow; feature-stability output; missing-input and rectification refusal conditions', 'A bounded workflow can preserve uncertain time as an interval and report which calculated features remain stable or cross boundaries.', 'The workflow does not recover an unknown birth time, validate rectification methods, validate astrology, or turn a selected time into historical evidence.', localRights, 'code-symbol'),
  ]),
  'maha-strategies:uncertainty-bounds': packet('maha-strategies:uncertainty-bounds', 'NIST supplies the measurement-uncertainty model and the local protocol carries bounded input intervals into stability results without inventing an exact value.', [
    source('nist-tn-1297-uncertainty', 'Guidelines for Evaluating and Expressing the Uncertainty of NIST Measurement Results', 'NIST', 'Technical Note 1297, 1994 edition', 'https://www.nist.gov/pml/nist-technical-note-1297', 'government-metrology-guidance', '§§2–7; Appendix A, Law of Propagation of Uncertainty', 'Type A and Type B components, combined standard uncertainty, expanded uncertainty, propagation, and reporting are kept explicit.', 'The method covers identified components under a stated measurement model; it does not discover omitted systematic effects, validate the model, or supply uncertainty where inputs are absent.', governmentRights),
    source('local-astrology-uncertainty-bounds', 'Astrology workflow protocols', 'Maha Strategies', `repository source inspected ${reviewedOn}`, 'repo:lib/astrology-workflow-protocols.ts', 'local-public-contract', 'input interval, boundary crossing, stability and refusal fields', 'The local workflow represents uncertain inputs and reports whether derived labels remain stable across the declared range.', 'A bounded calculation does not establish astrological meaning, predictive validity, unknown model error, or an exact event time.', localRights, 'code-symbol'),
  ]),
  'mayone-maharajan:authorial-lineage': packet('mayone-maharajan:authorial-lineage', 'The lineage is limited to relationships among identified Maha-controlled manuscripts and their dated authorial concepts; it is not a claim of intellectual priority or independent reception.', [
    source('maha-principle-authorial-lineage', 'The Maha Principle', 'Mayone Maharajan', 'working authorial manuscript inspected 2026-09-06', 'repo:content/books/the-maha-principle/The-Maha-Principle.md', 'authorial-primary-source', 'The Network and the Feed; Chapter 6; Chapter 7; Whole-Food Information', 'One manuscript state develops an authorial vocabulary for information, governance, verification, and resilience.', 'A manuscript can establish its own wording and internal relationships, not originality, influence, reception, consensus, or empirical truth.', authorRights, 'book-section'),
    source('cosmic-recursion-authorial-lineage', 'The Cosmic Recursion', 'Mayone Maharajan', 'working authorial manuscript inspected 2026-09-06', 'repo:content/books/the-cosmic-recursion/THE-COSMIC-RECURSION-manuscript.md', 'authorial-primary-source', 'Introduction and closing synthesis; passages distinguishing analogy, recurrence, evidence, and model boundary', 'A second identified manuscript develops a related but distinct authorial treatment of recurrence, analogy, model limits, and verification.', 'Textual relationship inside one author’s corpus does not prove chronological influence, priority over other thinkers, public reception, or scientific validity.', authorRights, 'book-section'),
  ]),
}

type ReviewInput = Omit<Parameters<typeof buildFederationTrancheReview>[0], 'trancheNumber' | 'additionalPackets'>

export function buildTrancheFiveReview(input: ReviewInput) {
  return buildFederationTrancheReview({
    ...input,
    trancheNumber: 5,
    additionalPackets: TRANCHE_FIVE_NEW_PACKETS,
  })
}
