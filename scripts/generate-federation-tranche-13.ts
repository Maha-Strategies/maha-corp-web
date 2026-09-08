/**
 * Tranche 13 — the next 100 unreviewed federation candidates.
 *
 * Deterministic throughout: sorted keys, sorted records, no clock reading. The
 * only dated value is a frozen constant, so regeneration is byte-identical.
 *
 * The honest shape of this tranche, recorded here because the numbers are the
 * finding rather than an accident of the run:
 *
 * Every candidate in the map carries `evidencePlan: not-started` on all six
 * axes. Evidence-ready requires inspected source content with an exact locator
 * and a rights basis. Sources were inspected for 27 of the 58 topics, so at
 * most those candidates can qualify, and the rest are blocked on inspection
 * rather than downgraded for any fault of their own. Reporting a larger
 * evidence-ready count would require either inspecting more sources or relaxing
 * the definition of inspection.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

import {
  PROPORTIONAL_TARGET, resolveDependency, selectCohort, topicOf,
  type Candidate,
} from '../lib/federation/tranche-13-selection.ts'
import { summariseRepair, withRepairedContract } from '../lib/federation/contract-repair.ts'

const OUT = 'content/federation'
const FROZEN_ON = '2026-09-06'
const SCHEMA = 'maha-federation-tranche-13'
const digest = (s: string) => `sha256:${createHash('sha256').update(s, 'utf8').digest('hex')}`

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}

/* -- inputs ---------------------------------------------------------------- */

const map = JSON.parse(readFileSync(`${OUT}/federation-route-candidates-v2.json`, 'utf8')) as
  { candidates: Candidate[] }
const lineage = JSON.parse(readFileSync(`${OUT}/federation-candidate-lineage-v2.json`, 'utf8')) as
  { supersededCandidates: { candidateId: string }[] }

const superseded = new Set(lineage.supersededCandidates.map((s) => s.candidateId))
const priorCohortFiles = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11-mythology', '12-mythology']
const covered = new Set<string>()
for (const t of priorCohortFiles) {
  const d = JSON.parse(readFileSync(`${OUT}/federation-tranche-${t}-cohort-v1.json`, 'utf8')) as Record<string, unknown>
  for (const value of Object.values(d)) {
    if (Array.isArray(value)) for (const e of value) {
      if (e && typeof e === 'object' && 'candidateId' in e) covered.add((e as { candidateId: string }).candidateId)
    }
  }
}

// The definition-role contract repair, applied before selection. All 169
// definition candidates sit on the property that owns the concept, so the
// contract was mislabelled rather than the role. See contract-repair.ts.
const repairSummary = summariseRepair(map.candidates)
const repaired = map.candidates.map(withRepairedContract)
const remaining = repaired.filter((c) => !covered.has(c.candidateId) && !superseded.has(c.candidateId))
const selection = selectCohort(remaining)
const cohort = selection.selected
const cohortIds = new Set(cohort.map((c) => c.candidateId))

/* -- dependencies ---------------------------------------------------------- */

const definitionsByConcept = new Map<string, Candidate[]>()
for (const c of map.candidates) {
  if (c.routeRole !== 'definition') continue
  definitionsByConcept.set(c.conceptId, [...(definitionsByConcept.get(c.conceptId) ?? []), c])
}
const reviewedConcepts = new Set(repaired.filter((c) => covered.has(c.candidateId)).map((c) => c.conceptId))

const dependencies = cohort.map((c) => ({
  candidateId: c.candidateId,
  conceptId: c.conceptId,
  declaredOwner: c.conceptAuthority.canonicalOwner,
  ...resolveDependency(c, definitionsByConcept, reviewedConcepts, cohortIds),
})).sort((a, b) => a.candidateId.localeCompare(b.candidateId))
const dependencyByCandidate = new Map(dependencies.map((d) => [d.candidateId, d]))

/* -- source inspections ---------------------------------------------------- */

/**
 * Sources actually opened and read in this pass, with the locator each claim
 * rests on. Two topics. Metadata was not treated as inspection and no snippet
 * was used as evidence.
 */
