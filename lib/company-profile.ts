import { MAHA_DESCRIPTOR, MAHA_ORGANIZATION_ID, MAHA_SITE_URL, mahaOrganizationJsonLd } from './entity.ts'

// Curated public projection. Never import private strategy, customer records,
// filesystem inventories, draft scientific claims or paid deliverables here.
export const COMPANY_PROFILE_DATE = '2026-09-29'
export const COMPANY_PROFILE_PATH = '/company.json'
export const COMPANY_PROFILE_SCHEMA_PATH = '/schemas/company-profile-1.0.json'
export const COMPANY_PORTFOLIO_PATH = '/about/technology'
const absolute = (path: string) => `${MAHA_SITE_URL}${path}`

export const COMPANY_DIRECTION = 'Maha is growing from context and evidence infrastructure into broader technology development. Current software, internal experiments and future research directions are described separately; interest in a field is not a claim of expertise, discovery or a finished product.'
export const COMPANY_BOUNDARIES = [
  'This is a company-authored portfolio description, not independent validation or a live service-health report.',
  'A research topic or proposed application is not a product offer, customer engagement or validated technology.',
  'Caldera results described here are internal simulations; no physical robot, building-safety or construction validation is claimed.',
  'Longevity work is exploratory research scoping, not a therapy, diagnostic, clinical service or demonstrated health benefit.',
  'Cultural and interpretive material is distinguished from empirical science; source provenance does not establish predictive validity.',
  'Public discovery does not guarantee crawling, indexing, ranking, AI citation or inclusion in model training.',
] as const

export const COMPANY_AREAS = [
  { id: 'software', name: 'Software and developer tools', description: 'Context processing, evidence workflows, evaluations and machine-commerce delivery interfaces.' },
  { id: 'research', name: 'Research and technology development', description: 'Internal experiments, simulation studies and exploratory scientific collaborations; maturity varies by activity.' },
  { id: 'publishing', name: 'Publishing and educational products', description: 'Books, source-aware research publishing, author tools and interactive learning experiences.' },
] as const

export const COMPANY_ACTIVITIES = [
  { id: 'context-software', name: 'Context and agent workflow software', area: 'software', status: 'software-and-evaluation', summary: 'Context processing and evaluation tools for AI workflows, with developer interfaces and bounded assessment methods.', boundary: 'Performance depends on the workload and configuration; no universal cost saving or evidence-retention guarantee is claimed.', links: ['/context-compiler', '/developers'] },
  { id: 'provenance-software', name: 'Evidence and provenance software', area: 'software', status: 'software-and-evaluation', summary: 'Maha Provenance Standard, claim preflight and reviewable evidence workflows.', boundary: 'Automated structural triage and provenance records do not independently establish factual truth or regulatory compliance.', links: ['/mps', '/mps/preflight', '/knowledge/evidence-workflows'] },
  { id: 'caldera', name: 'Caldera: computational architecture and Physical AI', area: 'research', status: 'internal-simulation', summary: 'An internal digital-twin and simulation research environment exploring geometry, inspection uncertainty and bounded robotic recovery.', boundary: 'Not a commercially validated robot, construction system or approved building design. Physical measurements and external validation remain separate next steps.', links: ['/knowledge/computational-architecture'] },
  { id: 'longevity-research', name: 'Longevity and metabolism research direction', area: 'research', status: 'exploratory-research', summary: 'Source-based study of aging-related mechanisms and assay interpretation, with interest in scientific software and future laboratory collaborations.', boundary: 'No Maha longevity intervention, validated biomarker, clinical predictor or established laboratory partnership is claimed.', links: ['/knowledge/longevity-metabolism'] },
  { id: 'research-publishing', name: 'Research and publishing', area: 'publishing', status: 'publishing-and-education', summary: 'Books, source-linked knowledge, research explanations and author-facing publishing tools.', boundary: 'Publication and editorial review are distinct from peer review, independent replication and experimental discovery.', links: ['/books', '/knowledge', '/about'] },
  { id: 'educational-products', name: 'Interactive educational products', area: 'publishing', status: 'publishing-and-education', summary: 'Interactive science communication, including the Mayon Volcano educational experience.', boundary: 'Educational visualisations and conceptual reconstructions are not real-time monitoring or predictive hazard models.', links: ['/projects/mayon'] },
] as const

