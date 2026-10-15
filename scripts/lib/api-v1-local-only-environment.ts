/** Local test runner only. Never apply this to production configuration. */
const hostedCredential = /SUPABASE|POSTGRES|DATABASE|NEON|PG(?:HOST|PORT|DATABASE|USER|PASSWORD)|REDIS|UPSTASH|CDP|ANTHROPIC|OPENAI.*KEY|MODEL.*KEY|VERCEL|SENTRY|POSTHOG|RPC.*URL|ALCHEMY|INFURA|PRIVATE_KEY|API_KEY|AWS_ACCESS_KEY|AWS_SECRET_ACCESS_KEY/i
export function localOnlyEnvironment(source: Record<string, string | undefined> = process.env): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(source)) if (!hostedCredential.test(key)) env[key] = value
  return { ...env, NODE_ENV: 'test', X402_ENABLED: 'false', NEXT_TELEMETRY_DISABLED: '1', OTEL_SDK_DISABLED: 'true' }
}