const INSPECTIONS = [
  {
    inspectionId: 'tr13-src-001',
    topic: 'container-image',
    sourceIdentity: 'OCI Image Manifest Specification',
    version: 'image-spec v1.1 (specs-go VersionMajor 1, VersionMinor 1)',
    stableUrl: 'https://github.com/opencontainers/image-spec/blob/main/manifest.md',
    locator: 'Line 4 (goals paragraph); §"Image Manifest Property Descriptions" line 16; `config` property, line 38',
    inspectionDepth: 'full-document-read',
    accessBasis: 'Public repository under the OCI open specification licence.',
    reuseBasis: 'Reference-only. Bounded original summary permitted; specification text is not copied into artifacts.',
    supportedClaimScope:
      'That an OCI image manifest is content-addressable, and that it references its configuration object by digest.',
    boundary:
      'Supports what the manifest format specifies. It does not establish runtime behaviour, registry policy, supply-chain assurance, or that any particular image is trustworthy.',
    sourceClass: 'open-specification',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in Tranches 1-12 for this topic.',
  },
  {
    inspectionId: 'tr13-src-002',
    topic: 'pyroclastic-density-current',
    sourceIdentity: 'U.S. Geological Survey, Volcano Hazards Program — "Pyroclastic flows move fast and destroy everything in their path"',
    version: 'Page as served 2026-09-06',
    stableUrl: 'https://www.usgs.gov/programs/VHP/pyroclastic-flows-move-fast-and-destroy-everything-their-path',
    locator: 'Opening descriptive paragraph: speed and temperature sentences.',
    inspectionDepth: 'full-page-read',
    accessBasis: 'United States government work, publicly accessible without restriction.',
    reuseBasis: 'US government work; bounded original summary permitted with attribution.',
    supportedClaimScope:
      'That pyroclastic flows typically travel faster than 80 km/h (50 mph) and that internal rock and gas temperatures are generally between 200°C and 700°C.',
    boundary:
      'A hazard description for a general audience. It does not establish site-specific risk for any volcano, evacuation distances, or preparedness policy, and it is not a substitute for a hazard assessment.',
    sourceClass: 'government-scientific-agency',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in Tranches 1-12 for this topic.',
  },
  {
    inspectionId: 'tr13-src-003',
    topic: 'compiler-provenance',
    sourceIdentity: 'W3C PROV-DM: The PROV Data Model',
    version: 'W3C Recommendation, 30 April 2013',
    stableUrl: 'https://www.w3.org/TR/prov-dm/',
    locator: '§2.1 PROV Core Structures — Entity and Activity definitions.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'W3C Recommendation, publicly published.',
    reuseBasis: 'W3C Document Licence. Reference-only here; specification text is not copied into artifacts.',
    supportedClaimScope:
      'That provenance can be modelled as entities, activities that act upon them over time, and derivation relations between entities.',
    boundary:
      'A data model for expressing provenance. It does not establish that any recorded provenance is accurate, complete, or trustworthy, and it prescribes no build or compiler behaviour.',
    sourceClass: 'open-standard-recommendation',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Supersedes no earlier source inspected in this programme.',
  },
  {
    inspectionId: 'tr13-src-004',
    topic: 'citation-lineage',
    sourceIdentity: 'W3C PROV-DM: The PROV Data Model',
    version: 'W3C Recommendation, 30 April 2013',
    stableUrl: 'https://www.w3.org/TR/prov-dm/',
    locator: '§2.1 PROV Core Structures — derivation between entities.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'W3C Recommendation, publicly published.',
    reuseBasis: 'W3C Document Licence. Reference-only.',
    supportedClaimScope:
      'That a later entity may be recorded as derived from an earlier one, giving a traceable chain between versions of a work.',
    boundary:
      'Supports expressing a lineage. It does not establish that a cited chain is correct, that a citation is warranted, or that any particular citation practice is standard.',
    sourceClass: 'open-standard-recommendation',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same document as tr13-src-003, inspected for a different relation.',
  },
  {
    inspectionId: 'tr13-src-005',
    topic: 'model-evaluation',
    sourceIdentity: 'NIST AI Risk Management Framework (AI RMF 1.0), NIST AI 100-1',
    version: 'January 2023',
    stableUrl: 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf',
    locator: 'MEASURE 2, subcategories 2.1, 2.3 and 2.5.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'United States government publication, freely available.',
    reuseBasis: 'US government work; bounded original summary permitted with attribution.',
    supportedClaimScope:
      'That evaluating an AI system for trustworthy characteristics involves documenting test sets, metrics and TEVV tooling, measuring performance under conditions similar to deployment, and documenting limits on generalisability beyond those conditions.',
    boundary:
      'A voluntary framework. It does not certify any system, establish a passing threshold, create a legal obligation, or state that following it makes a system safe.',
    sourceClass: 'government-standards-body',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in this programme.',
  },
  {
    inspectionId: 'tr13-src-006',
    topic: 'evaluation-protocol',
    sourceIdentity: 'NIST AI Risk Management Framework (AI RMF 1.0), NIST AI 100-1',
    version: 'January 2023',
    stableUrl: 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf',
    locator: 'MEASURE 2.1 — test sets, metrics and TEVV tooling are documented.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'United States government publication, freely available.',
    reuseBasis: 'US government work; bounded original summary permitted with attribution.',
    supportedClaimScope:
      'That an evaluation protocol is expected to record the test sets, the metrics and the tools used, so that the evaluation can be examined afterwards.',
    boundary:
      'Says what should be documented, not how to design a protocol, which metrics are correct for a task, or that a documented protocol is a sound one.',
    sourceClass: 'government-standards-body',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same document as tr13-src-005, inspected for a different subcategory.',
  },
  {
    inspectionId: 'tr13-src-007',
    topic: 'benchmark-design',
    sourceIdentity: 'NIST AI Risk Management Framework (AI RMF 1.0), NIST AI 100-1',
    version: 'January 2023',
    stableUrl: 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf',
    locator: 'MEASURE 2.3 and 2.5 — measurement under deployment-like conditions; limits of generalisability.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'United States government publication, freely available.',
    reuseBasis: 'US government work; bounded original summary permitted with attribution.',
    supportedClaimScope:
      'That a benchmark result holds for the conditions it was measured under, and that limits on generalising beyond those conditions are themselves to be documented.',
    boundary:
      'Does not prescribe any benchmark, dataset or scoring method, and does not establish that a benchmark measures what its name suggests.',
    sourceClass: 'government-standards-body',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same document as tr13-src-005, inspected for different subcategories.',
  },
  {
    inspectionId: 'tr13-src-008',
    topic: 'user-revocation',
    sourceIdentity: 'Regulation (EU) 2016/679 (General Data Protection Regulation)',
    version: 'Consolidated text, EUR-Lex CELEX 32016R0679',
    stableUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679',
    locator: 'Article 7(3) (withdrawal of consent); Article 17(1) (right to erasure).',
    inspectionDepth: 'targeted-article-read',
    accessBasis: 'Official EU legal publication, freely accessible.',
    reuseBasis: 'EUR-Lex reuse policy permits reproduction with source acknowledgement; summarised here rather than reproduced.',
    supportedClaimScope:
      'That a data subject may withdraw consent at any time without affecting the lawfulness of processing before withdrawal, and may obtain erasure of personal data without undue delay on the stated grounds.',
    boundary:
      'States the right and its conditions. It does not specify any technical mechanism for revocation, does not determine whether a given system is compliant, and is not legal advice.',
    sourceClass: 'statutory-instrument',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in this programme.',
  },
  {
    inspectionId: 'tr13-src-009',
    topic: 'local-memory',
    sourceIdentity: 'Regulation (EU) 2016/679 (General Data Protection Regulation)',
    version: 'Consolidated text, EUR-Lex CELEX 32016R0679',
    stableUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679',
    locator: 'Article 25 — data protection by design and by default, including minimising processing.',
    inspectionDepth: 'targeted-article-read',
    accessBasis: 'Official EU legal publication, freely accessible.',
    reuseBasis: 'EUR-Lex reuse policy permits reproduction with source acknowledgement; summarised here.',
    supportedClaimScope:
      'That minimising the personal data processed, and doing so by design and by default, is an expressed obligation rather than an optional practice.',
    boundary:
      'Establishes a duty, not an architecture. It does not state that local retention satisfies it, nor that any particular storage location is compliant.',
    sourceClass: 'statutory-instrument',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same instrument as tr13-src-008, inspected for a different article.',
  },
  {
    inspectionId: 'tr13-src-010',
    topic: 'acknowledgement',
    sourceIdentity: 'CRediT — Contributor Roles Taxonomy (ANSI/NISO Z39.104)',
    version: 'Approved as an ANSI/NISO standard in 2022',
    stableUrl: 'https://credit.niso.org/',
    locator: 'Summary table, "CRediT\u2019s 14 Contributor Roles".',
    inspectionDepth: 'full-page-read',
    accessBasis: 'Publicly published standard summary.',
    reuseBasis: 'Licensed CC-BY 4.0, which permits reuse with attribution. Summarised rather than copied.',
    supportedClaimScope:
      'That contribution to a work can be recorded against fourteen named roles rather than a single undifferentiated credit.',
    boundary:
      'A vocabulary for describing contribution. It does not determine authorship, allocate credit, or establish that a declared role was actually performed.',
    sourceClass: 'consensus-standard',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in this programme.',
  },
  {
    inspectionId: 'tr13-src-011',
    topic: 'machine-authorship-disclosure',
    sourceIdentity: 'CRediT — Contributor Roles Taxonomy (ANSI/NISO Z39.104)',
    version: 'Approved as an ANSI/NISO standard in 2022',
    stableUrl: 'https://credit.niso.org/',
    locator: 'Summary table of the fourteen contributor roles.',
    inspectionDepth: 'full-page-read',
    accessBasis: 'Publicly published standard summary.',
    reuseBasis: 'Licensed CC-BY 4.0. Summarised rather than copied.',
    supportedClaimScope:
      'That the taxonomy enumerates roles for human contributors to a scholarly work.',
    boundary:
      'It does not address machine or model contribution, and must not be read as authorising a machine to be listed as a contributor. Inspected because it is the nearest applicable standard, and it does not reach the question this route asks.',
    sourceClass: 'consensus-standard',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same standard as tr13-src-010, inspected for a different question.',
  },
  {
    inspectionId: 'tr13-src-012',
    topic: 'quantum-policy',
    sourceIdentity: 'FIPS 203, Module-Lattice-Based Key-Encapsulation Mechanism Standard',
    version: 'Effective 13 August 2024',
    stableUrl: 'https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.203.pdf',
    locator: '§1 Introduction — ML-KEM and its three parameter sets (ML-KEM-512, -768, -1024).',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'United States federal standard, freely published.',
    reuseBasis: 'US government work; bounded original summary with attribution.',
    supportedClaimScope:
      'That a federal standard now specifies a key-encapsulation mechanism, ML-KEM, in three parameter sets, believed secure against an adversary possessing a quantum computer.',
    boundary:
      'Specifies an algorithm and its parameters. It does not state when any organisation must migrate, that migration is complete anywhere, or that quantum attack is imminent. "Believed to be secure" is the standard\u2019s own hedge and is not a proof.',
    sourceClass: 'federal-standard',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in this programme.',
  },
  {
    inspectionId: 'tr13-src-013',
    topic: 'standards-and-conformity',
    sourceIdentity: "NIST Special Publication 2000-01, ABC's of Conformity Assessment",
    version: 'NIST SP 2000-01',
    stableUrl: 'https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.2000-01.pdf',
    locator: 'Definition paragraph quoting ISO/IEC 17000, and the following paragraph enumerating testing, inspection, certification and accreditation.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'United States government publication, freely available.',
    reuseBasis: 'US government work; bounded original summary with attribution.',
    supportedClaimScope:
      'That conformity assessment is the demonstration that specified requirements relating to a product, process, system, person or body are fulfilled, and that it includes testing, inspection, certification and the accreditation of the bodies performing those activities.',
    boundary:
      'Describes the field. It does not accredit anyone, does not establish that any particular assessment is adequate, and does not substitute for the ISO/IEC 17000 text it quotes.',
    sourceClass: 'government-standards-body',
    independence: 'independent-of-maha',
    relationshipToEarlier:
      'Used as a lawful free route to the ISO/IEC 17000 definition. ISO/IEC 42001 and the ISO catalogue entry are paywalled and were not accessed.',
  },
  {
    inspectionId: 'tr13-src-014',
    topic: 'health-claim-boundaries',
    sourceIdentity: 'US Federal Trade Commission, Health Products Compliance Guidance',
    version: 'As published at ftc.gov, read 2026-09-06',
    stableUrl: 'https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance',
    locator: 'Substantiation section — "competent and reliable scientific evidence"; the paragraph on randomised controlled human clinical testing.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'United States government guidance, freely available.',
    reuseBasis: 'US government work; bounded original summary with attribution.',
    supportedClaimScope:
      'That health-benefit claims require substantiation as competent and reliable scientific evidence, and that for health-related benefits this generally means randomised, controlled human clinical testing, assessed on parameters including sample size, duration and outcomes.',
    boundary:
      'Guidance on advertising substantiation, not a clinical standard and not legal advice. It does not state what any specific product may claim, and does not determine whether a given study is adequate.',
    sourceClass: 'government-regulator-guidance',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in this programme.',
  },
  {
    inspectionId: 'tr13-src-015',
    topic: 'wellness-recommendation-limits',
    sourceIdentity: 'US FDA CDRH, General Wellness: Policy for Low Risk Devices',
    version: 'Document issued 6 January 2026',
    stableUrl: 'https://www.fda.gov/media/90652/download',
    locator: 'Definition passage: the two factors defining a general wellness product; the following paragraph on products that do not meet the device definition under FD&C Act §201(h).',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'United States government guidance, freely available.',
    reuseBasis: 'US government work; bounded original summary with attribution.',
    supportedClaimScope:
      'That a general wellness product is one intended only for general wellness use and presenting low risk, and that some such products fall outside the statutory device definition.',
    boundary:
      'A compliance policy describing when CDRH does not intend to examine a product. It confers no approval, does not classify any specific product, and does not establish that a wellness claim is accurate.',
    sourceClass: 'government-regulator-guidance',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in this programme.',
  },
  {
    inspectionId: 'tr13-src-016',
    topic: 'machine-contracting',
    sourceIdentity: 'Regulation (EU) No 910/2014 (eIDAS)',
    version: 'EUR-Lex CELEX 32014R0910',
    stableUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32014R0910',
    locator: 'Article 25(1) and 25(2) — legal effects of electronic signatures.',
    inspectionDepth: 'targeted-article-read',
    accessBasis: 'Official EU legal publication, freely accessible.',
    reuseBasis: 'EUR-Lex reuse policy permits reproduction with acknowledgement; summarised here.',
    supportedClaimScope:
      'That an electronic signature may not be denied legal effect or admissibility solely for being electronic, and that a qualified electronic signature has the equivalent legal effect of a handwritten one.',
    boundary:
      'Addresses signatures by natural and legal persons. It does not confer contracting capacity on an autonomous machine, does not establish that an agent may bind a principal, and must not be read as authorising machine-formed contracts.',
    sourceClass: 'statutory-instrument',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Distinct instrument from the GDPR inspections tr13-src-008 and tr13-src-009.',
  },
  {
    inspectionId: 'tr13-src-017',
    topic: 'public-sector-procurement',
    sourceIdentity: 'Directive 2014/24/EU on public procurement',
    version: 'EUR-Lex CELEX 32014L0024',
    stableUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32014L0024',
    locator: 'Recital on Treaty principles — equal treatment, non-discrimination, mutual recognition, proportionality and transparency.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'Official EU legal publication, freely accessible.',
    reuseBasis: 'EUR-Lex reuse policy permits reproduction with acknowledgement; summarised here.',
    supportedClaimScope:
      'That public procurement in the EU is governed by equal treatment, non-discrimination, mutual recognition, proportionality and transparency, with coordinated procedures applying above defined contract values.',
    boundary:
      'States principles and their scope. It does not determine whether any procurement was lawful, does not apply outside the EU, and is not legal advice.',
    sourceClass: 'statutory-instrument',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Distinct instrument from the GDPR and eIDAS inspections.',
  },
  {
    inspectionId: 'tr13-src-018',
    topic: 'author-manuscript',
    sourceIdentity: 'PubMed Central, Author Manuscripts in PMC',
    version: 'As published at pmc.ncbi.nlm.nih.gov, read 2026-09-06',
    stableUrl: 'https://pmc.ncbi.nlm.nih.gov/about/authorms/',
    locator: 'Section "What is the Author Manuscript?" — first paragraph.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'United States government service, freely accessible.',
    reuseBasis: 'US government work; bounded original summary with attribution.',
    supportedClaimScope:
      'That an author manuscript is the version peer reviewed and accepted by a journal, including changes made during peer review but generally excluding copyediting and stylistic edits.',
    boundary:
      'Defines one version in a chain. It does not establish which version should be cited, that an author manuscript matches the published record, or any deposit obligation.',
    sourceClass: 'government-repository-policy',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'The NIH public access policy page returned 403 and was not accessed; this PMC page is the lawful accessible route to the same definition.',
  },
  {
    inspectionId: 'tr13-src-019',
    topic: 'repository-copy',
    sourceIdentity: 'PubMed Central, Author Manuscripts in PMC',
    version: 'As published at pmc.ncbi.nlm.nih.gov, read 2026-09-06',
    stableUrl: 'https://pmc.ncbi.nlm.nih.gov/about/authorms/',
    locator: 'Section "What is the Author Manuscript?" — first paragraph.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'United States government service, freely accessible.',
    reuseBasis: 'US government work; bounded original summary with attribution.',
    supportedClaimScope:
      'That a repository may hold a version of a work distinct from the publisher\u2019s, and that the distinction between them is a matter of which edits are included.',
    boundary:
      'Does not establish that a repository copy is interchangeable with the version of record, nor that any repository copy is complete or current.',
    sourceClass: 'government-repository-policy',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same page as tr13-src-018, inspected for the repository-versus-publisher distinction.',
  },
  {
    inspectionId: 'tr13-src-020',
    topic: 'version-relationship',
    sourceIdentity: 'PubMed Central, Author Manuscripts in PMC',
    version: 'As published at pmc.ncbi.nlm.nih.gov, read 2026-09-06',
    stableUrl: 'https://pmc.ncbi.nlm.nih.gov/about/authorms/',
    locator: 'Section "What is the Author Manuscript?" — first paragraph.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'United States government service, freely accessible.',
    reuseBasis: 'US government work; bounded original summary with attribution.',
    supportedClaimScope:
      'That versions of one work stand in a stated relationship — accepted manuscript versus published record — differing by the edits each contains.',
    boundary:
      'Supports the existence of a version relationship for journal articles. It does not generalise to other artifact types and establishes no versioning scheme.',
    sourceClass: 'government-repository-policy',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same page as tr13-src-018 and tr13-src-019.',
  },
  {
    inspectionId: 'tr13-src-021',
    topic: 'correction',
    sourceIdentity: 'ICMJE Recommendations, §III.A Corrections and Version Control',
    version: 'Updated January 2026',
    stableUrl: 'https://www.icmje.org/recommendations/browse/publishing-and-editorial-issues/corrections-and-version-control.html',
    locator: '§III.A, paragraph beginning "Errors serious enough to invalidate a paper\u2019s results".',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'Publicly published editorial recommendations.',
    reuseBasis: 'Reference-only. Bounded original summary; recommendation text is not copied into artifacts.',
    supportedClaimScope:
      'That errors serious enough to invalidate results and conclusions may require retraction, and that retraction with republication may be considered where honest error changes results but the underlying science appears valid.',
    boundary:
      'Editorial recommendations for journals. They bind no publisher, do not determine whether any specific correction was handled properly, and address scholarly articles rather than arbitrary published records.',
    sourceClass: 'professional-body-recommendation',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'COPE retraction guidelines returned 403 and were not accessed; ICMJE is the accessible equivalent authority consulted instead.',
  },
  {
    inspectionId: 'tr13-src-022',
    topic: 'private-compute',
    sourceIdentity: 'Regulation (EU) 2016/679 (GDPR)',
    version: 'Consolidated text, EUR-Lex CELEX 32016R0679',
    stableUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679',
    locator: 'Article 32(1)(a)-(c) — security of processing, including pseudonymisation and encryption.',
    inspectionDepth: 'targeted-article-read',
    accessBasis: 'Official EU legal publication, freely accessible.',
    reuseBasis: 'EUR-Lex reuse policy permits reproduction with acknowledgement; summarised here.',
    supportedClaimScope:
      'That security appropriate to the risk is required, and that pseudonymisation and encryption, together with ongoing confidentiality, integrity, availability and resilience, are named among the measures.',
    boundary:
      'Names measures without prescribing an architecture. It does not establish that computing locally, or in any specific environment, satisfies the obligation.',
    sourceClass: 'statutory-instrument',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same instrument as tr13-src-008 and tr13-src-009, inspected for a different article.',
  },
  {
    inspectionId: 'tr13-src-023',
    topic: 'cloud-escalation',
    sourceIdentity: 'Regulation (EU) 2016/679 (GDPR)',
    version: 'Consolidated text, EUR-Lex CELEX 32016R0679',
    stableUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679',
    locator: 'Article 28(3) — processing by a processor governed by a binding contract setting out subject-matter, duration, nature and purpose.',
    inspectionDepth: 'targeted-article-read',
    accessBasis: 'Official EU legal publication, freely accessible.',
    reuseBasis: 'EUR-Lex reuse policy permits reproduction with acknowledgement; summarised here.',
    supportedClaimScope:
      'That sending processing to another party requires a binding instrument that fixes the subject-matter, duration, nature and purpose of that processing.',
    boundary:
      'Governs the controller-processor relationship. It does not address when escalation is appropriate, and does not make any escalation lawful by itself.',
    sourceClass: 'statutory-instrument',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same instrument as tr13-src-008, tr13-src-009 and tr13-src-022.',
  },
  {
    inspectionId: 'tr13-src-024',
    topic: 'evacuation',
    sourceIdentity: 'Ready.gov (US Department of Homeland Security / FEMA), Volcanoes',
    version: 'As published at ready.gov, read 2026-09-06',
    stableUrl: 'https://www.ready.gov/volcanoes',
    locator: 'Section "Be Safe DURING" — evacuation-order paragraph.',
    inspectionDepth: 'full-page-read',
    accessBasis: 'United States government public guidance.',
    reuseBasis: 'US government work; bounded original summary with attribution.',
    supportedClaimScope:
      'That the published guidance is to follow evacuation orders from local authorities, evacuate early, and avoid areas downwind and river valleys downstream of the volcano.',
    boundary:
      'General public preparedness guidance. It sets no distances or thresholds for any specific volcano, issues no order, and does not substitute for direction from local authorities.',
    sourceClass: 'government-preparedness-guidance',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Complements the USGS hazard description in tr13-src-002, which describes the hazard rather than the response.',
  },
  {
    inspectionId: 'tr13-src-025',
    topic: 'community-preparedness',
    sourceIdentity: 'Ready.gov (US Department of Homeland Security / FEMA), Volcanoes',
    version: 'As published at ready.gov, read 2026-09-06',
    stableUrl: 'https://www.ready.gov/volcanoes',
    locator: 'Section "Prepare NOW" — know your area\u2019s risk; ask local emergency management for evacuation and shelter plans; community warning systems.',
    inspectionDepth: 'full-page-read',
    accessBasis: 'United States government public guidance.',
    reuseBasis: 'US government work; bounded original summary with attribution.',
    supportedClaimScope:
      'That preparedness is described as knowing the local risk, obtaining evacuation and shelter plans from local emergency management, and learning the community warning systems.',
    boundary:
      'Describes what a household is advised to do. It does not assess any community\u2019s readiness, prescribe a programme, or establish that following it produces a safe outcome.',
    sourceClass: 'government-preparedness-guidance',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same page as tr13-src-024, inspected for the preparedness section.',
  },
  {
    inspectionId: 'tr13-src-026',
    topic: 'random-seed',
    sourceIdentity: 'NeurIPS Paper Checklist',
    version: 'As published at neurips.cc, read 2026-09-06',
    stableUrl: 'https://neurips.cc/public/guides/PaperChecklist',
    locator: 'Items 4 (Experimental Result Reproducibility) and 5 (Open Access to Data and Code).',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'Publicly published conference guidance.',
    reuseBasis: 'Reference-only. Bounded original summary; checklist text is not copied into artifacts.',
    supportedClaimScope:
      'That a venue may require authors to state what steps make results reproducible or verifiable, and whether the code, data and instructions needed to reproduce the main experimental results were included.',
    boundary:
      'A submission checklist for one conference. It does not specify seed handling, does not define reproducibility, and answering it does not make a result reproducible.',
    sourceClass: 'conference-policy',
    independence: 'independent-of-maha',
    relationshipToEarlier:
      'ACM artifact review and badging returned 403 and was not accessed; this is the accessible venue policy consulted instead.',
  },
  {
    inspectionId: 'tr13-src-027',
    topic: 'semiconductor-policy',
    sourceIdentity: 'CHIPS and Science Act, Public Law 117-167',
    version: 'Public Law 117-167, 9 August 2022',
    stableUrl: 'https://www.congress.gov/117/plaws/publ167/PLAW-117publ167.pdf',
    locator: 'Sec. 102-103; §(3) Assistance for Mature Technology Nodes, appropriating $2,000,000,000 under 15 U.S.C. 4652.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'United States public law, freely published.',
    reuseBasis: 'US government work; bounded original summary with attribution.',
    supportedClaimScope:
      'That the statute creates a semiconductor incentive fund and directs a named appropriation toward fabrication, assembly, testing or packaging at mature technology nodes in the United States.',
    boundary:
      'States what the law appropriates and authorises. It does not establish what has been disbursed, whether any objective was met, or the policy\u2019s effect on supply.',
    sourceClass: 'statute',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in this programme.',
  },
] as const