export type KnowledgeState = 'knowledge-assets' | 'implemented-software' | 'documented-simulation' | 'exploratory-direction'
function field(id: string, name: string, state: KnowledgeState, currentWork: string, possibleDirection: string) {
  return { id, name, state, currentWork, possibleDirection, url: absolute(`${COMPANY_PORTFOLIO_PATH}#field-${id}`) }
}

// All field summaries are visible in the portfolio page. No per-topic route is
// invented for branch-only/noindex content, and no draft canonical record is promoted.
export const COMPANY_KNOWLEDGE_FIELDS = [
  field('semiconductors', 'Semiconductor manufacturing', 'knowledge-assets', 'Process, material, equipment and measurement reference maps.', 'Investigate software for checking engineering handoffs; no fabrication or yield-prediction capability is claimed.'),
  field('supply-chains', 'Suppliers and critical supply chains', 'knowledge-assets', 'Source-linked supplier profiles and supply-chain research.', 'Explore requirement matching and change monitoring; a suggested alternative is not a qualified substitute.'),
  field('architecture', 'Computational architecture', 'implemented-software', 'A building-program arithmetic checker and internal layout studies.', 'Explore constraint and schedule reconciliation, not structural or code-compliance certification.'),
  field('robotics', 'Robotics and human assistance', 'documented-simulation', 'Task-evaluation methods and internal simulated recovery/handoff studies.', 'Investigate task-specific recovery with an engineering partner before physical deployment.'),
  field('physical-ai', 'Physical AI', 'documented-simulation', 'Internal geometric inspection, registration and uncertainty experiments in Caldera.', 'Test a narrowly scoped perception component against independent physical measurements.'),
  field('nanotechnology', 'Nanotechnology', 'exploratory-direction', 'Research scoping and source review; no calibrated measurement product is claimed.', 'Explore lab-partner image or particle-measurement analysis.'),
  field('advanced-materials', 'Advanced materials', 'knowledge-assets', 'Source-bounded records on materials, properties and readiness limits.', 'Explore application-specific candidate selection with a materials expert and experimental validation.'),
  field('quantum', 'Quantum systems and advanced energy', 'knowledge-assets', 'Quantum-system and measurement reference records.', 'Investigate a specialist-defined calibration problem; no quantum hardware or advantage is claimed.'),
  field('fusion', 'Fusion and plasma systems', 'knowledge-assets', 'References on confinement, diagnostics and engineering limits.', 'Explore offline diagnostic-signal analysis with a specialist, not reactor control or energy production.'),
  field('synthetic-biology', 'Synthetic biology and cellular engineering', 'knowledge-assets', 'Source records on cellular tools and experimental boundaries.', 'Explore routine experimental-data quality software with a qualified lab.'),
  field('biomolecular', 'Biomolecular engineering', 'knowledge-assets', 'Molecular-method and measurement reference records.', 'Explore condition-aware assay comparisons; no novel molecule or protein-design platform is claimed.'),
  field('longevity', 'Longevity and metabolism', 'knowledge-assets', 'References on autophagy, metabolism, senescence and endpoint interpretation.', 'Seek a scientific collaborator for one assay-analysis problem; not treatment or clinical advice.'),
  field('neurotechnology', 'Neurotechnology and BCI', 'knowledge-assets', 'Neural-interface and signal-interpretation reference records.', 'Explore research-signal quality analysis; no clinical BCI or neurological benefit is claimed.'),
  field('neuromorphic', 'Neuromorphic and biocomputing', 'knowledge-assets', 'Comparisons of spiking, hardware and biological computing approaches.', 'Test one event-driven sensing task against a fair baseline; no Maha chip or living computing system is claimed.'),
  field('interpretability', 'Mechanistic interpretability', 'knowledge-assets', 'Source-based interpretability concepts and limitations.', 'Investigate whether internal model signals improve detection of a defined failure.'),
  field('agentic-systems', 'Agentic systems and MCP', 'implemented-software', 'Context/evaluation implementations and developer integration interfaces.', 'Improve context allocation on measured customer tasks; payment mechanisms are not proof of task success.'),
  field('mathematics', 'Mathematics', 'implemented-software', 'Mathematical reference records and bounded arithmetic/geometry implementations.', 'Develop a solver for a specific planning problem, retaining uncertainty and infeasible cases.'),
  field('celestial', 'Celestial facts', 'implemented-software', 'Time, reference-frame and coordinate contracts connected to calculations.', 'Improve numerical integration for developers; no astronomical discovery is implied.'),
  field('astronomy', 'Astronomy', 'knowledge-assets', 'Scientific explanations and separate documented computational research studies.', 'Explore an observing-analysis or education use case; hypotheses are not discoveries.'),
  field('astrology', 'Astrology and interpretive applications', 'implemented-software', 'Source-linked traditional rules and interpretive interfaces.', 'Explore transparent cultural reference tools, not scientifically validated predictions or high-stakes decision advice.'),
  field('panchanga', 'Pañcāṅga and calendrical tools', 'implemented-software', 'Calendar calculations with stated location, time and convention boundaries.', 'Explore reliable calendar exports for publishers; arithmetic does not establish auspiciousness.'),
  field('religion', 'Religion and contemplative traditions', 'knowledge-assets', 'Textual, historical and interpretive comparison records.', 'Explore educational text-comparison tools without certifying metaphysical or clinical claims.'),
  field('epistemic-publishing', 'Epistemic publishing and evidence workflows', 'implemented-software', 'Source, revision, provenance and publication-gate software.', 'Improve reviewed correction workflows; a valid record is not proof of a true claim.'),
  field('integration-evidence', 'Integration evidence and reproducibility', 'implemented-software', 'Bounded integration records and reproducibility workflows.', 'Develop repeatable compatibility checks, not comprehensive security certification.'),
] as const

