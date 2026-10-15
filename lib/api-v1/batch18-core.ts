import { z } from 'zod'
import { recordAuditSuite } from './batch9-record-suite.ts'
import { input, records, id, spec, time, later, utc, unique, finding as f, metric as m, type AuditSpec } from './batch5-core.ts'
import { samePins } from './batch11-science-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'

type Policy = { category: string; boundary: string; frame: z.ZodRawShape; sample: Record<string, unknown> }
export function publicRecordSuite(p: Parameters<typeof recordAuditSuite>[0], overrides: AuditSpec[] = []) {
  const prefix = p.category + '-', keys = Object.keys(p.pins)
  const duplicate = spec(prefix + 'duplicate-record-identities', 'Group declared organization/record/revision identities and compare every source, jurisdiction, record-kind and content pin. Identical content with conflicting pins is not a duplicate clean frame. ' + p.boundary,
    input({ rows: records({ ...p.pins, id }) }), { rows: [p.sample] }, { rows: [p.sample, { ...p.sample, id: 'duplicate1' }] },
    [prefix + 'duplicate-frame', prefix + 'conflicting-frame-content'], [prefix + 'distinct-frames'], i => {
      unique(i.rows.map(r => r.id)); const groups = new Map<string, typeof i.rows>()
      for (const r of i.rows) { const row: Record<string, unknown> = r, key = demandDigest([row[p.owner], row[p.subject], row[p.revision]]); groups.set(key, [...(groups.get(key) ?? []), r]) }
      return { findings: [...groups.values()].filter(g => g.length > 1).map(g => f(prefix + (g.every(r => samePins(r, g[0], keys)) ? 'duplicate-frame' : 'conflicting-frame-content'), ...g.map(r => r.id))), metrics: [m(prefix + 'distinct-frames', p.category, groups.size)] }
    })
  const custom = new Map([duplicate, ...overrides].map(s => [s.id, s]))
  return recordAuditSuite(p).map(s => custom.get(s.id) ?? s)
}

export const minorInteger = z.string().regex(/^(0|[1-9][0-9]{0,17})$/)
const currency = z.string().regex(/^[A-Z]{3}$/), digits = z.number().int().min(0).max(6)
/** No binary floating-point amounts, currency conversion, sums across frames,
 * accounting interpretation or assumption that a currency code is real. */
export function declaredMoneyAudits(p: Policy) {
  const prefix = p.category + '-', keys = Object.keys(p.frame), denomination = { currency, minorUnitDigits: digits }
  const measurement = { ...p.frame, ...denomination, unit: z.enum(['minor-units', 'major-units']), valueMinor: minorInteger.nullable(), qualifier: z.enum(['exact', 'estimated', 'unknown']) }
  const row = { id: 'money1', ...p.sample, currency: 'USD', minorUnitDigits: 2, unit: 'minor-units', valueMinor: '100', qualifier: 'exact' }
  return [
    spec(prefix + 'unit-label-consistency', 'Check exact declared currency/minor-unit scale labels and all source/revision pins. Only canonical nonnegative integer strings are accepted as amounts; unknown or estimated amounts remain unestablished. Never treat a major-unit label as minor units or infer equivalence across currencies. Currency labels are not independently validated. ' + p.boundary,
      input({ ...p.frame, ...denomination, measurements: records(measurement) }), { ...p.sample, currency: 'USD', minorUnitDigits: 2, measurements: [row] },
      { ...p.sample, currency: 'USD', minorUnitDigits: 2, measurements: [{ ...row, currency: 'EUR' }] },
      [prefix + 'denomination-mismatch', prefix + 'amount-frame-mismatch', prefix + 'amount-not-exact'], [prefix + 'exact-compatible-amounts'], i => {
        unique(i.measurements.map(r => r.id)); let checked = 0
        const findings = i.measurements.flatMap(r => { const issues = [...(r.currency !== i.currency || r.minorUnitDigits !== i.minorUnitDigits || r.unit !== 'minor-units' ? [f(prefix + 'denomination-mismatch', r.id)] : []), ...(!samePins(r, i, keys) ? [f(prefix + 'amount-frame-mismatch', r.id)] : []), ...(r.valueMinor === null || r.qualifier !== 'exact' ? [f(prefix + 'amount-not-exact', r.id)] : [])]; if (!issues.length) checked++; return issues })
        return { findings, metrics: [m(prefix + 'exact-compatible-amounts', p.category, checked)] }
      }),
    spec(prefix + 'declared-bound-audit', 'Compare exact canonical integer minor-unit strings using BigInt against one inclusive caller-declared bound in the same record/source/revision/currency/scale frame. Duplicate bounds, unknown values and denomination mismatches cannot pass. This is a caller policy check, not a funding, accounting or legal threshold. ' + p.boundary,
      input({ bounds: records({ ...p.frame, ...denomination, minimumMinor: minorInteger, maximumMinor: minorInteger }), measurements: records(measurement) }),
      { bounds: [{ id: 'bound1', ...p.sample, currency: 'USD', minorUnitDigits: 2, minimumMinor: '0', maximumMinor: '100' }], measurements: [row] },
      { bounds: [{ id: 'bound1', ...p.sample, currency: 'USD', minorUnitDigits: 2, minimumMinor: '0', maximumMinor: '100' }], measurements: [{ ...row, valueMinor: '101' }] },
      [prefix + 'amount-outside-declared-bound', prefix + 'bound-not-unique', prefix + 'denomination-mismatch', prefix + 'amount-not-exact'], [prefix + 'exact-compatible-bounds'], i => {
        unique(i.bounds.map(r => r.id)); unique(i.measurements.map(r => r.id)); if (i.bounds.some(b => BigInt(b.minimumMinor) > BigInt(b.maximumMinor))) throw Error('reversed_minor_unit_bounds')
        let checked = 0
        const findings = i.measurements.flatMap(r => { const matches = i.bounds.filter(b => samePins(b, r, keys)); if (matches.length !== 1) return [f(prefix + 'bound-not-unique', r.id)]; const b = matches[0]
          if (r.currency !== b.currency || r.minorUnitDigits !== b.minorUnitDigits || r.unit !== 'minor-units') return [f(prefix + 'denomination-mismatch', r.id)]
          if (r.valueMinor === null || r.qualifier !== 'exact') return [f(prefix + 'amount-not-exact', r.id)]
          checked++; const amount = BigInt(r.valueMinor); return amount < BigInt(b.minimumMinor) || amount > BigInt(b.maximumMinor) ? [f(prefix + 'amount-outside-declared-bound', r.id)] : [] })
        return { findings, metrics: [m(prefix + 'exact-compatible-bounds', p.category, checked)] }
      }),
  ]
}