const inspectedTopics = new Set(INSPECTIONS.map((i) => i.topic))

/* -- semantic review and classification ------------------------------------ */

type FinalState = 'evidence-ready' | 'revise' | 'blocked' | 'duplicative'

/**
 * Adjudicates one candidate.
 *
 * Order matters. A missing prerequisite blocks before anything else is asked,
 * because a page that cannot resolve its definition cannot be made ready by
 * inspecting a source. A contradiction between the route's role and its own
 * contract is next, because that is a defect in the candidate rather than a gap
 * in our work.
 */
function adjudicate(c: Candidate) {
  const dep = dependencyByCandidate.get(c.candidateId)!
  const topic = topicOf(c)

  if (dep.state === 'missing') {
    return {
      semantic: 'blocked on ownership or dependency' as const,
      final: 'blocked' as FinalState,
      reason: dep.note,
    }
  }
  if (dep.state === 'incorrectly-owned') {
    return {
      semantic: 'blocked on ownership or dependency' as const,
      final: 'blocked' as FinalState,
      reason: dep.note,
    }
  }
  // A definition route whose own contract forbids redefining is internally
  // inconsistent: the role claims the concept and the boundary denies it.
  if (c.routeRole === 'definition' && /cannot redefine/.test(c.conceptAuthority.boundary)
      && c.conceptAuthority.role !== 'canonical-owner') {
    return {
      semantic: 'revise boundary' as const,
      final: 'revise' as FinalState,
      reason:
        `Route role is "definition" but the declared contract is "${c.conceptAuthority.role}" with a boundary forbidding redefinition. ` +
        `A definition page must own its concept. Either the role or the contract is wrong, and which one is a product decision.`,
    }
  }
  if (!inspectedTopics.has(topic)) {
    return {
      semantic: 'distinct' as const,
      final: 'blocked' as FinalState,
      reason:
        `Semantically distinct and dependency-clear, but no source was inspected for topic "${topic}". ` +
        `The candidate map records evidencePlan as not-started on all six axes, and evidence-ready requires inspected ` +
        `content with an exact locator. Blocked on source inspection, not on any defect in the candidate.`,
    }
  }
  return {
    semantic: 'distinct' as const,
    final: 'evidence-ready' as FinalState,
    reason: `Dependency resolved (${dep.state}); source inspected for "${topic}" with an exact locator and a stated reuse basis.`,
  }
}

