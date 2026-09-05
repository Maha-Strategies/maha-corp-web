import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import routeMap from '../content/scaling/epistemic-clearing-route-candidates-v1.json' with { type: 'json' }
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'

type Candidate = (typeof routeMap.candidates)[number]
type Link = { title: string; path: string; role: 'operational-source' | 'inspected-source-projection' | 'conceptual-lens' | 'related-guide' }

const ROOT = resolve(import.meta.dirname, '..')
const OUTPUT = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(ROOT, 'content/scaling/epistemic-clearing-batch-1.json')

const PREPARED_ON = '2026-09-05'
const BUILD_THRESHOLD = 1500

const humanize = (value: string): string => value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const sentence = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1)
const withArticle = (value: string): string => `${/^[aeiou]/i.test(value) ? 'an' : 'a'} ${value}`
const cleanQuestion = (value: string): string => value.replace(/\ba ([aeiou])/gi, 'an $1')

const bookRoutes: Record<string, { title: string; path: string }> = {
  'the-maha-principle': { title: 'The Maha Principle — navigating complexity', path: '/books/the-maha-principle/read/navigating-complexity' },
  'the-synthetic-self': { title: 'The Synthetic Self — the alignment problem', path: '/books/the-synthetic-self/read/the-alignment-problem' },
  'the-cosmic-recursion': { title: 'The Cosmic Recursion — the boundary that holds', path: '/books/the-cosmic-recursion/read/the-boundary-that-holds' },
  'the-orbital-mind': { title: 'The Orbital Mind — agency and boundary', path: '/books/the-orbital-mind/read/agency-and-boundary' },
  'the-volcanic-engine': { title: 'The Volcanic Engine — two warnings', path: '/books/the-volcanic-engine/read/two-warnings' },
}

const machineSubjects: Record<string, { label: string; asset: string; identity: string; specificBoundary: string; source: Link }> = {
  'enterprise-mcp-gateway': { label: 'enterprise MCP gateway', asset: 'a governed tool invocation', identity: 'tenant, agent, credential, tool, and endpoint', specificBoundary: 'A manifest entry is discovery, not authority to invoke a tool.', source: { title: 'Enterprise MCP gateway', path: '/enterprise-mcp-gateway', role: 'operational-source' } },
  'entitlement-service': { label: 'entitlement service', asset: 'an entitlement decision', identity: 'principal, offer, grant, scope, and expiry', specificBoundary: 'Eligibility must be recomputed from the active grant rather than copied from a prior response.', source: { title: 'MCP gateway contract', path: '/mcp-gateway-contract.json', role: 'operational-source' } },
  'carp-seller': { label: 'CARP seller', asset: 'a seller-side enquiry or delivery', identity: 'seller role, customer role, endpoint, offer, and lifecycle', specificBoundary: 'An authenticated enquiry is not a purchase, settlement, reservation, or escrow instruction.', source: { title: 'CARP seller profile', path: '/.well-known/carp/seller.json', role: 'operational-source' } },
  'release-registry-reader': { label: 'release-registry reader', asset: 'an exact released revision', identity: 'record, revision, release, status, and retrieval instant', specificBoundary: 'A historical or superseded release must never be returned as the active revision.', source: { title: 'Epistemic release registry', path: '/knowledge/epistemic-system/releases/registry.json', role: 'operational-source' } },
  'runtime-witness-receipt': { label: 'runtime-witness receipt client', asset: 'a witnessed execution receipt', identity: 'job, adapter, environment, input, output, and receipt digest', specificBoundary: 'A receipt establishes recorded execution metadata, not scientific correctness.', source: { title: 'Computational witness API', path: '/api/docs/openapi', role: 'operational-source' } },
  'batch-api-client': { label: 'batch API client', asset: 'a bounded batch request', identity: 'tenant, credential, batch, item, and request digest', specificBoundary: 'One authorized item cannot lend authority or quota to another item in the same batch.', source: { title: 'Developer infrastructure', path: '/developers', role: 'operational-source' } },
  'calculation-receipt-retrieval': { label: 'calculation-receipt retrieval client', asset: 'a deterministic calculation receipt', identity: 'kernel version, operation, inputs, units, assumptions, and digest', specificBoundary: 'A receipt cannot be manufactured when the calculation or its inputs are absent.', source: { title: 'Evidence Dossier workflow examples', path: '/knowledge/evidence-workflows', role: 'operational-source' } },
  'claude-desktop-client': { label: 'Claude Desktop client', asset: 'a local MCP tool request', identity: 'local client, configured server, credential scope, tool, and request', specificBoundary: 'Client configuration does not confer permission beyond the server-side entitlement.', source: { title: 'MCP manifest', path: '/mcp.json', role: 'operational-source' } },
  'cursor-client': { label: 'Cursor client', asset: 'an editor-originated MCP request', identity: 'workspace, client, server, credential, tool, and request', specificBoundary: 'Workspace proximity does not authorize source disclosure or filesystem mutation.', source: { title: 'MCP manifest', path: '/mcp.json', role: 'operational-source' } },
  'custom-enterprise-agent': { label: 'custom enterprise agent', asset: 'an enterprise-agent tool request', identity: 'tenant, agent deployment, principal, tool, endpoint, and policy', specificBoundary: 'A custom integration must not become a path around the same controls applied to standard clients.', source: { title: 'Agent infrastructure compatibility pack', path: '/agent-infrastructure-compatibility-pack', role: 'operational-source' } },
  'docker-job-agent': { label: 'Docker job agent', asset: 'a containerized job request', identity: 'image digest, job, principal, input, network policy, and runtime receipt', specificBoundary: 'An image tag is mutable and cannot substitute for the executed image digest.', source: { title: 'Computational witness API', path: '/api/docs/openapi', role: 'operational-source' } },
  'evidence-dossier-retrieval': { label: 'Evidence Dossier retrieval client', asset: 'a licensed Evidence Dossier', identity: 'principal, license grant, dossier, package digest, and delivery', specificBoundary: 'A licence permits retrieval of one released package; it does not upgrade its assurance.', source: { title: 'Evidence Audit', path: '/evidence-audit', role: 'operational-source' } },
  'offline-verifier': { label: 'offline verifier', asset: 'a locally verified evidence package', identity: 'verifier version, package, manifest, file set, and expected digest', specificBoundary: 'Offline verification proves package integrity only to the extent encoded by the verifier contract.', source: { title: 'Evidence workflow examples', path: '/knowledge/evidence-workflows', role: 'operational-source' } },
  'qiskit-job-agent': { label: 'Qiskit job agent', asset: 'a witnessed quantum job', identity: 'backend, circuit, transpiler, seed, environment, result, and receipt', specificBoundary: 'A witnessed run does not imply hardware advantage, reproducibility on another backend, or physical correctness.', source: { title: 'Computational witness API', path: '/api/docs/openapi', role: 'operational-source' } },
  'slurm-job-agent': { label: 'SLURM job agent', asset: 'a scheduled HPC job', identity: 'cluster, allocation, job, executable, environment, inputs, and receipt', specificBoundary: 'Scheduler acceptance is not evidence that the intended binary or inputs executed.', source: { title: 'Computational witness API', path: '/api/docs/openapi', role: 'operational-source' } },
  'webhook-consumer': { label: 'webhook consumer', asset: 'a signed lifecycle event', identity: 'provider, endpoint, event, object, signature, and delivery attempt', specificBoundary: 'Delivery success and business-state transition are separate facts, and duplicates must be idempotent.', source: { title: 'OpenAPI contract', path: '/api/docs/openapi', role: 'operational-source' } },
  'cabezon-buyer': { label: 'CABEZON buyer', asset: 'a buyer-side enquiry and licensed delivery', identity: 'buyer, seller, endpoint, offer, grant, delivery, and acknowledgement', specificBoundary: 'This guide does not authorize payment, escrow, settlement, or a broader CABEZON transaction.', source: { title: 'Agent offer catalog', path: '/agent-offers.json', role: 'operational-source' } },
}

