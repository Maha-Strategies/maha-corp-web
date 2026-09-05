import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import batchOne from '../content/scaling/epistemic-clearing-batch-1.json' with { type: 'json' }
import routeMap from '../content/scaling/epistemic-clearing-route-candidates-v1.json' with { type: 'json' }
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'

export type Candidate = (typeof routeMap.candidates)[number]
export type Lane = Candidate['lane']
type LinkRole = 'operational-source' | 'inspected-source-projection' | 'conceptual-lens' | 'related-guide'
type GuideLink = { title: string; path: string; role: LinkRole }

const ROOT = resolve(import.meta.dirname, '..')
const OUTPUT = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(ROOT, 'content/scaling/epistemic-clearing-batch-2.json')
const PREPARED_ON = '2026-09-05'

const QUOTAS: Readonly<Record<Lane, number>> = {
  'machine-integrations': 60,
  'tamil-religion': 80,
  'astrology-infrastructure': 80,
  'evidence-clearing': 100,
  'mathematics-astronomy': 50,
  'cross-domain-synthesis': 37,
}

const bookRoutes: Readonly<Record<string, { title: string; path: string }>> = {
  'the-maha-principle': { title: 'The Maha Principle — conceptual boundary', path: '/books/the-maha-principle/read/navigating-complexity' },
  'the-synthetic-self': { title: 'The Synthetic Self — alignment and inspection', path: '/books/the-synthetic-self/read/the-alignment-problem' },
  'the-cosmic-recursion': { title: 'The Cosmic Recursion — boundary and scale', path: '/books/the-cosmic-recursion/read/the-boundary-that-holds' },
  'the-orbital-mind': { title: 'The Orbital Mind — frames and agency', path: '/books/the-orbital-mind/read/agency-and-boundary' },
  'the-volcanic-engine': { title: 'The Volcanic Engine — inference and warning', path: '/books/the-volcanic-engine/read/two-warnings' },
  'the-borrowed-light': { title: 'The Borrowed Light — model boundary', path: '/books/the-borrowed-light/read' },
  'the-imagined-life': { title: 'The Imagined Life — observation and interpretation', path: '/books/the-imagined-life/read' },
  'the-unfinished-species': { title: 'The Unfinished Species — systems and selection', path: '/books/the-unfinished-species/read' },
}

const sentence = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1)
const cleanQuestion = (value: string): string => value.replace(/\ba ([aeiou])/gi, 'an $1')
function subjectOf(candidate: Candidate): string {
  const title = candidate.title.split(':')[0].trim()
  const suffixes = [
    ' occurrence and identity map',
    ' evidence comparison',
    ' evidence map',
    ' in the Tolkappiyam',
    ' calculation receipt',
    ' prospective evaluation protocol',
    ' input workflow',
    ' sensitivity analysis',
    ' decision map',
  ]
  return suffixes.reduce((subject, suffix) => subject.endsWith(suffix) ? subject.slice(0, -suffix.length) : subject, title)
}
const lensName = (candidate: Candidate): string => candidate.lens.replaceAll('-', ' ')

function uniqueLinks(links: readonly GuideLink[]): GuideLink[] {
  const seen = new Set<string>()
  return links.filter((link) => {
    if (seen.has(link.path)) return false
    seen.add(link.path)
    return true
  })
}

function bookLinks(candidate: Candidate): GuideLink[] {
  return candidate.bookPriority.matched.flatMap((match) => {
    const book = bookRoutes[match.bookId]
    return book ? [{ ...book, role: 'conceptual-lens' as const }] : []
  })
}