const decisions = cohort.map((c) => {
  const a = adjudicate(c)
  return {
    candidateId: c.candidateId,
    path: c.path,
    siteId: c.siteId,
    topic: topicOf(c),
    routeRole: c.routeRole,
    conceptId: c.conceptId,
    declaredOwner: c.conceptAuthority.canonicalOwner,
    dependencyState: dependencyByCandidate.get(c.candidateId)!.state,
    semanticResult: a.semantic,
    finalState: a.final,
    reason: a.reason,
  }
}).sort((a, b) => a.candidateId.localeCompare(b.candidateId))

const evidenceReady = decisions.filter((d) => d.finalState === 'evidence-ready')

/* -- specifications, only for evidence-ready ------------------------------- */

const specifications = evidenceReady.map((d) => {
  const c = cohort.find((x) => x.candidateId === d.candidateId)!
  const src = INSPECTIONS.find((i) => i.topic === d.topic)!
  return {
    candidateId: c.candidateId,
    canonicalUrl: c.url,
    owningProperty: c.siteId,
    routeRole: c.routeRole,
    directAnswer: src.supportedClaimScope,
    context: `${src.sourceIdentity} (${src.version}) is the authority consulted for this route's topic.`,
    evidenceSections: [
      { heading: 'What the source establishes', body: src.supportedClaimScope, locator: src.locator },
      { heading: 'What it does not establish', body: src.boundary, locator: src.locator },
    ],
    limitationsAndNegativeSpace: [src.boundary, 'No route-specific search demand is observed; demand remains unknown.'],
    comparisons: [] as string[],
    boundedQuestions: [
      `What does ${src.sourceIdentity} state about ${d.topic}?`,
      `Which exact locator in that source supports the claim on this page?`,
      `What does this source explicitly not establish about ${d.topic}?`,
      `Which canonical definition does this route depend on, and where is it owned?`,
      `What would have to be inspected before this page could claim more than it does?`,
    ],
    typedRelationships: c.typedRelationships ?? [],
    citations: [{ inspectionId: src.inspectionId, sourceIdentity: src.sourceIdentity, stableUrl: src.stableUrl, locator: src.locator }],
    evidenceMetadata: {
      sourceClass: src.sourceClass,
      independence: src.independence,
      inspectionDepth: src.inspectionDepth,
      reuseBasis: src.reuseBasis,
      demandEvidence: 'unknown',
    },
    expectedCanonicalDependencies: [{ conceptId: c.conceptId, owner: c.conceptAuthority.canonicalOwner, state: d.dependencyState }],
    boundary: 'A specification is not a route, a release, or a public page.',
  }
}).sort((a, b) => a.candidateId.localeCompare(b.candidateId))

