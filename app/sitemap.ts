import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.mahastrategies.com'
  
  return [
    // EXISTING CORE NODES
    { url: `${baseUrl}`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/consulting`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
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
    { url: `${baseUrl}/audit`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 }, // ADDED CORE NODE
    { url: `${baseUrl}/mps`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },   // ADDED CORE NODE
    { url: `${baseUrl}/books/the-synthetic-self`, lastModified: new Date('2026-07-16'), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/books/the-synthetic-self/ai-is-a-mirror`, lastModified: new Date('2026-07-16'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/books/the-unfinished-species`, lastModified: new Date('2026-07-16'), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/books/the-unfinished-species/the-blind-watchmaker-opens-his-eyes`, lastModified: new Date('2026-07-16'), changeFrequency: 'monthly', priority: 0.7 },

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
      lastModified: new Date('2026-07-09'),
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
}
