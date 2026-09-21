/** Remove exact repetitions only; no semantic inference or evidence rewriting. */
export function unreadItems(items: readonly string[], alreadyRendered: readonly string[]): string[] {
  const existing = new Set(alreadyRendered)
  return items.filter((item) => !existing.has(item))
}