const machineLenses = {
  'bounded-execution': {
    title: 'Bounded execution',
    answer: (subject: string, asset: string) => `For ${subject}, bind ${asset} to an authenticated identity, exact allowlist, request digest, quota, deadline, and endpoint before execution. Refuse the call if any binding is missing, stale, substituted, or broader than the grant.`,
    inputs: ['Authenticated principal and credential fingerprint', 'Exact tool and endpoint selector', 'Active grant with scope and expiry', 'Request digest, quota ceiling, and deadline'],
    steps: ['Resolve the credential to one active principal.', 'Match the requested tool and endpoint to the grant.', 'Reserve quota against the replay-safe request identifier.', 'Execute only the frozen selector inside its time and resource bounds.', 'Record outcome, consumed quota, and an immutable receipt.'],
    outputs: ['Allow or refuse decision with reason code', 'Bounded execution result or no result', 'Digest-bound execution receipt'],
    refusals: ['Selector or endpoint differs from the authorized value.', 'Grant is absent, expired, revoked, or already exhausted.', 'The same request identifier arrives with different content.'],
  },
  'entitlement-decision': {
    title: 'Entitlement decision',
    answer: (subject: string, asset: string) => `For ${subject}, decide entitlement to ${asset} from the active principal, exact offer or resource, granted scope, expiry, revocation state, and remaining quota. Discovery, prior access, or possession of an identifier is never sufficient.`,
    inputs: ['Authenticated principal', 'Exact offer or resource identifier', 'Active grant and policy version', 'Expiry, revocation, and quota state'],
    steps: ['Resolve identity without trusting caller-supplied ownership.', 'Load the exact grant and current policy.', 'Match resource, operation, audience, and endpoint.', 'Check time, revocation, and quota atomically.', 'Return a bounded decision without exposing credential material.'],
    outputs: ['Entitled or refused state', 'Stable refusal code', 'Decision fingerprint and policy version'],
    refusals: ['A nearby offer or predecessor revision is substituted.', 'Identity and grant belong to different principals.', 'Policy or grant cannot be read at decision time.'],
  },
  'receipt-and-acknowledgement': {
    title: 'Receipt and acknowledgement',
    answer: (subject: string, asset: string) => `For ${subject}, receipt ${asset} with the exact subject, package or result digest, delivery endpoint, lifecycle identifier, and delivery instant. Accept acknowledgement only for that same digest and make exact replays idempotent.`,
    inputs: ['Lifecycle and request identifiers', 'Delivered artifact or result digest', 'Bound destination endpoint', 'Recipient identity and acknowledgement policy'],
    steps: ['Verify delivery follows an authorized decision.', 'Bind the receipt to the exact artifact and endpoint.', 'Persist the append-only delivery state.', 'Accept acknowledgement only from the bound recipient.', 'Return the original acknowledgement on exact replay.'],
    outputs: ['Delivery receipt', 'Acknowledgement or refusal', 'Append-only lifecycle state'],
    refusals: ['Acknowledgement names another artifact or lifecycle.', 'Destination endpoint changed after authorization.', 'A duplicate identifier carries different content.'],
  },
  'identity-binding': {
    title: 'Identity binding',
    answer: (subject: string, asset: string) => `For ${subject}, bind ${asset} to a verified principal, credential fingerprint, tenant or workspace, endpoint, and policy audience. Recompute the binding at use time rather than trusting a display name or caller assertion.`,
    inputs: ['Principal and tenant identifiers', 'Credential fingerprint and issuer', 'Endpoint identity', 'Audience and policy version'],
    steps: ['Authenticate the credential through its issuer.', 'Resolve the principal and tenant relationship.', 'Verify endpoint ownership or pinning.', 'Bind the audience and requested operation.', 'Emit a non-secret identity-binding fingerprint.'],
    outputs: ['Bound identity tuple', 'Non-reversible fingerprint', 'Refusal reason when any edge is unproven'],
    refusals: ['Display name substitutes for a verified identifier.', 'Credential, tenant, and endpoint do not share one authority chain.', 'The operation targets an audience outside the credential scope.'],
  },
  'quota-and-metering': {
    title: 'Quota and metering',
    answer: (subject: string, asset: string) => `For ${subject}, meter ${asset} against one authenticated principal and one policy version using an atomic reservation, a declared unit, and a replay-safe request identifier. Charge or consume once; exact retries return the original result.`,
    inputs: ['Principal and active plan', 'Metered operation and declared unit', 'Current allowance and reset boundary', 'Replay-safe request identifier'],
    steps: ['Resolve the plan and unit before work begins.', 'Reserve the maximum bounded amount atomically.', 'Perform only the metered operation.', 'Commit actual consumption or release the reservation.', 'Return usage and remaining allowance without customer content.'],
    outputs: ['Usage record', 'Remaining quota', 'Idempotent response for exact replay'],
    refusals: ['The unit or price is not declared before execution.', 'A duplicate request would consume twice.', 'Quota state is unavailable or inconsistent.'],
  },
} as const