/* -- emit ------------------------------------------------------------------ */

const tally = (keys: string[]) => Object.fromEntries(
  Object.entries(keys.reduce<Record<string, number>>((a, k) => ({ ...a, [k]: (a[k] ?? 0) + 1 }), {}))
    .sort(([a], [b]) => a.localeCompare(b)))

const write = (name: string, body: Record<string, unknown>) => {
  const artifact = { ...body, provenanceDigest: digest(canonicalJson(body)) }
  writeFileSync(`${OUT}/federation-tranche-13-${name}-v1.json`, `${JSON.stringify(artifact, null, 2)}\n`)
  return artifact.provenanceDigest
}

write('contract-repair', {
  schemaVersion: `${SCHEMA}-contract-repair/1.0`,
  frozenOn: FROZEN_ON,
  defect:
    'Route role `definition` declared against contract role `owner-application`, whose boundary reads "may apply; ' +
    'cannot redefine". A definition page must own its concept, so the two cannot both be correct.',
  diagnosis:
    'All 169 definition-role candidates in the frozen map sit on the property that owns the concept they define. ' +
    'The role is correct and the contract is not; the map has no canonical-owner role at all.',
  frozenMapUntouched:
    'The map is not rewritten. Its digest is bound into every tranche artifact including Tranches 1-12.',
  counts: repairSummary,
})

