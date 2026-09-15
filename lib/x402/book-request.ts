/**
 * Request shapes for the machine book offers, with no book data imported.
 *
 * The receipt builders call these first, and the x402 gateway calls them
 * before settlement, so both apply one contract. Whether a well-formed
 * sectionId names a published section needs the edition itself and is still
 * decided by the builder.
 */
export function parseBookSectionRequest(input: unknown): { sectionId: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Request must be a JSON object.')
  const record = input as Record<string, unknown>
  if (Object.keys(record).some((key) => key !== 'sectionId')) throw new Error('Only sectionId is accepted.')
  if (typeof record.sectionId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(record.sectionId)) {
    throw new Error('sectionId must be a published section slug.')
  }
  return { sectionId: record.sectionId }
}

export function parseBookEditionRequest(input: unknown): Record<string, never> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Request must be an empty JSON object.')
  if (Object.keys(input as Record<string, unknown>).length !== 0) throw new Error('This edition has no request parameters; send {}.')
  return {}
}
