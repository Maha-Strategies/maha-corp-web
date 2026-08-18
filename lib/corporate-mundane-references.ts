export const CORPORATE_MUNDANE_RELEASE_DATE = '2026-08-18' as const
export const CORPORATE_MUNDANE_PATH = '/knowledge/astrology/corporate-mundane' as const
export const CORPORATE_MUNDANE_KINDS = ['methodology', 'sanitized-case-study'] as const

export type CorporateMundaneKind = typeof CORPORATE_MUNDANE_KINDS[number]

export interface CorporateMundaneSource {
  id: string
  authority: string
  title: string
  url: string
  establishes: string
  boundary: string
}

export interface CorporateMundaneReference {
  slug: string
  kind: CorporateMundaneKind
  title: string
  description: string
  question: string
  method: string
  evidenceRequired: readonly string[]
  decisionRule: string
  sanitizedExample: string
  sanitization: string
  limitations: string
  doesNotEstablish: string
  sourceIds: readonly string[]
  relatedSlugs: readonly string[]
  empiricalStatus: 'not-evidence-of-predictive-skill'
}

export const CORPORATE_MUNDANE_SOURCES: readonly CorporateMundaneSource[] = [
  {
    id: 'maha-corporate-report-contract', authority: 'Maha Celestial', title: 'Corporate charts: events, evidence, and uncertainty',
    url: 'https://www.mahastrategies.com/knowledge/astrology/corporate-charts',
    establishes: 'The public organization-event taxonomy, evidence fields, location policy, time-confidence model, stability audit, and explicit corporate-report refusals.',
    boundary: 'This is Maha’s declared methodology. It is not independent evidence that corporate astrology predicts outcomes.',
  },
  {
    id: 'maha-celestial-fact-contract', authority: 'Maha Celestial', title: 'Celestial fact-layer specification',
    url: 'https://www.mahastrategies.com/knowledge/celestial',
    establishes: 'The reproducible time, observer, reference-frame, coordinate, precision, software, and provenance fields consumed by corporate calculations.',
    boundary: 'A reproducible astronomical fact does not validate an astrological interpretation built on that fact.',
  },
  {
    id: 'maha-timing-reference-library', authority: 'Maha Celestial', title: 'Celestial timing reference library',
    url: 'https://www.mahastrategies.com/knowledge/astrology/timing',
    establishes: 'Declared methods for ingress, station, lunation, and Vimśottarī chronology, including repeated crossings and uncertainty.',
    boundary: 'The reference library defines calculations and conventions; it does not establish predictive meaning.',
  },
  {
    id: 'iana-tzdb-2026c', authority: 'Internet Assigned Numbers Authority', title: 'IANA Time Zone Database',
    url: 'https://www.iana.org/time-zones/releases/2026c',
    establishes: 'Versioned timezone identifiers, UTC offsets, daylight-saving transitions, and representative historical civil-time rules.',
    boundary: 'Timezone rules cannot recover precision absent from the underlying organization-event record.',
  },
  {
    id: 'rfc3339', authority: 'Internet Engineering Task Force', title: 'RFC 3339: Date and Time on the Internet',
    url: 'https://www.rfc-editor.org/rfc/rfc3339',
    establishes: 'A timestamp serialization profile with explicit UTC offsets and the UTC designator.',
    boundary: 'A serialized timestamp does not prove when an event occurred or which event should represent an organization.',
  },
  {
    id: 'nist-fips-180-4', authority: 'National Institute of Standards and Technology', title: 'FIPS PUB 180-4: Secure Hash Standard',
    url: 'https://csrc.nist.gov/pubs/fips/180-4/upd1/final',
    establishes: 'The SHA-256 digest algorithm used to fingerprint evidence attachments without publishing their contents.',
    boundary: 'A digest proves byte-level consistency with a retained file; it does not prove the file is authentic or its claims are true.',
  },
]

const COMMON_SANITIZATION = 'This page contains no organization name, client identity, participant or founder natal data, exact revenue, account identifier, raw document, attachment filename, private URL, or full event timestamp. The scenario is a sanitized demonstration of a system behavior, not a claimed client result.'
const COMMON_BOUNDARY = 'The method does not establish valuation, investment return, legal status, revenue, survival, market adoption, or a guaranteed business outcome, and it is not evidence that astrology predicts organizational events.'

