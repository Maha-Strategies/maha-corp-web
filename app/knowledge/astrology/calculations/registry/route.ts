import { CALCULATION_REFERENCE_RELEASE_DATE, CALCULATION_REFERENCES, CALCULATION_REFERENCE_SOURCES, calculationReferencePath } from '@/lib/celestial-calculation-references'

export function GET() {
  return Response.json({
    schemaVersion: 'celestial-calculation-references/1.0',
    releasedAt: CALCULATION_REFERENCE_RELEASE_DATE,
    epistemicBoundary: 'These records document calculations and conventions. They do not establish that astrological interpretations predict outcomes.',
    references: CALCULATION_REFERENCES.map((entry) => ({ ...entry, path: calculationReferencePath(entry) })),
    sources: CALCULATION_REFERENCE_SOURCES,
  })
}
