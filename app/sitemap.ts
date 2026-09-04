import { MetadataRoute } from 'next'
import { MAHA_SITE_URL } from '@/lib/entity'
import { getPublicContentPublicationSitemapRows } from '@/lib/public-content-publications'
import { unfinishedSpeciesSections } from '@/lib/unfinished-species'
import { openBookEditions } from '@/lib/open-book-editions'
import { KNOWLEDGE_ARTICLES, knowledgeArticlePath } from '@/lib/knowledge-data'
import { SEMICONDUCTOR_PROCESS_MAP_DATE, SEMICONDUCTOR_PROCESS_MAP_PATH } from '@/lib/semiconductor-process-map'
import { BRIEFS } from '@/lib/briefs-data'
import { KNOWLEDGE_SUPPLIERS, knowledgeSupplierPath } from '@/lib/knowledge-process-profiles'
import { CELESTIAL_FACT_PATH, CELESTIAL_FACT_RELEASE_DATE } from '@/lib/celestial-facts'
import { ASTROLOGY_PATH, ASTROLOGY_RELEASE_DATE, ASTROLOGY_TRADITIONS, astrologyTraditionPath } from '@/lib/astrology-traditions'
import { ASTRONOMY_ARTICLES, ASTRONOMY_KNOWLEDGE_PATH, ASTRONOMY_KNOWLEDGE_RELEASE_DATE, astronomyArticlePath } from '@/lib/astronomy-knowledge'
import { CELESTIAL_GUIDE_LIST, CELESTIAL_GUIDE_RELEASE_DATE } from '@/lib/celestial-guides'
import { CALCULATION_REFERENCE_PATH, CALCULATION_REFERENCE_RELEASE_DATE, CALCULATION_REFERENCES, calculationReferencePath } from '@/lib/celestial-calculation-references'
import { TIMING_REFERENCE_PATH, TIMING_REFERENCE_RELEASE_DATE, TIMING_REFERENCES, timingReferencePath } from '@/lib/celestial-timing-references'
import { CORPORATE_MUNDANE_PATH, CORPORATE_MUNDANE_REFERENCES, CORPORATE_MUNDANE_RELEASE_DATE, corporateMundaneReferencePath } from '@/lib/corporate-mundane-references'
import { TROPICAL_SIDEREAL_COMPARISON_PATH, TROPICAL_SIDEREAL_COMPARISON_RELEASE_DATE, TROPICAL_SIDEREAL_COMPARISONS, tropicalSiderealComparisonPath } from '@/lib/tropical-sidereal-comparisons'
import { ASTROLOGY_ANSWER_GRAPH_DATE, ASTROLOGY_ANSWER_GRAPH_PATH, ASTROLOGY_ANSWER_GRAPH_REGISTRY_PATH, ASTROLOGY_ANSWERS, astrologyAnswerPath } from '@/lib/astrology-answer-graph'
import { ASTROLOGY_WORKFLOW_DATE, ASTROLOGY_WORKFLOW_PATH, ASTROLOGY_WORKFLOW_PROTOCOLS, ASTROLOGY_WORKFLOW_REGISTRY_PATH, astrologyWorkflowPath } from '@/lib/astrology-workflow-protocols'
import { MATHEMATICAL_CONCEPTS, MATHEMATICS_KNOWLEDGE_PATH, MATHEMATICS_KNOWLEDGE_RELEASE_DATE, mathematicsConceptPath } from '@/lib/mathematics-knowledge'
import { RELIGION_COMPARISONS, RELIGION_COMPARISONS_PATH, RELIGION_CONCEPTS, RELIGION_KNOWLEDGE_PATH, RELIGION_KNOWLEDGE_RELEASE_DATE, religionComparisonPath, religionConceptPath } from '@/lib/religion-knowledge'
import { MAYON_KNOWLEDGE_DATE, MAYON_KNOWLEDGE_PATH } from '@/lib/mayon-knowledge'
import { MAYON_ANSWER_REGISTRY_PATH, MAYON_TOPICS, mayonTopicPath } from '@/lib/mayon-topics'
import { TAMIL_CLASSICAL_DATE, TAMIL_CLASSICAL_PATH, TAMIL_CLASSICAL_REGISTRY_PATH, TAMIL_CLASSICAL_TOPICS, tamilClassicalTopicPath } from '@/lib/tamil-classical-traditions'
import { TIRUVAYMOLI_ATLAS_DATE, TIRUVAYMOLI_ATLAS_PATH, TIRUVAYMOLI_ATLAS_REGISTRY_PATH, TIRUVAYMOLI_ATLAS_TOPICS, tiruvaymoliAtlasTopicPath } from '@/lib/tiruvaymoli-passage-atlas'
import { TAMIL_SOURCE_ATLAS_DATE, TAMIL_SOURCE_ATLAS_PATH, TAMIL_SOURCE_ATLAS_REGISTRY_PATH, TAMIL_SOURCE_ATLAS_TOPICS, tamilSourceAtlasTopicPath } from '@/lib/tamil-source-atlas'
import { NEUROMORPHIC_COMPARISONS, NEUROMORPHIC_COMPARISONS_PATH, NEUROMORPHIC_CONCEPTS, NEUROMORPHIC_PATH, NEUROMORPHIC_RELEASE_DATE, neuromorphicComparisonPath, neuromorphicConceptPath } from '@/lib/neuromorphic-biocomputing'
import { EPISTEMIC_DOMAINS, EPISTEMIC_RELEASE_DATE, EPISTEMIC_SYSTEM_PATH, PUBLIC_EPISTEMIC_RECORDS } from '@/lib/epistemic-pilots'
import { epistemicRecordPath } from '@/lib/epistemic-publication'
import { getActiveEpistemicCanonicalReleases } from '@/lib/public-epistemic-releases'
import { EPISTEMIC_PHASE4_PILOT_DATE } from '@/lib/epistemic-pilot-corpus'
import { PUBLIC_AUTHORITY_CONFORMANCE_DATE } from '@/lib/celestial-public-authority-conformance'
import { getPublishedSubstantialPage, SUBSTANTIAL_PUBLICATION_DATE } from '@/lib/substantial-page-public'
import { eligibleSourceSlugs, SOURCE_ROUTE_PREFIX } from '@/lib/source-reference-projection'
import { EXACTZK_EVIDENCE_PATH, EXACTZK_RELEASE_DATE, KNOWLEDGE_INTEGRATIONS_PATH, NSGOODS_PREFLIGHT_V3_EVIDENCE_PATH, NSGOODS_PREFLIGHT_V3_RELEASE_DATE } from '@/lib/knowledge-integration-evidence'

