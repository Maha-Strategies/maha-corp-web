import { getAllArchivedBriefSlugs } from './briefs-data.ts'
import { KNOWLEDGE_ARTICLES, getKnowledgeArticle, type KnowledgeArticle } from './knowledge-data.ts'
import { KNOWLEDGE_SUPPLIERS, getKnowledgeSupplier, type KnowledgeSupplierProfile } from './knowledge-process-profiles.ts'

export type IntelligenceKnowledgeRelationship = 'technical-foundation' | 'process-dependency' | 'risk-control' | 'supplier-context'

export interface IntelligenceKnowledgeLink {
  briefSlug: string
  relationship: IntelligenceKnowledgeRelationship
  rationale: string
  articleIds: string[]
  supplierIds: string[]
}

export interface SupportingKnowledgeObject {
  objectType: 'knowledge' | 'supplier'
  id: string
  relationship: IntelligenceKnowledgeRelationship
  rationale: string
  article?: KnowledgeArticle
  supplier?: KnowledgeSupplierProfile
}

export const INTELLIGENCE_KNOWLEDGE_LINKS: IntelligenceKnowledgeLink[] = [
  { briefSlug: 'sea-semiconductor-manufacturing-hedge', relationship: 'technical-foundation', rationale: 'Frames the manufacturing stages, facility controls, and packaging hand-offs that determine whether a regional production hedge is operationally credible.', articleIds: ['domain-semiconductor-manufacturing', 'concept-cleanrooms-fab-utilities', 'process-silicon-wafer-preparation', 'process-advanced-packaging'], supplierIds: ['supplier-tsmc', 'supplier-ase', 'supplier-amkor'] },
  { briefSlug: 'semiconductor-bifurcation', relationship: 'risk-control', rationale: 'Supports the brief’s analysis of duplicated manufacturing ecosystems with process-control, metrology, yield-learning, and starting-wafer dependencies.', articleIds: ['domain-semiconductor-manufacturing', 'concept-metrology-defect-inspection', 'concept-yield-learning-spc', 'process-silicon-wafer-preparation'], supplierIds: ['supplier-kla', 'supplier-sumco', 'supplier-shinetsu'] },
  { briefSlug: 'backside-microchannel-semiconductors', relationship: 'process-dependency', rationale: 'Explains silicon micromachining, direct liquid interfaces, package integration, and qualification risks behind backside microchannel cooling.', articleIds: ['concept-direct-to-silicon-cooling', 'process-plasma-etch', 'process-advanced-packaging', 'concept-package-reliability-failure-analysis'], supplierIds: ['supplier-tsmc', 'supplier-lam-research'] },
  { briefSlug: 'known-good-die-storage-yield', relationship: 'risk-control', rationale: 'Connects known-good-die economics to wafer sort, yield learning, singulation, final test, and package reliability gates.', articleIds: ['process-wafer-sort', 'concept-yield-learning-spc', 'process-wafer-thinning-dicing', 'process-final-burn-in-system-test', 'concept-package-reliability-failure-analysis'], supplierIds: ['supplier-advantest', 'supplier-ase', 'supplier-amkor'] },
  { briefSlug: 'angstrom-era-soc-architecture', relationship: 'technical-foundation', rationale: 'Traces leading-edge SoC choices from RTL and physical design through masks, lithography, pattern transfer, device formation, and advanced packaging.', articleIds: ['process-ic-design-tapeout', 'process-rtl-to-physical-design', 'process-mask-data-reticle-fabrication', 'process-photolithography', 'process-thin-film-deposition', 'process-plasma-etch', 'process-ion-implantation-annealing', 'process-advanced-packaging'], supplierIds: ['supplier-synopsys', 'supplier-cadence', 'supplier-asml', 'supplier-applied-materials', 'supplier-lam-research'] },
  { briefSlug: 'rad-hard-gan-sic-leo-satellites', relationship: 'risk-control', rationale: 'Provides manufacturing and qualification context for wide-bandgap devices intended for radiation, thermal, and lifetime-constrained environments.', articleIds: ['domain-semiconductor-manufacturing', 'process-thin-film-deposition', 'process-ion-implantation-annealing', 'concept-package-reliability-failure-analysis'], supplierIds: ['supplier-applied-materials', 'supplier-axcelis'] },
  { briefSlug: 'generative-ai-silicon-cycle-recalibration', relationship: 'technical-foundation', rationale: 'Grounds AI silicon-cycle claims in the complete manufacturing chain, advanced packaging, test, and yield-learning constraints.', articleIds: ['domain-semiconductor-manufacturing', 'process-advanced-packaging', 'process-final-burn-in-system-test', 'concept-yield-learning-spc'], supplierIds: ['supplier-tsmc', 'supplier-ase', 'supplier-amkor', 'supplier-advantest'] },
  { briefSlug: 'semiconductor-wfe-doping-annealing-landscape', relationship: 'supplier-context', rationale: 'Maps the equipment landscape to ion implantation, activation, thermal processing, deposition, and process-control requirements.', articleIds: ['process-ion-implantation-annealing', 'process-thermal-oxidation-diffusion', 'process-thin-film-deposition', 'concept-metrology-defect-inspection'], supplierIds: ['supplier-applied-materials', 'supplier-axcelis', 'supplier-tokyo-electron', 'supplier-kla'] },
  { briefSlug: 'power-semiconductor-target-setting-metrics', relationship: 'risk-control', rationale: 'Connects target metrics to the manufacturing, metrology, and qualification evidence needed to interpret device-level performance claims.', articleIds: ['domain-semiconductor-manufacturing', 'concept-metrology-defect-inspection', 'concept-package-reliability-failure-analysis'], supplierIds: ['supplier-kla'] },
  { briefSlug: 'angstrom-foundry-diversification', relationship: 'process-dependency', rationale: 'Shows why foundry diversification requires matched design kits, signoff, masks, process control, yield learning, and package assumptions—not only nominal node equivalence.', articleIds: ['process-ic-design-tapeout', 'process-mask-data-reticle-fabrication', 'concept-metrology-defect-inspection', 'concept-yield-learning-spc', 'process-advanced-packaging'], supplierIds: ['supplier-synopsys', 'supplier-cadence', 'supplier-asml', 'supplier-kla', 'supplier-tsmc'] },
  { briefSlug: 'strategic-ip-architecture', relationship: 'technical-foundation', rationale: 'Links strategic IP decisions to RTL integration, verification, physical implementation, signoff, and tape-out control.', articleIds: ['process-ic-design-tapeout', 'process-rtl-to-physical-design'], supplierIds: ['supplier-synopsys', 'supplier-cadence'] },
  { briefSlug: 'electro-photonic-co-integration', relationship: 'process-dependency', rationale: 'Provides the film, etch, interconnect, package, and metrology foundations needed to assess electronic-photonic integration routes.', articleIds: ['process-thin-film-deposition', 'process-plasma-etch', 'process-copper-interconnect-cmp', 'process-advanced-packaging', 'concept-metrology-defect-inspection'], supplierIds: ['supplier-applied-materials', 'supplier-lam-research', 'supplier-kla', 'supplier-tsmc'] },
  { briefSlug: 'power-semiconductor-target-architecture', relationship: 'technical-foundation', rationale: 'Connects target architecture to substrate, doping, thermal processing, metallization, package, and reliability choices.', articleIds: ['process-silicon-wafer-preparation', 'process-ion-implantation-annealing', 'process-thermal-oxidation-diffusion', 'process-copper-interconnect-cmp', 'concept-package-reliability-failure-analysis'], supplierIds: ['supplier-sumco', 'supplier-shinetsu', 'supplier-axcelis', 'supplier-applied-materials'] },
  { briefSlug: 'gan-on-diamond-leo-economics', relationship: 'process-dependency', rationale: 'Connects the economic thesis to thin-film interfaces, pattern transfer, packaging, thermal paths, and qualification requirements.', articleIds: ['process-thin-film-deposition', 'process-plasma-etch', 'concept-direct-to-silicon-cooling', 'process-advanced-packaging', 'concept-package-reliability-failure-analysis'], supplierIds: ['supplier-applied-materials', 'supplier-lam-research'] },
  { briefSlug: 'rapidus-2nm-yield-probability', relationship: 'risk-control', rationale: 'Grounds yield-probability reasoning in masks, lithography, defect inspection, statistical learning, and final electrical screening.', articleIds: ['process-mask-data-reticle-fabrication', 'process-photolithography', 'concept-metrology-defect-inspection', 'concept-yield-learning-spc', 'process-wafer-sort'], supplierIds: ['supplier-asml', 'supplier-kla', 'supplier-advantest'] },
  { briefSlug: 'us-foundry-sovereignization', relationship: 'process-dependency', rationale: 'Links sovereign capacity claims to the complete manufacturing chain, cleanroom utilities, process control, and upstream wafer supply.', articleIds: ['domain-semiconductor-manufacturing', 'concept-cleanrooms-fab-utilities', 'concept-metrology-defect-inspection', 'process-silicon-wafer-preparation'], supplierIds: ['supplier-kla', 'supplier-sumco', 'supplier-shinetsu'] },
  { briefSlug: 'upstream-semiconductor-cvc-best-practices', relationship: 'supplier-context', rationale: 'Provides a process map for locating where upstream material and equipment investments sit in semiconductor production and qualification.', articleIds: ['domain-semiconductor-manufacturing', 'concept-yield-learning-spc', 'concept-package-reliability-failure-analysis'], supplierIds: [] },
  { briefSlug: 'european-compressor-suppliers-semiconductor-utilities', relationship: 'process-dependency', rationale: 'Connects compressor and utility-system screening to fab gas, air, vacuum, uptime, contamination, and facility-control requirements.', articleIds: ['concept-cleanrooms-fab-utilities', 'process-wafer-cleaning-surface-preparation'], supplierIds: [] },
  { briefSlug: 'smartphone-ap-fan-out-substrate-thickness', relationship: 'process-dependency', rationale: 'Maps the package decision to RDL and substrate construction, interconnect, encapsulation, singulation, and package reliability.', articleIds: ['process-advanced-packaging', 'process-package-substrates-rdl', 'process-wire-bond-flip-chip', 'process-encapsulation-underfill-molding', 'process-wafer-thinning-dicing', 'concept-package-reliability-failure-analysis'], supplierIds: ['supplier-tsmc', 'supplier-ase', 'supplier-amkor'] },
  { briefSlug: 'smartphone-ap-osat-commercial-risk-allocation', relationship: 'supplier-context', rationale: 'Connects commercial risk allocation to the OSAT-controlled assembly, test, substrate, encapsulation, and qualification interfaces.', articleIds: ['process-advanced-packaging', 'process-package-substrates-rdl', 'process-wire-bond-flip-chip', 'process-encapsulation-underfill-molding', 'process-final-burn-in-system-test', 'concept-package-reliability-failure-analysis'], supplierIds: ['supplier-ase', 'supplier-amkor', 'supplier-tsmc'] },
  { briefSlug: 'ai-semiconductor-slt-practices', relationship: 'risk-control', rationale: 'Supports system-level-test decisions with wafer-sort, final-test, burn-in, interface, and failure-analysis foundations.', articleIds: ['process-wafer-sort', 'process-final-burn-in-system-test', 'concept-package-reliability-failure-analysis'], supplierIds: ['supplier-advantest', 'supplier-ase', 'supplier-amkor'] },
  { briefSlug: 'semiconductor-substrate-price-tolerance', relationship: 'supplier-context', rationale: 'Connects substrate pricing negotiations to the actual RDL, substrate, assembly-yield, test, and qualification responsibilities that drive switching cost.', articleIds: ['process-package-substrates-rdl', 'process-advanced-packaging', 'concept-yield-learning-spc', 'concept-package-reliability-failure-analysis'], supplierIds: ['supplier-ase', 'supplier-amkor'] },
  { briefSlug: 'advanced-packaging-test-cpo-sockets', relationship: 'process-dependency', rationale: 'Links advanced-package and CPO socket requirements to substrate routing, package integration, final test, and reliability controls.', articleIds: ['process-advanced-packaging', 'process-package-substrates-rdl', 'process-final-burn-in-system-test', 'concept-package-reliability-failure-analysis'], supplierIds: ['supplier-advantest', 'supplier-ase', 'supplier-amkor'] },
  { briefSlug: 'ultra-thin-shock-absorbing-adhesives', relationship: 'risk-control', rationale: 'Provides encapsulation, interface, cure, stress, and reliability context for evaluating thin shock-absorbing adhesive systems used near electronics.', articleIds: ['process-encapsulation-underfill-molding', 'concept-package-reliability-failure-analysis'], supplierIds: ['supplier-dow'] },
  { briefSlug: 'ntc-thermistors-embedded-power-modules', relationship: 'process-dependency', rationale: 'Connects embedded sensing concepts to package interconnect, encapsulation, final test, and thermo-mechanical qualification.', articleIds: ['process-wire-bond-flip-chip', 'process-encapsulation-underfill-molding', 'process-final-burn-in-system-test', 'concept-package-reliability-failure-analysis'], supplierIds: ['supplier-ase', 'supplier-amkor'] },
  { briefSlug: 'us-semiconductor-cleanroom-construction', relationship: 'process-dependency', rationale: 'Maps cleanroom construction claims to the utility, contamination, stability, metrology, and production-control environment required by fabs.', articleIds: ['concept-cleanrooms-fab-utilities', 'process-wafer-cleaning-surface-preparation', 'concept-metrology-defect-inspection'], supplierIds: ['supplier-kla', 'supplier-lam-research', 'supplier-tokyo-electron'] },
  { briefSlug: 'ppg-derivatives-semiconductor-applications', relationship: 'technical-foundation', rationale: 'Connects the chemical-family analysis to lithography solvents, wafer cleaning, copper electroplating/CMP, encapsulation, and material qualification boundaries.', articleIds: ['material-ppg-derivatives', 'process-photolithography', 'process-wafer-cleaning-surface-preparation', 'process-copper-interconnect-cmp', 'process-encapsulation-underfill-molding'], supplierIds: ['supplier-dow'] },
]

