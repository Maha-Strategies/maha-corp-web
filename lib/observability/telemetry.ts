import * as Sentry from '@sentry/nextjs'
import type { Span } from '@sentry/core'

function operationName(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 32)
  return normalized || 'UNKNOWN'
}

export function mcpMethodClass(method: string) {
  if (method === 'tools/list') return 'tools.list'
  if (method === 'tools/call') return 'tools.call'
  if (method === 'initialize') return 'initialize'
  if (method === 'ping') return 'ping'
  if (method.startsWith('resources/')) return 'resources'
  if (method.startsWith('prompts/')) return 'prompts'
  return 'custom'
}

export function captureOperationalError(error: unknown, component: string, operation: string) {
  Sentry.withScope((scope) => {
    scope.setTag('maha.component', component.slice(0, 64))
    scope.setTag('maha.operation', operation.slice(0, 64))
    Sentry.captureException(error)
  })
}

export async function traceRedisQuery<T>(operation: string, work: () => Promise<T>): Promise<T> {
  const command = operationName(operation)
  return Sentry.startSpan({
    name: `Redis ${command}`,
    op: 'db.redis',
    attributes: { 'db.system': 'redis', 'db.operation.name': command },
  }, async (span) => {
    const started = performance.now()
    try {
      const result = await work()
      span.setStatus({ code: 1, message: 'ok' })
      return result
    } catch (error) {
      span.setStatus({ code: 2, message: 'internal_error' })
      captureOperationalError(error, 'redis', command)
      throw error
    } finally {
      span.setAttribute('maha.duration_ms', Math.round((performance.now() - started) * 100) / 100)
    }
  })
}

export async function traceMcpUpstream<T>(method: string, hostname: string, work: (span: Span) => Promise<T>): Promise<T> {
  return Sentry.startSpan({
    name: 'MCP upstream POST',
    op: 'http.client',
    attributes: {
      'server.address': hostname,
      'http.request.method': 'POST',
      'mcp.method_class': mcpMethodClass(method),
      'maha.dependency': 'modal-mcp-upstream',
    },
  }, async (span) => {
    const started = performance.now()
    try { return await work(span) }
    finally { span.setAttribute('maha.duration_ms', Math.round((performance.now() - started) * 100) / 100) }
  })
}