function laneLinks(candidate: Candidate): GuideLink[] {
  const nearest = candidate.scores.duplicationEvidence.nearestObservedRoute
    ? [{ title: 'Nearest existing public guide', path: candidate.scores.duplicationEvidence.nearestObservedRoute, role: 'related-guide' as const }]
    : []
  const byLane: Record<Lane, GuideLink[]> = {
    'machine-integrations': [
      { title: 'Developer infrastructure', path: '/developers', role: 'operational-source' },
      { title: 'Enterprise MCP Gateway', path: '/enterprise-mcp-gateway', role: 'operational-source' },
      { title: 'OpenAPI contract', path: '/api/docs/openapi', role: 'operational-source' },
    ],
    'tamil-religion': [
      { title: 'Tamil religion source atlas', path: '/knowledge/religion/tamil-source-atlas', role: 'related-guide' },
      { title: 'Māyōṉ source dossier', path: '/knowledge/religion/mayon', role: 'related-guide' },
      { title: 'Religion methodology', path: '/knowledge/religion', role: 'operational-source' },
    ],
    'astrology-infrastructure': [
      { title: 'Astrology workflow protocols', path: '/knowledge/astrology/protocols', role: 'operational-source' },
      { title: 'Calculation authority library', path: '/knowledge/astrology/calculations', role: 'operational-source' },
      { title: 'Celestial fact layer', path: '/knowledge/celestial', role: 'operational-source' },
    ],
    'evidence-clearing': [
      { title: 'Free Evidence Preflight', path: '/tools/evidence-preflight', role: 'operational-source' },
      { title: 'Evidence workflow examples', path: '/knowledge/evidence-workflows', role: 'operational-source' },
      { title: 'Claim-level provenance', path: '/mps/claim-level-provenance', role: 'operational-source' },
    ],
    'mathematics-astronomy': [
      { title: candidate.proposedPath.includes('/astronomy/') ? 'Astronomy knowledge' : 'Mathematics knowledge', path: candidate.proposedPath.includes('/astronomy/') ? '/knowledge/astronomy' : '/knowledge/mathematics', role: 'operational-source' },
      { title: 'Calculation authority library', path: '/knowledge/astrology/calculations', role: 'operational-source' },
      { title: 'Evidence workflow examples', path: '/knowledge/evidence-workflows', role: 'operational-source' },
    ],
    'cross-domain-synthesis': [
      { title: 'Epistemic publication system', path: '/knowledge/epistemic-system', role: 'operational-source' },
      { title: 'Knowledge integrations', path: '/knowledge/integrations', role: 'operational-source' },
      { title: 'Evidence workflow examples', path: '/knowledge/evidence-workflows', role: 'operational-source' },
    ],
  }
  return uniqueLinks([...byLane[candidate.lane], ...nearest, ...bookLinks(candidate)])
}

