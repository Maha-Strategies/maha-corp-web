/**
 * The single decision point for whether substantial material may be rendered.
 *
 * This lives in its own leaf module with no imports on purpose. The record page
 * must not pull in the alignment audits or the reconciliation preflight just to
 * ask this question — doing so drags the whole audit corpus into the page
 * bundle, which both breaks the build and defeats the served-output boundary.
 */
export function mayRenderSubstantialMaterial(input: {
  eligible: boolean
  contractRecordRevision: string
  liveRecordRevision: string
}): boolean {
  if (!input.eligible) return false
  // Empty digests must never compare equal and pass the guard.
  if (!input.contractRecordRevision || !input.liveRecordRevision) return false
  return input.contractRecordRevision === input.liveRecordRevision
}
