// Synthetic precision regression only. No company identity or certificate data.
export const SYNTHETIC_MINUTE_FORMATION = {
  organizationName: 'Synthetic minute-precision organization',
  eventType: 'certificate-issued',
  date: '2025-12-17',
  time: '07:43',
  timeZone: 'America/Denver',
  timeConfidence: 'recorded-minute',
  uncertaintyMinutes: 1,
  latitudeDegrees: 41.14,
  longitudeDegrees: -104.8197,
  locationBasis: 'authority-location',
  jurisdictionCountryCode: 'US',
  registrationAuthority: 'Synthetic registry; no actual attestation',
  evidenceKind: 'government-record',
  evidenceReference: 'Synthetic input, not inspected evidence',
} as const
