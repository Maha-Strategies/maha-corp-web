/**
 * Emits the Tranche 2 remediation artifacts.
 *
 * Deterministic: sorted keys, sorted records, no clock. The generated files
 * carry digests of the Codex-owned Tranche 2 artifacts they were derived from,
 * so a change on that side invalidates this remediation rather than silently
 * outliving it.
 *
 *   node --experimental-strip-types scripts/generate-federation-tranche-two-remediation.ts
 *
 * TRANCHE_2_DIR may point at an alternate review workspace. By default the
 * generator reads the committed Tranche 2 artifacts in this repository so a
 * clean CI checkout regenerates the committed result rather than an
 * environment-dependent fallback.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  assertDeterminations, canonicalJson, isPromotion,
  type Determination, type Inspection,
} from '../lib/federation-tranche-two-remediation.ts'

const TRANCHE_2_DIR = process.env.TRANCHE_2_DIR ?? 'content/federation'
const OUT = 'content/federation'
const OBSERVED = '2026-09-05'
const digest = (body: string) => `sha256:${createHash('sha256').update(body, 'utf8').digest('hex')}`

/* -- what was actually fetched in this pass ------------------------------- */

const INSPECTIONS: Inspection[] = [
  {
    url: 'https://publish.mahastrategies.com/docs/release-manifests',
    observedOn: OBSERVED, httpStatus: 200,
    sections: ['The release contract', 'Access modes', 'Why approval comes first', 'Related documentation'],
    establishes: 'The manifest fields, the three access modes, that metadata-public releases stop resolving when withdrawn, and that approval is an accountable editorial act preceding release.',
    doesNotEstablish: 'Any failure mode other than withdrawal ceasing to resolve, and no procedural workflow.',
  },
  {
    url: 'https://publish.mahastrategies.com/docs/machine-readability',
    observedOn: OBSERVED, httpStatus: 200,
    sections: ['Start with readable public pages', 'Validate the actual payload', 'Use discovery files as supplements', 'Independent corroboration remains separate', 'Related documentation'],
    establishes: 'The canonical definition of machine-readable publishing practice: unique title, description, canonical URL, structured data matching visible content, payload validation as a release blocker, and that discovery files grant no access and guarantee no indexing.',
    doesNotEstablish: 'Any article template, schema listing, or worked example. It is guidance, not a specification.',
  },
  {
    url: 'https://publish.mahastrategies.com/docs/editorial-workflow',
    observedOn: OBSERVED, httpStatus: 200,
    establishes: 'The canonical owner of editorial workflow on the Publish property.',
    doesNotEstablish: 'Nothing relevant is absent; its existence is the finding.',
  },
  {
    url: 'https://publish.mahastrategies.com/docs/release-gates',
    observedOn: OBSERVED, httpStatus: 200,
    establishes: 'The canonical owner of release gating on the Publish property.',
    doesNotEstablish: 'Nothing relevant is absent; its existence is the finding.',
  },
  {
    url: 'https://publish.mahastrategies.com/docs/glossary',
    observedOn: OBSERVED, httpStatus: 200,
    establishes: 'A published glossary for the Publish property. It mentions a query letter once, in its conventional sense.',
    doesNotEstablish: 'It never uses or defines the term "agentic query letter".',
  },
  {
    url: 'https://publish.mahastrategies.com/context-packs/the-maha-principle-v0.1.0.json',
    observedOn: OBSERVED, httpStatus: 200,
    establishes: 'A live, metadata-only machine-readable record served as JSON: a concrete instance rather than a description of one.',
    doesNotEstablish: 'It is one instance and does not generalise to a template.',
  },
  {
    url: 'https://www.mahastrategies.com/pricing',
    observedOn: OBSERVED, httpStatus: 200,
    establishes: 'Current offer terms are public: two assessment tiers at $12,500 and $25,000, a founding-partner exchange at $2,500 limited to the first two signed customers, a named scope covering token and cost measurement and failure-path behaviour, and hard token budgets as a positioning claim.',
    doesNotEstablish: 'Customer outcomes. The offer explicitly excludes any performance or savings guarantee, and excludes production credentials from scope entirely.',
  },
  {
    url: 'https://www.mahastrategies.com/assessments/context-control-evidence-assessment-sample.pdf',
    observedOn: OBSERVED, httpStatus: 200,
    establishes: 'The published assessment sample the offer prices are gated on. Its reachability is what makes the offer terms citable.',
    doesNotEstablish: 'Delivered customer results.',
  },
  {
    url: 'https://publish.mahastrategies.com/agentic-publishing/release-manifest/policy',
    observedOn: OBSERVED, httpStatus: 404,
    establishes: 'The proposed route does not exist, confirming this remediation creates no public route.',
    doesNotEstablish: 'Anything about the candidate’s merits.',
  },
]

