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
      url: 'https://mahastrategies.com/intelligence/briefs/backside-microchannel-semiconductors',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://mahastrategies.com/intelligence/briefs/known-good-die-storage-yield',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://mahastrategies.com/intelligence/briefs/high-purity-alumina-manufacturing-architecture',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://mahastrategies.com/intelligence/briefs/angstrom-era-soc-architecture',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://mahastrategies.com/intelligence/briefs/rad-hard-gan-sic-leo-satellites',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://mahastrategies.com/intelligence/briefs/generative-ai-silicon-cycle-recalibration',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://mahastrategies.com/intelligence/briefs/semiconductor-wfe-doping-annealing-landscape',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://mahastrategies.com/intelligence/briefs/power-semiconductor-target-setting-metrics',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://mahastrategies.com/intelligence/briefs/tensor-network-ai-compression',
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly',
      priority: 0.8,
    }
  ]
}