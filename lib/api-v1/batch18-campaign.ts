import { z } from 'zod'
import { input, records, id, digest, hash, time, later, utc, spec, unique, finding as f, metric as m } from './batch5-core.ts'
import { samePins } from './batch11-science-core.ts'
import { publicRecordSuite, declaredMoneyAudits, declaredModuleCoverage } from './batch18-core.ts'

const category = 'campaign-disclosures', prefix = category + '-'
const boundary = 'Public or synthetic nonpersonal committee-level filing metadata and aggregate amounts only. No donor, contributor, voter or candidate-person records; no political profiling, fundraising targeting, eligibility or contribution-limit decisions, filing submission, live FEC access or legal/compliance advice. A matching label is not proof of official acceptance, completeness or lawful reuse.'
const frame = { committeeRef: z.string().regex(/^C[0-9]{8}$/), filingRef: id, reportForm: z.enum(['F3', 'F3P', 'F3X', 'other-declared']), jurisdictionRef: id, reportingPeriodRef: id, filingRevision: digest, filingDigest: digest }
const sample = { committeeRef: 'C00000001', filingRef: 'synthetic-filing1', reportForm: 'F3X', jurisdictionRef: 'declared-jurisdiction1', reportingPeriodRef: 'declared-period1', filingRevision: hash, filingDigest: hash }
const policy = { category, boundary, frame, sample }
const chronology = spec(prefix + 'timestamp-order-audit', 'Check supplied coverage-start/coverage-end/receipt chronology at full UTC instant precision, in one exact committee/form/filing/period/source/revision frame. Equality is allowed by this caller-declaration policy; a missing receipt time remains unknown. Does not compute official deadlines, period overlap, amendment priority or legal timeliness. ' + boundary,
  input({ ...frame, assessedAt: utc, rows: records({ ...frame, coverageStartAt: utc, coverageEndAt: utc, receivedAt: utc.nullable() }) }),
  { ...sample, assessedAt: time, rows: [{ id: 'filing1', ...sample, coverageStartAt: time, coverageEndAt: time, receivedAt: time }] },
  { ...sample, assessedAt: time, rows: [{ id: 'filing1', ...sample, coverageStartAt: time, coverageEndAt: later, receivedAt: time }] },
  [prefix + 'chronology-conflict', prefix + 'filing-frame-mismatch', prefix + 'receipt-time-unknown'], [prefix + 'ordered-declared-filings'], i => {
    unique(i.rows.map(r => r.id)); let count = 0
    const findings = i.rows.flatMap(r => { const issues = [...(!samePins(r, i, Object.keys(frame)) ? [f(prefix + 'filing-frame-mismatch', r.id)] : []), ...(r.receivedAt === null ? [f(prefix + 'receipt-time-unknown', r.id)] : []), ...(r.coverageStartAt > r.coverageEndAt || r.coverageEndAt > i.assessedAt || r.receivedAt !== null && (r.receivedAt < r.coverageEndAt || r.receivedAt > i.assessedAt) ? [f(prefix + 'chronology-conflict', r.id)] : [])]; if (!issues.length) count++; return issues })
    return { findings, metrics: [m(prefix + 'ordered-declared-filings', category, count)] }
  })
export const BATCH18_CAMPAIGN = publicRecordSuite({ category, noun: 'committee/form/period/revision-pinned public filing metadata', boundary,
  pins: { ...frame, scopeRef: id }, sample: { id: 'filing1', ...sample, scopeRef: 'public-metadata' }, owner: 'committeeRef', subject: 'filingRef', revision: 'filingRevision', content: 'filingDigest', units: ['minor-units', 'major-units'], unitMeaning: 'declared committee-level aggregate amount denomination' },
  [...declaredMoneyAudits(policy), chronology, declaredModuleCoverage({ ...policy, modules: ['summary', 'receipts-summary', 'disbursements-summary', 'debts-summary'] })])