/*
 * The sitemap reads active canonical releases from the database, so it must be
 * rendered per request. A sitemap Route Handler is cached by default unless it
 * uses a request-time API or a dynamic config option, which meant a record
 * released after the last deployment never appeared until the next build. The
 * llms.txt manifest already renders per request for the same reason.
 */
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = MAHA_SITE_URL
  
  // Source references are listed only while they still resolve. The same live
  // release read that renders them decides whether they are listed, so a
  // withdrawal removes the entry in the same pass that removes the page.
  const sourceReferencePages: MetadataRoute.Sitemap = (await eligibleSourceSlugs())
    .map((slug) => ({ url: `${baseUrl}${SOURCE_ROUTE_PREFIX}/${slug}` }))

  const staticPages: MetadataRoute.Sitemap = [
    // EXISTING CORE NODES
    { url: `${baseUrl}` },
    { url: `${baseUrl}/consulting` },
    { url: `${baseUrl}/rapid-intelligence-brief`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/consulting/semiconductor-supply-chain` },
    { url: `${baseUrl}/consulting/ai-infrastructure` },
    { url: `${baseUrl}/consulting/evidence-policy` },
    { url: `${baseUrl}/method` },
    { url: `${baseUrl}/governed-workflow` },
    { url: `${baseUrl}/governed-workflow/evidence` },
    { url: `${baseUrl}/software` },
    { url: `${baseUrl}/doctrine` },
    { url: `${baseUrl}/research` },
    { url: `${baseUrl}/knowledge`, lastModified: new Date(CELESTIAL_FACT_RELEASE_DATE) },
    { url: `${baseUrl}${KNOWLEDGE_INTEGRATIONS_PATH}`, lastModified: new Date(EXACTZK_RELEASE_DATE) },
    { url: `${baseUrl}${EXACTZK_EVIDENCE_PATH}`, lastModified: new Date(EXACTZK_RELEASE_DATE) },
    { url: `${baseUrl}${NSGOODS_PREFLIGHT_V3_EVIDENCE_PATH}`, lastModified: new Date(NSGOODS_PREFLIGHT_V3_RELEASE_DATE) },
    { url: `${baseUrl}${CELESTIAL_FACT_PATH}`, lastModified: new Date(CELESTIAL_FACT_RELEASE_DATE) },
    { url: `${baseUrl}${ASTRONOMY_KNOWLEDGE_PATH}`, lastModified: new Date(ASTRONOMY_KNOWLEDGE_RELEASE_DATE) },
    { url: `${baseUrl}${MATHEMATICS_KNOWLEDGE_PATH}`, lastModified: new Date(MATHEMATICS_KNOWLEDGE_RELEASE_DATE) },
    ...MATHEMATICAL_CONCEPTS.map((concept) => ({
      url: `${baseUrl}${mathematicsConceptPath(concept)}`,
      lastModified: new Date(MATHEMATICS_KNOWLEDGE_RELEASE_DATE),
    })),
    { url: `${baseUrl}${RELIGION_KNOWLEDGE_PATH}`, lastModified: new Date(RELIGION_KNOWLEDGE_RELEASE_DATE) },
    { url: `${baseUrl}${MAYON_KNOWLEDGE_PATH}`, lastModified: new Date(MAYON_KNOWLEDGE_DATE) },
    { url: `${baseUrl}${MAYON_ANSWER_REGISTRY_PATH}`, lastModified: new Date(MAYON_KNOWLEDGE_DATE) },
    ...MAYON_TOPICS.map((topic) => ({
      url: `${baseUrl}${mayonTopicPath(topic)}`,
      lastModified: new Date(MAYON_KNOWLEDGE_DATE),
    })),
    { url: `${baseUrl}${TAMIL_CLASSICAL_PATH}`, lastModified: new Date(TAMIL_CLASSICAL_DATE) },
    { url: `${baseUrl}${TAMIL_CLASSICAL_REGISTRY_PATH}`, lastModified: new Date(TAMIL_CLASSICAL_DATE) },
    ...TAMIL_CLASSICAL_TOPICS.map((topic) => ({
      url: `${baseUrl}${tamilClassicalTopicPath(topic)}`,
      lastModified: new Date(TAMIL_CLASSICAL_DATE),
    })),
    { url: `${baseUrl}${TIRUVAYMOLI_ATLAS_PATH}`, lastModified: new Date(TIRUVAYMOLI_ATLAS_DATE) },
    { url: `${baseUrl}${TIRUVAYMOLI_ATLAS_REGISTRY_PATH}`, lastModified: new Date(TIRUVAYMOLI_ATLAS_DATE) },
    ...TIRUVAYMOLI_ATLAS_TOPICS.map((topic) => ({
      url: `${baseUrl}${tiruvaymoliAtlasTopicPath(topic)}`,
      lastModified: new Date(TIRUVAYMOLI_ATLAS_DATE),
    })),
    { url: `${baseUrl}${TAMIL_SOURCE_ATLAS_PATH}`, lastModified: new Date(TAMIL_SOURCE_ATLAS_DATE) },
    { url: `${baseUrl}${TAMIL_SOURCE_ATLAS_REGISTRY_PATH}`, lastModified: new Date(TAMIL_SOURCE_ATLAS_DATE) },
    ...TAMIL_SOURCE_ATLAS_TOPICS.map((topic) => ({
      url: `${baseUrl}${tamilSourceAtlasTopicPath(topic)}`,
      lastModified: new Date(TAMIL_SOURCE_ATLAS_DATE),
    })),
    ...RELIGION_CONCEPTS.map((concept) => ({
      url: `${baseUrl}${religionConceptPath(concept)}`,
      lastModified: new Date(RELIGION_KNOWLEDGE_RELEASE_DATE),
    })),
    { url: `${baseUrl}${RELIGION_COMPARISONS_PATH}`, lastModified: new Date(RELIGION_KNOWLEDGE_RELEASE_DATE) },
    ...RELIGION_COMPARISONS.map((comparison) => ({
      url: `${baseUrl}${religionComparisonPath(comparison)}`,
      lastModified: new Date(RELIGION_KNOWLEDGE_RELEASE_DATE),
    })),
    { url: `${baseUrl}${NEUROMORPHIC_PATH}`, lastModified: new Date(NEUROMORPHIC_RELEASE_DATE) },
    ...NEUROMORPHIC_CONCEPTS.map((concept) => ({ url: `${baseUrl}${neuromorphicConceptPath(concept)}`, lastModified: new Date(NEUROMORPHIC_RELEASE_DATE) })),
    { url: `${baseUrl}${NEUROMORPHIC_COMPARISONS_PATH}`, lastModified: new Date(NEUROMORPHIC_RELEASE_DATE) },
    ...NEUROMORPHIC_COMPARISONS.map((comparison) => ({ url: `${baseUrl}${neuromorphicComparisonPath(comparison)}`, lastModified: new Date(NEUROMORPHIC_RELEASE_DATE) })),
    { url: `${baseUrl}${EPISTEMIC_SYSTEM_PATH}`, lastModified: new Date(EPISTEMIC_RELEASE_DATE) },
    { url: `${baseUrl}${EPISTEMIC_SYSTEM_PATH}/migrations`, lastModified: new Date(EPISTEMIC_RELEASE_DATE) },
    { url: `${baseUrl}${EPISTEMIC_SYSTEM_PATH}/releases`, lastModified: new Date(EPISTEMIC_RELEASE_DATE) },
    { url: `${baseUrl}${EPISTEMIC_SYSTEM_PATH}/pilot-corpus`, lastModified: new Date(EPISTEMIC_PHASE4_PILOT_DATE) },
    { url: `${baseUrl}${EPISTEMIC_SYSTEM_PATH}/publishing-factory`, lastModified: new Date(PUBLIC_AUTHORITY_CONFORMANCE_DATE) },
    ...EPISTEMIC_DOMAINS.map((domain) => ({ url: `${baseUrl}/knowledge/${domain.slug}`, lastModified: new Date(EPISTEMIC_RELEASE_DATE) })),
    ...PUBLIC_EPISTEMIC_RECORDS.map((record) => ({ url: `${baseUrl}${epistemicRecordPath(record)}`, lastModified: new Date(EPISTEMIC_RELEASE_DATE) })),
    { url: `${baseUrl}${ASTROLOGY_PATH}`, lastModified: new Date(ASTROLOGY_RELEASE_DATE) },
    { url: `${baseUrl}${ASTROLOGY_ANSWER_GRAPH_PATH}`, lastModified: new Date(ASTROLOGY_ANSWER_GRAPH_DATE) },
    { url: `${baseUrl}${ASTROLOGY_ANSWER_GRAPH_REGISTRY_PATH}`, lastModified: new Date(ASTROLOGY_ANSWER_GRAPH_DATE) },
    ...ASTROLOGY_ANSWERS.map((answer) => ({
      url: `${baseUrl}${astrologyAnswerPath(answer)}`,
      lastModified: new Date(ASTROLOGY_ANSWER_GRAPH_DATE),
    })),
    { url: `${baseUrl}${ASTROLOGY_WORKFLOW_PATH}`, lastModified: new Date(ASTROLOGY_WORKFLOW_DATE) },
    { url: `${baseUrl}${ASTROLOGY_WORKFLOW_REGISTRY_PATH}`, lastModified: new Date(ASTROLOGY_WORKFLOW_DATE) },
    ...ASTROLOGY_WORKFLOW_PROTOCOLS.map((workflow) => ({
      url: `${baseUrl}${astrologyWorkflowPath(workflow)}`,
      lastModified: new Date(ASTROLOGY_WORKFLOW_DATE),
    })),
    { url: `${baseUrl}/knowledge/muhurta`, lastModified: new Date(ASTROLOGY_RELEASE_DATE) },
    { url: `${baseUrl}/knowledge/birth`, lastModified: new Date(ASTROLOGY_RELEASE_DATE) },
    { url: `${baseUrl}/knowledge/corporate`, lastModified: new Date(CELESTIAL_GUIDE_RELEASE_DATE) },
    { url: `${baseUrl}/reports/celestial`, lastModified: new Date(ASTROLOGY_RELEASE_DATE) },
    ...CELESTIAL_GUIDE_LIST.map((guide) => ({
      url: `${baseUrl}${guide.path}`,
      lastModified: new Date(CELESTIAL_GUIDE_RELEASE_DATE),
    })),
    { url: `${baseUrl}${CALCULATION_REFERENCE_PATH}`, lastModified: new Date(CALCULATION_REFERENCE_RELEASE_DATE) },
    ...CALCULATION_REFERENCES.map((entry) => ({
      url: `${baseUrl}${calculationReferencePath(entry)}`,
      lastModified: new Date(CALCULATION_REFERENCE_RELEASE_DATE),
    })),
    { url: `${baseUrl}${TIMING_REFERENCE_PATH}`, lastModified: new Date(TIMING_REFERENCE_RELEASE_DATE) },
    ...TIMING_REFERENCES.map((entry) => ({
      url: `${baseUrl}${timingReferencePath(entry)}`,
      lastModified: new Date(TIMING_REFERENCE_RELEASE_DATE),
    })),
    { url: `${baseUrl}${CORPORATE_MUNDANE_PATH}`, lastModified: new Date(CORPORATE_MUNDANE_RELEASE_DATE) },
    ...CORPORATE_MUNDANE_REFERENCES.map((entry) => ({
      url: `${baseUrl}${corporateMundaneReferencePath(entry)}`,
      lastModified: new Date(CORPORATE_MUNDANE_RELEASE_DATE),
    })),
    { url: `${baseUrl}${TROPICAL_SIDEREAL_COMPARISON_PATH}`, lastModified: new Date(TROPICAL_SIDEREAL_COMPARISON_RELEASE_DATE) },
    ...TROPICAL_SIDEREAL_COMPARISONS.map((entry) => ({
      url: `${baseUrl}${tropicalSiderealComparisonPath(entry)}`,
      lastModified: new Date(TROPICAL_SIDEREAL_COMPARISON_RELEASE_DATE),
    })),
    { url: `${baseUrl}/knowledge/suppliers`, lastModified: new Date('2026-08-13') },
    { url: `${baseUrl}${SEMICONDUCTOR_PROCESS_MAP_PATH}`, lastModified: new Date(SEMICONDUCTOR_PROCESS_MAP_DATE) },
    { url: `${baseUrl}/start` },
    { url: `${baseUrl}/policy` },
    { url: `${baseUrl}/contact` },
    { url: `${baseUrl}/network`, lastModified: new Date('2026-07-26') },
    { url: `${baseUrl}/case-studies`, lastModified: new Date('2026-07-26') },
    { url: `${baseUrl}/projects/mayon`, lastModified: new Date('2026-07-24') },
    { url: `${baseUrl}/apps`, lastModified: new Date('2026-07-26') },
    { url: `${baseUrl}/apps/mayon`, lastModified: new Date('2026-07-26') },
    { url: `${baseUrl}/apps/mayon/privacy`, lastModified: new Date('2026-07-25') },
    { url: `${baseUrl}/apps/maha-os`, lastModified: new Date('2026-07-26') },
    { url: `${baseUrl}/apps/the-engine`, lastModified: new Date('2026-07-26') },
    { url: `${baseUrl}/apps/the-engine/privacy`, lastModified: new Date('2026-07-22') },
    { url: `${baseUrl}/tools` },
    { url: `${baseUrl}/tools/evidence-preflight`, lastModified: new Date('2026-08-30') },
    { url: `${baseUrl}/navigator`, lastModified: new Date('2026-08-09') },
    { url: `${baseUrl}/developers`, lastModified: new Date('2026-08-06') },
    { url: `${baseUrl}/pricing`, lastModified: new Date('2026-08-23') },
    { url: `${baseUrl}/terms`, lastModified: new Date('2026-08-27') },
    { url: `${baseUrl}/terms/physical-goods`, lastModified: new Date('2026-08-27') },
    { url: `${baseUrl}/agent-infrastructure-compatibility-pack`, lastModified: new Date('2026-08-11') },
    { url: `${baseUrl}/x402-observatory`, lastModified: new Date('2026-08-09') },
    { url: `${baseUrl}/x402-buyer-policy`, lastModified: new Date('2026-08-09') },
    { url: `${baseUrl}/tensor-opt`, lastModified: new Date('2026-08-06') },
    { url: `${baseUrl}/geometric-optimization`, lastModified: new Date('2026-08-06') },
    { url: `${baseUrl}/tools/architecture-readiness-assessment`, lastModified: new Date('2026-07-29') },
    { url: `${baseUrl}/tools/ai-boundary-planner`, lastModified: new Date('2026-07-29') },
    { url: `${baseUrl}/tools/constraint-studio`, lastModified: new Date('2026-07-27') },
    { url: `${baseUrl}/tools/token-calc`, lastModified: new Date('2026-07-29') },
    { url: `${baseUrl}/utilities/receipts` },
    { url: `${baseUrl}/about`, lastModified: new Date('2026-07-20') },
    { url: `${baseUrl}/systemic-sovereignty`, lastModified: new Date('2026-07-20') },
    { url: `${baseUrl}/on-device-ai-vs-cloud`, lastModified: new Date('2026-07-20') },
    { url: `${baseUrl}/audit` }, // ADDED CORE NODE
    { url: `${baseUrl}/docs` },
    { url: `${baseUrl}/mps` },   // ADDED CORE NODE
    { url: `${baseUrl}/mps/what-is-mps`, lastModified: new Date('2026-07-20') },
    { url: `${baseUrl}/mps/learn`, lastModified: new Date('2026-07-27') },
    { url: `${baseUrl}/mps/learn/implementation`, lastModified: new Date('2026-07-28') },
    { url: `${baseUrl}/mps/learn/reference-architectures`, lastModified: new Date('2026-07-29') },
    { url: `${baseUrl}/mps/learn/reference-architectures/offline-field-capture-authorized-cloud-escalation`, lastModified: new Date('2026-07-29') },
    { url: `${baseUrl}/mps/learn/reference-architectures/school-accessibility-assistant`, lastModified: new Date('2026-07-29') },
    { url: `${baseUrl}/mps/learn/reference-architectures/internal-approved-document-search`, lastModified: new Date('2026-07-29') },
    { url: `${baseUrl}/mps/learn/implementation/individuals`, lastModified: new Date('2026-07-28') },
    { url: `${baseUrl}/mps/learn/implementation/schools`, lastModified: new Date('2026-07-28') },
    { url: `${baseUrl}/mps/learn/implementation/small-organizations`, lastModified: new Date('2026-07-28') },
    { url: `${baseUrl}/mps/learn/implementation/developers`, lastModified: new Date('2026-07-28') },
    { url: `${baseUrl}/mps/learn/glossary`, lastModified: new Date('2026-07-28') },
    { url: `${baseUrl}/mps/learn/faq`, lastModified: new Date('2026-07-28') },
    { url: `${baseUrl}/mps/learn/methodology`, lastModified: new Date('2026-07-28') },
    { url: `${baseUrl}/mps/claim-level-provenance`, lastModified: new Date('2026-07-27') },
    { url: `${baseUrl}/mps/citing-ai-assisted-research`, lastModified: new Date('2026-07-27') },
    { url: `${baseUrl}/mps/source-interpretation-speculation`, lastModified: new Date('2026-07-27') },
    { url: `${baseUrl}/mps/audit-access`, lastModified: new Date('2026-07-20') },
    { url: `${baseUrl}/mps/preflight`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/mps/preflight/example`, lastModified: new Date('2026-07-27') },
    { url: `${baseUrl}/overclock`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/books`, lastModified: new Date('2026-09-02') },
    { url: `${baseUrl}/books/mcp-access`, lastModified: new Date('2026-07-20') },
    { url: `${baseUrl}/books/the-maha-principle`, lastModified: new Date('2026-08-26') },
    { url: `${baseUrl}/books/the-borrowed-light`, lastModified: new Date('2026-07-28') },
    { url: `${baseUrl}/books/the-borrowed-light/m-theory-faq`, lastModified: new Date('2026-07-28') },
    { url: `${baseUrl}/books/the-cosmic-recursion`, lastModified: new Date('2026-09-02') },
    { url: `${baseUrl}/books/the-synthetic-self`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/books/the-synthetic-self/ai-is-a-mirror`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/books/the-synthetic-self/the-learning-machine`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/books/the-synthetic-self/how-large-language-models-learn`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/books/the-orbital-mind`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/books/the-orbital-mind/the-map-is-not-the-mind`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/books/the-orbital-mind/the-governing-center`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/books/the-orbital-mind/what-is-executive-function`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/books/the-unfinished-species`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/books/the-unfinished-species/the-blind-watchmaker-opens-his-eyes`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/books/the-unfinished-species/the-algorithm`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/books/the-unfinished-species/what-is-natural-selection`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/books/the-imagined-life`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/books/the-imagined-life/the-faculty-of-the-possible`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/books/the-imagined-life/what-happens-when-you-sleep`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/books/the-imagined-life/sleep-stages-explained`, lastModified: new Date('2026-07-22') },
    { url: `${baseUrl}/books/the-volcanic-engine`, lastModified: new Date('2026-08-24') },
    { url: `${baseUrl}/books/the-volcanic-engine/why-volcanoes-explode`, lastModified: new Date('2026-08-24') },
    { url: `${baseUrl}/books/the-volcanic-engine/is-yellowstone-overdue`, lastModified: new Date('2026-08-24') },

    // POLICY DIRECTIVES (Five Platform Seeds)
    { url: `${baseUrl}/policy/nutrient-density-standard`, lastModified: new Date('2026-06-02') },
    { url: `${baseUrl}/policy/chemical-reciprocity-act`, lastModified: new Date('2026-06-02') },
    { url: `${baseUrl}/policy/algorithmic-transparency-act`, lastModified: new Date('2026-06-02') },
    { url: `${baseUrl}/policy/soil-restoration-corps`, lastModified: new Date('2026-06-02') },
    { url: `${baseUrl}/policy/community-sovereignty-compact`, lastModified: new Date('2026-06-02') },

    // POLICY WORKING PAPERS
    { url: `${baseUrl}/policy/nutrient-density-standard/paying-for-nutrition`, lastModified: new Date('2026-06-13') },

    // PROTOCOL HUB & NODES
    { url: `${baseUrl}/protocols` },
    { url: `${baseUrl}/protocols/architecting-renewal` },
    { url: `${baseUrl}/protocols/metabolic-sovereignty` },
    { url: `${baseUrl}/protocols/digital-firewall` },
    { url: `${baseUrl}/protocols/kinetic-friction` },
    { url: `${baseUrl}/protocols/hardware-sovereignty`, lastModified: new Date('2026-05-30') },

    // COGNITIVE GRID & MCP
    { url: `${baseUrl}/research/mcp` },
    { url: `${baseUrl}/mcp-bridge`, lastModified: new Date('2026-07-20') },
    { url: `${baseUrl}/enterprise-mcp-gateway`, lastModified: new Date('2026-07-29') },
    { url: `${baseUrl}/guides/enterprise-mcp-governance`, lastModified: new Date('2026-08-08') },
    { url: `${baseUrl}/guides/mcp-gateway-vs-direct-server`, lastModified: new Date('2026-08-08') },
    { url: `${baseUrl}/context-compiler`, lastModified: new Date('2026-07-29') },
    { url: `${baseUrl}/integrations/wso2`, lastModified: new Date('2026-08-19') },
    { url: `${baseUrl}/context-compiler/playground`, lastModified: new Date('2026-08-08') },
    { url: `${baseUrl}/benchmarks/context-retention`, lastModified: new Date('2026-08-08') },
    { url: `${baseUrl}/guides/retrieval-augmented-generation-lewis-2020`, lastModified: new Date('2026-08-09') },
    { url: `${baseUrl}/guides/context-compression-vs-conversation-summarization`, lastModified: new Date('2026-08-08') },
    { url: `${baseUrl}/guides/preserve-citations-reducing-llm-context`, lastModified: new Date('2026-08-08') },
    { url: `${baseUrl}/guides/crewai-context-compression-provenance`, lastModified: new Date('2026-08-08') },
    { url: `${baseUrl}/recipes/context-compiler-large-document`, lastModified: new Date('2026-08-07') },
    { url: `${baseUrl}/recipes/bazaar-discovery-to-payment`, lastModified: new Date('2026-08-08') },
    { url: `${baseUrl}/context-pack-evaluator`, lastModified: new Date('2026-07-29') },

    // TACTICAL BRIEFS
    { url: `${baseUrl}/doctrine/briefs/soil-gut-brain-axis` },
    { url: `${baseUrl}/doctrine/briefs/overclocked` },
    { url: `${baseUrl}/doctrine/briefs/physics-of-spirit` },
    { url: `${baseUrl}/doctrine/briefs/protocol-of-precision`, lastModified: new Date('2026-05-29') },
    {
      url: `${baseUrl}/doctrine/briefs/strategic-gravity`,
      lastModified: new Date('2026-05-29'),
    },
    {
      url: `${baseUrl}/doctrine/briefs/harmonic-command`,
      lastModified: new Date('2026-05-29'),
    },
    {
      url: `${baseUrl}/doctrine/briefs/asymmetric-soundscape`,
      lastModified: new Date('2026-05-29'),
    },
    {
      url: `${baseUrl}/doctrine/briefs/visionarys-standard`,
      lastModified: new Date('2026-05-29'),
    },
    {
      url: `${baseUrl}/doctrine/briefs/the-ordeal`,
      lastModified: new Date('2026-05-29'),
    },
    {
      url: `${baseUrl}/doctrine/briefs/consumer-to-producer`,
      lastModified: new Date('2026-05-29'),
    },
    {
      url: `${baseUrl}/doctrine/briefs/saturnian-vision`,
      lastModified: new Date('2026-05-29'),
    },

    // INJECTED: ACTIVE MARKET INTELLIGENCE
    { url: `${baseUrl}/intelligence` },
    { url: `${baseUrl}/insights` },
    { url: `${baseUrl}/intelligence/briefs/semiconductor-bifurcation` },
    { url: `${baseUrl}/intelligence/briefs/physical-ai-deployment` },
    {
      url: `${baseUrl}/intelligence/briefs/algorithmic-lock-in`,
    },
    {
      url: `${baseUrl}/intelligence/briefs/backside-microchannel-semiconductors`,
      lastModified: new Date('2026-08-13'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/known-good-die-storage-yield`,
      lastModified: new Date('2026-05-28'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/high-purity-alumina-manufacturing-architecture`,
      lastModified: new Date('2026-05-28'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/angstrom-era-soc-architecture`,
      lastModified: new Date('2026-08-05'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/rad-hard-gan-sic-leo-satellites`,
      lastModified: new Date('2026-05-28'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/generative-ai-silicon-cycle-recalibration`,
      lastModified: new Date('2026-05-28'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/semiconductor-wfe-doping-annealing-landscape`,
      lastModified: new Date('2026-05-28'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/power-semiconductor-target-setting-metrics`,
      lastModified: new Date('2026-05-28'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/tensor-network-ai-compression`,
      lastModified: new Date('2026-05-28'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/neurotechnology-non-medical-outlook`,
      lastModified: new Date('2026-05-28'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/ultra-thin-shock-absorbing-adhesives`,
      lastModified: new Date('2026-05-28'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/ai-software-cost-trajectory-2040`,
      lastModified: new Date('2026-05-28'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/hyperscaler-storage-disposition`,
      lastModified: new Date('2026-05-29'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/angstrom-foundry-diversification`,
      lastModified: new Date('2026-05-29'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/strategic-ip-architecture`,
      lastModified: new Date('2026-05-29'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/electro-photonic-co-integration`,
      lastModified: new Date('2026-05-29'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/power-semiconductor-target-architecture`,
      lastModified: new Date('2026-05-29'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/stm-legacy-distribution`,
      lastModified: new Date('2026-05-29'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/arc-welding-robotics-margins`,
      lastModified: new Date('2026-05-29'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/gan-on-diamond-leo-economics`,
      lastModified: new Date('2026-05-29'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/rapidus-2nm-yield-probability`,
      lastModified: new Date('2026-05-29'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/us-foundry-sovereignization`,
      lastModified: new Date('2026-08-05'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/sea-semiconductor-manufacturing-hedge`,
      lastModified: new Date('2026-06-02'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/sea-gaming-market-expansion`,
      lastModified: new Date('2026-06-04'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/upstream-semiconductor-cvc-best-practices`,
      lastModified: new Date('2026-07-23'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/european-compressor-suppliers-semiconductor-utilities`,
      lastModified: new Date('2026-07-23'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/smartphone-ap-fan-out-substrate-thickness`,
      lastModified: new Date('2026-08-05'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/smartphone-ap-osat-commercial-risk-allocation`,
      lastModified: new Date('2026-08-05'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/smartphone-oem-peripheral-sales-mix`,
      lastModified: new Date('2026-07-24'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/ai-semiconductor-slt-practices`,
      lastModified: new Date('2026-07-09'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/semiconductor-substrate-price-tolerance`,
      lastModified: new Date('2026-07-09'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/tape-storage-nearline-hdd-demand`,
      lastModified: new Date('2026-07-15'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/advanced-packaging-test-cpo-sockets`,
      lastModified: new Date('2026-07-15'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/ppg-derivatives-semiconductor-applications`,
      lastModified: new Date('2026-08-13'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/automotive-cloud-virtual-verification`,
      lastModified: new Date('2026-08-05'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/ntc-thermistors-embedded-power-modules`,
      lastModified: new Date('2026-07-15'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/china-fa-cable-competitive-landscape`,
      lastModified: new Date('2026-07-15'),
    },
    {
      url: `${baseUrl}/intelligence/briefs/us-semiconductor-cleanroom-construction`,
      lastModified: new Date('2026-07-15'),
    },
  ]
  const [published, canonicalReleases] = await Promise.all([
    getPublicContentPublicationSitemapRows(),
    getActiveEpistemicCanonicalReleases(),
  ])
  const unfinishedSpeciesReader = [
    { url: `${baseUrl}/books/the-unfinished-species/read`, lastModified: new Date('2026-07-22') },
    ...unfinishedSpeciesSections.map((section) => ({ url: `${baseUrl}/books/the-unfinished-species/read/${section.slug}`, lastModified: new Date('2026-07-22') })),
  ]
  const otherOpenBookReaders = Object.values(openBookEditions).flatMap((book) => {
    const lastModified = new Date(
      book.slug === 'the-cosmic-recursion' ? '2026-09-02' : book.slug === 'the-maha-principle' ? '2026-08-26' : book.slug === 'the-volcanic-engine' ? '2026-08-24' : '2026-07-22',
    )
    return [
      { url: `${baseUrl}/books/${book.slug}/read`, lastModified },
      ...book.sections.map((section) => ({ url: `${baseUrl}/books/${book.slug}/read/${section.slug}`, lastModified })),
    ]
  })
  const knowledgePages = KNOWLEDGE_ARTICLES.map((article) => ({
    url: `${baseUrl}${knowledgeArticlePath(article)}`,
    lastModified: new Date(article.dateModified),
  }))
  const astronomyKnowledgePages = ASTRONOMY_ARTICLES.map((article) => ({
    url: `${baseUrl}${astronomyArticlePath(article)}`,
    lastModified: new Date(article.dateModified),
  }))

  const knowledgeSupplierPages = KNOWLEDGE_SUPPLIERS.map((supplier) => ({
    url: `${baseUrl}${knowledgeSupplierPath(supplier)}`,
    lastModified: new Date('2026-08-13'),
  }))
  const astrologyTraditionPages = ASTROLOGY_TRADITIONS.map((tradition) => ({
    url: `${baseUrl}${astrologyTraditionPath(tradition)}`,
    lastModified: new Date(ASTROLOGY_RELEASE_DATE),
  }))

  const staticEpistemicPaths = new Set(PUBLIC_EPISTEMIC_RECORDS.map(epistemicRecordPath))
  const canonicalReleasePages = canonicalReleases
    .filter((release) => !staticEpistemicPaths.has(release.canonicalPath))
    .map((release) => ({
      url: `${baseUrl}${release.canonicalPath}`,
      lastModified: new Date(getPublishedSubstantialPage(release.recordId)?.quality.eligible ? SUBSTANTIAL_PUBLICATION_DATE : release.releasedAt),
    }))

  const publicIntelligenceBriefUrls = new Set(
    BRIEFS.map((brief) => `${baseUrl}/intelligence/briefs/${brief.slug}`),
  )
  const publicStaticPages = staticPages.filter(({ url }) =>
    !url.startsWith(`${baseUrl}/intelligence/briefs/`) || publicIntelligenceBriefUrls.has(url),
  )

  return [...publicStaticPages, ...sourceReferencePages, ...knowledgePages, ...astronomyKnowledgePages, ...astrologyTraditionPages, ...knowledgeSupplierPages, ...unfinishedSpeciesReader, ...otherOpenBookReaders, ...canonicalReleasePages, ...published.map((publication) => ({ url: `${baseUrl}/insights/${publication.slug}`, lastModified: new Date(publication.updated_at) }))]
}