/* -- determinations -------------------------------------------------------- */

const OFFER = 'https://www.mahastrategies.com/pricing'
const SAMPLE = 'https://www.mahastrategies.com/assessments/context-control-evidence-assessment-sample.pdf'
const MANIFESTS = 'https://publish.mahastrategies.com/docs/release-manifests'
const READABILITY = 'https://publish.mahastrategies.com/docs/machine-readability'
const WAS_INACCESSIBLE = 'The observed canonical Publish definition route could not be inspected, so its templates and interfaces cannot be checked for semantic or schema agreement.'
const WAS_OWNER_UNINSPECTED = 'JATS and Schema.org establish external machine-readable article vocabularies, but the existing Publish owner definition could not be inspected; a parallel definition or template would risk semantic conflict.'
const WAS_COMMERCIAL = 'The inspected sources establish implementation and control boundaries, but not current offer terms, availability, price, or customer outcomes.'
const WAS_RAWLS = 'Rawls supplies a primary genealogy for public reason, but no inspected Mayone manuscript passage establishes that the term is part of Mayone’s authorial system or how his use differs.'
const WAS_NO_AUTHORITY = 'No inspected authority defines an agentic query letter; the closest editorial source only governs conventional submission responsibilities.'

const NO_OUTCOMES = 'Any customer outcome, result, saving, or delivered benefit. The offer excludes performance and savings guarantees, and the founding-partner tier is still open, so no outcome record exists.'

