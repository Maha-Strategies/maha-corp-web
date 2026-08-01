import * as Sentry from '@sentry/nextjs'
import { scrubSentryPayload, sentryTraceSampleRate } from './lib/observability/sentry'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: sentryTraceSampleRate(),
  sendDefaultPii: false,
  beforeSend: scrubSentryPayload,
  beforeSendTransaction: scrubSentryPayload,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
