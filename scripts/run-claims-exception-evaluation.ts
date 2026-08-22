/**
 * Emits the claims-exception evaluation evidence report.
 *
 * Deterministic and offline: no credential is read, no provider is called, no
 * payment is possible, and nothing leaves the process. The output is the
 * metadata-only artifact an evaluator receives.
 */
import { claimsExceptionEvidenceReport } from '../lib/governed-workflow/evaluations/claims-exception.ts'
import { findUnboundedStrings } from '../lib/governed-workflow/audit.ts'

const report = claimsExceptionEvidenceReport()

// Refuse to emit anything long enough to be document text, rather than
// trusting that nothing upstream introduced it.
const unbounded = findUnboundedStrings(report.scenarios)
if (unbounded.length > 0) {
  console.error(`Refusing to emit: unbounded string at ${unbounded[0].path} (${unbounded[0].length} chars).`)
  process.exit(1)
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