const DETERMINATIONS: Determination[] = [
  /* --- blocked on "could not be inspected": the routes answer 200 --------- */
  {
    candidateId: 'cand_b0625906e210bafb279b7669',
    proposedUrl: 'https://publish.mahastrategies.com/agentic-publishing/machine-readable-article/template',
    originalDisposition: 'blocked', originalReason: WAS_OWNER_UNINSPECTED,
    outcome: 'promote-with-narrowed-scope',
    restsOn: [READABILITY],
    narrowedScope: {
      mayState: [
        'A field template for a machine-readable article, each field carrying the Schema.org or JATS term it derives from.',
        'That the canonical definition of the practice is /docs/machine-readability, linked as parent.',
        'That a payload validating is a release condition, per the canonical.',
      ],
      mayNotState: [
        'A definition of machine-readable publishing. That is the canonical owner’s, and duplicating it is what got the definition candidate rejected.',
        'That using the template causes indexing, citation, or summarisation.',
      ],
    },
    finding: 'The canonical was reachable on re-inspection and contains no template: it is guidance across four sections, none of which enumerates fields. A template is therefore additive rather than parallel, provided it defers to the canonical for the definition.',
  },
  {
    candidateId: 'cand_c8b98032f22fc91b51dac6be',
    proposedUrl: 'https://publish.mahastrategies.com/agentic-publishing/machine-readable-article/example',
    originalDisposition: 'blocked', originalReason: WAS_OWNER_UNINSPECTED,
    outcome: 'promote-with-narrowed-scope',
    restsOn: [READABILITY, 'https://publish.mahastrategies.com/context-packs/the-maha-principle-v0.1.0.json'],
    narrowedScope: {
      mayState: [
        'A walkthrough of the live Context Pack JSON as a worked example, quoting fields that are already public.',
        'Which parts of that record are metadata and which are deliberately excluded.',
      ],
      mayNotState: [
        'That the example is a specification or a template.',
        'That metadata being public licenses reproduction of the work it describes.',
      ],
    },
    finding: 'A live metadata-only record is served and was fetched in this pass. An example grounded in an actually-published artifact is stronger evidence than the block assumed, and it does not restate the canonical definition.',
  },
  {
    candidateId: 'cand_5322e19e5c67b1aae32124b0',
    proposedUrl: 'https://publish.mahastrategies.com/agentic-publishing/release-manifest/failure-mode',
    originalDisposition: 'blocked', originalReason: WAS_INACCESSIBLE,
    outcome: 'promote-with-narrowed-scope',
    restsOn: [MANIFESTS],
    narrowedScope: {
      mayState: [
        'The one failure mode the canonical does establish: a withdrawn metadata-public release must stop resolving.',
        'That failing closed is the required direction when a release cannot be verified.',
      ],
      mayNotState: [
        'Any further failure mode. The canonical establishes exactly one, and a catalogue of failure modes would be authored rather than sourced.',
      ],
    },
    finding: 'The canonical answered 200 and states that metadata-public releases "should stop resolving when withdrawn". That supports a page about that failure mode and nothing wider. Promoted at one-mode scope rather than as proposed.',
  },
  {
    candidateId: 'cand_edda69105a975d84215ad8ab',
    proposedUrl: 'https://publish.mahastrategies.com/agentic-publishing/release-manifest/policy',
    originalDisposition: 'blocked', originalReason: WAS_INACCESSIBLE,
    outcome: 'hold-with-corrected-reason',
    holdGround: 'canonical-owner-already-covers-this-facet',
    restsOn: [MANIFESTS],
    canonicalOwner: MANIFESTS,
    finding: 'The route was reachable, so the recorded reason is wrong. Reading it produces a better one: "Access modes" and "Why approval comes first" already are the release-manifest policy. A policy page would restate the canonical under a second URL, which is the failure that rejected the definition candidate.',
  },
  {
    candidateId: 'cand_f805090b4bbcaa508d1215a0',
    proposedUrl: 'https://publish.mahastrategies.com/agentic-publishing/release-manifest/workflow',
    originalDisposition: 'blocked', originalReason: WAS_INACCESSIBLE,
    outcome: 'hold-with-corrected-reason',
    holdGround: 'canonical-owner-already-covers-this-facet',
    restsOn: [MANIFESTS, 'https://publish.mahastrategies.com/docs/editorial-workflow', 'https://publish.mahastrategies.com/docs/release-gates'],
    canonicalOwner: 'https://publish.mahastrategies.com/docs/editorial-workflow',
    finding: 'Reachable, so the recorded reason is wrong. Two canonical owners already exist for this facet — /docs/editorial-workflow and /docs/release-gates — and both answered 200. A release-manifest workflow page would compete with them.',
  },

  /* --- commercialization: offer terms exist, but cover only some topics --- */
  {
    candidateId: 'cand_41ee6b7080d2c8416e30adaf',
    proposedUrl: 'https://www.mahastrategies.com/clearing/agent-governance/context-budgeting/commercialization',
    originalDisposition: 'revise', originalReason: WAS_COMMERCIAL,
    outcome: 'promote-with-narrowed-scope',
    restsOn: [OFFER, SAMPLE],
    narrowedScope: {
      mayState: [
        'That context budgeting is commercially offered, naming the two assessment tiers and their published prices.',
        'That the declared token budget is enforced rather than advised, which is a published positioning claim.',
        'That token and cost measurement is inside the assessment scope.',
      ],
      mayNotState: [NO_OUTCOMES, 'That a budget produces a saving. Nothing is promised before measurement.'],
    },
    finding: 'The blanket reason is wrong here: current offer terms, availability and price are all public and were fetched in this pass, and the price gate’s four required artifacts are present. Hard budgets and token and cost measurement are named in the offer, so this topic is commercially established.',
  },
  {
    candidateId: 'cand_f6409ea20cfc51496e3a61d8',
    proposedUrl: 'https://www.mahastrategies.com/clearing/agent-governance/failure-recovery/commercialization',
    originalDisposition: 'revise', originalReason: WAS_COMMERCIAL,
    outcome: 'promote-with-narrowed-scope',
    restsOn: [OFFER, SAMPLE],
    narrowedScope: {
      mayState: [
        'That failure-path behaviour is measured within the published assessment scope, at the published prices.',
      ],
      mayNotState: [
        'That failures are recovered from. The offer measures failure-path behaviour; it does not sell recovery, and the page title must not promise it.',
        NO_OUTCOMES,
      ],
    },
    finding: 'Offer terms are public and name failure-path behaviour in scope. The gap between "measured" and "recovered" is the whole narrowing: promoted as a measurement offering, not a recovery offering.',
  },
  {
    candidateId: 'cand_757660327e81854886c9df90',
    proposedUrl: 'https://www.mahastrategies.com/clearing/agent-governance/metered-evidence-retrieval/commercialization',
    originalDisposition: 'revise', originalReason: WAS_COMMERCIAL,
    outcome: 'hold-with-corrected-reason',
    holdGround: 'offer-terms-do-not-cover-this-topic',
    restsOn: [OFFER],
    finding: 'Offer terms exist and are public, so the recorded reason is wrong. The correct one is narrower: the assessment measures token and cost, but no published term meters evidence retrieval or prices it per retrieval. Metering as a commercial model is not established by the offer that exists.',
  },
  {
    candidateId: 'cand_22d9ff199c2b10c0dabf2206',
    proposedUrl: 'https://www.mahastrategies.com/clearing/agent-governance/tool-authorization/commercialization',
    originalDisposition: 'revise', originalReason: WAS_COMMERCIAL,
    outcome: 'hold-with-corrected-reason',
    holdGround: 'offer-terms-do-not-cover-this-topic',
    restsOn: [OFFER],
    finding: 'Offer terms exist and are public, so the recorded reason is wrong. Corrected: the published scope covers workload comparison, token and cost, provenance, latency and failure paths. Tool authorization appears nowhere in it.',
  },
  {
    candidateId: 'cand_0a1d37ad506fe9b0fdf91a0e',
    proposedUrl: 'https://www.mahastrategies.com/clearing/agent-governance/credential-rotation/commercialization',
    originalDisposition: 'revise', originalReason: WAS_COMMERCIAL,
    outcome: 'hold-with-corrected-reason',
    holdGround: 'offer-terms-exclude-this-topic',
    restsOn: [OFFER],
    finding: 'The strongest hold of the five, and for the opposite reason to the one recorded. The offer does not merely omit credentials: it excludes them, requiring a sanitized workload with no production credentials. A commercialization page for credential rotation would contradict the published scope of the only offer that exists.',
  },

  /* --- reasons that survived checking ------------------------------------- */
  {
    candidateId: 'cand_31b7dabe923fc44a99337460',
    proposedUrl: 'https://www.mayonemaharajan.com/concepts/public-reason/definition',
    originalDisposition: 'revise', originalReason: WAS_RAWLS,
    outcome: 'hold-reason-confirmed',
    holdGround: 'no-manuscript-passage-establishes-authorial-use',
    restsOn: [READABILITY],
    finding: 'Searched the manuscript and library content available in these repositories. "Public reason" occurs only inside the federation candidate map itself — that is, in the proposal for the page, and nowhere in any authored source. The recorded reason holds exactly as written.',
  },
  {
    candidateId: 'cand_8fce42b97cdeb9ab2446d8aa',
    proposedUrl: 'https://www.mayonemaharajan.com/concepts/public-reason/relationship',
    originalDisposition: 'revise', originalReason: WAS_RAWLS,
    outcome: 'hold-reason-confirmed',
    holdGround: 'no-manuscript-passage-establishes-authorial-use',
    restsOn: [READABILITY],
    finding: 'Same search, same result. A relationship page is strictly harder than the definition it would depend on, so it cannot become ready before the definition does.',
  },
  {
    candidateId: 'cand_c6513de286daaca52d677bd9',
    proposedUrl: 'https://publish.mahastrategies.com/agentic-publishing/agentic-query-letter/machine-interface',
    originalDisposition: 'revise', originalReason: WAS_NO_AUTHORITY,
    outcome: 'hold-reason-confirmed',
    holdGround: 'no-inspected-authority-defines-the-term',
    restsOn: ['https://publish.mahastrategies.com/docs/glossary'],
    finding: 'The property publishes a glossary, and it was fetched in this pass. It uses "query letter" once, conventionally, and never defines "agentic query letter". The term has no published definition to build a machine interface on.',
  },
  {
    candidateId: 'cand_ed31a1988d83179a77beec49',
    proposedUrl: 'https://publish.mahastrategies.com/agentic-publishing/agentic-query-letter/template',
    originalDisposition: 'revise', originalReason: WAS_NO_AUTHORITY,
    outcome: 'hold-reason-confirmed',
    holdGround: 'no-inspected-authority-defines-the-term',
    restsOn: ['https://publish.mahastrategies.com/docs/glossary'],
    finding: 'Same glossary, same absence. A template for an undefined artifact would be the definition, arriving without saying so.',
  },
  {
    candidateId: 'cand_48485c2639eca0b2fb4d9852',
    proposedUrl: 'https://publish.mahastrategies.com/agentic-publishing/machine-readable-article/definition',
    originalDisposition: 'reject-as-duplicative',
    originalReason: 'The existing https://publish.mahastrategies.com/docs/machine-readability route is the canonical definition; publishing another generic definition would split one concept across two doorways.',
    outcome: 'reject-duplicative',
    holdGround: 'canonical-owner-already-covers-this-facet',
    restsOn: [READABILITY],
    canonicalOwner: READABILITY,
    finding: 'Re-inspected and upheld. The canonical answered 200 and does define the practice across four sections. The rejection stands, and re-inspection strengthens rather than weakens it.',
  },
]

