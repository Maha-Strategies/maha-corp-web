import { MetadataRoute } from 'next'
import { MAHA_SITE_URL } from '@/lib/entity'
import { getPublicContentPublicationSitemapRows } from '@/lib/public-content-publications'
import { unfinishedSpeciesSections } from '@/lib/unfinished-species'
import { openBookEditions } from '@/lib/open-book-editions'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = MAHA_SITE_URL
  
  const staticPages: MetadataRoute.Sitemap = [
    // EXISTING CORE NODES
    { url: `${baseUrl}` },
    { url: `${baseUrl}/consulting` },
    { url: `${baseUrl}/rapid-intelligence-brief`, lastModified: new Date('2026-07-16') },
    { url: `${baseUrl}/consulting/semiconductor-supply-chain` },
    { url: `${baseUrl}/consulting/ai-infrastructure` },
    { url: `${baseUrl}/consulting/evidence-policy` },
    { url: `${baseUrl}/method` },
    { url: `${baseUrl}/software` },
    { url: `${baseUrl}/doctrine` },
    { url: `${baseUrl}/research` },
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
    { url: `${baseUrl}/developers`, lastModified: new Date('2026-08-06') },
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
    { url: `${baseUrl}/books`, lastModified: new Date('2026-07-28') },
    { url: `${baseUrl}/books/mcp-access`, lastModified: new Date('2026-07-20') },
    { url: `${baseUrl}/books/the-borrowed-light`, lastModified: new Date('2026-07-28') },
    { url: `${baseUrl}/books/the-borrowed-light/m-theory-faq`, lastModified: new Date('2026-07-28') },
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
    { url: `${baseUrl}/context-compiler/playground`, lastModified: new Date('2026-08-08') },
    { url: `${baseUrl}/benchmarks/context-retention`, lastModified: new Date('2026-08-08') },
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
      lastModified: new Date('2026-05-28'),
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
  const published = await getPublicContentPublicationSitemapRows()
  const unfinishedSpeciesReader = [
    { url: `${baseUrl}/books/the-unfinished-species/read`, lastModified: new Date('2026-07-22') },
    ...unfinishedSpeciesSections.map((section) => ({ url: `${baseUrl}/books/the-unfinished-species/read/${section.slug}`, lastModified: new Date('2026-07-22') })),
  ]
  const otherOpenBookReaders = Object.values(openBookEditions).flatMap((book) => [
    { url: `${baseUrl}/books/${book.slug}/read`, lastModified: new Date('2026-07-22') },
    ...book.sections.map((section) => ({ url: `${baseUrl}/books/${book.slug}/read/${section.slug}`, lastModified: new Date('2026-07-22') })),
  ])
  return [...staticPages, ...unfinishedSpeciesReader, ...otherOpenBookReaders, ...published.map((publication) => ({ url: `${baseUrl}/insights/${publication.slug}`, lastModified: new Date(publication.updated_at) }))]
}