function answerFor(candidate: Candidate): string {
  const subject = subjectOf(candidate)
  const lens = candidate.lens
  const answers: Record<string, string> = {
    'source-identity': `Establish ${subject} from the authoritative identifier and the exact object inspected. Preserve title, responsible party, version, date, host, and content digest separately; a resolving DOI or URL proves location, not content support.`,
    'conflict-and-uncertainty': `For ${subject}, record supporting, conflicting, and unresolved evidence as separate findings. Preserve each source's scope and uncertainty, and do not average disagreements that concern different populations, versions, or claim definitions.`,
    'locator-sufficiency': `A locator for ${subject} is sufficient only when another reader can reopen the exact passage, table, figure, equation, or version that bears the claim. A landing page, search snippet, or document title is metadata rather than a claim locator.`,
    'claim-scope': `Bound ${subject} to the population, system, conditions, time, comparison, and outcome actually supported. Remove causal, universal, quantitative, or deployment language unless the inspected evidence establishes that stronger scope.`,
    'governed-release-and-retrieval': `Release ${subject} only when inspected evidence, exact-revision review, and an active canonical release bind the same target. Retrieval must return that active target and refuse stale, superseded, withdrawn, or differently scoped material.`,
    'identity-binding': `Bind ${subject} to one authenticated principal, tenant, credential fingerprint, endpoint, request digest, and lifecycle. Refuse substitution at any edge rather than inferring identity from possession of an identifier.`,
    'entitlement-decision': `Decide entitlement for ${subject} from the active principal, exact offer or resource, grant scope, expiry, revocation state, and remaining quota. Discovery and prior possession are not grants.`,
    'quota-and-metering': `Meter ${subject} against a server-defined unit and the exact principal, offer, request digest, and period. Reserve before work, settle from observed use, and make exact replays idempotent.`,
    'bounded-execution': `Execute ${subject} only after binding the exact tool, method, endpoint, request digest, deadline, and resource ceiling to an authorized principal. Missing, stale, or broader selectors produce refusal rather than fallback.`,
    'receipt-and-acknowledgement': `For ${subject}, issue a receipt over the request, result or delivery, identity bindings, status, and prior lifecycle digest. An acknowledgement must reference that exact receipt and cannot manufacture settlement or success.`,
    'concept-and-passage': `For ${subject}, begin with exact wording in a named edition and locator. Show the translation separately, attribute commentary, and label historical or theological synthesis so none is mistaken for the primary text.`,
    'identity-map': `Map ${subject} occurrence by occurrence. Preserve the textual form, grammatical and poetic context, named translation, date layer, and the explicit relationship type before connecting it to another divine name.`,
    'relationship-map': `For ${subject}, separate the primary association from translated wording, commentator explanation, historical reconstruction, and later reception. A shared landscape or poetic system establishes relation, not identity or continuous worship.`,
    'bounded-comparison': `Compare ${subject} only across named passages and editions. Align equivalent units, display divergent wording, attribute every gloss, and leave historical continuity or theological equivalence unresolved unless a separate source supports it.`,
    'passage-guide': `For ${subject}, verify the named edition and exact printed boundary before interpreting any wording. Keep the primary text, named translation, commentary, historical inference, and theology in separate evidence frames, and refuse any passage claim whose locator has not been inspected.`,
    'calculation-receipt': `Recompute ${subject} from canonical inputs, units, reference frame, algorithm and dependency versions, rounding rules, and uncertainty assumptions. Emit outputs and a digest-bound receipt; if any required numeric input is absent, emit no invented number.`,
    'prospective-evaluation': `Evaluate ${subject} prospectively by freezing the claim, scoring rule, sample, exclusions, baseline, time horizon, and failure threshold before outcomes are known. Report null and adverse results under the same protocol.`,
    'input-workflow': `For ${subject}, freeze the original observation or civil input, transformation chain, reference frame, versioned data sources, ambiguity policy, and uncertainty interval before calculation or interpretation.`,
    'decision-map': `Distinguish ${subject} by listing each tradition's source namespace, inputs, calculation choices, interpretive rules, and prohibited transfers. The map documents differences and does not validate either tradition.`,
    'sensitivity-analysis': `Test ${subject} by varying only the declared uncertain input across a bounded interval, holding the kernel and all other inputs fixed, then reporting numerical deltas and categorical boundary crossings without selecting a preferred outcome afterward.`,
    'definition-boundary': `Define ${subject} with its domain, inputs, codomain or output, assumptions, excluded cases, and equivalence conventions. Distinguish the definition from an implementation, example, approximation, or empirical claim.`,
    'derivation': `Derive ${subject} from named definitions and assumptions through checkable intermediate steps. Preserve every transformation and domain restriction; a numerical match alone does not prove the derivation.`,
    'worked-example': `A reproducible ${subject} example fixes inputs, units, conventions, algorithm version, intermediate values, output, and acceptance tolerance. It demonstrates one case and does not establish universal performance.`,
    'uncertainty': `Represent uncertainty in ${subject} by naming uncertain inputs, their units and dependence, the propagation rule, output interval or distribution, and the conditions under which that representation fails.`,
    'implementation-verification': `Verify an implementation of ${subject} against independent fixtures, boundary cases, invariants, and a reference result with declared tolerance. Version the implementation and preserve a receipt for every fixture.`,
    'observable': `For ${subject}, separate detector-level or catalogue observables from calibrated quantities and inferred physical parameters. Record the instrument, band or channel, time, reduction version, and selection boundary.`,
    'measurement-method': `Measure ${subject} through a declared instrument, acquisition protocol, calibration chain, reduction procedure, uncertainty model, and quality exclusions. Do not report an inferred quantity as a direct observation.`,
    'calibration': `Calibrate ${subject} with traceable references, instrument state, correction model, validity interval, residuals, and acceptance thresholds. A calibration from another configuration or epoch cannot be silently reused.`,
    'inference-boundary': `For ${subject}, list what was observed, which model connects it to the reported quantity, the assumptions and alternatives, and what the data cannot distinguish. Preserve observation and inference as different fields.`,
    'terminology-boundary': `Between ${subject}, define each term in its home domain and permit a bridge only when the relationship is typed. Shared vocabulary or metaphor is not evidence that mechanisms or validity transfer.`,
    'source-contract': `A source contract for ${subject} names the authority required on each side, exact locators, rights, version relationship, claim mapping, and prohibited cross-domain inference. Failure on either side refuses the bridge.`,
    'calculation-and-measurement-transfer': `Transfer a calculation or measurement across ${subject} only when quantities, units, frames, assumptions, calibration, and uncertainty are compatible. Similar notation is insufficient.`,
    'uncertainty-transfer': `Preserve uncertainty across ${subject} by carrying the originating interval or distribution, dependence assumptions, transformations, and validity boundary. Never replace unknown uncertainty with zero.`,
    'machine-retrieval-contract': `A machine retrieving evidence across ${subject} must bind both domain records, exact revisions, bridge type, entitlement, requested fields, and delivery digest. A bridge authorizes no broader corpus access.`,
  }
  const answer = answers[lens]
  if (!answer) throw new Error(`No answer template for lens ${lens}`)
  return answer
}