/* -- emit ------------------------------------------------------------------ */

assertDeterminations(DETERMINATIONS, INSPECTIONS)

const upstream: Record<string, string> = {}
for (const name of ['readiness', 'decisions', 'evidence-packets', 'cohort']) {
  const path = join(TRANCHE_2_DIR, `federation-tranche-2-${name}-v1.json`)
  upstream[name] = existsSync(path) ? digest(readFileSync(path, 'utf8')) : 'not-available-at-generation-time'
}

const sorted = [...DETERMINATIONS].sort((a, b) => a.candidateId.localeCompare(b.candidateId))
const tally = (keys: string[]) => Object.fromEntries(
  Object.entries(keys.reduce<Record<string, number>>((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 }), {}))
    .sort(([a], [b]) => a.localeCompare(b)))

const promotions = sorted.filter((d) => isPromotion(d.outcome))

const inspectionArtifact = {
  schemaVersion: 'maha-federation-tranche-2-remediation-inspection/1.0',
  observedOn: OBSERVED,
  purpose: 'Sources fetched while reassessing the fifteen non-ready Tranche 2 candidates. Recorded with status codes because "could not be inspected" is the claim under test.',
  upstreamTrancheTwoDigests: upstream,
  inspections: [...INSPECTIONS].sort((a, b) => a.url.localeCompare(b.url)),
}