const evidenceTopics: Record<string, { label: string; object: string; boundary: string }> = {
  'agent-provenance': { label: 'agent provenance', object: 'an agent event, its actor, tool, input commitment, output commitment, and runtime receipt', boundary: 'Provenance records what was bound and observed; it does not establish that the agent was correct.' },
  'doi-version-relationship': { label: 'DOI version relationships', object: 'the DOI, publisher record, preprint or manuscript, version of record, correction, and access copy', boundary: 'A DOI identifies a work or version according to its registration; it does not prove that every hosted copy is textually identical.' },
  'machine-generated-claim': { label: 'machine-generated claims', object: 'the generated claim, model and prompt commitments, cited source, locator, and human review state', boundary: 'A model citation is a lead until the cited passage is inspected and shown to carry the claim.' },
  'formal-proof': { label: 'formal proofs', object: 'the theorem statement, assumptions, definitions, prover version, dependencies, and checked artifact', boundary: 'A checked theorem proves the formal statement under its assumptions, not that the model describes nature.' },
  'government-report-version': { label: 'government report versions', object: 'agency, report number, title, issue date, revision, stable host, and exact file digest', boundary: 'Government authorship is an authority attribute, not a guarantee that a claim is current or universally applicable.' },
  'preprint-to-version-of-record-transition': { label: 'preprint-to-version-of-record transitions', object: 'preprint version, accepted manuscript, version of record, dates, identifiers, and substantive differences', boundary: 'A later version does not silently validate claims bound to an earlier text; the relationship must be recorded explicitly.' },
  'code-and-data-version': { label: 'code and data versions', object: 'repository, commit, release, dataset version, environment, licence, and file digests', boundary: 'Version identity supports reproducibility; it does not show that the code is correct or the data are representative.' },
}

const evidenceLenses = {
  'source-identity': { title: 'Source identity', answer: 'Establish identity from authoritative identifiers and the inspected object itself; keep title, author or organization, version, date, host, and digest as separate fields.', inputs: ['Candidate source URL or identifier', 'Observed title and responsible entity', 'Version and issue date', 'Stable locator or file digest'], steps: ['Resolve the identifier at an authoritative registry or host.', 'Compare registry metadata with the opened object.', 'Record version relationships without collapsing them.', 'Fingerprint the exact inspected object.', 'Refuse identity when the observed object contradicts the metadata.'], outputs: ['Source identity record', 'Version-relationship classification', 'Mismatch or unresolved status'], refusals: ['Only a search-result snippet was seen.', 'The opened object has another title or subject.', 'A mutable landing page is treated as a frozen version.'] },
  'locator-sufficiency': { title: 'Locator sufficiency', answer: 'A locator is sufficient only when another reader can reach the exact passage, figure, table, theorem, or record that carries the bounded claim in the identified version.', inputs: ['Identified source and version', 'Bounded claim', 'Section, page, figure, table, or theorem marker', 'Access and rights basis'], steps: ['Open the identified version.', 'Navigate using the proposed locator.', 'Confirm the located unit contains the supporting passage.', 'Record the smallest stable addressable unit.', 'Test the locator independently from the claim summary.'], outputs: ['Exact locator', 'Passage fingerprint', 'Locator-completeness verdict'], refusals: ['The locator names only a homepage or abstract for a section claim.', 'Page numbering belongs to another version.', 'The passage can be found only by an undocumented text search.'] },
  'conflict-and-uncertainty': { title: 'Conflict and uncertainty', answer: 'Record conflicting evidence as separate, versioned propositions with their scopes and uncertainty; do not average disagreement into a confident sentence or choose a preferred source silently.', inputs: ['Claim and scope', 'Each conflicting source and locator', 'Version and publication relationship', 'Declared uncertainty or unresolved question'], steps: ['Normalize the propositions without erasing scope.', 'Inspect each cited passage independently.', 'Classify direct contradiction, scope difference, or version change.', 'Preserve uncertainty and missing evidence.', 'State what evidence could resolve the conflict.'], outputs: ['Typed conflict record', 'Scope comparison', 'Unresolved-evidence requirement'], refusals: ['One side has not been inspected.', 'Different populations or definitions are called contradictions.', 'A later source silently overwrites historical evidence.'] },
} as const

const tamilSelections = [
  'methods/historical-inference-labelling', 'methods/manuscript-and-printed-edition-authority', 'methods/printed-unit-boundary-verification', 'methods/edition-identity-and-version-control', 'methods/commentary-attribution', 'methods/cross-century-reception-mapping', 'methods/divine-name-disambiguation', 'methods/machine-answers-from-layered-textual-evidence', 'methods/primary-text-and-translation-separation', 'methods/theological-claim-separation',
  'reception/kannan-in-alvar-reception', 'reception/mayon-to-mayavan', 'reception/mayon-to-tirumal', 'reception/mullai-imagery-in-later-bhakti', 'reception/nappinnai-in-later-vaishnava-reception', 'reception/narayana-in-tiruvaymoli', 'reception/paripatal-tirumal-in-later-reception', 'reception/sacred-hill-to-temple-localization', 'reception/sangam-landscape-grammar-in-devotional-poetry', 'reception/tamil-epithets-in-sanskritic-identification',
  'divine-names/mayon', 'divine-names/tirumal', 'divine-names/kannan', 'divine-names/narayana', 'divine-names/mayavan', 'divine-names/mal', 'divine-names/murukan', 'divine-names/ceyon', 'divine-names/nappinnai', 'divine-names/korravai',
] as const

