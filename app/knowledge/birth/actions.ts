'use server'

import { BirthInputError, buildBirthReport, type BirthReport } from '@/lib/birth-report'
import type { HistoricalMilestoneInput } from '@/lib/historical-calibration'
import { consumeReadingCapacity } from '@/lib/jyotisha-capacity'

export type BirthActionState =
  | { status: 'idle' }
  | { status: 'ok'; report: BirthReport }
  | { status: 'error'; message: string }

/**
 * Computes a birth report from posted form data.
 *
 * The submission carries personal data, so it arrives by POST rather than in a
 * query string, and nothing here writes the inputs to a log. Only derived
 * values and digests are returned.
 */
export async function computeBirthReport(_previous: BirthActionState, formData: FormData): Promise<BirthActionState> {
  try {
    const capacity = await consumeReadingCapacity()
    if (capacity !== 'accepted') return { status: 'error', message: capacity === 'limited'
      ? 'The free reading service has reached its shared capacity. Please try again later.'
      : 'The reading service is temporarily unavailable. No report was generated.' }
    // Number(null) and Number('') are zero, not supplied coordinates.
    for (const key of ['latitude', 'longitude']) {
      const value = formData.get(key)
      if (typeof value !== 'string' || !value.trim()) throw new BirthInputError('Latitude and longitude are required.')
    }
    const timingMoment = String(formData.get('timingInstantUtc') ?? '')
    const milestonePayload = String(formData.get('historicalMilestones') ?? '[]')
    if (milestonePayload.length > 50_000) throw new BirthInputError('Historical milestone data is too large.')
    let historicalMilestones: HistoricalMilestoneInput[]
    try {
      const parsed: unknown = JSON.parse(milestonePayload)
      if (!Array.isArray(parsed)) throw new Error('not-an-array')
      historicalMilestones = parsed as HistoricalMilestoneInput[]
    } catch {
      throw new BirthInputError('Historical milestones could not be read.')
    }
    const report = buildBirthReport({
      date: String(formData.get('date') ?? ''),
      time: String(formData.get('time') ?? ''),
      timeZone: String(formData.get('timeZone') ?? ''),
      birthTimeUncertaintyMinutes: Number(formData.get('birthTimeUncertaintyMinutes') ?? 0),
      latitudeDegrees: Number(formData.get('latitude')),
      longitudeDegrees: Number(formData.get('longitude')),
      elevationMeters: formData.get('elevation') === '' ? undefined : Number(formData.get('elevation')),
      placeLabel: String(formData.get('placeLabel') ?? ''),
      timingInstantUtc: timingMoment ? `${timingMoment}:00.000Z` : undefined,
      historicalMilestones,
    })
    return { status: 'ok', report }
  } catch (error) {
    if (error instanceof BirthInputError) return { status: 'error', message: error.message }
    // Never surface an unexpected error's detail: it could echo the input back.
    return { status: 'error', message: 'The report could not be computed from those inputs.' }
  }
}
