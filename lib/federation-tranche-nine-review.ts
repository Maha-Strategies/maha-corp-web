import {
  buildFederationTrancheReview,
  type FederationReviewPacket,
  type FederationReviewSource,
} from './federation-tranche-four-review.ts'

const reviewedOn = '2026-09-06'
const publicRights = 'Publicly accessible source; link and bounded paraphrase only. No source text is redistributed.'
const governmentRights = 'Official government source; link and bounded paraphrase only. No full text or time-sensitive operational value is retained.'
const localRights = 'Maha-controlled repository source; headings, symbols, and file identity only. No credential, customer value, runtime payload, private input, or receipt body is retained.'
const authorRights = 'Maha-controlled working authorial manuscript; bounded summary only. The packet does not imply publication, peer review, consensus, or empirical validation.'

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

const packet = (topicKey: string, reason: string, sources: FederationReviewSource[]): FederationReviewPacket => ({
  topicKey,
  disposition: 'evidence-ready',
  reason,
  sourceIdentityChecked: true,
  locatorChecked: true,
  rightsChecked: true,
  scopeChecked: true,
  boundaryChecked: true,
  sources,
})

const local = (sourceId: string, title: string, path: string, locator: string, scope: string, boundary: string, sourceClass = 'local-public-contract') => source(
  sourceId,
  title,
  'Maha Strategies',
  `repository source inspected ${reviewedOn}`,
  `repo:${path}`,
  sourceClass,
  locator,
  scope,
  boundary,
  localRights,
  'code-symbol',
)

const mahaPrinciple = (sourceId: string, locator: string, scope: string, boundary: string) => source(
  sourceId,
  'The Maha Principle',
  'Mayone Maharajan',
  `working authorial manuscript inspected ${reviewedOn}`,
  'repo:content/books/the-maha-principle/The-Maha-Principle.md',
  'authorial-primary-source',
  locator,
  scope,
  boundary,
  authorRights,
  'book-section',
)

const tolkappiyam = source(
  'tolkappiyam-porul-5-t9',
  'Tolkāppiyam III: Poruḷatikāram',
  'Project Madurai text preserved by TextGrid',
  'TextGrid version dated 2025-05-27; Project Madurai base text prepared 1999–2001',
  'https://textgridrep.org/browse/49tqk.0',
  'primary-literary-text',
  'Akattiṇaiyiyal, nūṟpā 5, complete six-line deity-and-landscape stanza',
  'The edition places Māyōṉ with mullai and Cēyōṉ with kuṟiñci as two relations in one literary landscape classification.',
  'The stanza establishes wording and literary classification, not chronology, ethnic ownership, universal worship, a complete pantheon, or later theological identity.',
  'CC BY-NC-SA 4.0 for the TextGrid representation; short quotation with attribution.',
  'exact-passage',
)

const paripatal = source(
  'project-madurai-paripatal-t9',
  'Paripāṭal and Paripāṭal Tiraṭṭu',
  'Project Madurai',
  'Unicode Tamil edition first published 2000; page notice updated through 2021',
  'https://www.projectmadurai.org/pm_etexts/utf8/pmuni0087.html',
  'primary-literary-text',
  'Tirumāl poems 1–4, 13 and 15; especially poem 2 lines 20–25 and poem 3 lines 31–40',
  'The inspected edition preserves named devotional epithets, associated figures, poetic places, and compressed mythic allusions in specific Tirumāl poems.',
  'An epithet occurrence establishes wording in one passage; it does not establish identity in every text, chronology, historical influence, or theological truth.',
  'Project Madurai permits free distribution with its header intact; this packet links and paraphrases only.',
  'exact-passage',
)

const divyaPrabandham = source(
  'divya-prabandham-part-4-t9',
  'Nālāyira Divya Prabandham, Part 4: English translation',
  'Project Madurai; translated by Kausalya Hart',
  'Project Madurai translation containing pāsurams 2971–4000',
  'https://www.projectmadurai.org/pm_etexts/utf8/pmuni0624_eng.html',
  'primary-text-in-translation',
  'Tiruvāymoḻi pāsurams 3052–3054, 3147–3150, 3211–3232, 3244–3254 and 3288–3298',
  'The named translation renders later devotional occurrences of forms including Māyan, Māl, Kaṇṇan, Nārāyaṇa, and Neṭumāl at exact numbered units.',
  'This establishes one translator’s rendering, not the untranslated Tamil’s complete range, continuity from Sangam texts, timeless equivalence, or theological truth.',
  'Project Madurai distribution terms; limited quotation and bounded paraphrase with translator attribution.',
  'exact-passage',
)