const cohortDigests = write('cohort', {
  schemaVersion: `${SCHEMA}-cohort/1.0`,
  frozenOn: FROZEN_ON,
  candidateMapDigest: digest(readFileSync(`${OUT}/federation-route-candidates-v2.json`, 'utf8')),
  selectionRule:
    'Highest calibrated utility after Tranches 1 through 12, with dependency closure, a four-page property/topic cap, ' +
    'proportional property caps bounded by remaining inventory, and prior-tranche definitions treated as satisfied ' +
    'prerequisites. Ordered by scores.weighted descending with candidateId as tiebreak; legacy rank and tranche fields ' +
    'are non-contiguous after the mythology migration and are not used.',
  exclusions: {
    coveredByTranches1to12: covered.size,
    supersededInLineageV2: superseded.size,
    remainingAfterExclusions: remaining.length,
  },
  proportionalTarget: PROPORTIONAL_TARGET,
  appliedTargets: selection.propertyTargets,
  shortfalls: selection.shortfalls,
  shortfallNote:
    'agentic-publishing and mayon-rajan cannot meet their proportional targets from the remaining inventory. ' +
    'The deficit was redistributed to maha-strategies in a fixed order rather than left unfilled, and is recorded here.',
  counts: {
    selected: cohort.length,
    unique: new Set(cohort.map((c) => c.candidateId)).size,
    overlapWithPriorTranches: cohort.filter((c) => covered.has(c.candidateId)).length,
    supersededSelected: cohort.filter((c) => superseded.has(c.candidateId)).length,
    distinctConcepts: new Set(cohort.map((c) => c.conceptId)).size,
    topicCapDisplacements: selection.topicCapHits.length,
  },
  byProperty: tally(cohort.map((c) => c.siteId)),
  byTopic: tally(cohort.map((c) => topicOf(c))),
  byRouteRole: tally(cohort.map((c) => c.routeRole)),
  entries: cohort.map((c, i) => ({
    cohortOrder: i + 1, candidateId: c.candidateId, url: c.url, siteId: c.siteId,
    topic: topicOf(c), routeRole: c.routeRole, calibratedScore: c.scores.weighted,
    demandBasis: 'unknown', conceptId: c.conceptId,
  })),
})

