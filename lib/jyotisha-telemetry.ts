/** Drop private reading events, not just their known input keys. */
export function isPrivateReadingTelemetry(event: {
  request?: { url?: string }; transaction?: string; breadcrumbs?: { data?: Record<string, unknown> }[];
}): boolean {
  const values = [event.request?.url, event.transaction,
    ...(event.breadcrumbs ?? []).flatMap(b => [b.data?.url, b.data?.from, b.data?.to])]
  return values.some(value => typeof value === 'string'
    && /\/knowledge\/birth(?:[/?#\s]|$)|\/api\/v1\/interpretations\/jyotisha(?:[/?#\s]|$)/.test(value))
}
