import type { Metadata } from 'next'

import CelestialGuidePage from '@/app/knowledge/astrology/CelestialGuidePage'
import { SITE_URL } from '@/lib/briefs-data'
import { CELESTIAL_GUIDES } from '@/lib/celestial-guides'

const guide = CELESTIAL_GUIDES.comparison

export const metadata: Metadata = { metadataBase: new URL(SITE_URL), title: `${guide.title} | Maha Celestial`, description: guide.description, alternates: { canonical: guide.path }, openGraph: { type: 'article', title: guide.title, description: guide.description, url: `${SITE_URL}${guide.path}`, siteName: 'Maha Celestial' } }

export default function TropicalVsSiderealPage() { return <CelestialGuidePage guide={guide} /> }