const METHODOLOGIES: CorporateMundaneReference[] = [
  {
    slug: 'organization-event-taxonomy', kind: 'methodology', title: 'Organization-event taxonomy for corporate charts',
    description: 'Why filing, acceptance, certification, transaction, deployment, launch, merger, and acquisition events must remain distinct corporate chart inputs.',
    question: 'Which documented event is being charted, and what organizational change did that event actually constitute?',
    method: 'Name the event before calculation, select one supported event type, preserve competing candidates, and prohibit retroactive substitution based on which chart looks more favorable. Each interpretation rule must declare the event types it can consume.',
    evidenceRequired: ['Contemporaneous event record', 'Issuer or system of record', 'Event-type rationale', 'Competing candidate events and their locators'],
    decisionRule: 'A report may describe only the declared event. It must not call a first transaction an incorporation, treat a launch as legal formation, or generalize a legal-formation rule to another event type.',
    sanitizedExample: 'A record set contains filing submission, registry acceptance, first invoice payment, and public launch. The system creates four separate event records and selects none merely because its chart appears preferable.',
    sanitization: COMMON_SANITIZATION, limitations: 'Organizational beginnings can be gradual and distributed. A taxonomy makes choices explicit but cannot prove that one event is the uniquely correct symbolic origin.', doesNotEstablish: COMMON_BOUNDARY,
    sourceIds: ['maha-corporate-report-contract'], relatedSlugs: ['competing-formation-events-case-study', 'filing-submission-versus-acceptance-case-study'], empiricalStatus: 'not-evidence-of-predictive-skill',
  },
  {
    slug: 'legal-formation-event-selection', kind: 'methodology', title: 'Selecting a legal formation event',
    description: 'How filing submission, filing acceptance, and certificate issuance are separated when constructing an evidence-bound legal formation chart.',
    question: 'Does the record establish submission, acceptance, certificate issuance, or only an official date?',
    method: 'Retain the authority, jurisdiction, record locator, status transition, timestamp precision, and whether the time represents an automated system action or only a document date. Do not infer acceptance time from a later certificate.',
    evidenceRequired: ['Government or registry record', 'Status and authority', 'Recorded date or timestamp', 'Jurisdiction and entity identifier when publishable'],
    decisionRule: 'Legal-formation interpretation is eligible only for filing acceptance or certificate issuance under the present rule scope; submission remains a separate administrative event.',
    sanitizedExample: 'A filing receipt shows minute-level submission while the certificate shows only the following date. The submission receives a precise event record; the certificate receives a date-only uncertainty window.',
    sanitization: COMMON_SANITIZATION, limitations: 'Registry procedure varies by jurisdiction, and software cannot determine legal effect from a timestamp alone. Legal counsel and official records remain authoritative.', doesNotEstablish: COMMON_BOUNDARY,
    sourceIds: ['maha-corporate-report-contract', 'rfc3339'], relatedSlugs: ['organization-event-taxonomy', 'filing-submission-versus-acceptance-case-study'], empiricalStatus: 'not-evidence-of-predictive-skill',
  },
  {
    slug: 'first-commercial-transaction-method', kind: 'methodology', title: 'First commercial transaction as an organization event',
    description: 'A method for recording the first compensated transaction without confusing authorization, ledger posting, settlement, payout, or bank receipt.',
    question: 'Which timestamp represents the first economically meaningful transaction under the declared study definition?',
    method: 'Define the transaction state in advance, identify the authoritative platform or bank record, retain currency and amount only in private evidence, and distinguish authorization, platform credit, settlement, payout, and bank posting.',
    evidenceRequired: ['Platform or bank record', 'Declared transaction state', 'Timestamp with timezone', 'Evidence locator and attachment digest'],
    decisionRule: 'The first event satisfying the preregistered transaction state is used. Later settlement or payout cannot replace it after chart inspection unless the study registered that state separately.',
    sanitizedExample: 'A platform credit precedes bank receipt by several days. The system charts the platform credit for a platform-income definition and stores bank receipt as a distinct operational milestone.',
    sanitization: COMMON_SANITIZATION, limitations: 'Payment systems expose different timestamps and may batch activity. “First revenue” is not meaningful until the ledger state and accounting basis are declared.', doesNotEstablish: COMMON_BOUNDARY,
    sourceIds: ['maha-corporate-report-contract', 'rfc3339', 'nist-fips-180-4'], relatedSlugs: ['platform-credit-timestamp-case-study', 'transaction-location-case-study'], empiricalStatus: 'not-evidence-of-predictive-skill',
  },
  {
    slug: 'first-deployment-method', kind: 'methodology', title: 'First production deployment as a corporate event',
    description: 'How to distinguish code merge, build, release creation, deployment start, regional completion, first request, and customer availability.',
    question: 'What system transition qualifies as deployment, and which clock and region observed it?',
    method: 'Preregister one deployment state, retain immutable provider telemetry or deployment logs, identify region and timezone, and store other lifecycle timestamps as related events rather than silently choosing among them.',
    evidenceRequired: ['Deployment provider record', 'Environment and region', 'Declared success state', 'UTC timestamp and immutable locator'],
    decisionRule: 'Only a successful production transition matching the declared state qualifies. Staging deploys, retries, rollbacks, and first traffic remain separately labelled.',
    sanitizedExample: 'A release reaches two regions minutes apart. The system records each completion and uses the preregistered primary production region rather than averaging the timestamps.',
    sanitization: COMMON_SANITIZATION, limitations: 'Distributed systems have no universal single launch instant. A declared convention improves reproducibility without making one region metaphysically primary.', doesNotEstablish: COMMON_BOUNDARY,
    sourceIds: ['maha-corporate-report-contract', 'rfc3339'], relatedSlugs: ['deployment-versus-launch-case-study', 'deployment-region-exception-case-study'], empiricalStatus: 'not-evidence-of-predictive-skill',
  },
  {
    slug: 'public-launch-method', kind: 'methodology', title: 'Public launch event methodology',
    description: 'A reproducible policy for launch events spanning publication, announcement, DNS propagation, application availability, and first public access.',
    question: 'Which observable public state constitutes launch, and was it fixed before outcomes were known?',
    method: 'Declare the public state, channel, target geography, and system of record before calculation. Retain publication, availability, announcement, and first-access timestamps separately when they differ.',
    evidenceRequired: ['Publication or availability record', 'Public channel or endpoint', 'UTC timestamp', 'Declared launch-state definition'],
    decisionRule: 'A launch timestamp is accepted only when its state matches the predeclared definition and can be independently located. Marketing copy cannot substitute for availability telemetry without disclosure.',
    sanitizedExample: 'A website becomes reachable before the announcement is posted. Both events remain in the corpus, while the report uses the predeclared public-availability state.',
    sanitization: COMMON_SANITIZATION, limitations: 'Global launches propagate over time and audience access varies. One timestamp is a measurement convention, not a complete description of exposure.', doesNotEstablish: COMMON_BOUNDARY,
    sourceIds: ['maha-corporate-report-contract', 'rfc3339'], relatedSlugs: ['deployment-versus-launch-case-study', 'organization-event-taxonomy'], empiricalStatus: 'not-evidence-of-predictive-skill',
  },
  {
    slug: 'merger-acquisition-event-method', kind: 'methodology', title: 'Merger and acquisition event methodology',
    description: 'How signing, regulatory approval, shareholder approval, legal effectiveness, and financial close are retained as distinct organization events.',
    question: 'Which legal or operational transition is being studied in a merger or acquisition sequence?',
    method: 'Name the transaction stage, authority, effective condition, jurisdiction, closing location basis, and time confidence. Preserve the complete event chain and prohibit using an earlier or later stage interchangeably.',
    evidenceRequired: ['Agreement or official notice', 'Declared transaction stage', 'Effective timestamp or uncertainty interval', 'Jurisdiction and closing-location rationale'],
    decisionRule: 'Merger-effective and acquisition-close records may be charted only under their exact labels. No record is treated as a new biological birth or used to erase predecessor histories.',
    sanitizedExample: 'Regulatory clearance occurs before legal effectiveness and financial close. Three events are stored; the report selects the registered legal-effective event requested by the study.',
    sanitization: COMMON_SANITIZATION, limitations: 'Complex transactions can close across jurisdictions and time zones. The event chain may resist reduction to one moment, and legal effect requires authoritative advice.', doesNotEstablish: COMMON_BOUNDARY,
    sourceIds: ['maha-corporate-report-contract', 'rfc3339'], relatedSlugs: ['cross-jurisdiction-merger-case-study', 'organization-event-taxonomy'], empiricalStatus: 'not-evidence-of-predictive-skill',
  },
  {
    slug: 'event-time-confidence-method', kind: 'methodology', title: 'Event-time confidence and uncertainty intervals',
    description: 'How recorded instants, minutes, hours, official dates, and estimates become explicit uncertainty windows instead of false precision.',
    question: 'What precision does the source actually support, independently of the precision accepted by the calculator?',
    method: 'Assign a confidence class from the evidence, convert it to a bounded interval, choose a representative instant only for calculation, and recompute time-sensitive features across the full possible interval.',
    evidenceRequired: ['Original timestamp wording', 'Clock precision', 'Timezone or location', 'Reason for any uncertainty beyond the displayed precision'],
    decisionRule: 'Recorded instants use zero added uncertainty; date-only events use a midday representative instant with a twelve-hour interval; unstable features are withheld rather than printed at the midpoint.',
    sanitizedExample: 'An official record supplies a date but no time. The report calculates noon for orientation, tests the whole local day, and withholds houses when the ascendant changes.',
    sanitization: COMMON_SANITIZATION, limitations: 'Confidence classes are policy categories, not statistical confidence intervals. They communicate evidence resolution and cannot recover an unrecorded clock time.', doesNotEstablish: COMMON_BOUNDARY,
    sourceIds: ['maha-corporate-report-contract', 'rfc3339', 'iana-tzdb-2026c'], relatedSlugs: ['estimated-time-sensitivity-case-study', 'historical-timezone-case-study'], empiricalStatus: 'not-evidence-of-predictive-skill',
  },
  {
    slug: 'date-only-stability-audit', kind: 'methodology', title: 'Date-only corporate chart stability audit',
    description: 'A fail-closed procedure for deciding which placements survive a full-day event-time window and which houses or limbs must be withheld.',
    question: 'Which chart facts remain invariant throughout the interval supported by the evidence?',
    method: 'Calculate at the representative midpoint and both interval edges, sample intermediate instants where necessary, compare ascendant, whole-sign houses, and pañcāṅga limbs, and publish only features stable across the declared window.',
    evidenceRequired: ['Official event date', 'IANA timezone', 'Event location policy', 'Full uncertainty interval'],
    decisionRule: 'Organization-house applications are allowed only when ascendant and whole-sign geometry remain stable. Changed limbs are named, and unstable labels are withheld rather than averaged.',
    sanitizedExample: 'Slow planetary signs remain unchanged across a date, but the ascendant crosses several signs. The report keeps the stable longitudes and suppresses organization-house interpretations.',
    sanitization: COMMON_SANITIZATION, limitations: 'Endpoint agreement alone can miss an intermediate boundary crossing; sampling resolution must match the feature’s motion and declared tolerance.', doesNotEstablish: COMMON_BOUNDARY,
    sourceIds: ['maha-corporate-report-contract', 'maha-celestial-fact-contract'], relatedSlugs: ['estimated-time-sensitivity-case-study', 'event-time-confidence-method'], empiricalStatus: 'not-evidence-of-predictive-skill',
  },
  {
    slug: 'event-location-policy', kind: 'methodology', title: 'Corporate event-location selection policy',
    description: 'How authority, registered office, operational, transaction, deployment, and closing locations are selected without silent substitution.',
    question: 'Where did the declared event occur under the system that recorded or legally constituted it?',
    method: 'Choose from the supported location bases, apply the event-type recommendations, retain WGS 84 coordinates and place label, and require a written rationale whenever a nonrecommended basis is selected.',
    evidenceRequired: ['Event-type record', 'Location basis', 'Coordinates and place label', 'Rationale for a documented exception'],
    decisionRule: 'The event location is not automatically headquarters, founder location, registered office, server region, or payment destination. Substitution requires an explicit documented exception.',
    sanitizedExample: 'A registry event concerns a remote company whose operators are abroad. The authority location is used for the legal event; the operational city is retained for later deployment events.',
    sanitization: COMMON_SANITIZATION, limitations: 'Digital and legal events can be distributed or jurisdictional abstractions. A location policy makes assumptions visible but does not prove physical causation.', doesNotEstablish: COMMON_BOUNDARY,
    sourceIds: ['maha-corporate-report-contract', 'maha-celestial-fact-contract'], relatedSlugs: ['transaction-location-case-study', 'deployment-region-exception-case-study'], empiricalStatus: 'not-evidence-of-predictive-skill',
  },
  {
    slug: 'jurisdiction-versus-event-location', kind: 'methodology', title: 'Jurisdiction versus event location',
    description: 'Why legal jurisdiction, registration authority, registered office, operational city, and computational observer must remain separate fields.',
    question: 'Which field answers legal authority, and which field supplies the observer coordinates for this specific event?',
    method: 'Record country, subdivision, authority, and entity identifier independently from location basis, coordinates, and rationale. Never derive jurisdiction from geocoding or infer event location from the entity’s legal address.',
    evidenceRequired: ['Jurisdiction record', 'Registration authority', 'Event-location evidence', 'Location-basis policy'],
    decisionRule: 'Jurisdiction controls legal context; event location controls observer geometry under the declared policy. Neither field is allowed to overwrite the other.',
    sanitizedExample: 'An entity is registered in one jurisdiction, managed from another country, and deployed in a third region. The three facts remain separate records rather than one blended “company location.”',
    sanitization: COMMON_SANITIZATION, limitations: 'This data model is not a conflict-of-laws analysis and cannot determine tax residence, regulatory scope, or legal venue.', doesNotEstablish: COMMON_BOUNDARY,
    sourceIds: ['maha-corporate-report-contract', 'maha-celestial-fact-contract'], relatedSlugs: ['cross-jurisdiction-merger-case-study', 'event-location-policy'], empiricalStatus: 'not-evidence-of-predictive-skill',
  },
  {
    slug: 'evidence-attachment-fingerprinting', kind: 'methodology', title: 'Evidence attachment fingerprinting without content retention',
    description: 'How SHA-256, byte length, media type, filename, and locator preserve reproducibility while raw private evidence remains outside the report.',
    question: 'Can a reviewer confirm which exact attachment supported the event without publishing or permanently storing its contents?',
    method: 'Hash the attachment bytes in memory, validate media type and size limits, retain the SHA-256 digest and bounded metadata, and discard content unless a separate consent and retention policy authorizes storage.',
    evidenceRequired: ['Original attachment bytes during processing', 'SHA-256 implementation', 'Evidence locator', 'Retention and consent policy'],
    decisionRule: 'A matching digest confirms byte identity with a later supplied file. It does not authenticate issuer, signature, provenance chain, or substantive truth.',
    sanitizedExample: 'A private filing PDF is hashed during report creation. The resulting report retains only a digest and generic evidence class; the document body and identifying filename are absent from the public case.',
    sanitization: COMMON_SANITIZATION, limitations: 'Hashing is not document verification. Authenticity, alteration before hashing, and issuer authority require separate controls.', doesNotEstablish: COMMON_BOUNDARY,
    sourceIds: ['maha-corporate-report-contract', 'nist-fips-180-4'], relatedSlugs: ['evidence-digest-case-study', 'legal-formation-event-selection'], empiricalStatus: 'not-evidence-of-predictive-skill',
  },
  {
    slug: 'civil-time-resolution-for-organizations', kind: 'methodology', title: 'Civil-time resolution for organization events',
    description: 'How local timestamps, IANA zones, UTC offsets, daylight-saving folds, gaps, and historical uncertainty become one reproducible time record.',
    question: 'Which UTC instant or bounded set of instants corresponds to the event’s recorded local clock reading?',
    method: 'Resolve the local timestamp with a pinned IANA zone, detect folds and gaps, retain selected offset and tzdb version, reject silent normalization, and expand uncertain historical records into candidate instants.',
    evidenceRequired: ['Local timestamp', 'Event location', 'IANA timezone', 'Fold or gap evidence', 'Timezone database release'],
    decisionRule: 'Ambiguous folds require an earlier/later choice or two candidates. Nonexistent gap times require correction evidence. Fixed offsets cannot replace timezone rules for historical events.',
    sanitizedExample: 'An automated record falls during a repeated local hour. Two valid UTC instants are retained until an independent server log identifies the applicable offset.',
    sanitization: COMMON_SANITIZATION, limitations: 'Timezone databases encode best-known civil practice and can contain historical uncertainty. Correct conversion cannot improve the source timestamp’s own resolution.', doesNotEstablish: COMMON_BOUNDARY,
    sourceIds: ['iana-tzdb-2026c', 'rfc3339', 'maha-celestial-fact-contract'], relatedSlugs: ['dst-fold-corporate-event-case-study', 'historical-timezone-case-study'], empiricalStatus: 'not-evidence-of-predictive-skill',
  },
  {
    slug: 'tropical-sidereal-corporate-comparison', kind: 'methodology', title: 'Tropical and sidereal corporate chart comparison',
    description: 'A parallel-model method that shares one event and ephemeris while keeping tropical and Lahiri-sidereal labels, rules, and scores separate.',
    question: 'Which findings come from shared celestial geometry, and which depend on the declared zodiac frame?',
    method: 'Freeze one event record and tropical longitude set, derive Lahiri-sidereal longitudes separately, namespace every feature and rule by frame, and compare outcomes without blending sign labels or selecting the better model after the fact.',
    evidenceRequired: ['One frozen organization event', 'Tropical longitudes', 'Named ayanāṁśa and version', 'Separate rule and evaluation profiles'],
    decisionRule: 'Tropical and sidereal outputs remain parallel. Agreement is reported as agreement; disagreement is preserved; neither model is averaged into an unlabeled synthesis.',
    sanitizedExample: 'A slow planet receives different sign labels in the two frames while its physical state and event timestamp remain identical. The report displays both labels and no combined verdict.',
    sanitization: COMMON_SANITIZATION, limitations: 'Parallel calculation does not determine which tradition is correct. Comparative performance requires preregistered prospective outcomes and multiplicity control.', doesNotEstablish: COMMON_BOUNDARY,
    sourceIds: ['maha-celestial-fact-contract', 'maha-timing-reference-library'], relatedSlugs: ['parallel-frame-case-study', 'corporate-outcome-preregistration'], empiricalStatus: 'not-evidence-of-predictive-skill',
  },
  {
    slug: 'organization-house-stability-policy', kind: 'methodology', title: 'Organization-house stability and significator policy',
    description: 'When organization-specific whole-sign houses may be displayed and why unstable event times force house applications to be withheld.',
    question: 'Does the ascendant remain stable across the evidence-supported time window, and which event-focused houses are allowed?',
    method: 'Compute the ascendant and whole-sign geometry throughout the uncertainty interval, require stability before populating organization houses, and select event-focused houses from the versioned policy rather than generic natal language.',
    evidenceRequired: ['Event-time interval', 'Observer location', 'Whole-sign house convention', 'Versioned event-to-house policy'],
    decisionRule: 'If the ascendant or house geometry changes, organization-house applications are empty. Stable geometry permits descriptive domains but not outcome predictions.',
    sanitizedExample: 'A minute-level transaction keeps one ascendant sign across its interval, while a date-only filing does not. Only the transaction report may display event-focused house geometry.',
    sanitization: COMMON_SANITIZATION, limitations: 'The organization-house meanings are Maha synthesis awaiting practitioner review, not classical consensus or empirical validation.', doesNotEstablish: COMMON_BOUNDARY,
    sourceIds: ['maha-corporate-report-contract', 'maha-celestial-fact-contract'], relatedSlugs: ['estimated-time-sensitivity-case-study', 'organization-event-taxonomy'], empiricalStatus: 'not-evidence-of-predictive-skill',
  },
  {
    slug: 'corporate-outcome-preregistration', kind: 'methodology', title: 'Preregistering corporate timing outcomes',
    description: 'How a corporate timing hypothesis becomes a locked, measurable forecast instead of a retrospective story fitted to milestones.',
    question: 'What quantitative outcome, horizon, direction, comparator, and stopping rule were fixed before the action or result?',
    method: 'Freeze event eligibility, planetary features, model version, prediction, KPI, system of record, outcome horizon, random or ordinary baseline, exclusions, and analysis plan before the action begins.',
    evidenceRequired: ['Timestamped registration', 'Model and feature digest', 'Objective KPI source', 'Comparator policy', 'Locked analysis plan'],
    decisionRule: 'Only prospective observations within the fixed horizon enter confirmatory scoring. Retrospective examples remain exploratory, and misses and ordinary non-event periods stay in the denominator.',
    sanitizedExample: 'A launch-timing rule is registered against a bounded activation metric and random-clock comparator before release. The later result is scored whether favorable, unfavorable, or null.',
    sanitization: COMMON_SANITIZATION, limitations: 'Preregistration prevents some bias but does not create signal. Adequate sample size, independent replication, leakage control, and paired baselines remain necessary.', doesNotEstablish: COMMON_BOUNDARY,
    sourceIds: ['maha-timing-reference-library', 'maha-corporate-report-contract'], relatedSlugs: ['outcome-leakage-refusal-case-study', 'ordinary-non-event-period-case-study'], empiricalStatus: 'not-evidence-of-predictive-skill',
  },
]

