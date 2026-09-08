import { createHash } from 'node:crypto'

export type Tranche20State = 'evidence-ready' | 'revise' | 'blocked'

export type Tranche20Source = {
  sourceId: string
  identity: string
  locator: string
  rightsBasis: string
  scope: string
  boundary: string
  roles: readonly string[]
  kind: 'local-implementation' | 'official-authority'
}

const local = (sourceId: string, locator: string, roles: readonly string[], scope: string, boundary: string): Tranche20Source => ({
  sourceId, identity: locator.split(' — ')[0], locator, roles, scope, boundary,
  rightsBasis: 'project-owned-reference-only', kind: 'local-implementation',
})

const official = (sourceId: string, identity: string, locator: string, roles: readonly string[], scope: string, boundary: string): Tranche20Source => ({
  sourceId, identity, locator, roles, scope, boundary,
  rightsBasis: 'official-public-reference; quote-free metadata and paraphrase only', kind: 'official-authority',
})

export const GAP_CLOSURE_SOURCES: Readonly<Record<string, readonly Tranche20Source[]>> = {
  'urn:maha:concept:computation:interval-bounds': [
    local('t20-interval-execution', 'packages/wasm-kernel/src/execution.ts — executeKernelRequest and verifyExecutedCalculationReceipt', ['machine-interface', 'reproducibility'], 'Executes interval addition over canonical signed-i64 inputs with one explicit unit and independently recomputes the receipt output.', 'This proves only bounded interval addition; it does not establish general interval arithmetic or measurement validity.'),
  ],
  'urn:maha:concept:computation:root-finding': [
    local('t20-newton-fixture', 'lib/deterministic-calculation.ts — newtonRoot and buildCalculation and assertCalculable', ['machine-interface', 'reproducibility'], 'Executes a fixed-precision Newton iteration and binds the exact method locator, inputs, assumptions, steps, result, and uncertainty treatment into a receipt.', 'This proves a bounded Newton-method fixture, not convergence for arbitrary functions or a general root-finding service.'),
  ],
  'urn:maha:concept:computation:cryptographic-commitments': [
    local('t20-canonical-commitment', 'lib/evidence-dossier/digest.ts — canonicalJson and provenanceDigest', ['machine-interface', 'reproducibility'], 'Canonicalizes supported JSON values and emits a SHA-256 commitment that can be recomputed from the same non-empty payload.', 'A matching digest establishes byte-equivalent canonical content, not truth, authorship, timestamp, or legal signature.'),
  ],
  'urn:maha:concept:computation:reproducibility-fixtures': [
    local('t20-fixture-registry', 'lib/evidence-workflow-examples.ts — EVIDENCE_WORKFLOW_PUBLIC_REGISTRY and EVIDENCE_WORKFLOW_REGISTRY_DIGEST', ['machine-interface'], 'Publishes a typed synthetic fixture registry with expected outputs, refusals, checks, and one digest over the registry.', 'Synthetic conformance is not independent reproduction and the registry is prepared rather than deployed.'),
  ],
  'urn:maha:concept:evidence:source-recovery': [
    local('t20-source-recovery', 'lib/source-recovery.ts — recoveryRequests and validateObservation and compileRecoveryPackets', ['workflow', 'verification', 'failure-modes'], 'Builds bounded recovery requests, validates observations, and compiles packets while preserving identity, version, access, and inspection states.', 'Recovery locates candidates only; it cannot claim content inspection, canonical substitution, or version equivalence without evidence.'),
  ],
}

