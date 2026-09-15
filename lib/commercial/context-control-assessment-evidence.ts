import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { REQUIRED_PUBLIC_ARTIFACTS } from './context-control-assessment-offer.ts'

/**
 * Operator-side evidence availability check.
 *
 * Keep this filesystem probe separate from the public offer data. Public pages
 * import the offer module, and bundlers must not need to trace an arbitrary
 * repository root merely to render its static commercial copy.
 */
export function missingPublicArtifacts(root = join(import.meta.dirname, '..', '..')): string[] {
  return REQUIRED_PUBLIC_ARTIFACTS.filter((path) => !existsSync(join(root, path)))
}