const tamilFocus: Record<string, { answer: string; boundary: string; links: Link[] }> = {
  'historical-inference-labelling': { answer: 'Label a historical inference only after the primary passage, translation, date or range, and inferential bridge are separately visible. The answer must remain weaker than the evidence from which it is drawn.', boundary: 'Similarity, sequence, or later identification does not by itself prove origin, continuity, or borrowing.', links: [{ title: 'Textual authority', path: '/knowledge/religion/textual-authority', role: 'inspected-source-projection' }] },
  'manuscript-and-printed-edition-authority': { answer: 'Name the manuscript or printed edition actually used, its editor or publisher, date, unit boundaries, and any relationship to another witness. Do not let a convenient web transcription become the unnamed authority.', boundary: 'A readable edition is not automatically the earliest, best, or only witness.', links: [{ title: 'Source text and translation', path: '/knowledge/religion/comparisons/source-text-and-translation', role: 'inspected-source-projection' }] },
  'printed-unit-boundary-verification': { answer: 'Verify the beginning and end of the printed unit in the named edition before assigning a route, quotation, or question to it. A search hit inside a poem does not establish the poem or pasuram boundary.', boundary: 'Line proximity cannot substitute for an inspected printed-unit boundary.', links: [{ title: 'Tamil source atlas', path: '/knowledge/religion/tamil-source-atlas', role: 'inspected-source-projection' }] },
  'edition-identity-and-version-control': { answer: 'Keep edition identity, transcription, translation, correction state, and access copy as distinct version fields. Bind every quotation and answer to the version actually inspected.', boundary: 'Two files carrying the same work title are not presumed textually identical.', links: [{ title: 'Tamil source atlas registry', path: '/knowledge/religion/tamil-source-atlas/registry', role: 'inspected-source-projection' }] },
  'commentary-attribution': { answer: 'Attribute commentary to its named commentator, edition, period, and passage rather than presenting it as words of the primary text. Multiple commentaries remain parallel witnesses when they disagree.', boundary: 'Later commentary can document reception but cannot be silently projected backward into the primary text.', links: [{ title: 'Primary text and later commentary', path: '/knowledge/religion/mayon/primary-text-versus-later-commentary', role: 'inspected-source-projection' }] },
  'cross-century-reception-mapping': { answer: 'Map reception as dated, source-specific edges: earlier passage, later passage, shared name or image, and an explicitly graded relationship. Preserve gaps instead of drawing an unbroken lineage.', boundary: 'A later reuse of a name does not prove unchanged identity, doctrine, or ritual across centuries.', links: [{ title: 'Māyōṉ and later Āḻvār reception', path: '/knowledge/religion/mayon/mayon-and-alvar-reception', role: 'inspected-source-projection' }] },
  'divine-name-disambiguation': { answer: 'Treat each divine name as a form found in a particular passage and language before grouping identities. Record textual equation, translation choice, attributed commentary, and historical inference as different edge types.', boundary: 'Shared attributes or a familiar translation do not by themselves establish identity.', links: [{ title: 'Māyōṉ identity map', path: '/knowledge/religion/mayon/mayon-vishnu-and-krishna', role: 'inspected-source-projection' }] },
  'machine-answers-from-layered-textual-evidence': { answer: 'A machine answer should emit the primary-text observation first, then translation, commentary, historical inference, and theology in separately labelled fields. Missing layers remain missing.', boundary: 'Retrieval confidence cannot convert commentary or theology into primary-text evidence.', links: [{ title: 'Classical Tamil traditions registry', path: '/knowledge/religion/tamil-classical-traditions/registry', role: 'inspected-source-projection' }] },
  'primary-text-and-translation-separation': { answer: 'Store the source-language unit and each translation as distinct objects with edition and translator identity. A translated divine name is an interpretive rendering, not a replacement for the original form.', boundary: 'Translation equivalence does not establish lexical identity or historical continuity.', links: [{ title: 'Source text and translation', path: '/knowledge/religion/comparisons/source-text-and-translation', role: 'inspected-source-projection' }] },
  'theological-claim-separation': { answer: 'State what a passage says, what a tradition teaches, and what a reader believes in separate frames. Historical evidence can document theology without adjudicating its metaphysical truth.', boundary: 'This clearing layer neither certifies nor refutes sacred and metaphysical propositions.', links: [{ title: 'Doctrine and lived practice', path: '/knowledge/religion/comparisons/doctrine-and-lived-practice', role: 'inspected-source-projection' }] },
  'kannan-in-alvar-reception': { answer: 'The current atlas treats Kannan in Āḻvār material as a later, passage-bound devotional name. Compare each occurrence with earlier Māyōṉ evidence without assuming that every use carries the same historical layer.', boundary: 'This route does not prove a single uninterrupted identity from Sangam poetry to later Vaiṣṇava theology.', links: [{ title: 'Tiruvāymoḻi atlas', path: '/knowledge/religion/tiruvaymoli', role: 'inspected-source-projection' }] },
  'mayon-to-mayavan': { answer: 'Māyōṉ and Māyavan should be connected only through passages that name the forms or through attributed scholarship that explains the relationship. The map preserves the spelling and source period of each form.', boundary: 'Phonetic resemblance and later devotional usage are not enough to establish a direct historical derivation.', links: [{ title: 'Who is Māyōṉ?', path: '/knowledge/religion/mayon/who-is-mayon', role: 'inspected-source-projection' }] },
  'mayon-to-tirumal': { answer: 'The Māyōṉ–Tirumāl relationship is represented as a source-specific identity map spanning classical landscape grammar and Tirumāl praise, not as a timeless synonym table.', boundary: 'The map does not erase differences of genre, date, epithet, or theological setting.', links: [{ title: 'Māyōṉ, Tirumāl and the Paripāṭal', path: '/knowledge/religion/mayon/mayon-tirumal-and-paripatal', role: 'inspected-source-projection' }] },
  'mullai-imagery-in-later-bhakti': { answer: 'Trace mullai imagery into later devotion only when a later passage actually carries the image or an identified commentator makes the connection. Keep the earlier landscape association visible as its own source fact.', boundary: 'Landscape vocabulary alone cannot establish direct transmission or unchanged theology.', links: [{ title: 'Māyōṉ and mullai', path: '/knowledge/religion/mayon/mayon-and-mullai', role: 'inspected-source-projection' }] },
  'nappinnai-in-later-vaishnava-reception': { answer: 'Map Nappinnai through the passages that name or unmistakably describe her, then distinguish translation, commentary, and later Vaiṣṇava identification. Do not fill gaps from a generic consort pattern.', boundary: 'A relational role does not by itself establish identity with another named figure.', links: [{ title: 'Tiruvāymoḻi source atlas', path: '/knowledge/religion/tiruvaymoli', role: 'inspected-source-projection' }] },
  'narayana-in-tiruvaymoli': { answer: 'Index Nārāyaṇa in the exact Tiruvāymoḻi units where the name occurs and preserve poetic voice, addressee, and translation. Connect the name to Māyōṉ only through typed textual or reception edges.', boundary: 'Occurrence in a later devotional corpus does not retroactively insert the name into an earlier passage.', links: [{ title: 'Tiruvāymoḻi registry', path: '/knowledge/religion/tiruvaymoli/registry', role: 'inspected-source-projection' }] },
  'paripatal-tirumal-in-later-reception': { answer: 'Treat Paripāṭal Tirumāl praise as an earlier textual witness and later reception as a separate dated layer. Connections require named passages on both sides and an explicit relation type.', boundary: 'A later community’s identification does not make every earlier poetic detail a later doctrinal assertion.', links: [{ title: 'Paripāṭal source atlas', path: '/knowledge/religion/tamil-source-atlas', role: 'inspected-source-projection' }] },
  'sacred-hill-to-temple-localization': { answer: 'A sacred hill becomes a temple-localization claim only when a source names the place, shrine, or cult connection. Preserve poetic landscape, geographic proposal, and later temple tradition as separate records.', boundary: 'Topographic similarity is not a secure place identification.', links: [{ title: 'Māyōṉ source cluster', path: '/knowledge/religion/mayon', role: 'inspected-source-projection' }] },
  'sangam-landscape-grammar-in-devotional-poetry': { answer: 'Compare Sangam landscape grammar with devotional poetry by matching explicit landscape terms, divine names, and poetic function in dated passages. Similar mood is a research lead, not an attested transmission.', boundary: 'A shared image does not prove that the later poem follows the earlier grammar.', links: [{ title: 'Tiṇai as a poetic system', path: '/knowledge/religion/tamil-classical-traditions/tinai-as-a-poetic-system', role: 'inspected-source-projection' }] },
  'tamil-epithets-in-sanskritic-identification': { answer: 'Keep the Tamil epithet, Sanskritic identification, source passage, translation, and commentator together. Record whether the equation is textual, translational, commentarial, or historical.', boundary: 'A modern bilingual equivalence must not be presented as wording found in the earlier text.', links: [{ title: 'Māyōṉ identity and limits', path: '/knowledge/religion/mayon/mayon-vishnu-and-krishna', role: 'inspected-source-projection' }] },
  'mayon': { answer: 'Māyōṉ is handled as a divine name attested within specific classical Tamil textual contexts, including the mullai association. Later identifications are connected as separate, typed reception claims.', boundary: 'The name alone does not settle ethnicity, origin, exclusivity, or complete identity with every later form.', links: [{ title: 'Who is Māyōṉ?', path: '/knowledge/religion/mayon/who-is-mayon', role: 'inspected-source-projection' }] },
  'tirumal': { answer: 'Tirumāl is indexed through the passages and praise contexts that use the name, especially the Paripāṭal cluster. Its relationship to Māyōṉ is shown through sources rather than assumed from a modern synonym list.', boundary: 'This index does not collapse every Tirumāl, Vishnu, or Krishna reference into one undifferentiated historical claim.', links: [{ title: 'Māyōṉ, Tirumāl and Paripāṭal', path: '/knowledge/religion/mayon/mayon-tirumal-and-paripatal', role: 'inspected-source-projection' }] },
  'kannan': { answer: 'Kannan is indexed primarily as a Tamil devotional name in later reception material, with exact occurrences kept separate from earlier Māyōṉ evidence.', boundary: 'A later Kannan passage cannot be used as direct evidence for wording in an earlier classical text.', links: [{ title: 'Tiruvāymoḻi atlas', path: '/knowledge/religion/tiruvaymoli', role: 'inspected-source-projection' }] },
  'narayana': { answer: 'Nārāyaṇa is mapped through exact devotional occurrences and their translations, then connected to other names only with a declared textual or reception relationship.', boundary: 'The index documents usage; it does not prove that all names are interchangeable in every period or tradition.', links: [{ title: 'Tiruvāymoḻi registry', path: '/knowledge/religion/tiruvaymoli/registry', role: 'inspected-source-projection' }] },
  'mayavan': { answer: 'Māyavan is preserved as its own textual form and linked to Māyōṉ only where a passage, translation, or attributed interpretation supports the connection.', boundary: 'Spelling variation is not automatically evidence of identical usage or chronology.', links: [{ title: 'Māyōṉ cluster', path: '/knowledge/religion/mayon', role: 'inspected-source-projection' }] },
  'mal': { answer: 'Māl is indexed as an exact divine-name form with its passage, grammatical setting, and translation. Longer forms and later identities remain connected but distinct.', boundary: 'A short form cannot be expanded into a specific identity without passage-level evidence.', links: [{ title: 'Classical Tamil traditions registry', path: '/knowledge/religion/tamil-classical-traditions/registry', role: 'inspected-source-projection' }] },
  'murukan': { answer: 'Murukaṉ is compared with Māyōṉ through the classical landscape-deity system: each name retains its own landscape association and source passage before any broader comparison.', boundary: 'Co-membership in a poetic system does not establish identity, rivalry, genealogy, or shared cult.', links: [{ title: 'Māyōṉ and Murukaṉ', path: '/knowledge/religion/mayon/mayon-and-murukan', role: 'inspected-source-projection' }] },
  'ceyon': { answer: 'Cēyōṉ is indexed as the divine-name form associated with kuṟiñci in the landscape-deity stanza and connected to Murukaṉ through the published classical-Tamil evidence map.', boundary: 'The index does not make claims about every later Murukaṉ tradition or temple practice.', links: [{ title: 'Cēyōṉ and kuṟiñci', path: '/knowledge/religion/tamil-classical-traditions/ceyon-and-kurinji', role: 'inspected-source-projection' }] },
  'nappinnai': { answer: 'Nappinnai is indexed from exact Tamil devotional passages and kept distinct from later comparative identifications unless a named source supplies the bridge.', boundary: 'Consort imagery alone does not identify one figure with another across languages and centuries.', links: [{ title: 'Tiruvāymoḻi atlas', path: '/knowledge/religion/tiruvaymoli', role: 'inspected-source-projection' }] },
  'korravai': { answer: 'Koṟṟavai is indexed within the classical Tamil landscape and martial-poetic evidence where she is actually named or discussed, not as a generic label for every goddess tradition.', boundary: 'The index does not infer identity with later goddesses without source-specific evidence.', links: [{ title: 'Classical Tamil traditions', path: '/knowledge/religion/tamil-classical-traditions', role: 'inspected-source-projection' }] },
}