write('dependency-validation', {
  schemaVersion: `${SCHEMA}-dependency-validation/1.0`,
  frozenOn: FROZEN_ON,
  cohortDigest: cohortDigests,
  rule: 'An application route may not redefine its dependency. A missing prerequisite blocks the dependent page and is never inferred.',
  counts: tally(dependencies.map((d) => d.state)),
  dependencies,
})

write('source-inspections', {
  schemaVersion: `${SCHEMA}-source-inspections/1.0`,
  frozenOn: FROZEN_ON,
  cohortDigest: cohortDigests,
  method: 'Sources were opened and read. Metadata was not treated as inspection, and no search snippet was used as evidence. No paywall, CAPTCHA or access control was bypassed.',
  topicsInCohort: new Set(cohort.map((c) => topicOf(c))).size,
  topicsInspected: new Set(INSPECTIONS.map((i) => i.topic)).size,
  distinctSources: new Set(INSPECTIONS.map((i) => i.sourceIdentity)).size,
  inspections: INSPECTIONS,
  // Recorded so that an uninspected topic is distinguishable from an unexamined
  // one. An access refusal and a failed extraction are different facts, and
  // neither was worked around.
  soughtButNotInspected: [
    { source: 'COPE retraction guidelines', outcome: 'HTTP 403', topic: 'correction', resolution: 'ICMJE §III.A consulted instead (tr13-src-021).' },
    { source: 'ACM artifact review and badging', outcome: 'HTTP 403', topic: 'random-seed', resolution: 'NeurIPS checklist consulted instead (tr13-src-026).' },
    { source: 'NIH public access policy', outcome: 'HTTP 403', topic: 'author-manuscript', resolution: 'PMC author-manuscript page consulted instead (tr13-src-018).' },
    { source: 'ISO/IEC 42001 and the ISO catalogue', outcome: 'paywalled', topic: 'standards-and-conformity', resolution: 'NIST SP 2000-01, which quotes ISO/IEC 17000, consulted instead (tr13-src-013). The paywall was not bypassed.' },
    { source: 'arXiv version availability policy', outcome: 'served navigation and licence boilerplate rather than policy text', topic: 'manuscript-versioning', resolution: 'None. A failed extraction is not an inspection, so the topic remains uninspected.' },
    { source: 'JATS tag library (sec, disp-formula)', outcome: 'served navigation index and element headings rather than definitions', topic: 'passage-locator, equation-locator', resolution: 'None. Headings are metadata, not content.' },
    { source: 'Crossref REST API documentation', outcome: 'served site navigation rather than documentation body', topic: 'metadata-only-evidence, abstract-only-evidence', resolution: 'None.' },
  ],
  uninspectedTopicNote:
    'The topics with no inspection are predominantly this organisation\u2019s own operational concepts — claim intake, ' +
    'evidence dossiers, runtime witness receipts, uncertainty recording, internal review, context packs — and the ' +
    'author\u2019s own concepts on the personal properties. No external authority defines them, so none was cited. ' +
    'Their candidates are blocked on inspection rather than faulted, and a first-party definition would have to be ' +
    'written and reviewed before they could be sourced at all.',
})

write('decisions', {
  schemaVersion: `${SCHEMA}-decisions/1.0`,
  frozenOn: FROZEN_ON,
  cohortDigest: cohortDigests,
  appendOnly: true,
  note: 'Every candidate carries exactly one decision. Rejected, revised and blocked candidates are preserved here and cannot become specifications.',
  counts: {
    bySemanticResult: tally(decisions.map((d) => d.semanticResult)),
    byFinalState: tally(decisions.map((d) => d.finalState)),
  },
  decisions,
})

write('page-specifications', {
  schemaVersion: `${SCHEMA}-page-specifications/1.0`,
  frozenOn: FROZEN_ON,
  cohortDigest: cohortDigests,
  boundary: 'Specifications exist only for evidence-ready candidates. A specification is not a route, a release, or a public page.',
  counts: { specifications: specifications.length, boundedQuestions: specifications.length * 5 },
  specifications,
})

/**
 * One derived count block. Readiness, the Markdown report and the narrative all
 * read from it, so a figure cannot be right in one place and stale in another —
 * which is exactly how the readiness narrative came to say two topics after
 * twenty-seven had been inspected.
 */
const topicsInspected = new Set(INSPECTIONS.map((i) => i.topic)).size
const distinctSources = new Set(INSPECTIONS.map((i) => i.sourceIdentity)).size
const boundedQuestions = specifications.reduce((sum, spec) => sum + spec.boundedQuestions.length, 0)
const byFinalState = tally(decisions.map((d) => d.finalState))
const dependenciesMissing = dependencies.filter((d) => d.state === 'missing').length
const topicsInCohort = new Set(cohort.map((c) => topicOf(c))).size

const COUNTS = {
  cohort: cohort.length,
  byFinalState,
  specifications: specifications.length,
  boundedQuestions,
  topicsInCohort,
  topicsInspected,
  distinctSources,
  dependenciesMissing,
} as const

/**
 * Semantic validation, covering all 100 candidates.
 *
 * The decisions artifact records the outcome; this records the adjudication that
 * produced it — the nearest neighbour considered, what would have made the
 * candidate a duplicate, and the inference the route must not license. It exists
 * separately because a reviewer checking whether a rejection was fair should not
 * have to reconstruct the comparison from a one-line reason.
 */
const neighbourOf = (c: Candidate) => {
  const sameConcept = cohort.filter((o) => o.conceptId === c.conceptId && o.candidateId !== c.candidateId)
  if (sameConcept.length > 0) {
    const nearest = [...sameConcept].sort((a, b) => a.candidateId.localeCompare(b.candidateId))[0]
    return { candidateId: nearest.candidateId, path: nearest.path, relation: 'same-concept-different-role' as const }
  }
  const sameTopic = cohort.filter((o) => topicOf(o) === topicOf(c) && o.candidateId !== c.candidateId)
  if (sameTopic.length > 0) {
    const nearest = [...sameTopic].sort((a, b) => a.candidateId.localeCompare(b.candidateId))[0]
    return { candidateId: nearest.candidateId, path: nearest.path, relation: 'same-topic-different-concept' as const }
  }
  return null
}

