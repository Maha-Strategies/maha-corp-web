'use server'

import { createHash } from 'node:crypto'
import { createCorporateReviewStore, readCorporateTrust } from '@/lib/corporate-review-service'

import {
  CorporateReportInputError,
  buildCorporateReport,
  type CorporateReport,
  type CorporateEvidenceKind,
  type EventLocationBasis,
  type EventTimeConfidence,
  type FormationEventType,
} from '@/lib/corporate-report'

export type CorporateActionState =
  | { status: 'idle' }
  | { status: 'ok'; report: CorporateReport }
  | { status: 'error'; message: string }

const MAX_EVIDENCE_BYTES = 500_000

export async function computeCorporateReport(_previous: CorporateActionState, formData: FormData): Promise<CorporateActionState> {
  try {
    const fileValue = formData.get('evidenceFile')
    let evidenceAttachment
    if (fileValue instanceof File && fileValue.size > 0) {
      if (fileValue.size > MAX_EVIDENCE_BYTES) throw new CorporateReportInputError('Evidence attachment must be 500 KB or smaller.')
      const bytes = Buffer.from(await fileValue.arrayBuffer())
      evidenceAttachment = {
        filename: fileValue.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180) || 'evidence-file',
        mediaType: fileValue.type.slice(0, 120) || 'application/octet-stream',
        byteLength: fileValue.size,
        sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      }
    }

    const input = {
      timingReferenceUtc: formData.get('timingDate') ? `${String(formData.get('timingDate'))}T12:00:00Z` : undefined,
      organizationName: String(formData.get('organizationName') ?? ''),
      eventType: String(formData.get('eventType') ?? '') as FormationEventType,
      date: String(formData.get('date') ?? ''),
      time: String(formData.get('time') ?? ''),
      timeZone: String(formData.get('timeZone') ?? ''),
      timeConfidence: String(formData.get('timeConfidence') ?? '') as EventTimeConfidence,
      uncertaintyMinutes: Number(formData.get('uncertaintyMinutes')),
      placeLabel: String(formData.get('placeLabel') ?? ''),
      latitudeDegrees: Number(formData.get('latitude')),
      longitudeDegrees: Number(formData.get('longitude')),
      elevationMeters: formData.get('elevation') === '' ? undefined : Number(formData.get('elevation')),
      locationBasis: String(formData.get('locationBasis') ?? '') as EventLocationBasis,
      locationRationale: String(formData.get('locationRationale') ?? ''),
      jurisdictionCountryCode: String(formData.get('jurisdictionCountryCode') ?? ''),
      jurisdictionRegion: String(formData.get('jurisdictionRegion') ?? ''),
      registrationAuthority: String(formData.get('registrationAuthority') ?? ''),
      entityIdentifier: String(formData.get('entityIdentifier') ?? ''),
      evidenceKind: String(formData.get('evidenceKind') ?? '') as CorporateEvidenceKind,
      evidenceReference: String(formData.get('evidenceReference') ?? ''),
      evidenceAttachment,
    }
    // Validate before storage access. Review objects never come from FormData.
    const baseline = buildCorporateReport(input)
    const privateGrant = String(formData.get('privateVerificationReceipt') ?? '')
    const store = process.env.CORPORATE_REVIEWS_ENABLED === 'true' ? createCorporateReviewStore() : null
    if (privateGrant && !store) return { status: 'error', message: 'Private verification is not configured. Remove the receipt to get an unverified calculation report.' }
    const trust = await readCorporateTrust(input, privateGrant, store)
    const report = store ? buildCorporateReport(input, trust) : baseline
    return { status: 'ok', report }
  } catch (error) {
    if (error instanceof CorporateReportInputError) return { status: 'error', message: error.message }
    return { status: 'error', message: 'The organization event report could not be computed from those inputs.' }
  }
}
