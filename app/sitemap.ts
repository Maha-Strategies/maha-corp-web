// app/sitemap.ts
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.mahastrategies.com'
  
  return [
    // EXISTING CORE NODES
    { url: `${baseUrl}`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/consulting`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/software`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/doctrine`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/research`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/start`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/policy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 }, // ADDED CONTACT ROUTE

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
    { url: `${baseUrl}/doctrine/briefs/protocol-of-precision`, lastModified: new Date('2026-05-29'), changeFrequency: 'monthly', priority: 0.6,},
    {
      url: 'https://www.mahastrategies.com/doctrine/briefs/strategic-gravity',
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: 'https://www.mahastrategies.com/doctrine/briefs/harmonic-command',
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://www.mahastrategies.com/doctrine/briefs/asymmetric-soundscape',
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://www.mahastrategies.com/doctrine/briefs/visionarys-standard',
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://www.mahastrategies.com/doctrine/briefs/the-ordeal',
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://www.mahastrategies.com/doctrine/briefs/consumer-to-producer',
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://www.mahastrategies.com/doctrine/briefs/saturnian-vision',
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
      url: 'https://www.mahastrategies.com/intelligence/briefs/backside-microchannel-semiconductors',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/known-good-die-storage-yield',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/high-purity-alumina-manufacturing-architecture',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/angstrom-era-soc-architecture',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/rad-hard-gan-sic-leo-satellites',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/generative-ai-silicon-cycle-recalibration',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/semiconductor-wfe-doping-annealing-landscape',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/power-semiconductor-target-setting-metrics',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/tensor-network-ai-compression',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/neurotechnology-non-medical-outlook',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/ultra-thin-shock-absorbing-adhesives',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/ai-software-cost-trajectory-2040',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/hyperscaler-storage-disposition',
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/angstrom-foundry-diversification',
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/strategic-ip-architecture',
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/electro-photonic-co-integration',
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/power-semiconductor-target-architecture',
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/stm-legacy-distribution',
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/arc-welding-robotics-margins',
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/gan-on-diamond-leo-economics',
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/rapidus-2nm-yield-probability',
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.mahastrategies.com/intelligence/briefs/us-foundry-sovereignization',
      lastModified: new Date('2026-05-29'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ]
}