function framework(candidate: Candidate) {
  const subject = subjectOf(candidate)
  const laneSpecific: Record<Lane, { inputs: string[]; steps: string[]; outputs: string[]; refusals: string[]; limits: string[] }> = {
    'machine-integrations': {
      inputs: ['Authenticated principal and tenant', 'Exact resource, tool, method, and endpoint', 'Active entitlement with scope and expiry', 'Replay-safe request identifier and content digest'],
      steps: ['Resolve the credential to one active principal.', `Bind the exact ${subject} selector and requested capability.`, 'Evaluate entitlement, quota, expiry, and revocation.', 'Perform only the bounded operation or return a reason-coded refusal.', 'Commit metering and a digest-bound receipt atomically.', 'Acknowledge only the exact receipt produced by this lifecycle.'],
      outputs: ['Reason-coded allow or refuse decision', 'Bounded result or delivery reference', 'Metering and lifecycle receipt'],
      refusals: ['Identity, endpoint, selector, or digest is missing or substituted.', 'The grant is absent, expired, revoked, exhausted, or broader than the request.', 'A replay carries different content or lifecycle state.'],
      limits: ['This guide does not authorize payment, escrow, Production mutation, or private-corpus access.', 'A receipt proves recorded execution or delivery, not factual correctness.', 'Book links provide conceptual framing only and are not technical evidence.'],
    },
    'tamil-religion': {
      inputs: ['Named primary-text edition and printed-unit boundary', 'Exact source-language passage and locator', 'Named translation with edition identity', 'Attributed commentary or scholarship when used'],
      steps: ['Fix the printed unit before extracting a name or relationship.', 'Transcribe or point to the exact primary wording.', 'Present the named translation as a separate witness.', 'Attribute commentary rather than merging it into the passage.', `Classify every statement about ${subject} as textual, translated, historical, reception, or theological.`, 'State what the available sources do not establish.'],
      outputs: ['Passage-to-claim map', 'Typed identity or relationship edges', 'Explicit translation and inference limits'],
      refusals: ['The printed boundary or edition cannot be identified.', 'A later commentary is presented as primary wording.', 'Shared imagery is used to assert identity, origin, or continuous worship.'],
      limits: ['A primary text records wording in an edition; it does not by itself establish historical practice.', 'A translation is an attributed interpretation and may differ from another translation.', 'Historical inference and theology remain separately labelled; this guide adjudicates neither metaphysical truth nor sacred worth.'],
    },
    'astrology-infrastructure': {
      inputs: ['Canonical event or observation inputs with units', 'Named time scale, coordinate frame, and convention', 'Versioned ephemeris, kernel, and rule set', 'Uncertainty interval and explicit fallback policy'],
      steps: [`Freeze the input and convention manifest for ${subject}.`, 'Canonicalize units, time, location, frame, and version identifiers.', 'Run the declared calculation, comparison, or prospective protocol.', 'Sweep uncertainty or compare against the frozen baseline where applicable.', 'Emit outputs, refusals, and a deterministic receipt.', 'Keep astronomical arithmetic separate from astrological interpretation.'],
      outputs: ['Canonical input manifest', 'Recomputable result or preregistered evaluation record', 'Digest-bound provenance receipt'],
      refusals: ['A required input, unit, frame, algorithm version, or uncertainty is absent.', 'A convention is selected after seeing the preferred result.', 'Interpretive success is inferred from deterministic arithmetic.'],
      limits: ['Reproducible astronomical arithmetic does not validate astrological interpretation or prediction.', 'No absent number, uncertainty interval, or calculation receipt is invented.', 'High-stakes medical, legal, financial, or safety decisions remain prohibited uses.'],
    },
    'evidence-clearing': {
      inputs: ['Exact claim text and bounded scope', 'Source identity or candidate DOI/URL metadata', 'Exact locator and authorized excerpt when available', 'Rights, access, version, and uncertainty declarations'],
      steps: [`Normalize the claim and source identity for ${subject}.`, 'Verify that the locator identifies content rather than metadata.', 'Map each clause to supporting, conflicting, or missing evidence.', 'Check scope, version relationship, rights, and unsupported inference independently.', 'Emit reason-coded findings and required remediation.', 'Keep preflight, review, canonical release, and licensed retrieval as distinct states.'],
      outputs: ['Digest-bound preflight finding', 'Claim-to-source and locator matrix', 'Reason-coded remediation path'],
      refusals: ['Source content was not inspected at the claimed locator.', 'The source concerns another subject, version, population, or outcome.', 'The requested conclusion exceeds the inspected evidence or rights basis.'],
      limits: ['This is deterministic evidence triage, not factual certification or a verified Evidence Dossier.', 'A DOI, URL, title, or abstract does not prove passage-level support.', 'No confidential submission or private corpus is required for this public guide.'],
    },
    'mathematics-astronomy': {
      inputs: ['Named definition, observable, or target quantity', 'Units, domain, coordinate frame, and assumptions', 'Versioned reference, algorithm, or instrument method', 'Tolerance, uncertainty, and boundary cases'],
      steps: [`State whether ${subject} is a definition, derivation, computation, observation, or inference.`, 'Fix symbols, units, frames, assumptions, and excluded cases.', 'Expose the derivation, measurement chain, or algorithm as ordered steps.', 'Check independent fixtures, controls, or calibration references.', 'Propagate uncertainty and test boundary conditions.', 'Emit a result with provenance and a clear inference limit.'],
      outputs: ['Definition or measurement contract', 'Reproducible derivation, fixture, or observation chain', 'Uncertainty and inference-boundary statement'],
      refusals: ['The source, formula, observable, units, or frame is ambiguous.', 'A numerical output cannot be recomputed from stated inputs.', 'An inferred physical quantity is described as directly observed.'],
      limits: ['A worked example establishes one case, not universal performance.', 'Formal validity does not establish empirical adequacy or implementation correctness.', 'An observation supports only the inference licensed by its calibration and model assumptions.'],
    },
    'cross-domain-synthesis': {
      inputs: ['Exact records and active revisions on both sides', 'Declared bridge type and terminology map', 'Source, locator, rights, and claim scope for each side', 'Transfer rule for units, uncertainty, and prohibited inference'],
      steps: [`Define both sides of ${subject} in their own vocabularies.`, 'Verify each source and revision independently.', 'Classify the bridge as exact, mechanistic, statistical, instrumental, analogical, or strategic.', 'Test whether quantities, assumptions, and uncertainty may transfer.', 'Refuse every unlicensed inference and preserve disagreement.', 'Emit a digest-bound bridge record and retrieval contract.'],
      outputs: ['Typed cross-domain bridge', 'Two-sided source and revision map', 'Transfer and non-transfer rules'],
      refusals: ['Either side lacks inspected, exact-revision evidence.', 'A metaphor or shared term is treated as a mechanism.', 'Units, assumptions, scope, or uncertainty are dropped at the bridge.'],
      limits: ['A bridge organizes relationships and does not raise either side’s evidence maturity.', 'Analogical and strategic links transfer no scientific validity.', 'Machine retrieval requires its own entitlement and exact selectors.'],
    },
  }
  return laneSpecific[candidate.lane]
}