const astrologySelections = [
  'provenance/ayanamsa-identifier', 'provenance/birth-time-provenance', 'provenance/calculation-kernel-version', 'provenance/digest-bound-chart-reproduction', 'provenance/ephemeris-file-version', 'provenance/house-system-identifier', 'provenance/input-redaction-and-privacy', 'provenance/location-provenance', 'provenance/time-zone-database-version', 'provenance/tradition-rule-set-version',
  'sensitivity/geocentric-and-topocentric-positions', 'sensitivity/calendar-conversion', 'sensitivity/gregorian-and-julian-calendar-boundary', 'sensitivity/local-sidereal-time', 'sensitivity/ephemeris-version', 'sensitivity/apparent-and-mean-position', 'sensitivity/atmospheric-refraction', 'sensitivity/ayanamsa-selection', 'sensitivity/birth-time-uncertainty', 'sensitivity/coordinate-precision',
] as const

const astrologyFocus: Record<string, { preserve: string; failure: string; source: Link }> = {
  'ayanamsa-identifier': { preserve: 'the named ayanāṃśa, implementation or table version, epoch, and resulting offset', failure: 'A label such as “Lahiri” can hide different implementations or epochs.', source: { title: 'Sidereal zero-point declaration', path: '/knowledge/astrology/protocols/zodiac-zero-point-declaration', role: 'operational-source' } },
  'birth-time-provenance': { preserve: 'the reported time, source type, recorder, precision, later correction, and uncertainty interval', failure: 'A rounded or rectified time must not be represented as a contemporaneous record.', source: { title: 'Source-event intake', path: '/knowledge/astrology/protocols/source-event-intake', role: 'operational-source' } },
  'calculation-kernel-version': { preserve: 'the kernel package, version, build digest, operation, and deterministic execution mode', failure: 'The same formula name can produce different bytes when constants, rounding, or numeric kernels differ.', source: { title: 'Canonical input manifest', path: '/knowledge/astrology/protocols/canonical-input-manifest', role: 'operational-source' } },
  'digest-bound-chart-reproduction': { preserve: 'canonicalized inputs, dependency versions, outputs, and the receipt digest that binds them', failure: 'A screenshot or rendered chart cannot establish the inputs and algorithms that produced it.', source: { title: 'Calculation workflows', path: '/knowledge/astrology/calculations', role: 'operational-source' } },
  'ephemeris-file-version': { preserve: 'ephemeris family, file or dataset identifier, release, checksum, coverage interval, and flags', failure: 'Naming a software library does not identify the ephemeris data it loaded.', source: { title: 'Ephemeris model pinning', path: '/knowledge/astrology/protocols/ephemeris-model-pinning', role: 'operational-source' } },
  'house-system-identifier': { preserve: 'the named house system, implementation version, required angles, latitude eligibility, and fallback policy', failure: 'House numbers are uninterpretable when the system is omitted or silently substituted.', source: { title: 'House-system eligibility', path: '/knowledge/astrology/protocols/house-system-eligibility', role: 'operational-source' } },
  'input-redaction-and-privacy': { preserve: 'only calculation-relevant fields, pseudonymous request identity, retention policy, and redaction receipt', failure: 'A reproducibility package can become a privacy leak if it contains a person’s identifying birth record.', source: { title: 'Canonical input manifest', path: '/knowledge/astrology/protocols/canonical-input-manifest', role: 'operational-source' } },
  'location-provenance': { preserve: 'place label, coordinates, coordinate source, precision, elevation policy, and geocoding time', failure: 'A place name can resolve to multiple coordinates or political boundaries.', source: { title: 'Observer-site contract', path: '/knowledge/astrology/protocols/observer-site-contract', role: 'operational-source' } },
  'time-zone-database-version': { preserve: 'IANA zone identifier, tzdb version, resolved offset, fold or gap state, and conversion receipt', failure: 'Historical UTC conversion can change when time-zone rules or the selected occurrence of an ambiguous time differ.', source: { title: 'Civil-time resolution', path: '/knowledge/astrology/protocols/civil-time-resolution', role: 'operational-source' } },
  'tradition-rule-set-version': { preserve: 'tradition, source edition, rule-set version, technique scope, and prohibited cross-namespace transfers', failure: 'Shared vocabulary does not make two traditions’ rules interchangeable.', source: { title: 'Astrology traditions', path: '/knowledge/astrology', role: 'operational-source' } },
  'geocentric-and-topocentric-positions': { preserve: 'origin, observer coordinates, elevation, body, ephemeris, time scale, and correction flags', failure: 'A local parallax-sensitive position and an Earth-center position answer different coordinate questions.', source: { title: 'Coordinate-origin selection', path: '/knowledge/astrology/protocols/coordinate-origin-selection', role: 'operational-source' } },
  'calendar-conversion': { preserve: 'source calendar, date fields, conversion convention, reform boundary, and resulting continuous day count', failure: 'A date copied across calendars without a declared conversion can shift the instant by days.', source: { title: 'Timescale conversion chain', path: '/knowledge/astrology/protocols/timescale-conversion-chain', role: 'operational-source' } },
  'gregorian-and-julian-calendar-boundary': { preserve: 'declared calendar, jurisdictional convention, civil date, conversion rule, and proleptic-policy flag', failure: 'The same written date can name different days under Gregorian and Julian conventions.', source: { title: 'Civil-time resolution', path: '/knowledge/astrology/protocols/civil-time-resolution', role: 'operational-source' } },
  'local-sidereal-time': { preserve: 'UTC or UT1 instant, Earth-rotation convention, longitude sign, reference meridian, and angle normalization', failure: 'Time-scale or longitude-sign errors propagate directly into the local sidereal angle.', source: { title: 'Reference-frame declaration', path: '/knowledge/astrology/protocols/reference-frame-declaration', role: 'operational-source' } },
  'ephemeris-version': { preserve: 'two named ephemeris versions, identical inputs, output coordinates, and per-body deltas', failure: 'A software upgrade can alter positions without any change in user-supplied inputs.', source: { title: 'Ephemeris model pinning', path: '/knowledge/astrology/protocols/ephemeris-model-pinning', role: 'operational-source' } },
  'apparent-and-mean-position': { preserve: 'declared position type and whether nutation, aberration, light-time, and deflection corrections are applied', failure: 'Mean and apparent coordinates are not interchangeable labels for one output.', source: { title: 'Reference-frame declaration', path: '/knowledge/astrology/protocols/reference-frame-declaration', role: 'operational-source' } },
  'atmospheric-refraction': { preserve: 'geometric altitude, refraction model, pressure, temperature, observer elevation, and horizon criterion', failure: 'Near the horizon, an unspecified refraction model can change whether a rise or set condition is met.', source: { title: 'Observer-site contract', path: '/knowledge/astrology/protocols/observer-site-contract', role: 'operational-source' } },
  'ayanamsa-selection': { preserve: 'parallel tropical longitude and each named sidereal transform with exact offsets', failure: 'Selecting the convention after seeing the preferred sign is outcome-driven model choice.', source: { title: 'Tropical–sidereal comparison', path: '/knowledge/astrology/tropical-vs-sidereal', role: 'operational-source' } },
  'birth-time-uncertainty': { preserve: 'an explicit time interval, sampling resolution, stable outputs, boundary crossings, and withheld conclusions', failure: 'A point estimate hides which chart features change inside the reported uncertainty.', source: { title: 'Uncertain-time interval', path: '/knowledge/astrology/protocols/uncertain-time-interval', role: 'operational-source' } },
  'coordinate-precision': { preserve: 'input coordinate precision, rounding policy, recomputed outputs, and thresholds crossed by perturbation', failure: 'Displaying many decimal places cannot recover precision absent from the original location record.', source: { title: 'Observer-site contract', path: '/knowledge/astrology/protocols/observer-site-contract', role: 'operational-source' } },
}