export const POLICY_SOURCES: Readonly<Record<string, readonly Tranche20Source[]>> = {
  'urn:maha:concept:governance:intellectual-property': [
    official('t20-wipo-ai-ip', 'WIPO Revised Issues Paper on IP Policy and AI', 'https://www.wipo.int/meetings/en/doc_details.jsp?doc_id=499504 — issue taxonomy and policy questions', ['mechanisms', 'uncertainty'], 'Identifies IP mechanisms and unresolved policy questions raised by AI.', 'An issues paper is not law, jurisdiction-specific advice, or a final WIPO position.'),
  ],
  'urn:maha:concept:governance:traceability': [
    official('t20-eu-ai-traceability', 'European Commission AI Act service material', 'https://ai-act-service-desk.ec.europa.eu/en/ai-act/recital-71 — Recital 71 and linked Articles 11, 12, 19, 72', ['definition', 'sources', 'uncertainty'], 'Connects traceability for high-risk AI to technical documentation, lifecycle records, logs, and post-market monitoring.', 'This is bounded to the EU AI Act and high-risk-system context; it is not a universal definition or legal advice.'),
  ],
  'urn:maha:concept:governance:interoperability': [
    official('t20-eif', 'European Commission European Interoperability Framework', 'https://interoperable-europe.ec.europa.eu/collection/iopeu-monitoring/european-interoperability-framework-detail — introduction, layers, conceptual model, 47 recommendations', ['definition', 'mechanisms', 'implementation'], 'Defines organisational interoperability and provides layered mechanisms and implementation recommendations for European public services.', 'The framework is public-sector guidance; it does not prove outcomes or universal private-sector applicability.'),
  ],
  'urn:maha:concept:governance:digital-public-infrastructure': [
    official('t20-oecd-dpi', 'OECD Digital Public Infrastructure for Digital Governments', 'https://www.oecd.org/en/publications/digital-public-infrastructure-for-digital-governments_ff525dc8-en.html — abstract and governance findings', ['sources', 'tradeoffs'], 'Defines shared secure interoperable systems and identifies funding, collaboration, privacy, security, resilience, and cross-border governance tradeoffs.', 'The paper surveys policy design; it does not prescribe one implementation or establish local outcomes.'),
  ],
  'urn:maha:concept:governance:competition-policy': [
    official('t20-doj-antitrust', 'US Department of Justice Antitrust Division', 'https://www.justice.gov/atr/antitrust-laws-and-you — Sherman, Clayton, and FTC Act overview; https://www.justice.gov/atr/merger-guidelines/overview — 2023 Merger Guidelines overview', ['current-law', 'evidence', 'tradeoffs'], 'Identifies current US federal antitrust statutes and the evidence-oriented merger-analysis framework.', 'US federal materials do not establish other jurisdictions, case outcomes, or an executable machine rule.'),
  ],
  'urn:maha:concept:governance:assurance-cases': [
    official('t20-nist-assurance-case', 'NIST CSRC assurance-case glossary', 'https://csrc.nist.gov/glossary/term/assurance_case — definitions and identified source documents', ['sources', 'uncertainty'], 'Defines an assurance case as auditable argument and evidence with explicit assumptions supporting specified claims.', 'A glossary definition is not current law and does not show that a particular assurance case is adequate.'),
  ],
  'urn:maha:concept:governance:public-sector-procurement': [
    official('t20-far-it-procurement', 'US Federal Acquisition Regulation', 'https://www.acquisition.gov/far/39.101 — IT acquisition policy; https://www.acquisition.gov/far/part-10 — market research', ['current-law'], 'Records current US federal IT acquisition and market-research requirements at FAC 2026-01.', 'This is US federal procurement only, changes over time, and is not procurement advice.'),
  ],
  'urn:maha:concept:governance:incident-reporting': [
    official('t20-nist-incident', 'NIST AI 600-1 and NIST SP 800-171r3', 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf — MAP 5.1; https://nvlpubs.nist.gov/nistpubs/SpecialPublications/800-171r3/NIST.SP.800-171r3.html — 03.06.01–03.06.03', ['mechanisms', 'uncertainty'], 'Describes incident inputs, tracking, reporting, response, testing, and the dependence of reporting details on law, policy, sensitivity, and organizational assignment.', 'Cybersecurity controls and voluntary AI guidance do not establish a universal mandatory AI-incident regime.'),
  ],
}

export const PRODUCT_CONTRACT_FINDING = 'The repository currently declares a free preflight, a $49 document preflight, a disabled proposed $250 bounded dossier, and a separate $5,000 dossier-package list price. Commercial-use claims remain revise until one versioned offer contract reconciles scope, availability, price, turnaround, privacy, and refund terms.'

export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
}

export function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`
}