const determinationArtifact = {
  schemaVersion: 'maha-federation-tranche-2-remediation-determinations/1.0',
  observedOn: OBSERVED,
  scope: 'The fifteen Tranche 2 candidates that did not reach evidence-ready. The other 85 are untouched.',
  upstreamTrancheTwoDigests: upstream,
  boundary: 'Proposals for a later, separately-approved implementation pass. No public route is created, no Tranche 1 or Tranche 2 artifact is modified, and a promotion is a statement about evidence rather than an instruction to publish.',
  counts: {
    reassessed: sorted.length,
    promotions: promotions.length,
    byOutcome: tally(sorted.map((d) => d.outcome)),
    byHoldGround: tally(sorted.filter((d) => d.holdGround).map((d) => d.holdGround as string)),
    originalReasonsFoundWrong: sorted.filter((d) => d.outcome === 'hold-with-corrected-reason' || isPromotion(d.outcome)).length,
  },
  projectedPartitionIfAccepted: {
    note: 'Indicative only. Nothing is promoted until an operator accepts these determinations.',
    evidenceReady: 85 + promotions.length,
    remainingNonReady: sorted.length - promotions.length,
  },
  determinations: sorted,
}

for (const [name, body] of [
  ['inspection', inspectionArtifact],
  ['determinations', determinationArtifact],
] as const) {
  const withDigest = { ...body, provenanceDigest: digest(canonicalJson(body)) }
  writeFileSync(join(OUT, `federation-tranche-2-remediation-${name}-v1.json`), `${JSON.stringify(withDigest, null, 2)}\n`)
}

console.log(`reassessed ${sorted.length}`)
for (const [outcome, n] of Object.entries(determinationArtifact.counts.byOutcome)) console.log(`  ${String(n).padStart(2)}  ${outcome}`)
console.log(`original reason found wrong in ${determinationArtifact.counts.originalReasonsFoundWrong} of ${sorted.length}`)
console.log(`projected evidence-ready if accepted: ${determinationArtifact.projectedPartitionIfAccepted.evidenceReady}`)