export function buildCompanyProfile() {
  return {
    $schema: absolute(COMPANY_PROFILE_SCHEMA_PATH),
    schemaVersion: '1.0.0',
    asOf: COMPANY_PROFILE_DATE,
    canonicalPage: absolute(COMPANY_PORTFOLIO_PATH),
    organization: mahaOrganizationJsonLd,
    description: MAHA_DESCRIPTOR,
    direction: COMPANY_DIRECTION,
    boundaries: COMPANY_BOUNDARIES,
    areas: COMPANY_AREAS,
    activities: COMPANY_ACTIVITIES.map((activity) => ({ ...activity, url: absolute(`${COMPANY_PORTFOLIO_PATH}#${activity.id}`), links: activity.links.map(absolute) })),
    knowledgeFields: COMPANY_KNOWLEDGE_FIELDS,
    discovery: { company: absolute('/about'), knowledge: absolute('/knowledge'), siteGuide: absolute('/llms.txt'), registry: absolute('/maha-machine-readable-registry.json'), contact: absolute('/contact') },
  }
}

export function buildCompanyPortfolioJsonLd() {
  const url = absolute(COMPANY_PORTFOLIO_PATH)
  const records = [
    ...COMPANY_ACTIVITIES.map((a) => ({ id: a.id, name: a.name, status: a.status, description: `${a.summary} ${a.boundary}` })),
    ...COMPANY_KNOWLEDGE_FIELDS.map((f) => ({ id: `field-${f.id}`, name: f.name, status: f.state, description: `Current work: ${f.currentWork} Possible direction: ${f.possibleDirection}` })),
  ]
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': `${url}#page`, url, name: 'Maha Strategies technology and research portfolio', description: COMPANY_DIRECTION, dateModified: COMPANY_PROFILE_DATE, inLanguage: 'en', about: { '@id': MAHA_ORGANIZATION_ID }, publisher: { '@id': MAHA_ORGANIZATION_ID }, mainEntity: { '@id': `${url}#portfolio` } },
      { '@type': 'ItemList', '@id': `${url}#portfolio`, numberOfItems: records.length, itemListElement: records.map((record, index) => ({ '@type': 'ListItem', position: index + 1, item: { '@type': 'CreativeWork', '@id': `${url}#${record.id}`, url: `${url}#${record.id}`, name: record.name, description: record.description, creativeWorkStatus: record.status, publisher: { '@id': MAHA_ORGANIZATION_ID } } })) },
    ],
  }
}
