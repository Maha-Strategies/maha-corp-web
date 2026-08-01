import type { Event, TransactionEvent } from '@sentry/core'

type SentryPayload = Event | TransactionEvent

function stripQuery(value: string | undefined) {
  if (!value) return value
  try { const url = new URL(value); url.search = ''; url.hash = ''; return url.toString() }
  catch { return value.split('?')[0].split('#')[0] }
}

/** Keep operational context while removing customer payloads, credentials,
 * cookies, query strings, user identity, and arbitrary application extras. */
export function scrubSentryPayload<T extends SentryPayload>(event: T): T {
  if (event.request) {
    event.request = {
      method: event.request.method,
      url: stripQuery(event.request.url),
    }
  }
  delete event.user
  delete event.extra
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exception) => ({
      ...exception,
      value: exception.value ? 'Application error (details redacted)' : exception.value,
    }))
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
      category: breadcrumb.category,
      level: breadcrumb.level,
      timestamp: breadcrumb.timestamp,
      type: breadcrumb.type,
      data: breadcrumb.data?.url ? { url: stripQuery(String(breadcrumb.data.url)) } : undefined,
    }))
  }
  return event
}

export function sentryTraceSampleRate(value = process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.1
}

export function sentryEnvironment() {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development'
}
