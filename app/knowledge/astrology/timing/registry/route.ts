import { TIMING_REFERENCE_RELEASE_DATE, TIMING_REFERENCES, TIMING_REFERENCE_SOURCES, timingReferencePath } from '@/lib/celestial-timing-references'

export function GET() {
  return Response.json({
    schemaVersion: 'celestial-timing-references/1.0', releasedAt: TIMING_REFERENCE_RELEASE_DATE,
    epistemicBoundary: 'These records document celestial events and chronology conventions. They do not establish that astrological interpretations predict outcomes.',
    references: TIMING_REFERENCES.map((entry) => ({ ...entry, path: timingReferencePath(entry) })), sources: TIMING_REFERENCE_SOURCES,
  })
}
