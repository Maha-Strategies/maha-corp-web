type ErrorDiagnostic = {
  name: string
  message: string
  requestId?: string
  httpStatusCode?: number
}

function safeDiagnosticText(input: string): string {
  return input
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, '[REDACTED_AWS_ACCESS_KEY]')
    .replace(/\b0x[0-9a-fA-F]{64}\b/g, '[REDACTED_32_BYTE_VALUE]')
    .slice(0, 800)
}

/**
 * Preserve the AWS cause chain without dumping request objects, credentials,
 * headers, or response bodies. The one-shot runner must explain a stopped
 * payment before an operator can safely authorize another attempt.
 */
export function errorDiagnostics(error: unknown): ErrorDiagnostic[] {
  const diagnostics: ErrorDiagnostic[] = []
  const seen = new Set<unknown>()
  let current: unknown = error
  while (current instanceof Error && !seen.has(current) && diagnostics.length < 5) {
    seen.add(current)
    const metadata = '$metadata' in current && current.$metadata && typeof current.$metadata === 'object'
      ? current.$metadata as { requestId?: unknown; httpStatusCode?: unknown }
      : undefined
    diagnostics.push({
      name: safeDiagnosticText(current.name || 'Error'),
      message: safeDiagnosticText(current.message || 'Unknown error'),
      ...(typeof metadata?.requestId === 'string' ? { requestId: safeDiagnosticText(metadata.requestId) } : {}),
      ...(typeof metadata?.httpStatusCode === 'number' ? { httpStatusCode: metadata.httpStatusCode } : {}),
    })
    current = current.cause
  }
  return diagnostics.length ? diagnostics : [{ name: 'UnknownError', message: safeDiagnosticText(String(error)) }]
}
