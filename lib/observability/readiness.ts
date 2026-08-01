import { opsAlertConfig, type OpsAlertEnvironment } from './contracts.ts'

type Environment = OpsAlertEnvironment & Record<string, string | undefined>

function configured(value: string | undefined) { return Boolean(value?.trim().replace(/^['"]|['"]$/g, '')) }

export function observabilityReadiness(environment: Environment = process.env as Environment) {
  const sentry = {
    dsnConfigured: configured(environment.SENTRY_DSN) || configured(environment.NEXT_PUBLIC_SENTRY_DSN),
    clientDsnConfigured: configured(environment.NEXT_PUBLIC_SENTRY_DSN),
    sourceMapUploadConfigured: configured(environment.SENTRY_AUTH_TOKEN) && configured(environment.SENTRY_ORG) && configured(environment.SENTRY_PROJECT),
  }
  let webhookConfiguration: 'ready' | 'missing' | 'invalid' = 'missing'
  try { webhookConfiguration = opsAlertConfig(environment) ? 'ready' : 'missing' } catch { webhookConfiguration = 'invalid' }
  const webhook = { configuration: webhookConfiguration }
  const ready = sentry.dsnConfigured && sentry.clientDsnConfigured && sentry.sourceMapUploadConfigured && webhookConfiguration === 'ready'
  const unavailable = !sentry.dsnConfigured && webhookConfiguration === 'missing'
  return { generatedAt: new Date().toISOString(), readOnly: true as const, state: ready ? 'ready' as const : unavailable ? 'unavailable' as const : 'degraded' as const, sentry, webhook }
}
