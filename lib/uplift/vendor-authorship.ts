/**
 * Sources that are a company describing its own products.
 *
 * One set, used everywhere. The generator previously carried two identical
 * copies of this list four hundred lines apart -- one gating attestations, one
 * gating the first-party page state -- so adding a vendor source to the obvious
 * one silently left the other stale. That is not a hypothetical: it happened,
 * and the symptom was a page becoming better documented and less clearly
 * labelled at the same time.
 *
 * A company describing its own products is first-party evidence wherever it is
 * cited, so the exclusion belongs to the source rather than to a list of routes.
 */
export const VENDOR_AUTHORED_SOURCES: ReadonlySet<string> = new Set([
  'asml-lithography',
  'tel-process-equipment',
  'amkor-3d-stack',
  // Batch 13. Giving this catalogue a declared scope made its page eligible,
  // which would otherwise have moved it out of the first-party state.
  'advantest-products-overview',
])

export function isVendorAuthored(sourceId: string): boolean {
  return VENDOR_AUTHORED_SOURCES.has(sourceId)
}

/**
 * Supplier pages whose evidence includes the vendor's own documentation.
 *
 * Derived from each page's own source list. A page cannot lose the first-party
 * label by acquiring more of the vendor's documentation, and the derivation is
 * scoped to supplier routes so it cannot capture an equipment or process page
 * that happens to cite a vendor alongside independent work.
 */
export function vendorBackedSupplierRoutes(
  pages: readonly { route: string; sources: readonly { id: string }[] }[],
): Set<string> {
  const routes = new Set<string>()
  for (const page of pages) {
    if (!page.route.startsWith('/knowledge/suppliers/')) continue
    if (page.sources.some((source) => isVendorAuthored(source.id))) routes.add(page.route)
  }
  return routes
}
