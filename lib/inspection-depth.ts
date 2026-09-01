/**
 * How deeply a source was actually read, judged from what the audit says.
 *
 * This matters because claim-to-passage support cannot be approved on an
 * abstract: an abstract establishes what a paper is about, not that a named
 * section carries a named scope. Getting the classifier wrong is expensive in
 * both directions - too loose and a record is approved on evidence nobody read,
 * too tight and a record is sent back for work already done.
 *
 * Two earlier attempts were both wrong, and instructively so. Matching
 * /abstract/ anywhere flagged "abstract, Methods, Discussion, in-vivo results"
 * as shallow, because the word appears in a list of sections that were read.
 * Matching a keyword list of section names then missed "§§2.1-2.3 and §3, pp.
 * 311-347" and "What Is Ignition, milestones", which are more precise locators
 * than any keyword list would contain.
 *
 * The reliable signal is not what the audit names but whether it disclaims: an
 * inspection that reached only the abstract says so, because saying so is the
 * point of recording where you stopped. So depth is read from the explicit
 * limitation, and everything else is treated as having named something real.
 */

export const INSPECTION_DEPTH_VERSION = 'maha-inspection-depth/1.0' as const

export type InspectionDepth = 'abstract-or-metadata-only' | 'section-or-full-text' | 'not-recorded'

/** An inspection that states it stopped at the abstract, metadata or landing page. */
const EXPLICIT_LIMIT = [
  /\babstract\b[^.;]{0,40}\bonly\b/i,
  /\bmetadata\b[^.;]{0,40}\bonly\b/i,
  /\bonly\b[^.;]{0,40}\b(abstract|metadata)\b/i,
  /\blanding page\b/i,
  /\bpublisher-served abstract\b/i,
  /\bindexed abstract\b/i,
]

export function classifyInspectionDepth(inspectedContentLocation: string | null | undefined): InspectionDepth {
  const where = String(inspectedContentLocation ?? '').trim()
  if (where.length === 0) return 'not-recorded'
  return EXPLICIT_LIMIT.some((pattern) => pattern.test(where))
    ? 'abstract-or-metadata-only'
    : 'section-or-full-text'
}

/** Only a depth that reached the passage can support the claim-to-passage axis. */
export function supportsPassageAxis(depth: InspectionDepth): boolean {
  return depth === 'section-or-full-text'
}
