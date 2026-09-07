import { createHash } from 'node:crypto'

export type Tranche22Source = {
  sourceId: string
  identity: string
  locator: string
  rightsBasis: string
  scope: string
  boundary: string
  roles: readonly string[]
  kind: 'local-implementation' | 'official-authority' | 'commercial-contract'
}

const local = (sourceId: string, locator: string, roles: readonly string[], scope: string, boundary: string): Tranche22Source => ({
  sourceId, identity: locator.split(' — ')[0], locator, roles, scope, boundary,
  rightsBasis: 'project-owned-reference-only', kind: 'local-implementation',
})

const official = (sourceId: string, identity: string, locator: string, roles: readonly string[], scope: string, boundary: string): Tranche22Source => ({
  sourceId, identity, locator, roles, scope, boundary,
  rightsBasis: 'official-public-reference; quote-free metadata and paraphrase only', kind: 'official-authority',
})

const commercial = (sourceId: string, locator: string, roles: readonly string[], scope: string, boundary: string): Tranche22Source => ({
  sourceId, identity: locator.split(' — ')[0], locator, roles, scope, boundary,
  rightsBasis: 'project-owned-commercial-contract-reference', kind: 'commercial-contract',
})

export function checkedIntegerArithmetic(operation: 'add' | 'subtract' | 'multiply', left: bigint, right: bigint, absoluteLimit: bigint): { result: bigint; exact: true } {
  if (absoluteLimit <= BigInt(0)) throw new Error('invalid-limit')
  if ([left, right].some((value) => value < -absoluteLimit || value > absoluteLimit)) throw new Error('input-out-of-range')
  const result = operation === 'add' ? left + right : operation === 'subtract' ? left - right : left * right
  if (result < -absoluteLimit || result > absoluteLimit) throw new Error('result-out-of-range')
  return { result, exact: true }
}

export function rotateCartesianQuarterTurns(x: bigint, y: bigint, quarterTurns: number): { x: bigint; y: bigint; normalizedQuarterTurns: number } {
  if (!Number.isInteger(quarterTurns)) throw new Error('quarter-turn-not-integer')
  const normalizedQuarterTurns = ((quarterTurns % 4) + 4) % 4
  if (normalizedQuarterTurns === 0) return { x, y, normalizedQuarterTurns }
  if (normalizedQuarterTurns === 1) return { x: -y, y: x, normalizedQuarterTurns }
  if (normalizedQuarterTurns === 2) return { x: -x, y: -y, normalizedQuarterTurns }
  return { x: y, y: -x, normalizedQuarterTurns }
}

export function randomizedMeanContrast(control: readonly bigint[], treated: readonly bigint[], assignmentDeclaredRandom: boolean): { numerator: bigint; denominator: bigint; interpretation: 'randomized-sample-mean-contrast' } {
  if (!assignmentDeclaredRandom) throw new Error('random-assignment-not-declared')
  if (!control.length || !treated.length) throw new Error('empty-arm')
  const controlSum = control.reduce((sum, value) => sum + value, BigInt(0))
  const treatedSum = treated.reduce((sum, value) => sum + value, BigInt(0))
  return { numerator: treatedSum * BigInt(control.length) - controlSum * BigInt(treated.length), denominator: BigInt(control.length * treated.length), interpretation: 'randomized-sample-mean-contrast' }
}

export type LocatorAssertion = { sourceId: string; sourceRevision: string; kind: 'page' | 'section' | 'figure' | 'table' | 'equation'; value: string }

export function verifyLocator(expected: LocatorAssertion, observed: LocatorAssertion): { verified: true; locatorDigest: string } {
  for (const key of ['sourceId', 'sourceRevision', 'kind', 'value'] as const) if (expected[key] !== observed[key]) throw new Error(`locator-${key}-mismatch`)
  if (!expected.value.trim()) throw new Error('locator-empty')
  return { verified: true, locatorDigest: digest(expected) }
}

export type VersionNode = { objectId: string; revisionDigest: string; predecessorDigest: string | null; relation: 'initial' | 'supersedes' }

