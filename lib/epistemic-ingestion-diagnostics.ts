/**
 * The Batch 11 Preview diagnostic boundary.
 *
 * A 503 from the ingestion route covers two unrelated causes - no persistence
 * client, or a persistence call that threw - and the response could not tell
 * them apart. Distinguishing them from outside cost protected rehearsal runs,
 * each of which is a real Supabase branch and a real Preview deployment.
 *
 * So the isolated Batch 11 Preview may learn the minimum that separates them:
 * a fixed operation code and a SQLSTATE. Nothing else crosses. The code is
 * matched against a fixed shape rather than extracted from the message, so a
 * provider string carrying anything else - SQL, a connection URL, a row value -
 * yields "none" instead of passing that text through.
 *
 * Production never sets the flag, and there the key is absent rather than
 * empty, so the response body is byte-for-byte what it was before.
 */

/** The one environment value that opens this boundary. Exact match only. */
export const REHEARSAL_FLAG = 'batch-11-preview' as const

/** A bracketed SQLSTATE or PostgREST code, and nothing else. */
const SANITIZED_FAILURE_CODE = /\[(PGRST\d{3}|[0-9A-Z]{5})\]/

export interface PreviewDiagnostic {
  operation: string
  sqlstate: string
}

export function previewDiagnostic(
  operation: string,
  error?: unknown,
  flag: string | undefined = process.env.EPISTEMIC_EXTERNAL_LINEAGE_REHEARSAL,
): { diagnostic: PreviewDiagnostic } | Record<string, never> {
  if (flag !== REHEARSAL_FLAG) return {}
  const matched = (error instanceof Error ? error.message : '').match(SANITIZED_FAILURE_CODE)
  return { diagnostic: { operation, sqlstate: matched ? matched[1] : 'none' } }
}