type CaseDefinition = readonly [
  slug: string,
  title: string,
  description: string,
  question: string,
  method: string,
  evidenceRequired: readonly string[],
  decisionRule: string,
  sanitizationSpecific: string,
  sanitizedExample: string,
  limitations: string,
  relatedSlugs: readonly string[],
]

const CASES: readonly CaseDefinition[] = [
  ['competing-formation-events', 'Competing formation events remain separate', 'A sanitized record contains four plausible beginnings; the system refuses to choose one after inspecting their charts.', 'Which event should represent the organization when several documented beginnings exist?', 'Create separate filing-submitted, filing-accepted, first-transaction, and public-launch records, each with its own evidence and time confidence. Compare them only under a protocol that fixed event eligibility before outcomes.', ['Four event records', 'Independent locators', 'Timestamp confidence for each', 'Predeclared event-selection policy'], 'No candidate may replace another based on apparent astrological favorability.', 'The demonstration retains generic event classes and ordering but removes the organization, dates, places, and chart placements.', 'The output preserved all four candidates and withheld a universal “birth chart.”', 'This demonstrates event-model discipline, not that any candidate predicts better.', ['organization-event-taxonomy', 'corporate-outcome-preregistration']],
  ['filing-submission-versus-acceptance', 'Filing submission versus registry acceptance', 'A sanitized legal-formation case separates a minute-level submission receipt from a later date-only acceptance record.', 'Can a precise submission timestamp stand in for an imprecise legal acceptance?', 'Record submission and acceptance separately; assign each its supported confidence; apply legal-formation rules only to the event types they declare.', ['Submission receipt', 'Acceptance record', 'Authority and jurisdiction', 'Separate uncertainty windows'], 'Submission precision cannot be transferred to acceptance, and acceptance cannot inherit the submission chart.', 'Exact dates, jurisdiction, authority, entity identifier, and attachment metadata are removed.', 'The submission retained precise geometry; acceptance used a full-day audit and withheld unstable houses.', 'The case shows honest precision management, not legal advice or predictive accuracy.', ['legal-formation-event-selection', 'date-only-stability-audit']],
  ['platform-credit-timestamp', 'First platform credit with later payout', 'A sanitized income-origin case distinguishes platform account credit, payout initiation, and bank receipt.', 'Which event qualifies as the first commercial transaction?', 'Apply a preregistered platform-income definition to the earliest settled platform credit; retain payout and bank events as later operational milestones.', ['Platform ledger record', 'Transaction state definition', 'Timezone-bearing timestamps', 'Evidence digests'], 'The earliest event satisfying the locked ledger state qualifies; later cash movement does not overwrite it.', 'Platform name, currency, amount, date, account identity, and transaction identifiers are excluded.', 'One transaction event was selected by ledger state while two later payment events remained linked records.', 'This case does not show that the selected chart explains subsequent revenue growth.', ['first-commercial-transaction-method', 'evidence-attachment-fingerprinting']],
  ['transaction-location', 'Transaction location differs from registered office', 'A sanitized remote-business case documents why transaction location and registered office cannot be silently interchanged.', 'Which observer location belongs to a platform-mediated transaction?', 'Apply the transaction-location policy, retain the platform or operational basis, and record the registered office only in the jurisdictional context.', ['Transaction system record', 'Location-basis rationale', 'Registered-office record', 'Observer coordinates'], 'A nonstandard basis requires a written exception; founder location is never assumed from residence or device use.', 'All cities, countries, platform identifiers, and coordinates are replaced by generic roles.', 'The report retained two distinct places and made the observer-location assumption visible.', 'A location convention does not prove physical influence or determine tax or legal residence.', ['event-location-policy', 'jurisdiction-versus-event-location']],
  ['deployment-region-exception', 'Deployment region as a documented location exception', 'A sanitized distributed-system case uses a provider region only because the deployment event occurred there under a declared policy.', 'When may a cloud region supply event coordinates?', 'Require a deployment event, provider-region evidence, an explicit deployment-region basis, and a rationale explaining why the region represents the measured state transition.', ['Deployment record', 'Provider region', 'Operational location', 'Documented exception rationale'], 'A server region is eligible only for that deployment event and cannot become the organization’s general location.', 'Provider, application, region code, timestamp, and organization identity are removed.', 'The deployment report marked the region as a documented exception and did not reuse it for legal formation.', 'The result demonstrates transparent location policy, not that a server location has predictive power.', ['first-deployment-method', 'event-location-policy']],
  ['dst-fold-corporate-event', 'Corporate event during a daylight-saving fold', 'A sanitized automated event occurs in a repeated local hour that maps to two valid UTC instants.', 'How does the system avoid choosing the favorable occurrence of an ambiguous clock time?', 'Resolve both offsets from the pinned timezone database, retain both candidate instants, and use independent server-offset evidence if available.', ['Local event timestamp', 'IANA timezone', 'Timezone database version', 'Offset-bearing secondary log'], 'Without offset evidence, both candidates remain and unstable features are withheld.', 'Location, date, clock reading, organization, and server log values are generalized.', 'The secondary record resolved one offset; before that evidence, the system refused a single exact chart.', 'Correct fold handling does not validate any interpretation of either candidate chart.', ['civil-time-resolution-for-organizations', 'event-time-confidence-method']],
  ['historical-timezone', 'Historical timezone uncertainty in an institutional record', 'A sanitized older institutional event has a recorded local time but uncertain historical clock practice.', 'Can modern timezone software make the event exact?', 'Preserve the source wording, compare plausible civil-time rules, construct an instant interval, and test chart features across all supported candidates.', ['Original record wording', 'Historical place and jurisdiction', 'Candidate clock regimes', 'Uncertainty rationale'], 'Database output is one reconstruction, not conclusive evidence; unstable features remain unpublished.', 'Institution, locality, year, archival locator, and all chart values are omitted.', 'Slow positions remained usable while the ascendant and houses were withheld.', 'Software precision cannot recover an undocumented historical offset.', ['civil-time-resolution-for-organizations', 'date-only-stability-audit']],
  ['evidence-digest', 'Evidence digest without raw-document publication', 'A sanitized formation case proves which private attachment was used without exposing its content.', 'How can the report remain reproducible while minimizing retained private data?', 'Hash bytes in memory, record SHA-256, size and generic media type privately, and publish only a sanitized evidence class and digest policy.', ['Private source attachment', 'SHA-256 digest', 'Evidence locator', 'Retention policy'], 'Byte identity is verifiable only when the later file reproduces the digest; authenticity remains a separate review.', 'The document, filename, issuer, identifier, byte count, digest value, and event timestamp are absent.', 'The case page exposes the method and evidence class while retaining no raw participant or organization record.', 'A matching digest does not prove that the source document is genuine or legally effective.', ['evidence-attachment-fingerprinting', 'legal-formation-event-selection']],
  ['deployment-versus-launch', 'Production deployment versus public launch', 'A sanitized product case separates successful production deployment from later customer-facing availability.', 'Which event should anchor a product milestone?', 'Record both events with distinct definitions and systems of record, then choose only the event predeclared by the research question.', ['Deployment telemetry', 'Public availability record', 'Event definitions', 'UTC timestamps'], 'Deployment cannot silently stand in for launch, and launch cannot erase the operational deployment chronology.', 'Product, provider, channel, times, regions, and organization are removed.', 'The system produced two linked event records and no blended midpoint.', 'The case demonstrates event separation, not that either chart predicts product adoption.', ['first-deployment-method', 'public-launch-method']],
  ['cross-jurisdiction-merger', 'Cross-jurisdiction merger event chain', 'A sanitized merger case contains approval, legal effect, and financial close across different jurisdictions and locations.', 'How is one corporate chart avoided when the transaction has several authoritative stages?', 'Represent each stage separately, retain jurisdiction and closing-location basis, and use the exact event requested by a preregistered analysis.', ['Approval notice', 'Effective filing', 'Closing record', 'Jurisdiction and location rationale'], 'No stage is called the merger “birth” without qualification; predecessor and successor histories remain intact.', 'Parties, countries, regulators, values, dates, and locations are replaced with generic roles.', 'Three event records were preserved, with legal-effect and close explicitly distinguished.', 'This case does not determine legal effect, transaction quality, valuation, or future integration success.', ['merger-acquisition-event-method', 'jurisdiction-versus-event-location']],
  ['parallel-frame', 'Parallel tropical and sidereal corporate comparison', 'A sanitized formation event is calculated in two zodiac frames without mixing labels or selecting the more compelling narrative.', 'How can two systems be compared against one unchanged event?', 'Freeze the event and ephemeris, derive frame-specific features, keep separate rule namespaces, and display agreement and disagreement without synthesis.', ['Frozen event digest', 'Tropical longitudes', 'Lahiri offset', 'Frame-specific outputs'], 'No cross-frame rule consumption is allowed unless preregistered; post-outcome model selection is prohibited.', 'Event, organization, timestamp, positions, signs, and any outcome are removed.', 'The demonstration retained one fact bundle and two labelled derived views.', 'Frame comparison does not establish that either zodiac predicts outcomes.', ['tropical-sidereal-corporate-comparison', 'corporate-outcome-preregistration']],
  ['repeated-ingress-chronology', 'Repeated ingress chronology around retrograde motion', 'A sanitized corporate milestone window contains three crossings of one zodiac boundary.', 'Which ingress date belongs in the event timeline?', 'Search the full interval, retain direct and retrograde crossing directions, and relate the corporate event to all crossings rather than selecting the closest favorable one.', ['Planetary event search', 'Frame and ayanāṁśa', 'Crossing direction', 'Corporate event window'], 'All crossings in the interval remain in the chronology; none becomes “the” ingress without a predeclared selection rule.', 'Body, boundary, frame, event, dates, and organization are generalized.', 'The timeline retained three crossing records and prevented first-crossing cherry-picking.', 'Repeated chronology does not show that any crossing affected the milestone.', ['corporate-outcome-preregistration', 'tropical-sidereal-corporate-comparison']],
  ['ordinary-non-event-period', 'Ordinary non-event periods in a corporate corpus', 'A sanitized historical corpus pairs milestones with systematically sampled intervals in which the target event did not occur.', 'How does the dataset avoid containing only memorable company events?', 'Freeze a sampling clock, create candidate intervals independently of astrological features, require evidence-backed non-event records, and compile both classes through one state-vector schema.', ['Locked sampling schedule', 'Milestone definitions', 'Non-event evidence', 'Identical feature pipeline'], 'Unselected quiet periods cannot be added after feature inspection, and missing evidence cannot masquerade as a non-event.', 'Organization, business metrics, interval dates, features, and corpus identifiers are removed.', 'The corpus retained ordinary periods in the denominator instead of evaluating only milestones.', 'Balanced recordkeeping does not demonstrate predictive signal; it merely makes a valid test possible.', ['corporate-outcome-preregistration', 'outcome-leakage-refusal-case-study']],
  ['outcome-leakage-refusal', 'Outcome leakage causes forecast refusal', 'A sanitized benchmark attempt supplies a milestone whose outcome was already known before model registration.', 'Can the event be used as a prospective forecast?', 'Compare registration, action, observation, and retrieval chronology; reject any forecast created after outcome availability; retain the example only as exploratory history.', ['Registration timestamp', 'Action window', 'Outcome availability time', 'Model and feature digest'], 'A post-outcome record cannot enter confirmatory scoring regardless of whether the prediction matches.', 'Metric, event, organization, timestamps, model values, and result direction are excluded.', 'The system refused prospective status and labelled the record retrospective.', 'A correct retrospective match is not evidence of forecasting ability.', ['corporate-outcome-preregistration', 'ordinary-non-event-period-case-study']],
  ['estimated-time-sensitivity', 'Estimated event time changes house geometry', 'A sanitized operational milestone has a narrow-looking estimate that still crosses an ascendant boundary.', 'Should the midpoint chart display organization houses?', 'Construct the full estimate interval, solve the ascendant throughout it, and withhold house applications whenever the sign or whole-sign mapping changes.', ['Estimate source', 'Uncertainty minutes', 'Observer location', 'Boundary sensitivity audit'], 'Displayed midpoint precision never overrides interval instability.', 'Event type, estimate, location, organization, and all placements are removed.', 'The system retained stable planetary facts while suppressing houses and significator applications.', 'Withholding unstable geometry does not establish that stable geometry would predict an outcome.', ['event-time-confidence-method', 'organization-house-stability-policy']],
] as const

