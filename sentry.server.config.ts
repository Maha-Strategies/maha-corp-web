import * as Sentry from '@sentry/nextjs'
import { scrubSentryPayload, sentryEnvironment, sentryTraceSampleRate } from './lib/observability/sentry'
import { isPrivateReadingTelemetry } from './lib/jyotisha-telemetry'

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: sentryEnvironment(),
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: sentryTraceSampleRate(),
  sendDefaultPii: false,
  beforeSend: event => isPrivateReadingTelemetry(event) ? null : scrubSentryPayload(event),
  beforeSendTransaction: event => isPrivateReadingTelemetry(event) ? null : scrubSentryPayload(event),
})