function commercialAction(candidate: Candidate): { label: string; path: string; state: string } {
  if (candidate.commercialAction === 'evidence-preflight') return { label: 'Run the free Evidence Preflight', path: '/tools/evidence-preflight', state: 'available-free' }
  if (candidate.commercialAction === 'provenance-receipt') return { label: 'Inspect provenance receipt infrastructure', path: '/utilities/receipts', state: 'information-only' }
  if (candidate.commercialAction === 'evidence-dossier') return { label: 'Review the Evidence Dossier boundary', path: '/evidence-audit', state: 'information-only' }
  if (candidate.commercialAction === 'licensed-retrieval') return { label: 'Inspect licensed evidence retrieval', path: '/enterprise-mcp-gateway', state: 'information-only' }
  return { label: 'Explore the governing knowledge layer', path: '/knowledge', state: 'information-only' }
}

function evidenceFrameFor(candidate: Candidate): string {
  if (candidate.lane === 'tamil-religion') return 'layered-textual-method-without-passage-finding'
  if (candidate.lane === 'astrology-infrastructure') return 'reproducible-method-without-calculation-or-validity-transfer'
  if (candidate.lane === 'mathematics-astronomy') return 'verification-method-without-proof-or-observation'
  if (candidate.lane === 'cross-domain-synthesis') return 'typed-two-sided-bridge-without-validity-transfer'
  return 'bounded-operational-protocol-without-execution-claim'
}

