/**
 * Input parsing for the muhūrta verdict surface.
 *
 * Kept out of the page component so it can be tested directly: a moment
 * parsed against the wrong offset silently changes the verdict, which is the
 * kind of error that should be caught by a test rather than by a reader.
 */

/**
 * Parses the moment field as UTC.
 *
 * A bare `2026-08-16T05:28` is parsed by the platform as *local* time, which
 * would shift the instant by the server's offset. The field is labelled UTC,
 * so it is read as UTC.
 */
export function parseInstant(value: string | undefined): { instant: Date; invalid: boolean } {
  if (!value) return { instant: new Date(), invalid: false }
  const trimmed = value.trim()
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)
  const parsed = new Date(hasZone ? trimmed : `${trimmed}Z`)
  return Number.isFinite(parsed.getTime()) ? { instant: parsed, invalid: false } : { instant: new Date(), invalid: true }
}
