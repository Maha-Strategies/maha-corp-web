import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.mahastrategies.com'

  return [
    // EXISTING NODES
    { url: `${baseUrl}`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/consulting`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/software`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/doctrine`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    
    // NEW PROTOCOL HUB & NODES
    { url: `${baseUrl}/protocols`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/protocols/architecting-renewal`, lastModified: new Date(), priority: 0.9 },
    { url: `${baseUrl}/protocols/metabolic-sovereignty`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/protocols/digital-firewall`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/protocols/kinetic-friction`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/protocols/hardware-sovereignty`, lastModified: new Date(), priority: 0.8 },
  ]
}