const caseReferences: CorporateMundaneReference[] = CASES.map(([slug, title, description, question, method, evidenceRequired, decisionRule, sanitizationSpecific, sanitizedExample, limitations, relatedSlugs]) => ({
  slug: `${slug}-case-study`, kind: 'sanitized-case-study', title: `Sanitized case study: ${title}`, description, question, method, evidenceRequired,
  decisionRule, sanitizedExample, sanitization: `${COMMON_SANITIZATION} ${sanitizationSpecific}`,
  limitations, doesNotEstablish: COMMON_BOUNDARY, sourceIds: ['maha-corporate-report-contract', 'maha-celestial-fact-contract'], relatedSlugs,
  empiricalStatus: 'not-evidence-of-predictive-skill',
}))

export const CORPORATE_MUNDANE_REFERENCES: readonly CorporateMundaneReference[] = [...METHODOLOGIES, ...caseReferences]

const bySlug = new Map(CORPORATE_MUNDANE_REFERENCES.map((entry) => [entry.slug, entry]))
const sourceById = new Map(CORPORATE_MUNDANE_SOURCES.map((source) => [source.id, source]))

export function corporateMundaneReferencePath(entry: CorporateMundaneReference): string { return `${CORPORATE_MUNDANE_PATH}/${entry.slug}` }
export function getCorporateMundaneReference(slug: string): CorporateMundaneReference | undefined { return bySlug.get(slug) }
export function getCorporateMundaneSource(id: string): CorporateMundaneSource | undefined { return sourceById.get(id) }
export function getCorporateMundaneReferencesByKind(kind: CorporateMundaneKind): CorporateMundaneReference[] { return CORPORATE_MUNDANE_REFERENCES.filter((entry) => entry.kind === kind) }
