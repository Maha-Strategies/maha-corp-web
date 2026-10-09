import type { Metadata } from 'next'
import { buildBirthReport } from '@/lib/birth-report'
import AstrologyApp from './AstrologyApp'
import { strategicGeometry, transitOverlay, corporateSynastry } from '@/lib/astrology-strategy'
import { listTimeZones } from '@/lib/time-zones'

export const metadata: Metadata = {
  title: 'Orbital Alignment: Maha Jyotisha',
  description: 'Explore your birth chart, timing and source-traced Jyotisha readings with Maha Strategies.',
  alternates: { canonical: '/astrology' },
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function AstrologyPage() {
  const reference = `${new Date().toISOString().slice(0,10)}T12:00:00.000Z`
  const sample = buildBirthReport({
    date: '2000-01-01', time: '12:00', timeZone: 'Asia/Colombo',
    latitudeDegrees: 6.9271, longitudeDegrees: 79.8612,
    placeLabel: 'Colombo · fictional example', birthTimeUncertaintyMinutes: 0,
    timingInstantUtc: reference,
  })
  const secondary = buildBirthReport({ date: '2025-12-17', time: '12:00', timeZone: 'America/Denver', latitudeDegrees: 41.14, longitudeDegrees: -104.82, placeLabel: 'Fictional entity', birthTimeUncertaintyMinutes: 0, timingInstantUtc: sample.timing.referenceInstantUtc })
  const demo = { strategic: strategicGeometry(sample), transit: transitOverlay(sample.natalChart, sample.timing.referenceInstantUtc), synastry: corporateSynastry(sample.natalChart, secondary.natalChart, 'corporate') }
  return <AstrologyApp sample={sample} timeZones={listTimeZones()} demo={demo} launchPricing={process.env.ASTROLOGY_LAUNCH_PRICING === 'true'} />
}
