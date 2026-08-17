'use server'

import { BirthInputError, buildBirthReport, type BirthReport } from '@/lib/birth-report'

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
    const report = buildBirthReport({
      date: String(formData.get('date') ?? ''),
      time: String(formData.get('time') ?? ''),
      timeZone: String(formData.get('timeZone') ?? ''),
      latitudeDegrees: Number(formData.get('latitude')),
      longitudeDegrees: Number(formData.get('longitude')),
      elevationMeters: formData.get('elevation') === '' ? undefined : Number(formData.get('elevation')),
      placeLabel: String(formData.get('placeLabel') ?? ''),
    })
    return { status: 'ok', report }
  } catch (error) {
    if (error instanceof BirthInputError) return { status: 'error', message: error.message }
    // Never surface an unexpected error's detail: it could echo the input back.
    return { status: 'error', message: 'The report could not be computed from those inputs.' }
  }
}
