import type { DoctorReport } from './doctor.ts'

const ORIGIN = 'https://www.mahastrategies.com'
export type MonitorOffer = { offer: string; name: string; subject: string; method: 'GET' | 'POST' }

/** Public manifest only. Fail on malformed/empty inventory rather than silently losing coverage. */
export function discoveryMonitorMatrix(manifest: unknown): { include: MonitorOffer[] } {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray((manifest as { offers?: unknown }).offers)) throw new Error('Invalid public offer manifest')
  const include: MonitorOffer[] = []
  const ids = new Set<string>()
  const resources = new Set<string>()
  for (const raw of (manifest as { offers: unknown[] }).offers) {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid manifest offer')
    const row = raw as Record<string, unknown>
    if (row.status !== 'active' || (row.payment as { protocol?: unknown } | undefined)?.protocol !== 'x402') continue
    if (typeof row.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.id) || row.id.length > 80) throw new Error('Unsafe offer identifier')
    if (row.method !== 'POST' && row.method !== 'GET') throw new Error('Unsupported probe method')
    if (typeof row.canonicalResource !== 'string') throw new Error('Missing canonical resource')
    const url = new URL(row.canonicalResource)
    if (url.origin !== ORIGIN || !url.pathname.startsWith('/api/v1/') || url.username || url.password || url.hash || url.search || url.href !== row.canonicalResource) throw new Error('Unexpected probe destination')
    const identity = `${row.method} ${url.href}`
    if (ids.has(row.id) || resources.has(identity)) throw new Error('Duplicate public offer')
    ids.add(row.id); resources.add(identity)
    const name = row.id === 'context-compression' ? 'Context Compression' : row.id === 'deep-context-evaluation' ? 'Deep Context Evaluation' : row.id
    include.push({ offer: row.id, name, subject: url.href, method: row.method })
  }
  if (!include.length || include.length > 100) throw new Error('Offer inventory outside monitor safety bounds')
  return { include }
}

export type MonitorClassification = 'clean' | 'drift' | 'listing_missing' | 'probe_failure' | 'contract_failure' | 'warning' | 'monitor_failure'

/** A failed runner is not proof of stale metadata. Only a completed comparison can assert drift. */
export function classifyDiscoveryReport(value: unknown, subject: string, doctorOutcome: string): MonitorClassification {
  if (!value || typeof value !== 'object') return 'monitor_failure'
  const report = value as DoctorReport
  if (report.schemaVersion !== '1.0.0' || report.tool?.name !== 'x402-doctor' || report.endpoint !== subject
    || !Array.isArray(report.findings) || !report.summary || typeof report.ok !== 'boolean'
    || !Number.isFinite(Date.parse(report.checkedAt))
    || report.findings.some((finding) => !finding || typeof finding.ruleId !== 'string' || !['note', 'warning', 'error'].includes(finding.level))) return 'monitor_failure'
  const errors = report.findings.filter((finding) => finding.level === 'error').length
  const warnings = report.findings.filter((finding) => finding.level === 'warning').length
  if (errors !== report.summary.errors || warnings !== report.summary.warnings) return 'monitor_failure'
  const rules = new Set(report.findings.map((finding) => finding.ruleId))
  if (rules.has('x402.network') || rules.has('x402.bazaar.lookup')) return 'probe_failure'
  if (errors) return 'contract_failure'
  if (rules.has('x402.bazaar.stale_metadata') && report.live?.declarationDigest && report.bazaar?.found === true && report.bazaar.matchesLive === false) return 'drift'
  if (rules.has('x402.bazaar.not_found') && report.bazaar?.found === false) return 'listing_missing'
  if (warnings) return 'warning'
  // Never close an incident for a failed, skipped or cancelled command, a
  // missing comparison, or a report with no valid payment challenge.
  if (doctorOutcome !== 'success' || !report.ok || report.live?.status !== 402
    || !report.live.declarationDigest || report.bazaar?.found !== true || report.bazaar.matchesLive !== true) return 'monitor_failure'
  return 'clean'
}
