import { TROPICAL_SIDEREAL_COMPARISON_RELEASE_DATE, TROPICAL_SIDEREAL_COMPARISONS, TROPICAL_SIDEREAL_COMPARISON_SOURCES, tropicalSiderealComparisonPath } from '@/lib/tropical-sidereal-comparisons'

export function GET() {
  return Response.json({
    schemaVersion: 'tropical-sidereal-comparisons/1.0', releasedAt: TROPICAL_SIDEREAL_COMPARISON_RELEASE_DATE,
    comparisonPolicy: 'One shared celestial substrate produces two separately named derived models. Agreement is recorded; disagreement is preserved; neither frame is selected or blended after outcomes are known.',
    epistemicBoundary: 'These comparisons document calculations, conventions, and traditional model differences. They do not establish that either astrology system predicts outcomes.',
    comparisons: TROPICAL_SIDEREAL_COMPARISONS.map((entry) => ({ ...entry, path: tropicalSiderealComparisonPath(entry) })),
    sources: TROPICAL_SIDEREAL_COMPARISON_SOURCES,
  })
}