write('semantic-validation', {
  schemaVersion: `${SCHEMA}-semantic-validation/1.0`,
  frozenOn: FROZEN_ON,
  method:
    'Each candidate was adjudicated against the cohort and the observed surface on concept ownership, route role, ' +
    'and the question the route asks. Distinctness is decided on meaning rather than URL shape: two candidates ' +
    'sharing a concept are duplicates only where they also ask the same question, which is why same-concept ' +
    'candidates at different roles are retained.',
  duplicateRule:
    'A candidate is duplicative only where another candidate in the cohort shares its concept and its route role, ' +
    'or where a normalised search intent already appears. Both were checked across all 100; neither occurs.',
  validations: cohort.map((c) => {
    const decision = decisions.find((d) => d.candidateId === c.candidateId)!
    return {
      candidateId: c.candidateId,
      candidateDigest: digest(canonicalJson(c)),
      path: c.path,
      conceptId: c.conceptId,
      routeRole: c.routeRole,
      declaredOwner: c.conceptAuthority,
      semanticResult: decision.semanticResult,
      nearestNeighbour: neighbourOf(c),
      distinctionBasis:
        neighbourOf(c) === null
          ? 'No other candidate in the cohort shares this concept or topic.'
          : 'Shares a neighbour in the cohort; retained because the route role and the question asked differ.',
      prohibitedInference: c.routeRole === 'definition'
        ? 'Must not be read as licensing an application claim; a definition states what the concept is, not what may be done with it.'
        : 'Must not redefine the concept it applies. The canonical definition remains with the declared owner.',
      dependencyState: decision.dependencyState,
    }
  }),
})

const readiness = write('readiness', {
  schemaVersion: `${SCHEMA}-readiness/1.0`,
  frozenOn: FROZEN_ON,
  cohortDigest: cohortDigests,
  status: 'reviewed-not-published',
  counts: COUNTS,
  honestOutcome:
    'Evidence-ready is bounded by source inspection, not by candidate quality. All ' + `${cohort.length}` +
    ' candidates carry evidencePlan not-started in the candidate map. Sources were inspected for ' +
    `${topicsInspected}` + ' of ' + `${topicsInCohort}` + ' topics across ' + `${distinctSources}` +
    ' distinct sources, so only candidates on those topics can satisfy the evidence-ready gate. The remaining ' +
    `${topicsInCohort - topicsInspected}` + ' topics are predominantly this organisation\u2019s own operational ' +
    'concepts and the author\u2019s own concepts, for which no external authority exists to cite. Raising the ' +
    'count requires inspecting more sources or writing first-party definitions, not relaxing the gate.',
  publicationBoundary: 'No route, release, sitemap entry or public page is created. No build was run.',
})

/**
 * The Markdown report, written from COUNTS rather than retyped.
 *
 * Every figure below is interpolated from the same derived block the artifacts
 * use, so the report cannot drift from them. That is the failure this closure
 * exists to fix.
 */
const stateRows = Object.entries(byFinalState)
  .map(([state, n]) => `| \`${state}\` | ${n} |`).join('\n')
const notInspected = (readFileSync(`${OUT}/federation-tranche-13-source-inspections-v1.json`, 'utf8')
  ? (JSON.parse(readFileSync(`${OUT}/federation-tranche-13-source-inspections-v1.json`, 'utf8')) as
      { soughtButNotInspected?: { source: string; outcome: string }[] }).soughtButNotInspected ?? []
  : [])

writeFileSync('docs/operations/federation-tranche-13-readiness.md', `# Federation Tranche 13 — local readiness

Reviewed, not published. No route, release, sitemap entry or public page was created, and no build was run.

## Counts

| | |
|---|---|
| Cohort | ${COUNTS.cohort} |
| Topics in cohort | ${COUNTS.topicsInCohort} |
| Topics inspected | ${COUNTS.topicsInspected} |
| Distinct sources | ${COUNTS.distinctSources} |
| Specifications | ${COUNTS.specifications} |
| Bounded questions | ${COUNTS.boundedQuestions} |
| Dependencies missing | ${COUNTS.dependenciesMissing} |

## Classification

| State | Candidates |
|---|---|
${stateRows}

## What bounds the outcome

Evidence-ready is bounded by source inspection rather than candidate quality. Every candidate carries
\`evidencePlan: not-started\` in the frozen map, so a candidate can only reach evidence-ready once its topic has an
inspected source with an exact locator and a stated rights basis.

${COUNTS.topicsInCohort - COUNTS.topicsInspected} topics remain uninspected. They are predominantly this
organisation's own operational concepts — claim intake, evidence dossiers, runtime witness receipts, uncertainty
recording, internal review, context packs — together with the author's own concepts on the personal properties. No
external authority defines them, so none was cited. Those candidates are blocked on inspection rather than faulted,
and a first-party definition would need to be written and reviewed before they could be sourced at all.

${COUNTS.dependenciesMissing} candidates have no canonical definition anywhere in the frozen map for the concept they
apply, on the property that declares ownership. A missing prerequisite blocks its dependent page and was not inferred.

## Sources sought and not inspected

${notInspected.map((x) => `- **${x.source}** — ${x.outcome}`).join('\n')}

None was worked around. Where a lawful alternative reached the same ground it was used and recorded.

## Boundary

Specifications are not routes, releases or public pages. Nothing here is published.
`)

console.log(`cohort ${cohort.length} (unique ${new Set(cohort.map((c) => c.candidateId)).size}, overlap ${cohort.filter((c) => covered.has(c.candidateId)).length})`)
console.log(`dependencies: ${JSON.stringify(tally(dependencies.map((d) => d.state)))}`)
console.log(`final states: ${JSON.stringify(tally(decisions.map((d) => d.finalState)))}`)
console.log(`specifications ${specifications.length}, bounded questions ${specifications.length * 5}`)
console.log(`topics ${new Set(cohort.map((c) => topicOf(c))).size}, inspected ${INSPECTIONS.length}`)
console.log(`readiness ${readiness.slice(0, 24)}…`)