export function verifyVersionRelationship(previous: VersionNode | null, next: VersionNode): { verified: true; transition: 'initial' | 'supersedes' } {
  if (next.relation === 'initial') {
    if (previous !== null || next.predecessorDigest !== null) throw new Error('initial-has-predecessor')
    return { verified: true, transition: 'initial' }
  }
  if (!previous || previous.objectId !== next.objectId) throw new Error('predecessor-object-mismatch')
  if (next.predecessorDigest !== previous.revisionDigest) throw new Error('predecessor-digest-mismatch')
  if (next.revisionDigest === previous.revisionDigest) throw new Error('revision-unchanged')
  return { verified: true, transition: 'supersedes' }
}

export type AuditExportEntry = { eventId: string; eventType: string; subjectDigest: string; occurredAt: string }

export function compileAuditExport(entries: readonly AuditExportEntry[]): { entries: AuditExportEntry[]; exportDigest: string; containsSubmittedContent: false } {
  const ids = new Set<string>()
  const ordered = [...entries].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.eventId.localeCompare(b.eventId))
  for (const entry of ordered) {
    if (ids.has(entry.eventId)) throw new Error('duplicate-event')
    ids.add(entry.eventId)
    if (!/^sha256:[a-f0-9]{64}$/.test(entry.subjectDigest)) throw new Error('subject-digest-invalid')
    if (Number.isNaN(Date.parse(entry.occurredAt))) throw new Error('occurred-at-invalid')
  }
  return { entries: ordered, exportDigest: digest(ordered), containsSubmittedContent: false }
}

export function canonical(value: unknown): string {
  if (typeof value === 'bigint') return JSON.stringify(value.toString())
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
}

