import { CORPORATE_MUNDANE_REFERENCES, CORPORATE_MUNDANE_RELEASE_DATE, CORPORATE_MUNDANE_SOURCES, corporateMundaneReferencePath } from '@/lib/corporate-mundane-references'

export function GET() {
  return Response.json({
    schemaVersion: 'corporate-mundane-references/1.0', releasedAt: CORPORATE_MUNDANE_RELEASE_DATE,
    epistemicBoundary: 'These records document corporate-event methodology and sanitized system demonstrations. They do not establish that astrology predicts organization outcomes.',
    sanitizationBoundary: 'Sanitized case studies are synthetic demonstrations, not claimed client results. No organization, participant, natal, exact financial, raw-document, or full-timestamp data is published.',
    references: CORPORATE_MUNDANE_REFERENCES.map((entry) => ({ ...entry, path: corporateMundaneReferencePath(entry) })),
    sources: CORPORATE_MUNDANE_SOURCES,
  })
}