function methodBoundaryFor(candidate: Candidate): string {
  if (candidate.lane === 'tamil-religion') return 'This guide defines how to answer the question. It does not claim that a named passage, edition, translation, or historical relationship has been inspected for this subject.'
  if (candidate.lane === 'astrology-infrastructure') return 'This guide defines a reproducibility or evaluation contract. It contains no computed chart, prediction, measured outcome, or claim of astrological validity.'
  if (candidate.lane === 'mathematics-astronomy') return 'This guide defines a verification boundary. It contains no new theorem proof, astronomical observation, calibration result, or measured uncertainty.'
  if (candidate.lane === 'cross-domain-synthesis') return 'This guide defines a possible bridge contract. It does not assert that evidence, quantities, mechanisms, or validity transfer between the named domains.'
  if (candidate.lane === 'evidence-clearing') return 'This guide defines a preflight decision procedure. It is not a finding that a source was inspected, a claim was verified, or a dossier was approved.'
  return 'This guide defines a request-control procedure. It is not evidence that an integration executed, a credential was entitled, or a delivery succeeded.'
}

export function buildEpistemicClearingGuide(candidate: Candidate) {
  const subject = subjectOf(candidate)
  const answer = answerFor(candidate)
  const frame = framework(candidate)
  const body = {
    schemaVersion: 'maha-epistemic-clearing-guide/1.0',
    preparedOn: PREPARED_ON,
    candidateId: candidate.candidateId,
    candidateRank: candidate.rank,
    lane: candidate.lane,
    path: candidate.proposedPath,
    searchIntent: cleanQuestion(candidate.searchIntent),
    publicationState: 'prepared-not-deployed',
    canonicalRecordRequired: false,
    releaseBoundary: 'This page is an editorial or operational method over named public materials. It does not alter a canonical evidence record, inherit a scientific release, or report a completed subject-specific result.',
    contentMode: 'bounded-method-guide',
    resultStatus: 'no-subject-specific-result-claimed',
    family: candidate.subcategory.replaceAll(' ', '-').toLowerCase(),
    title: candidate.title,
    summary: `${sentence(lensName(candidate))} guide for ${subject}, with required inputs, ordered checks, refusal conditions, outputs, source roles, and an explicit authority boundary.`,
    question: cleanQuestion(candidate.searchIntent),
    directAnswer: answer,
    evidenceFrame: evidenceFrameFor(candidate),
    methodBoundary: methodBoundaryFor(candidate),
    sourceLinks: laneLinks(candidate),
    requiredInputs: frame.inputs,
    orderedSteps: frame.steps,
    expectedOutputs: frame.outputs,
    refusalConditions: frame.refusals,
    limitations: frame.limits,
    decisionRecord: {
      subject,
      question: cleanQuestion(candidate.searchIntent),
      minimumEvidence: frame.inputs.join('; ') + '.',
      orderedDecision: frame.steps.join(' '),
      passCondition: `Return ${frame.outputs.join(', ').toLowerCase()} only after every required input and ordered check is satisfied.`,
      refusalCondition: frame.refusals.join(' '),
      resultStatus: 'No subject-specific result has been produced by this method guide.',
    },
    questions: [
      { question: cleanQuestion(candidate.searchIntent), answer },
      { question: `What inputs must be fixed for ${subject}?`, answer: frame.inputs.join('; ') + '.' },
      { question: `What should a machine return for ${subject}?`, answer: frame.outputs.join('; ') + '. Every output remains bound to the exact inputs and decision state.' },
      { question: `When must a system refuse ${subject}?`, answer: frame.refusals.join(' ') },
      { question: `What does this guide not establish about ${subject}?`, answer: frame.limits.join(' ') },
    ],
    commercialAction: commercialAction(candidate),
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

export function generateEpistemicClearingBatchTwo(output = OUTPUT) {
  const used = new Set(batchOne.pages.map((page) => page.path))
  const selected = (Object.entries(QUOTAS) as [Lane, number][]).flatMap(([lane, quota]) => {
    const choices = routeMap.candidates.filter((candidate) =>
      candidate.lane === lane
      && !used.has(candidate.proposedPath)
      && candidate.canonicalSlugStatus === 'stable-candidate')
      .slice(0, quota)
    if (choices.length !== quota) throw new Error(`${lane}: expected ${quota} stable candidates, found ${choices.length}.`)
    return choices
  }).sort((left, right) => left.rank - right.rank)

  if (selected.length !== 407) throw new Error(`Expected 407 candidates, found ${selected.length}.`)
  const pages = selected.map(buildEpistemicClearingGuide)
  if (new Set(pages.map((page) => page.path)).size !== pages.length) throw new Error('Batch 2 contains duplicate paths.')

  const artifactBody = {
    schemaVersion: 'maha-epistemic-clearing-batch/1.0',
    preparedOn: PREPARED_ON,
    objective: 'Prepare the remaining 407 finite routes required to reach the 1,500-page planning threshold without a build or deployment.',
    selection: {
      sourceMapDigest: routeMap.provenanceDigest,
      excludesBatchDigest: batchOne.provenanceDigest,
      quotas: QUOTAS,
      stableSlugsOnly: true,
      provisionalPassageUnitsExcluded: 90,
    },
    deploymentGate: {
      state: 'build-withheld',
      lastOperatorAuthorizedStaticPageCount: 993,
      priorPreparedRoutes: 100,
      thisBatchRoutes: 407,
      projectedPreparedSitePages: 1500,
      exactBuildCountMeasured: false,
      instruction: 'The planning threshold is reached, but do not run a Production or Vercel build without new explicit operator approval.',
    },
    counts: {
      total: pages.length,
      boundedQuestions: pages.reduce((sum, page) => sum + page.questions.length, 0),
      byLane: Object.fromEntries(Object.keys(QUOTAS).map((lane) => [lane, pages.filter((page) => page.lane === lane).length])),
      bookConceptPriority: pages.filter((page) => page.sourceLinks.some((link) => link.role === 'conceptual-lens')).length,
    },
    publicationBoundary: 'Prepared routes are code and content only. They are not deployed, observed, indexed, clicked, commercially validated, or canonical scientific releases.',
    pages,
  }

  writeFileSync(output, `${JSON.stringify({ ...artifactBody, provenanceDigest: provenanceDigest(artifactBody) }, null, 2)}\n`)
  console.log(`Prepared ${pages.length} routes and ${artifactBody.counts.boundedQuestions} bounded questions at ${output}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateEpistemicClearingBatchTwo()
}