export function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`
}

export const CARRIED_APPLICATION_SOURCES: Readonly<Record<string, readonly Tranche22Source[]>> = {
  'urn:maha:concept:computation:deterministic-arithmetic': [local('t22-checked-arithmetic', 'lib/federation/readiness-tranche-22.ts — checkedIntegerArithmetic', ['machine-interface', 'reproducibility', 'worked-example', 'uncertainty'], 'Performs bounded exact integer addition, subtraction, or multiplication and refuses inputs or results outside the declared absolute limit.', 'Exact integer arithmetic has no rounding uncertainty inside the bound; it does not establish measurement uncertainty, floating-point behavior, or model validity.')],
  'urn:maha:concept:computation:reference-frame-conversion': [local('t22-quarter-turn-frame', 'lib/federation/readiness-tranche-22.ts — rotateCartesianQuarterTurns', ['machine-interface', 'reproducibility', 'worked-example'], 'Performs exact Cartesian rotations in integer quarter turns with a normalized transform identifier.', 'This is a synthetic two-dimensional orthogonal transform, not an Earth-orientation, celestial, geodetic, epoch, or uncertainty service.')],
  'urn:maha:concept:computation:causal-inference': [local('t22-randomized-contrast', 'lib/federation/readiness-tranche-22.ts — randomizedMeanContrast', ['machine-interface', 'reproducibility', 'worked-example'], 'Computes the exact sample-mean contrast for two declared randomized synthetic arms.', 'Randomization is caller-declared; this fixture does not verify assignment, estimate population effects, handle attrition, or justify transportability.')],
  'urn:maha:concept:evidence:locator-verification': [local('t22-locator-verifier', 'lib/federation/readiness-tranche-22.ts — verifyLocator', ['workflow', 'verification', 'failure-modes'], 'Verifies exact equality of source identity, revision, locator kind, and locator value and returns a digest.', 'A matching locator proves identity of the declaration, not that the passage exists, was inspected, or supports a claim.')],
  'urn:maha:concept:evidence:version-relationship': [local('t22-version-verifier', 'lib/federation/readiness-tranche-22.ts — verifyVersionRelationship', ['verification'], 'Verifies an initial or superseding transition against exact object and predecessor revision digests.', 'A valid transition establishes lineage consistency, not semantic equivalence, evidence quality, or review inheritance.')],
  'urn:maha:concept:evidence:audit-export': [local('t22-audit-export', 'lib/federation/readiness-tranche-22.ts — compileAuditExport', ['verification'], 'Sorts append-only metadata events, rejects duplicates and malformed digests or times, and binds the export to one digest.', 'The export contains metadata and fingerprints only; it does not prove completeness against an external system or include submitted content.')],
}

export const SCIENTIFIC_EVIDENCE_POLICY_SOURCES: readonly Tranche22Source[] = [
  official('t22-gao-evidence-policy', 'U.S. Government Accountability Office GAO-23-105460', 'https://www.gao.gov/products/gao-23-105460 — 13 practices across planning, assessing/building, using evidence, and learning', ['evidence', 'tradeoffs'], 'Describes evidence-building and use practices, evidence types, implementation actions, and observed limits in US federal agencies.', 'This is US federal management guidance and audit synthesis, not a universal hierarchy of evidence or proof that a policy works.'),
  official('t22-evidence-act', 'Foundations for Evidence-Based Policymaking Act of 2018', 'https://www.congress.gov/115/statute/STATUTE-132/STATUTE-132-Pg5529.pdf — Title I federal evidence-building activities and Titles II–III data access and confidentiality', ['current-law', 'definition'], 'Establishes US federal evaluation, evidence-building, data governance, and confidentiality duties.', 'This is US federal law; it neither mandates one scientific method nor creates an executable decision rule for arbitrary claims.'),
  official('t22-nasem-reproducibility', 'National Academies Reproducibility and Replicability in Science', 'https://nap.nationalacademies.org/resource/25303/R%26R.pdf — definitions and recommendations', ['evidence', 'tradeoffs'], 'Separates computational reproducibility from replicability and records why contrary results require contextual assessment rather than automatic reversal.', 'The report does not rank every study design or decide a specific policy question.')
]

export const POLICY_SOURCES: Readonly<Record<string, readonly Tranche22Source[]>> = {
  'urn:maha:concept:governance:scientific-evidence-policy': SCIENTIFIC_EVIDENCE_POLICY_SOURCES,
  'urn:maha:concept:governance:incident-reporting': [official('t22-nist-incident', 'NIST AI 600-1 and NIST SP 800-171r3', 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf — MAP 5.1; https://nvlpubs.nist.gov/nistpubs/SpecialPublications/800-171r3/NIST.SP.800-171r3.html — 03.06.01–03.06.03', ['definition', 'sources'], 'Describes incident inputs, tracking, response, testing, reporting, and organizational assignment.', 'Voluntary AI guidance and cybersecurity controls do not establish one universal mandatory incident regime.')],
  'urn:maha:concept:governance:intellectual-property': [official('t22-wipo-ip', 'WIPO Revised Issues Paper on IP Policy and AI', 'https://www.wipo.int/meetings/en/doc_details.jsp?doc_id=499504 — issue taxonomy and policy questions', ['definition', 'sources'], 'Identifies IP domains, mechanisms, and unresolved AI-related policy questions.', 'An issues paper is not jurisdiction-specific law, legal advice, or a final WIPO position.')],
  'urn:maha:concept:governance:interoperability': [official('t22-eu-interoperability', 'Regulation (EU) 2024/903 and European Interoperability Framework', 'https://interoperable-europe.ec.europa.eu/Interoperable-Europe-Act-Regulation — Articles 1–6; https://interoperable-europe.ec.europa.eu/collection/iopeu-monitoring/european-interoperability-framework-detail — layers and recommendations', ['evidence', 'sources', 'tradeoffs'], 'Defines legal, organizational, semantic, and technical interoperability and records assessment, reuse, governance, and implementation tradeoffs.', 'EU public-sector law and guidance do not establish a universal private-sector machine rule or prove outcomes.')],
  'urn:maha:concept:governance:competition-policy': [official('t22-doj-antitrust', 'U.S. Department of Justice Antitrust Division', 'https://www.justice.gov/atr/antitrust-laws-and-you — statutes; https://www.justice.gov/atr/merger-guidelines/overview — 2023 Merger Guidelines', ['implementation', 'uncertainty'], 'Describes US federal antitrust enforcement authorities and the analytical framework used in merger review.', 'Guidelines identify enforcement analysis, not guaranteed outcomes, universal law, or an executable adjudication rule.')],
  'urn:maha:concept:governance:assurance-cases': [official('t22-nist-assurance', 'NIST CSRC assurance-case glossary', 'https://csrc.nist.gov/glossary/term/assurance_case — definition and source documents', ['mechanisms', 'implementation'], 'Defines an assurance case as an auditable argument supported by evidence and explicit assumptions.', 'A definition does not establish current law or adequacy of a particular assurance case.')],
  'urn:maha:concept:governance:digital-public-infrastructure': [official('t22-oecd-dpi', 'OECD Digital Public Infrastructure for Digital Governments', 'https://www.oecd.org/en/publications/digital-public-infrastructure-for-digital-governments_ff525dc8-en.html — definition, components, safeguards, and implementation considerations', ['implementation'], 'Describes shared digital systems, implementation conditions, governance, safeguards, and interoperability considerations.', 'An OECD policy paper is not current law and does not create an executable machine rule.')],
}

export const PRODUCT_MAPPING_SOURCES: Readonly<Record<string, readonly Tranche22Source[]>> = {
  'urn:maha:concept:authority:context-budgeting': [commercial('t22-context-compression-offer', 'lib/agentic-commerce.ts — contextCompressionX402Capability', ['commercialization'], 'Publishes a payable bounded context-compression capability with an exact endpoint and x402 terms.', 'The offer covers transient context compression only; it does not commercialize general memory governance, durable tasks, delegation, or failure recovery.')],
}

export const RESEARCH_APPLICATION_SOURCES: Readonly<Record<string, readonly Tranche22Source[]>> = {
  'urn:maha:concept:evidence:scope-matching': [local('t22-preflight-scope', 'lib/evidence-preflight.ts — compileEvidencePreflight', ['relationships'], 'Records bounded-language and lexical-coverage signals between one claim and one supplied excerpt.', 'Lexical overlap is structural preflight, not proof of semantic support or source truth.')],
  'urn:maha:concept:evidence:inference-boundary': [local('t22-preflight-inference', 'lib/evidence-preflight.ts — compileEvidencePreflight', ['failure-mode'], 'Flags bounded lexical signals for unsupported causal, universal, certainty, and safety inference.', 'A lexical signal is a review prompt, not a semantic verdict.')],
  'urn:maha:concept:evidence:passage-locator': [local('t22-passage-locator', 'lib/federation/readiness-tranche-22.ts — verifyLocator', ['method', 'definition', 'protocol'], 'Defines and verifies source, revision, locator kind, and exact locator value as one bound assertion.', 'It does not establish passage existence, inspection, or claim support.')],
  'urn:maha:concept:evidence:equation-locator': [local('t22-equation-locator', 'lib/federation/readiness-tranche-22.ts — verifyLocator', ['machine-record', 'failure-mode'], 'Uses the exact locator contract with equation as a distinct locator kind and fails on kind or value substitution.', 'Equation identity does not validate transcription, symbols, assumptions, or arithmetic.')],
  'urn:maha:concept:evidence:metadata-only-evidence': [local('t22-metadata-boundary', 'lib/evidence-preflight-contract.ts — EvidencePreflightClaimAssessment and evidenceStatus', ['machine-record', 'failure-mode'], 'Distinguishes metadata-only evidence from located user-supplied excerpts and blocks it before source inspection.', 'Metadata identifies a possible source; it is non-explanatory and does not support a claim.')],
  'urn:maha:concept:evidence:abstract-only-evidence': [local('t22-recovery-depth', 'lib/source-recovery.ts — validateObservation and compileRecoveryPackets', ['machine-record', 'source-contract', 'method'], 'Preserves access, inspection, identity, and exact-locator states without upgrading abstract-only access to full-text inspection.', 'An abstract can establish subject and metadata at most; it cannot support section-specific or detailed claims.')],
  'urn:maha:concept:evidence:full-text-evidence': [local('t22-recovery-fulltext', 'lib/source-recovery.ts — validateObservation and compileRecoveryPackets', ['relationships', 'source-contract', 'protocol'], 'Requires a content-inspected observation and exact locator before a recovery packet can describe full-text evidence.', 'Full-text access alone does not prove relevance, rights, claim support, or correctness.')],
  'urn:maha:concept:evidence:government-mirror': [local('t22-government-mirror', 'lib/source-recovery.ts — recoveryRequests and compileRecoveryPackets', ['machine-record'], 'Represents a government-host recovery route while preserving identity, version, access, and inspection as separate states.', 'Government hosting does not make a document authoritative for every claim or establish version equivalence.')],
  'urn:maha:concept:evidence:reproducibility': [local('t22-reproducibility-registry', 'lib/evidence-workflow-examples.ts — EVIDENCE_WORKFLOW_PUBLIC_REGISTRY and EVIDENCE_WORKFLOW_REGISTRY_DIGEST', ['method', 'source-contract', 'relationships', 'protocol'], 'Publishes synthetic inputs, outputs, refusals, checks, and one digest-bound workflow registry.', 'Synthetic conformance is not independent scientific reproduction.')],
  'urn:maha:concept:evidence:contradiction-search': [local('t22-conflict-search', 'lib/federation/readiness-tranche-21.ts — classifyLiterature', ['relationships', 'definition', 'source-contract'], 'Compares located observations only after claim, population, and outcome scopes match.', 'Directional disagreement does not adjudicate study quality or truth.')],
  'urn:maha:concept:evidence:formal-definition': [local('t22-formal-proof-contract', 'packages/maha-lean-bridge/src/verifier.ts — verifyAttachments', ['method', 'definition', 'protocol', 'relationships'], 'Defines and verifies a machine-checked theorem attachment against a pinned manifest, source, claim, and toolchain.', 'A formal definition or checked deduction does not establish empirical truth or source support.')],
  'urn:maha:concept:evidence:slurm-job': [local('t22-slurm-adapter', 'packages/maha-witness/src/maha_witness/adapters.py — slurm_metadata', ['machine-record'], 'Captures bounded SLURM runtime metadata into the witness receipt contract.', 'Recorded scheduler metadata does not prove workload correctness or cluster configuration completeness.')],
  'urn:maha:concept:evidence:qiskit-circuit': [local('t22-qiskit-adapter', 'packages/maha-witness/src/maha_witness/adapters.py — qiskit_metadata', ['fixture', 'protocol'], 'Captures bounded Qiskit circuit, backend, shot, seed, and runtime metadata under the witness contract.', 'A receipt does not establish quantum advantage, hardware fidelity, or scientific validity.')],
}

export const PUBLISH_APPLICATION_SOURCES: Readonly<Record<string, readonly Tranche22Source[]>> = {
  'urn:maha:concept:release:release-manifest': [local('t22-release-manifest', 'lib/epistemic-release.ts — parseEpistemicReleaseRequest and releaseReadiness and buildEpistemicCanonicalRelease', ['failure-mode', 'template', 'machine-interface', 'example', 'governance', 'policy', 'workflow'], 'Defines, validates, evaluates, and compiles an exact-target canonical release with scoped approvals and separate release authority.', 'The release manifest records governance and provenance; it does not establish empirical truth, independent review, or source correctness.')],
  'urn:maha:concept:release:context-pack': [local('t22-context-pack', 'lib/context-compiler.ts — parseContextPackRequest and compileContextPack', ['policy', 'governance', 'workflow', 'failure-mode'], 'Validates bounded context inputs and deterministically compiles a source-attributed context pack under an explicit budget.', 'Selection and retention do not validate source truth, relevance outside the request, legal compliance, or downstream model behavior.')],
  'urn:maha:concept:release:manuscript-versioning': [local('t22-versioned-release', 'lib/epistemic-release.ts — epistemicReleaseStatus and activeEpistemicReleases', ['definition'], 'Distinguishes active, superseded, and withdrawn release states over exact targets.', 'Release lineage is not a universal publishing-version ontology and does not establish equivalence between manuscripts and versions of record.')],
}