const astrology = local(
  'local-astrology-selection-t9',
  'Astrology workflow protocols',
  'lib/astrology-workflow-protocols.ts',
  'COMMON_BOUNDARY; house-system-eligibility; house-system-decision-map; tropical-sidereal-decision-map; geocentric-topocentric-decision-map; mean-true-node-decision-map; hellenistic-jyotisha-decision-map; natal-horary-mundane-scope-map',
  'The protocols keep coordinate choices, chart classes, rule namespaces, eligibility, withheld outputs, and prospective evaluation separate and explicit.',
  'The protocols establish reproducibility and declared scope only. They do not validate astrology, select an empirically superior tradition, or turn interpretation into astronomical fact.',
)

export const TRANCHE_NINE_NEW_PACKETS: Record<string, FederationReviewPacket> = {
  'agentic-publishing:citation-verification': packet('agentic-publishing:citation-verification', 'Crossref supports identifier resolution and deposited-metadata retrieval, while the packet preserves the gap between bibliographic verification and claim verification.', [
    source('crossref-metadata-retrieval-t9', 'Metadata Retrieval', 'Crossref', 'living documentation updated 16 October 2025; inspected 2026-09-06', 'https://www.crossref.org/documentation/retrieve-metadata/', 'scholarly-metadata-service', 'Sources of metadata; REST API; Content negotiation; access and authentication', 'Crossref exposes member-deposited bibliographic metadata and relationships through human, API, content-negotiation, and bulk interfaces.', 'Crossref primarily receives metadata rather than scraping full text. A returned record does not prove metadata completeness, source access, passage support, rights, or truth.'),
    source('crossref-registration-verification-t9', 'Verify your registration', 'Crossref', 'living documentation updated 10 December 2025; inspected 2026-09-06', 'https://www.crossref.org/documentation/register-maintain-records/verify-your-registration/', 'scholarly-metadata-service', 'DOI resolution check; successful and failed deposit states; submission queue caveat', 'Resolution through doi.org can confirm that a DOI is live and identify its configured landing page after registration.', 'Resolution proves neither that the landing content was inspected nor that it supports a claim, names the intended version, is reusable, or remains complete.'),
  ]),
  'agentic-publishing:retraction-policy': packet('agentic-publishing:retraction-policy', 'COPE supplies editorial grounds and notice properties while Crossmark supplies a publisher-deposited status channel; neither independently adjudicates truth or misconduct.', [
    source('cope-retraction-v2-t9', 'Retraction Guidelines', 'COPE Council', 'version 2, November 2019', 'https://doi.org/10.24318/cope.2019.1.4', 'editorial-guidance', 'Summary; When should a publication be retracted?; What form should a retraction take?', 'Reasons for considering retraction and notice properties including linkage, identification, reason, responsibility, promptness, and accessibility.', 'The guidance does not itself retract an object, adjudicate misconduct, resolve every correction case, or create universal law.'),
    source('crossref-crossmark-retraction-t9', 'Crossmark documentation', 'Crossref', `living service documentation inspected ${reviewedOn}`, 'https://www.crossref.org/documentation/crossmark/', 'scholarly-status-service', 'Crossmark; Benefits; How Crossmark works; publisher obligations', 'Publisher-deposited metadata can expose current status and link corrections, retractions, or other updates.', 'Crossmark depends on publisher deposits and does not determine truth, misconduct, notice adequacy, or completeness.'),
  ]),
  'maha-os:emergency-override': packet('maha-os:emergency-override', 'HIPAA requires an emergency-access procedure inside a broader identity, access, audit, integrity, and authentication framework; NIST supplies temporary-account and least-privilege controls without licensing unrestricted access.', [
    source('ecfr-45-164-312-t9', '45 CFR § 164.312 — Technical safeguards', 'U.S. Department of Health and Human Services', `current eCFR text inspected ${reviewedOn}`, 'https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C/section-164.312', 'regulation', '§164.312(a)(1), (a)(2)(i)–(ii), (b), (c), and (d)', 'Covered entities and business associates must implement access control, unique user identification, necessary emergency access procedures, audit controls, integrity protection, and person or entity authentication for ePHI.', 'This is limited to HIPAA-regulated ePHI and does not prescribe one break-glass architecture, permit unrestricted access, displace minimum-necessary analysis, or provide legal advice.', governmentRights),
    source('nist-sp-800-53-emergency-t9', 'Security and Privacy Controls for Information Systems and Organizations', 'National Institute of Standards and Technology', 'SP 800-53 Rev. 5.1.1', 'https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final', 'government-guidance', 'AC-2(2) Temporary and Emergency Accounts; AC-3 Access Enforcement; AC-6 Least Privilege; AU-2 Event Logging; AU-3 Content of Audit Records; IA-2 Identification and Authentication', 'A system can constrain emergency identities through managed duration, approved authorization, least privilege, enforcement, authentication, and auditable event records.', 'Control selection does not establish implementation effectiveness, legal compliance, safe clinical use, or authority for a particular emergency action.', governmentRights),
  ]),
  'maha-policy:scientific-evidence-policy': packet('maha-policy:scientific-evidence-policy', 'OMB and OSTP supply a U.S.-federal, question-to-method and scientific-integrity frame; the packet does not convert that frame into universal science policy or guarantee a correct decision.', [
    source('omb-m-21-27-evidence-t9', 'Evidence-Based Policymaking: Learning Agendas and Annual Evaluation Plans', 'U.S. Office of Management and Budget', 'Memorandum M-21-27, 30 June 2021', 'https://www.whitehouse.gov/wp-content/uploads/2021/06/M-21-27.pdf', 'government-policy-memorandum', 'Governing Based on Evidence, pp. 1–3; strategic evidence plans and priority questions, pp. 8–10; methods, quality, transparency and machine-readable plans, pp. 10–12', 'Covered federal agencies are directed to connect priority questions to fit-for-purpose methods, quality across the evidence lifecycle, transparent plans, and learning agendas.', 'The memorandum implements U.S. federal evidence policy; it does not prescribe one preferred method, guarantee policy correctness, or create universal scientific law.', governmentRights, 'full-text'),
    source('ostp-scientific-integrity-policy-t9', 'OSTP Scientific Integrity Policy', 'White House Office of Science and Technology Policy', '2023 policy', 'https://www.whitehouse.gov/wp-content/uploads/2023/06/OSTP-SCIENTIFIC-INTEGRITY-POLICY.pdf', 'government-policy', 'Purpose and scope; scientific integrity principles; monitoring and evaluating scientific-integrity activities and outcomes', 'OSTP defines responsibilities and an evaluation programme for scientific integrity in federal scientific activities and evidence-informed decisions.', 'This is an OSTP institutional policy within the U.S. federal context; it does not certify a particular study, inference, agency implementation, or policy outcome.', governmentRights, 'full-text'),
  ]),
  'maha-policy:semiconductor-policy': packet('maha-policy:semiconductor-policy', 'The U.S. CHIPS Act and EU Chips Act establish two jurisdiction-specific mixes of funding, capacity, R&D, coordination, monitoring, and crisis response; policy mechanisms remain distinct from measured outcomes.', [
    source('us-chips-public-law-117-167-t9', 'CHIPS and Science Act of 2022', 'United States Congress', 'Public Law 117-167, 9 August 2022', 'https://www.congress.gov/117/plaws/publ167/PLAW-117publ167.pdf', 'law', 'Division A §§101–107; 15 U.S.C. §§4651–4659; Division B semiconductor R&D, workforce and research provisions', 'The statute establishes U.S. semiconductor incentive, research, manufacturing, workforce, guardrail, and related programme authorities and appropriations.', 'The statute applies in its own jurisdiction and delegated programmes; authorization or funding is not evidence that a project succeeded, capacity was delivered, or a current award remains available.', governmentRights, 'full-text'),
    source('eu-chips-regulation-2023-1781-t9', 'Regulation (EU) 2023/1781 establishing a framework of measures for strengthening Europe’s semiconductor ecosystem', 'European Parliament and Council', 'Official Journal, 13 September 2023', 'https://eur-lex.europa.eu/eli/reg/2023/1781/oj/eng', 'law', 'Articles 1–3; Chapters II–IV, including Articles 4–17 and 22–27', 'The regulation defines EU semiconductor objectives and mechanisms for initiative capacity, integrated production and open foundries, coordination, monitoring, and crisis response.', 'EU legal scope, phased implementation, delegated acts, Member-State action, and current programme state must be checked separately; the regulation does not prove industrial outcomes or supply security.', governmentRights, 'full-text'),
  ]),
  'maha-research:evidence-graph': packet('maha-research:evidence-graph', 'W3C PROV supplies typed provenance relations and DataCite supplies versioned scholarly metadata; an evidence graph remains an asserted model whose edges require claim-specific review.', [
    source('w3c-prov-o-evidence-graph-t9', 'PROV-O: The PROV Ontology', 'W3C', 'Recommendation, 30 April 2013', 'https://www.w3.org/TR/prov-o/', 'web-standard', 'Entities, Activities and Agents; used; wasGeneratedBy; wasDerivedFrom; wasAssociatedWith; wasAttributedTo', 'PROV-O can represent typed provenance between entities, activities, agents, inputs, outputs, derivations, associations, and attributions.', 'PROV represents asserted provenance; it does not verify truth, completeness, authentication, rights, causal validity, or passage-level claim support.'),
    source('datacite-schema-evidence-graph-t9', 'DataCite Metadata Schema Documentation', 'DataCite', 'version 4.6', 'https://datacite-metadata-schema.readthedocs.io/en/4.6/', 'metadata-specification', 'Identifier; Creator; Contributor; Version; RelatedIdentifier; Rights', 'Versioned metadata can name research objects, contributors, versions, typed relations, and rights statements.', 'Metadata fields do not establish source quality, lawful collection, relationship truth, or that one object supports another object’s claim.'),
  ]),
  'maha-research:full-text-evidence': packet('maha-research:full-text-evidence', 'PMC distinguishes free-to-read records from rights-cleared reuse and exposes licensed full text through authorized dataset interfaces; full text still requires exact claim and locator review.', [
    source('pmc-oai-full-text-t9', 'PMC OAI-PMH API', 'U.S. National Library of Medicine', `living API documentation inspected ${reviewedOn}`, 'https://pmc.ncbi.nlm.nih.gov/tools/oai/', 'government-repository-api', 'set=pmc-open; metadataPrefix=pmc and pmc_fm; OAI PMC identifiers', 'The API exposes metadata for PMC items and full text for records whose licenses or usage rights allow reuse; set=pmc-open identifies retrievable full-text items.', 'API retrieval does not prove claim relevance, inspection, version equivalence, or that every PMC item permits reuse.', governmentRights),
    source('pmc-copyright-t9', 'PMC Copyright Notice', 'U.S. National Library of Medicine', 'modified 9 September 2025', 'https://pmc.ncbi.nlm.nih.gov/about/copyright/', 'government-repository-policy', 'Restrictions on systematic downloading; Open Access Articles; Author Manuscripts; Digitized Articles', 'PMC identifies authorized bulk interfaces and distinguishes OA-subset licences, author manuscripts, public-domain records, and traditionally copyrighted free-to-read articles.', 'Free access is not the same as an open licence. Third-party figures may carry separate rights, and systematic main-site downloading is prohibited.', governmentRights),
  ]),
  'maha-research:government-mirror': packet('maha-research:government-mirror', 'GovInfo exposes package and granule identities, permanent content links, metadata, APIs, and signed-PDF authentication; official hosting and authenticity remain separate from claim support.', [
    source('govinfo-api-and-urls-t9', 'GovInfo API and link service', 'U.S. Government Publishing Office', `living documentation inspected ${reviewedOn}`, 'https://www.govinfo.gov/features/api', 'government-repository-api', 'API overview; package and granule endpoints; content and metadata downloads; API-key requirement', 'GovInfo provides programmatic discovery and retrieval for official content, package and granule metadata, and rendition links.', 'An API response establishes repository identity and supplied metadata only; it does not prove a document supports a claim, is current law, or applies to a specific fact.', governmentRights),
    source('govinfo-authentication-t9', 'Authentication', 'U.S. Government Publishing Office', `living documentation inspected ${reviewedOn}`, 'https://www.govinfo.gov/about/authentication', 'government-authentication-guidance', 'Digital signatures for official PDFs; verification status and document-integrity explanation', 'Digital signatures can support verification that an official PDF was issued by GPO and has not changed since signing.', 'Signature verification does not establish that the document is current, applicable, complete for a question, or substantively correct.', governmentRights),
  ]),
  'maha-research:reproducibility': packet('maha-research:reproducibility', 'The National Academies separates computational reproducibility from independent replication, while the local witness records bounded execution metadata and independently verifies its digest.', [
    source('nasem-reproducibility-2019-t9', 'Reproducibility and Replicability in Science', 'National Academies of Sciences, Engineering, and Medicine', 'Consensus Study Report, 2019', 'https://nap.nationalacademies.org/catalog/25303/reproducibility-and-replicability-in-science', 'consensus-study-report', 'Chapter 3, Understanding Reproducibility and Replicability; report summary definitions', 'Computational reproducibility means obtaining consistent computational results with the same data, steps, methods, code, and analysis conditions; replicability uses new data to answer the same scientific question.', 'Reproducibility does not establish scientific correctness or external validity, and a failed replication does not by itself identify which study or condition is wrong.'),
    local('local-computational-witness-repro-t9', 'Maha computational provenance witness', 'packages/maha-witness/README.md', 'Recorded fields; Adapter boundary; Assurance boundary; verification command', 'The witness records execution identity, bounded environment metadata, seeds, configuration, and artifact hashes, and verifies the receipt digest offline.', 'It does not capture arguments, arbitrary environment variables, paths, file contents, or credentials and does not establish scientific correctness, complete environment capture, or independent reproduction.', 'local-implementation-documentation'),
  ]),
  'maha-research:scope-matching': packet('maha-research:scope-matching', 'NIST requires intended context, assumptions, knowledge limits, and generalization limits to be stated; the local preflight refuses overbroad scope and unsupported inference without pretending to verify a dossier.', [
    source('nist-ai-rmf-scope-t9', 'Artificial Intelligence Risk Management Framework (AI RMF 1.0)', 'National Institute of Standards and Technology', 'NIST AI 100-1, January 2023', 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf', 'government-guidance', 'MAP 1.1; MAP 2.2–2.3; MEASURE 2.5', 'The framework calls for intended context, assumptions, knowledge limits, scientific integrity, and generalization limits to remain explicit.', 'The voluntary framework does not determine whether a particular source supports a claim or validate a model, inference, result, or deployment.', governmentRights),
    local('local-evidence-preflight-scope-t9', 'Maha Evidence Preflight contract', 'lib/evidence-preflight-contract.ts', 'EvidencePreflightBlocker; exact-locator-missing; claim-scope-overbroad; unsupported-inference-risk; rights-basis-unresolved', 'The local preflight separately records source identity, exact locator, evidence status, scope overbreadth, unsupported inference, rights, and access blockers.', 'The preflight is automated and structural. It does not independently inspect a source, verify a dossier, retain submitted content by default, or establish claim truth.'),
  ]),
  'maha-research:slurm-job': packet('maha-research:slurm-job', 'Slurm defines batch submission and job metadata; the local adapter allowlists a small supplied metadata projection and neither submits nor observes a job.', [
    source('slurm-sbatch-t9', 'Slurm Workload Manager — sbatch', 'SchedMD', `current documentation inspected ${reviewedOn}`, 'https://slurm.schedmd.com/sbatch.html', 'scheduler-documentation', 'DESCRIPTION; #SBATCH directives; input environment variables; output environment variables; RETURN VALUE', 'sbatch submits a batch script, assigns a job identifier, applies directive and option precedence, and makes named SLURM_* metadata available to the job environment.', 'Successful submission is not successful execution, scientific validity, resource availability, or proof that an output came from the named job.'),
    local('local-slurm-witness-adapter-t9', 'Maha SLURM witness adapter', 'packages/maha-witness/src/maha_witness/adapters.py', 'slurm_metadata; allowlisted SLURM_ARRAY_JOB_ID, SLURM_ARRAY_TASK_ID, SLURM_CLUSTER_NAME, SLURM_CPUS_PER_TASK, SLURM_JOB_ID, SLURM_JOB_NAME, SLURM_NNODES and SLURM_JOB_PARTITION', 'The adapter normalizes a caller-supplied, allowlisted subset of SLURM metadata into a deterministic witness field set.', 'The adapter does not submit a job, contact Slurm, capture arbitrary environment values, prove scheduler identity, prove job completion, or establish output correctness.'),
  ]),
  'maha-strategies:divine-epithets': packet('maha-strategies:divine-epithets', 'Primary-text occurrences support an occurrence-level identity map only when text, translation, passage, poetic voice, and period remain attached.', [paripatal, divyaPrabandham]),
  'maha-strategies:epistemic-clearance': packet('maha-strategies:epistemic-clearance', '“Epistemic clearance” is a Maha operating label synthesized from an authorial verification filter and the local preflight gate; neither source presents it as settled epistemology or independent certification.', [
    mahaPrinciple('maha-principle-epistemic-clearance-t9', 'The Trinity of Verification: Three Filters for a Noisy World; Ontological Arbitrage; glossary entry Trinity of Verification', 'The manuscript proposes an authorial three-filter practice for evaluating significant claims and keeping incentive, coherence, and consequence questions visible.', 'The manuscript does not use “epistemic clearance” as an established term, prove its filters valid, certify an accepted claim, or substitute for domain expertise and source inspection.'),
    local('local-evidence-preflight-clearance-t9', 'Maha Evidence Preflight contract', 'lib/evidence-preflight-contract.ts', 'EvidencePreflightClaimAssessment; blockers; privacy and offer boundaries', 'The local contract emits bounded structural findings for source identity, locator, claim scope, evidence status, inference risk, and rights/access limitations.', 'A preflight result is not an independently verified Evidence Dossier, expert endorsement, legal clearance, or proof of truth.'),
  ]),
  'maha-strategies:house-system-selection': packet('maha-strategies:house-system-selection', 'The local protocols make house-system eligibility and comparison reproducible while preserving unknown time, polar limitations, and tradition-specific rules.', [astrology]),
  'maha-strategies:kurinji': packet('maha-strategies:kurinji', 'The exact landscape stanza supports a Cēyōṉ–kuṟiñci literary relation without turning a classified poetic relation into a complete history of worship.', [tolkappiyam]),
  'maha-strategies:mullai': packet('maha-strategies:mullai', 'The exact landscape stanza supports a Māyōṉ–mullai literary relation; Paripāṭal provides later passage-specific devotional context without proving uninterrupted identity.', [tolkappiyam, paripatal]),
  'maha-strategies:recursive-institutions': packet('maha-strategies:recursive-institutions', '“Recursive institutions” is an editorial label for the manuscript’s authorial proposal that related governance patterns recur across personal, household, community, and state scales.', [
    mahaPrinciple('maha-principle-recursive-institutions-t9', 'The Fractal: As the Cell, So the State; The Three Scales of Construction; The Maha Rosetta Stone: One War, Four Battlefields; Subsidiarity and scale-error discussion; Zone of Exception', 'The manuscript proposes scale-aware, locally competent governance and recurring patterns linking individual practice, household, community, and civic institutions.', 'The manuscript does not use “recursive institutions” as a settled academic term, prove structural identity across scales, establish causal outcomes, or validate its institutional proposals.'),
  ]),
  'maha-strategies:tradition-comparison': packet('maha-strategies:tradition-comparison', 'The local protocols compare declared frames and rule namespaces symmetrically and require prospective evidence before naming a performance winner.', [astrology]),
}

export const TRANCHE_NINE_DECISION_OVERRIDES = {
  'maha-policy:agent-identity:current-law': {
    disposition: 'revise',
    reason: 'The inspected packet contains workload-identity and human digital-identity standards, not a jurisdiction-specific statute or regulation. A current-law page would overstate the source class.',
  },
  'maha-policy:public-sector-procurement:current-law': {
    disposition: 'revise',
    reason: 'The inspected source is OMB Memorandum M-25-22, a bounded federal policy instrument rather than a statute or regulation. The candidate must be renamed or supplied with exact jurisdiction-specific law.',
  },
} as const

type ReviewInput = Omit<Parameters<typeof buildFederationTrancheReview>[0], 'trancheNumber' | 'additionalPackets' | 'decisionOverrides'>

export function buildTrancheNineReview(input: ReviewInput) {
  return buildFederationTrancheReview({
    ...input,
    trancheNumber: 9,
    additionalPackets: TRANCHE_NINE_NEW_PACKETS,
    decisionOverrides: TRANCHE_NINE_DECISION_OVERRIDES,
  })
}