function candidate(path: string): Candidate {
  const found = routeMap.candidates.find((entry) => entry.proposedPath === path)
  if (!found) throw new Error(`Route-map candidate missing: ${path}`)
  return found
}

function complete(candidateEntry: Candidate, fields: Omit<Record<string, unknown>, 'provenanceDigest'>) {
  const body = {
    schemaVersion: 'maha-epistemic-clearing-guide/1.0',
    preparedOn: PREPARED_ON,
    candidateId: candidateEntry.candidateId,
    candidateRank: candidateEntry.rank,
    lane: candidateEntry.lane,
    path: candidateEntry.proposedPath,
    searchIntent: cleanQuestion(candidateEntry.searchIntent),
    publicationState: 'prepared-not-deployed',
    canonicalRecordRequired: false,
    releaseBoundary: 'This page is an editorial or operational projection over named public materials. It does not alter a canonical evidence record or inherit a scientific release.',
    ...fields,
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

const machineCandidates = routeMap.candidates
  .filter((entry) => entry.lane === 'machine-integrations' && entry.bookPriority.matched.length > 0)
  .slice(0, 40)

const machinePages = machineCandidates.map((entry) => {
  const slug = entry.proposedPath.split('/').at(-1)!
  const lensKey = Object.keys(machineLenses).find((key) => slug.endsWith(`-${key}`)) as keyof typeof machineLenses | undefined
  if (!lensKey) throw new Error(`Unknown machine lens: ${slug}`)
  const subjectKey = slug.slice(0, -(lensKey.length + 1))
  const subject = machineSubjects[subjectKey]
  if (!subject) throw new Error(`Missing machine subject profile: ${subjectKey}`)
  const lens = machineLenses[lensKey]
  const conceptual = entry.bookPriority.matched
    .map((match) => bookRoutes[match.bookId])
    .filter((value, index, values) => value && values.findIndex((other) => other.path === value.path) === index)
    .map((book) => ({ ...book, role: 'conceptual-lens' as const }))
  const answer = lens.answer(subject.label, subject.asset)
  return complete(entry, {
    family: 'book-concept-machine-application',
    title: `${lens.title} for ${withArticle(subject.label)}`,
    summary: `${sentence(subject.label)} decision guide for ${lens.title.toLowerCase()}, connecting Maha's implemented machine controls to book concepts without treating the books as technical evidence.`,
    question: cleanQuestion(entry.searchIntent),
    directAnswer: answer,
    evidenceFrame: 'operational-contract-with-conceptual-lens',
    sourceLinks: [subject.source, ...conceptual],
    requiredInputs: lens.inputs,
    orderedSteps: lens.steps,
    expectedOutputs: lens.outputs,
    refusalConditions: [...lens.refusals, subject.specificBoundary],
    limitations: [subject.specificBoundary, 'The linked book supplies a conceptual lens only; the operational contract and implementation remain the authority for machine behavior.', 'This guide does not authorize production mutation, payment, deployment, or access to a private evidence corpus.'],
    questions: [
      { question: `What is the minimum safe ${lens.title.toLowerCase()} for ${withArticle(subject.label)}?`, answer },
      { question: `Which identity fields must remain bound for ${withArticle(subject.label)}?`, answer: `Preserve ${subject.identity}; refuse the operation when any edge is missing or belongs to another lifecycle.` },
      { question: `What should happen on an exact replay?`, answer: 'Return the original bounded decision or result without consuming quota, delivering, or acknowledging a second time.' },
      { question: 'What role does the linked book play?', answer: 'It contributes a conceptual framing for boundaries, resilience, or governance. It is not evidence that the technical control exists or works.' },
      { question: `What does this guide not establish about ${withArticle(subject.label)}?`, answer: subject.specificBoundary },
    ],
    commercialAction: { label: 'Inspect licensed evidence retrieval', path: '/enterprise-mcp-gateway', state: 'information-only' },
  })
})

const evidenceCandidates = routeMap.candidates.filter((entry) => entry.lane === 'evidence-clearing').slice(0, 10)
const evidencePages = evidenceCandidates.map((entry) => {
  const slug = entry.proposedPath.split('/').at(-1)!
  const lensKey = Object.keys(evidenceLenses).find((key) => slug.endsWith(`-${key}`)) as keyof typeof evidenceLenses | undefined
  if (!lensKey) throw new Error(`Unknown evidence lens: ${slug}`)
  const topicKey = slug.slice(0, -(lensKey.length + 1))
  const topic = evidenceTopics[topicKey]
  if (!topic) throw new Error(`Missing evidence topic: ${topicKey}`)
  const lens = evidenceLenses[lensKey]
  return complete(entry, {
    family: 'evidence-clearing-protocol', title: `${lens.title} for ${topic.label}`,
    summary: `A fail-closed protocol for ${lens.title.toLowerCase()} when evaluating ${topic.label}.`, question: cleanQuestion(entry.searchIntent),
    directAnswer: `${lens.answer} For ${topic.label}, preserve ${topic.object}.`, evidenceFrame: 'maha-method-contract',
    sourceLinks: [
      { title: 'Free Evidence Preflight', path: '/tools/evidence-preflight', role: 'operational-source' },
      { title: 'Evidence workflow examples', path: '/knowledge/evidence-workflows', role: 'operational-source' },
      { title: 'Claim-level provenance', path: '/mps/claim-level-provenance', role: 'operational-source' },
    ],
    requiredInputs: lens.inputs, orderedSteps: lens.steps, expectedOutputs: lens.outputs, refusalConditions: [...lens.refusals, topic.boundary],
    limitations: [topic.boundary, 'This protocol produces a preflight or evidence-structure finding, not a verified Evidence Dossier.', 'No source is treated as inspected merely because its metadata or identifier resolves.'],
    questions: [
      { question: cleanQuestion(entry.searchIntent), answer: `${lens.answer} Preserve ${topic.object}.` },
      { question: `What must be preserved for ${topic.label}?`, answer: sentence(topic.object) + '.' },
      { question: 'When must the protocol refuse?', answer: `It must refuse when ${lens.refusals[0].toLowerCase()} or when the identified source cannot be inspected at the required depth.` },
      { question: 'Does a successful preflight verify the claim?', answer: 'No. It shows that the evidence request is sufficiently structured to begin inspection; factual verification remains a separate stage.' },
      { question: `What does this protocol not establish about ${topic.label}?`, answer: topic.boundary },
    ],
    commercialAction: { label: 'Run the free Evidence Preflight', path: '/tools/evidence-preflight', state: 'available-free' },
  })
})

const tamilPages = tamilSelections.map((suffix) => {
  const entry = candidate(`/knowledge/religion/clearing/${suffix}`)
  const [category, slug] = suffix.split('/')
  const focus = tamilFocus[slug]
  if (!focus) throw new Error(`Missing Tamil focus: ${slug}`)
  const categoryLabel = category === 'methods' ? 'Evidence method' : category === 'reception' ? 'Reception map' : 'Divine-name map'
  return complete(entry, {
    family: 'tamil-religion-clearing', title: `${humanize(slug)} — ${categoryLabel.toLowerCase()}`,
    summary: `A source-layered ${categoryLabel.toLowerCase()} for ${humanize(slug)}, preserving primary text, translation, commentary, historical inference, and theology as different frames.`,
    question: cleanQuestion(entry.searchIntent), directAnswer: focus.answer, evidenceFrame: category === 'methods' ? 'editorial-method' : 'projection-over-inspected-public-routes',
    sourceLinks: focus.links,
    requiredInputs: ['Exact primary-text unit and named edition', 'Source-language form and identified translation', 'Commentary or scholarship with attribution', 'Declared relationship type and uncertainty'],
    orderedSteps: ['Identify the exact form or proposition being connected.', 'Open the named passage and preserve its printed-unit boundary.', 'Separate source text from translation and commentary.', 'Classify each relationship as textual, translational, commentarial, historical, or theological.', 'State the strongest supported answer and what remains unresolved.'],
    expectedOutputs: ['Layered evidence map', 'Bounded direct answer', 'Unsupported-identity and inference list'],
    refusalConditions: ['The primary passage or edition is unnamed.', 'A translation or commentary is presented as source text.', 'A historical or theological conclusion is inferred from name similarity alone.', focus.boundary],
    limitations: [focus.boundary, 'This page projects already published evidence routes and does not replace their exact source locators.', 'The system documents theological claims as claims of traditions; it does not adjudicate metaphysical truth.'],
    questions: [
      { question: cleanQuestion(entry.searchIntent), answer: focus.answer },
      { question: `What is the primary-text layer for ${humanize(slug)}?`, answer: 'Use only the wording and structure present in the named printed unit; translation and later explanation remain separate.' },
      { question: 'How should translation be represented?', answer: 'Name the translator or edition and retain the source-language form so that an English identity choice remains visible as a choice.' },
      { question: 'When is a historical connection allowed?', answer: 'Only when passages on both sides and the inferential bridge are explicit; otherwise record the connection as unresolved.' },
      { question: `What must not be inferred about ${humanize(slug)}?`, answer: focus.boundary },
    ],
    commercialAction: { label: 'Run an evidence preflight on a textual claim', path: '/tools/evidence-preflight', state: 'available-free' },
  })
})

const astrologyPages = astrologySelections.map((suffix) => {
  const entry = candidate(`/knowledge/astrology/workflows/${suffix}`)
  const [category, slug] = suffix.split('/')
  const focus = astrologyFocus[slug]
  if (!focus) throw new Error(`Missing astrology focus: ${slug}`)
  const provenance = category === 'provenance'
  return complete(entry, {
    family: 'astrology-infrastructure', title: `${humanize(slug)} ${provenance ? 'provenance contract' : 'sensitivity workflow'}`,
    summary: `${provenance ? 'A provenance contract' : 'A deterministic sensitivity workflow'} for ${humanize(slug)}, separating reproducible celestial computation from interpretive and predictive claims.`,
    question: cleanQuestion(entry.searchIntent),
    directAnswer: provenance
      ? `Preserve ${focus.preserve}. Bind those fields to one canonical input manifest and receipt before interpreting or sharing an output.`
      : `Recompute the output across an explicitly bounded change in ${humanize(slug).toLowerCase()}, preserve all other inputs, and report both the numerical delta and every categorical boundary crossing.`,
    evidenceFrame: 'deterministic-computation-protocol', sourceLinks: [focus.source, { title: 'Astrology methodology and boundaries', path: '/knowledge/astrology', role: 'operational-source' }],
    requiredInputs: provenance ? ['Canonical input manifest', 'Named algorithm and dependency versions', 'Declared units and conventions', 'Retention and redaction policy'] : ['Baseline canonical input manifest', 'One explicitly varied input or convention', 'Frozen kernel and dependencies', 'Numerical and categorical comparison thresholds'],
    orderedSteps: provenance ? ['Normalize the input without dropping uncertainty.', `Record ${focus.preserve}.`, 'Run the named deterministic operation.', 'Bind inputs and outputs into a receipt.', 'Verify the receipt independently before interpretation.'] : ['Freeze the baseline manifest and kernel.', 'Define the variation before seeing the preferred interpretation.', 'Recompute every point under the same operation.', 'Measure numerical deltas and boundary crossings.', 'Withhold outputs that are unstable across the admitted interval.'],
    expectedOutputs: provenance ? ['Canonical manifest', 'Calculation or transformation receipt', 'Reproducibility and redaction statement'] : ['Sensitivity table', 'Stable and unstable output sets', 'Boundary-crossing and refusal report'],
    refusalConditions: [focus.failure, 'Required input, unit, convention, or dependency version is absent.', 'An interpretive preference selects the computational convention after outputs are seen.'],
    limitations: [focus.failure, 'Reproducible astronomical arithmetic does not validate an astrological interpretation or prediction.', 'No missing number, uncertainty interval, or calculation receipt is invented.'],
    questions: [
      { question: cleanQuestion(entry.searchIntent), answer: provenance ? `Preserve ${focus.preserve}.` : `Vary ${humanize(slug).toLowerCase()} inside a declared interval while holding every other input and the kernel fixed.` },
      { question: 'Which information must be versioned?', answer: `At minimum, preserve ${focus.preserve}, together with the canonical input and output digests.` },
      { question: 'When should an output be withheld?', answer: `Withhold it when ${focus.failure.charAt(0).toLowerCase() + focus.failure.slice(1)} or when a required dependency cannot be identified.` },
      { question: 'Does determinism validate the interpretation?', answer: 'No. Determinism makes the computation reproducible; interpretive or predictive validity requires a separate prospective evaluation.' },
      { question: 'What belongs in the receipt?', answer: 'The operation, canonical inputs, units, assumptions, dependency versions, outputs, uncertainty treatment, and package digest.' },
    ],
    commercialAction: { label: 'Review deterministic astrology protocols', path: '/knowledge/astrology/protocols', state: 'available-free' },
  })
})

const pages = [...machinePages, ...tamilPages, ...astrologyPages, ...evidencePages]
const body = {
  schemaVersion: 'maha-epistemic-clearing-batch/1.0', preparedOn: PREPARED_ON,
  objective: 'The first 100 prepared routes toward the 2,000-route epistemic clearing layer.',
  deploymentGate: { state: 'build-withheld', minimumPreparedSitePages: BUILD_THRESHOLD, instruction: 'Do not run a Production or Vercel build before the prepared site reaches 1,500 pages without new explicit operator approval.' },
  counts: {
    total: pages.length,
    bookConceptMachineApplications: machinePages.length,
    tamilReligion: tamilPages.length,
    astrologyInfrastructure: astrologyPages.length,
    evidenceClearing: evidencePages.length,
    boundedQuestions: pages.reduce((sum, page) => sum + (page.questions as unknown[]).length, 0),
  },
  publicationBoundary: 'Prepared routes are code and content only. They are not deployed, observed, indexed, clicked, commercially validated, or canonical scientific releases.',
  pages,
}

writeFileSync(OUTPUT, `${JSON.stringify({ ...body, provenanceDigest: provenanceDigest(body) }, null, 2)}\n`)
console.log(`Prepared ${pages.length} routes and ${body.counts.boundedQuestions} bounded questions at ${OUTPUT}`)
