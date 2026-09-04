/**
 * Typed related records, derived by co-citation and bounded.
 *
 * Two pages that draw on the same source are related, and that is a fact about
 * the corpus rather than a judgement about the subject: the link comes from the
 * source lists, so it cannot be authored to make a page look connected.
 *
 * Deliberately not a similarity heuristic. The depth audit counts typed links
 * towards substantiality, and a heuristic would let a page earn that count from
 * a resemblance nobody checked.
 *
 * The bound
 * ---------
 * Unbounded co-citation is quadratic in how many pages cite a source: a source
 * cited by N pages puts N-1 links on every one of them, so a cluster that
 * doubles quadruples the total. At 167 pages the worst page carried 17 links,
 * which is survivable; the same corpus at three times the size would put
 * seventy on a page and the section would stop being a list of related records
 * and become a dump.
 *
 * Which links survive is decided by source specificity rather than by
 * truncating an alphabetical list. A source cited by two pages says far more
 * about their relatedness than one cited by fifty, and that ratio is derived
 * from the corpus rather than judged. It is the same reasoning as an inverse
 * document frequency, and it means the bound improves the section instead of
 * merely shortening it.
 */

/**
 * The most related records one page will render.
 *
 * Sits above the 75th percentile of the current corpus, so most pages are
 * untouched, and far above the two links the substantial floor requires, so no
 * page can be pushed under that floor by the cap. It is also about where a list
 * stops being scannable.
 */
export const MAX_RELATED_RECORDS = 8

export interface LinkablePage {
  route: string
  sources: readonly { id: string }[]
  relatedRoutes: readonly string[]
}

/** How many pages cite each source. The denominator of the specificity score. */
export function citationCounts(pages: readonly LinkablePage[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const page of pages) {
    for (const source of page.sources) counts.set(source.id, (counts.get(source.id) ?? 0) + 1)
  }
  return counts
}

/**
 * Related routes for one page, most specifically connected first.
 *
 * A page that already declares its own related routes keeps them: an explicit
 * relationship outranks a derived one.
 */
export function relatedRoutesFor(
  page: LinkablePage,
  pages: readonly LinkablePage[],
  counts: Map<string, number>,
  limit: number = MAX_RELATED_RECORDS,
): string[] {
  if (page.relatedRoutes.length > 0) return [...page.relatedRoutes]

  const own = new Set(page.sources.map((s) => s.id))
  // Best specificity wins: the fewest other pages sharing any connecting source.
  const best = new Map<string, number>()
  for (const other of pages) {
    if (other.route === page.route) continue
    for (const source of other.sources) {
      if (!own.has(source.id)) continue
      const citing = counts.get(source.id) ?? 1
      const current = best.get(other.route)
      if (current === undefined || citing < current) best.set(other.route, citing)
    }
  }

  return [...best.entries()]
    // Fewer citing pages first; route breaks ties so regeneration is stable.
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([route]) => route)
}

/** Fill in related routes across the corpus, in place. */
export function deriveRelatedRoutes(pages: { route: string; sources: readonly { id: string }[]; relatedRoutes: readonly string[] }[]): void {
  const counts = citationCounts(pages)
  const snapshot = pages.map((p) => ({ route: p.route, sources: p.sources, relatedRoutes: p.relatedRoutes }))
  for (const page of pages) {
    page.relatedRoutes = relatedRoutesFor(page, snapshot, counts)
  }
}