export function declaredWindowAudit(p: Policy) {
  const prefix = p.category + '-'
  const row = { id: 'notice1', ...p.sample, publishedAt: time, amendedAt: time, closesAt: later }
  return spec(prefix + 'timestamp-order-audit', 'Compare supplied publication/amendment instants and an explicit half-open availability window against one assessment instant, in an identical issuer/record/source/revision frame. Closing equality is outside the window. Null closing or amendment time is unknown. Full UTC instants only; no time-zone conversion, official deadline, current availability or eligibility inference. ' + p.boundary,
    input({ ...p.frame, assessedAt: utc, rows: records({ ...p.frame, publishedAt: utc, amendedAt: utc.nullable(), closesAt: utc.nullable() }) }),
    { ...p.sample, assessedAt: time, rows: [row] }, { ...p.sample, assessedAt: later, rows: [row] },
    [prefix + 'declared-window-closed', prefix + 'window-frame-mismatch', prefix + 'closing-time-unknown', prefix + 'amendment-time-unknown', prefix + 'chronology-conflict'], [prefix + 'known-in-window-records'], i => {
      unique(i.rows.map(r => r.id)); let count = 0
      const findings = i.rows.flatMap(r => { const issues = [...(!samePins(r, i, Object.keys(p.frame)) ? [f(prefix + 'window-frame-mismatch', r.id)] : []), ...(r.closesAt === null ? [f(prefix + 'closing-time-unknown', r.id)] : r.closesAt <= i.assessedAt ? [f(prefix + 'declared-window-closed', r.id)] : []), ...(r.amendedAt === null ? [f(prefix + 'amendment-time-unknown', r.id)] : []), ...(r.publishedAt > i.assessedAt || r.closesAt !== null && r.closesAt <= r.publishedAt || r.amendedAt !== null && (r.amendedAt < r.publishedAt || r.amendedAt > i.assessedAt) ? [f(prefix + 'chronology-conflict', r.id)] : [])]; if (!issues.length) count++; return issues })
      return { findings, metrics: [m(prefix + 'known-in-window-records', p.category, count)] }
    })
}

export function declaredModuleCoverage(p: Policy & { modules: readonly [string, ...string[]] }) {
  const prefix = p.category + '-', moduleRef = z.enum(p.modules)
  return spec(prefix + 'condition-coverage-map', 'Require exactly one caller-declared present module per requested module name in an identical organization/record/jurisdiction/source/revision frame. Unknown, absent, duplicate and unrelated modules do not establish coverage. Requested modules are caller policy, not statutory filing or application requirements. ' + p.boundary,
    input({ ...p.frame, requiredModules: z.array(moduleRef).min(1).max(p.modules.length), rows: records({ ...p.frame, moduleRef, state: z.enum(['present', 'absent', 'unknown']) }, 0) }),
    { ...p.sample, requiredModules: [p.modules[0]], rows: [{ id: 'module1', ...p.sample, moduleRef: p.modules[0], state: 'present' }] },
    { ...p.sample, requiredModules: [p.modules[0]], rows: [] },
    [prefix + 'module-not-established', prefix + 'module-frame-mismatch', prefix + 'module-not-present', prefix + 'module-undeclared'], [prefix + 'established-requested-modules'], i => {
      unique(i.requiredModules); unique(i.rows.map(r => r.id)); let count = 0
      const issues = (r: typeof i.rows[number]) => [...(!samePins(r, i, Object.keys(p.frame)) ? [f(prefix + 'module-frame-mismatch', r.id)] : []), ...(r.state !== 'present' ? [f(prefix + 'module-not-present', r.id)] : [])]
      const findings = i.requiredModules.flatMap(k => { const matches = i.rows.filter(r => r.moduleRef === k); if (matches.length === 1 && issues(matches[0]).length === 0) { count++; return [] }; return [f(prefix + 'module-not-established', k)] })
      findings.push(...i.rows.flatMap(r => [...issues(r), ...(!i.requiredModules.includes(r.moduleRef) ? [f(prefix + 'module-undeclared', r.id)] : [])]))
      return { findings, metrics: [m(prefix + 'established-requested-modules', p.category, count)] }
    })
}
