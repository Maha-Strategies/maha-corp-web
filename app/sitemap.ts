import { MetadataRoute } from 'next'
import { MAHA_SITE_URL } from '@/lib/entity'
import { getPublicContentPublicationSitemapRows } from '@/lib/public-content-publications'
import { unfinishedSpeciesSections } from '@/lib/unfinished-species'
import { openBookEditions } from '@/lib/open-book-editions'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = MAHA_SITE_URL
  
  const staticPages: MetadataRoute.Sitemap = [
    // EXISTING CORE NODES
    { url: `${baseUrl}`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/consulting`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/rapid-intelligence-brief`, lastModified: new Date('2026-07-16'), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/consulting/semiconductor-supply-chain`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/consulting/ai-infrastructure`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/consulting/evidence-policy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/method`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/software`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/doctrine`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/research`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/start`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/policy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/network`, lastModified: new Date('2026-07-26'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/projects/mayon`, lastModified: new Date('2026-07-24'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/apps`, lastModified: new Date('2026-07-26'), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/apps/mayon`, lastModified: new Date('2026-07-26'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/apps/mayon/privacy`, lastModified: new Date('2026-07-25'), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/apps/maha-os`, lastModified: new Date('2026-07-26'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/apps/the-engine`, lastModified: new Date('2026-07-26'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/apps/the-engine/privacy`, lastModified: new Date('2026-07-22'), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/tools`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/utilities/receipts`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: new Date('2026-07-20'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/systemic-sovereignty`, lastModified: new Date('2026-07-20'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/on-device-ai-vs-cloud`, lastModified: new Date('2026-07-20'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/audit`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 }, // ADDED CORE NODE
    { url: `${baseUrl}/mps`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },   // ADDED CORE NODE
    { url: `${baseUrl}/mps/what-is-mps`, lastModified: new Date('2026-07-20'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/mps/audit-access`, lastModified: new Date('2026-07-20'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/mps/preflight`, lastModified: new Date('2026-07-16'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/overclock`, lastModified: new Date('2026-07-16'), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/books`, lastModified: new Date('2026-07-16'), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/books/mcp-access`, lastModified: new Date('2026-07-20'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/books/the-synthetic-self`, lastModified: new Date('2026-07-16'), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/books/the-synthetic-self/ai-is-a-mirror`, lastModified: new Date('2026-07-16'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/books/the-synthetic-self/the-learning-machine`, lastModified: new Date('2026-07-16'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/books/the-synthetic-self/how-large-language-models-learn`, lastModified: new Date('2026-07-16'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/books/the-orbital-mind`, lastModified: new Date('2026-07-16'), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/books/the-orbital-mind/the-map-is-not-the-mind`, lastModified: new Date('2026-07-16'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/books/the-orbital-mind/the-governing-center`, lastModified: new Date('2026-07-16'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/books/the-orbital-mind/what-is-executive-function`, lastModified: new Date('2026-07-16'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/books/the-unfinished-species`, lastModified: new Date('2026-07-16'), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/books/the-unfinished-species/the-blind-watchmaker-opens-his-eyes`, lastModified: new Date('2026-07-16'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/books/the-unfinished-species/the-algorithm`, lastModified: new Date('2026-07-16'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/books/the-unfinished-species/what-is-natural-selection`, lastModified: new Date('2026-07-16'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/books/the-imagined-life`, lastModified: new Date('2026-07-16'), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/books/the-imagined-life/the-faculty-of-the-possible`, lastModified: new Date('2026-07-16'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/books/the-imagined-life/what-happens-when-you-sleep`, lastModified: new Date('2026-07-16'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/books/the-imagined-life/sleep-stages-explained`, lastModified: new Date('2026-07-22'), changeFrequency: 'monthly', priority: 0.8 },

    // POLICY DIRECTIVES (Five Platform Seeds)
    { url: `${baseUrl}/policy/nutrient-density-standard`, lastModified: new Date('2026-06-02'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/policy/chemical-reciprocity-act`, lastModified: new Date('2026-06-02'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/policy/algorithmic-transparency-act`, lastModified: new Date('2026-06-02'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/policy/soil-restoration-corps`, lastModified: new Date('2026-06-02'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/policy/community-sovereignty-compact`, lastModified: new Date('2026-06-02'), changeFrequency: 'monthly', priority: 0.7 },

    // POLICY WORKING PAPERS
    { url: `${baseUrl}/policy/nutrient-density-standard/paying-for-nutrition`, lastModified: new Date('2026-06-13'), changeFrequency: 'monthly', priority: 0.7 },

    // PROTOCOL HUB & NODES
    { url: `${baseUrl}/protocols`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/protocols/architecting-renewal`, lastModified: new Date(), priority: 0.9 },
    { url: `${baseUrl}/protocols/metabolic-sovereignty`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/protocols/digital-firewall`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/protocols/kinetic-friction`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/protocols/hardware-sovereignty`, lastModified: new Date(), priority: 0.8 },

    // COGNITIVE GRID & MCP
    { url: `${baseUrl}/research/mcp`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/mcp-bridge`, lastModified: new Date('2026-07-20'), changeFrequency: 'monthly', priority: 0.7 },

    // TACTICAL BRIEFS
    { url: `${baseUrl}/doctrine/briefs/soil-gut-brain-axis`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/doctrine/briefs/overclocked`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/doctrine/briefs/physics-of-spirit`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/doctrine/briefs/protocol-of-precision`, lastModified: new Date('2026-05-29'), changeFrequency: 'monthly', priority: 0.6 },
    {
      url: `${baseUrl}/doctrine/briefs/strategic-gravity`,
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/doctrine/briefs/harmonic-command`,
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/doctrine/briefs/asymmetric-soundscape`,
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/doctrine/briefs/visionarys-standard`,
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/doctrine/briefs/the-ordeal`,
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/doctrine/briefs/consumer-to-producer`,
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/doctrine/briefs/saturnian-vision`,
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },

    // INJECTED: ACTIVE MARKET INTELLIGENCE
    { url: `${baseUrl}/intelligence`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/insights`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/intelligence/briefs/semiconductor-bifurcation`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/intelligence/briefs/physical-ai-deployment`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    {
      url: `${baseUrl}/intelligence/briefs/algorithmic-lock-in`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/intelligence/briefs/backside-microchannel-semiconductors`,
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/known-good-die-storage-yield`,
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/high-purity-alumina-manufacturing-architecture`,
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/angstrom-era-soc-architecture`,
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/rad-hard-gan-sic-leo-satellites`,
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/generative-ai-silicon-cycle-recalibration`,
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/semiconductor-wfe-doping-annealing-landscape`,
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/power-semiconductor-target-setting-metrics`,
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/tensor-network-ai-compression`,
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/neurotechnology-non-medical-outlook`,
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/ultra-thin-shock-absorbing-adhesives`,
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/ai-software-cost-trajectory-2040`,
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/hyperscaler-storage-disposition`,
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/angstrom-foundry-diversification`,
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/strategic-ip-architecture`,
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/electro-photonic-co-integration`,
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/power-semiconductor-target-architecture`,
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/stm-legacy-distribution`,
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/arc-welding-robotics-margins`,
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/gan-on-diamond-leo-economics`,
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/rapidus-2nm-yield-probability`,
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/us-foundry-sovereignization`,
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/sea-semiconductor-manufacturing-hedge`,
      lastModified: new Date('2026-06-02'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/sea-gaming-market-expansion`,
      lastModified: new Date('2026-06-04'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/upstream-semiconductor-cvc-best-practices`,
      lastModified: new Date('2026-07-23'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/european-compressor-suppliers-semiconductor-utilities`,
      lastModified: new Date('2026-07-23'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/smartphone-ap-fan-out-substrate-thickness`,
      lastModified: new Date('2026-07-23'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/smartphone-oem-peripheral-sales-mix`,
      lastModified: new Date('2026-07-24'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/ai-semiconductor-slt-practices`,
      lastModified: new Date('2026-07-09'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/semiconductor-substrate-price-tolerance`,
      lastModified: new Date('2026-07-09'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/tape-storage-nearline-hdd-demand`,
      lastModified: new Date('2026-07-15'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/advanced-packaging-test-cpo-sockets`,
      lastModified: new Date('2026-07-15'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/automotive-cloud-virtual-verification`,
      lastModified: new Date('2026-07-15'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/ntc-thermistors-embedded-power-modules`,
      lastModified: new Date('2026-07-15'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/china-fa-cable-competitive-landscape`,
      lastModified: new Date('2026-07-15'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/intelligence/briefs/us-semiconductor-cleanroom-construction`,
      lastModified: new Date('2026-07-15'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ]
  const published = await getPublicContentPublicationSitemapRows()
  const unfinishedSpeciesReader = [
    { url: `${baseUrl}/books/the-unfinished-species/read`, lastModified: new Date('2026-07-22'), changeFrequency: 'monthly' as const, priority: 0.9 },
    ...unfinishedSpeciesSections.map((section) => ({ url: `${baseUrl}/books/the-unfinished-species/read/${section.slug}`, lastModified: new Date('2026-07-22'), changeFrequency: 'monthly' as const, priority: 0.8 })),
  ]
  const otherOpenBookReaders = Object.values(openBookEditions).flatMap((book) => [
    { url: `${baseUrl}/books/${book.slug}/read`, lastModified: new Date('2026-07-22'), changeFrequency: 'monthly' as const, priority: 0.9 },
    ...book.sections.map((section) => ({ url: `${baseUrl}/books/${book.slug}/read/${section.slug}`, lastModified: new Date('2026-07-22'), changeFrequency: 'monthly' as const, priority: 0.8 })),
  ])
  return [...staticPages, ...unfinishedSpeciesReader, ...otherOpenBookReaders, ...published.map((publication) => ({ url: `${baseUrl}/insights/${publication.slug}`, lastModified: new Date(publication.updated_at), changeFrequency: 'monthly' as const, priority: 0.7 }))]
}
