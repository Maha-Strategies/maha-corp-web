import { computeNatalChart } from '../natal-chart.ts'
import { ZonedTimeError, zonedWallTimeToUtc } from '../zoned-time.ts'
import { CorpusValidationError, natalProfileDigest, type NatalProfileInput } from './types.ts'

export function resolveNatalProfile(value: unknown) {
  const profile = value as NatalProfileInput | null
  const issues: string[] = []
  if (!profile || typeof profile !== 'object') throw new CorpusValidationError(['natalProfile must be an object.'])
  if (typeof profile.date !== 'string' || typeof profile.time !== 'string' || typeof profile.timeZone !== 'string') issues.push('Natal date, local time, and IANA time zone are required.')
  const latitude = Number(profile.latitudeDegrees)
  const longitude = Number(profile.longitudeDegrees)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) issues.push('Natal latitude must be between -90 and 90.')
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) issues.push('Natal longitude must be between -180 and 180.')
  if (issues.length) throw new CorpusValidationError(issues)
  try {
    const resolved = zonedWallTimeToUtc(profile.date, profile.time, profile.timeZone)
    const normalized: NatalProfileInput = { ...profile, latitudeDegrees: latitude, longitudeDegrees: longitude }
    return {
      profile: normalized,
      profileSha256: natalProfileDigest(normalized),
      birthInstant: resolved.instant,
      natalChart: computeNatalChart({ instant: resolved.instant, latitudeDegrees: latitude, longitudeDegrees: longitude }),
    }
  } catch (error) {
    if (error instanceof ZonedTimeError) throw new CorpusValidationError([error.message])
    throw error
  }
}