const LINKS_BY_BRIEF = new Map(INTELLIGENCE_KNOWLEDGE_LINKS.map((link) => [link.briefSlug, link]))

export function getSupportingKnowledgeObjects(briefSlug: string): SupportingKnowledgeObject[] {
  const link = LINKS_BY_BRIEF.get(briefSlug)
  if (!link) return []
  return [
    ...link.articleIds.map((id) => ({ objectType: 'knowledge' as const, id, relationship: link.relationship, rationale: link.rationale, article: getKnowledgeArticle(id) })).filter((item) => item.article !== undefined),
    ...link.supplierIds.map((id) => ({ objectType: 'supplier' as const, id, relationship: 'supplier-context' as const, rationale: link.rationale, supplier: getKnowledgeSupplier(id) })).filter((item) => item.supplier !== undefined),
  ]
}

export function getIntelligenceBriefSlugsForKnowledgeObject(objectId: string): string[] {
  return INTELLIGENCE_KNOWLEDGE_LINKS.filter((link) => link.articleIds.includes(objectId) || link.supplierIds.includes(objectId)).map((link) => link.briefSlug)
}

export function assertIntelligenceKnowledgeLinkIntegrity(): void {
  const briefSlugs = new Set(getAllArchivedBriefSlugs())
  const articleIds = new Set(KNOWLEDGE_ARTICLES.map((article) => article.id))
  const supplierIds = new Set(KNOWLEDGE_SUPPLIERS.map((supplier) => supplier.id))
  const seenBriefs = new Set<string>()
  for (const link of INTELLIGENCE_KNOWLEDGE_LINKS) {
    if (!briefSlugs.has(link.briefSlug)) throw new Error(`Unknown Intelligence brief ${link.briefSlug}`)
    if (seenBriefs.has(link.briefSlug)) throw new Error(`Duplicate Intelligence link record ${link.briefSlug}`)
    seenBriefs.add(link.briefSlug)
    if (link.rationale.length < 80) throw new Error(`${link.briefSlug} needs a meaningful relationship rationale`)
    if (!link.articleIds.length) throw new Error(`${link.briefSlug} needs at least one Knowledge article`)
    for (const articleId of link.articleIds) if (!articleIds.has(articleId)) throw new Error(`${link.briefSlug} references unknown article ${articleId}`)
    for (const supplierId of link.supplierIds) if (!supplierIds.has(supplierId)) throw new Error(`${link.briefSlug} references unknown supplier ${supplierId}`)
  }
}

assertIntelligenceKnowledgeLinkIntegrity()
