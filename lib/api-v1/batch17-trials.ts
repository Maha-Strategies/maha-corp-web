import { z } from 'zod'
import { input, records, id, digest, spec, hash, utc, time, later, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, samePins } from './batch11-science-core.ts'
import { declaredCountAudits } from './batch17-counts.ts'

const category = 'trial-registry-records', prefix = category + '-'
const boundary = 'Public or synthetic nonpersonal study-level registry metadata only; no individual participant, investigator, contact, medical or genomic records. No ClinicalTrials.gov access, recruitment, trial matching, diagnosis, treatment, efficacy/safety inference, registration compliance or clinical/regulatory certification. NCT-shaped IDs and source digests are unverified declarations.'
const frame = { registryRef: id, studyRef: z.string().regex(/^NCT[0-9]{8}$/), protocolDigest: digest, snapshotRevision: digest, snapshotDigest: digest }
const sample = { registryRef: 'declared-registry1', studyRef: 'NCT00000001', protocolDigest: hash, snapshotRevision: hash, snapshotDigest: hash }
const quantities = ['enrollment-count', 'arm-count', 'outcome-count'] as const, units = ['participants', 'arms', 'outcomes'] as const
const numeric = declaredCountAudits({ category, boundary, frame, sample: { id: 'm1', ...sample }, quantities, units,
  compatible: { 'enrollment-count': ['participants'], 'arm-count': ['arms'], 'outcome-count': ['outcomes'] }, sampleQuantity: 'enrollment-count', sampleUnit: 'participants' })
const timestamp = spec(prefix + 'timestamp-order-audit', 'Check supplied submission/posting/update/retrieval chronology in one exact registry/study/protocol/snapshot frame. Missing posting or update instants remain unknown, not zero or a missing real-world filing. Dates are full UTC declaration instants, not parsed registry partial dates. ' + boundary,
  input({ ...frame, assessedAt: utc, rows: records({ ...frame, submittedAt: utc, postedAt: utc.nullable(), updatedAt: utc.nullable(), retrievedAt: utc }) }),
  { ...sample, assessedAt: time, rows: [{ id: 'trial1', ...sample, submittedAt: time, postedAt: time, updatedAt: time, retrievedAt: time }] },
  { ...sample, assessedAt: time, rows: [{ id: 'trial1', ...sample, submittedAt: time, postedAt: time, updatedAt: time, retrievedAt: later }] },
  [prefix + 'chronology-conflict', prefix + 'chronology-frame-mismatch', prefix + 'posting-time-unknown', prefix + 'update-time-unknown'], [prefix + 'complete-ordered-records'], i => {
    unique(i.rows.map(r => r.id)); let ordered = 0
    const findings = i.rows.flatMap(r => { const issues = [...(!samePins(r, i, Object.keys(frame)) ? [f(prefix + 'chronology-frame-mismatch', r.id)] : []), ...(r.postedAt === null ? [f(prefix + 'posting-time-unknown', r.id)] : []), ...(r.updatedAt === null ? [f(prefix + 'update-time-unknown', r.id)] : []), ...(r.retrievedAt > i.assessedAt || r.submittedAt > r.retrievedAt || r.postedAt !== null && (r.postedAt < r.submittedAt || r.postedAt > r.retrievedAt) || r.updatedAt !== null && (r.updatedAt < r.submittedAt || r.updatedAt > r.retrievedAt || r.postedAt !== null && r.updatedAt < r.postedAt) ? [f(prefix + 'chronology-conflict', r.id)] : [])]; if (!issues.length) ordered++; return issues })
    return { findings, metrics: [m(prefix + 'complete-ordered-records', category, ordered)] }
  })
const section = z.enum(['identification', 'status', 'design', 'outcomes', 'results'])
const coverage = spec(prefix + 'condition-coverage-map', 'Check one declared present section per caller-requested registry module in an identical registry/study/protocol/snapshot frame. Missing, unknown, duplicate or unrelated module declarations do not establish coverage. Presence is not complete registration, results availability, efficacy or legal compliance. ' + boundary,
  input({ ...frame, requiredSections: z.array(section).min(1).max(5), rows: records({ ...frame, section, state: z.enum(['present', 'missing', 'unknown']) }, 0) }),
  { ...sample, requiredSections: ['design'], rows: [{ id: 'section1', ...sample, section: 'design', state: 'present' }] },
  { ...sample, requiredSections: ['design'], rows: [] },
  [prefix + 'section-not-established', prefix + 'section-frame-mismatch', prefix + 'section-undeclared', prefix + 'section-not-present'], [prefix + 'established-requested-sections'], i => {
    unique(i.requiredSections); unique(i.rows.map(r => r.id)); let covered = 0
    const issues = (r: typeof i.rows[number]) => [...(!samePins(r, i, Object.keys(frame)) ? [f(prefix + 'section-frame-mismatch', r.id)] : []), ...(r.state !== 'present' ? [f(prefix + 'section-not-present', r.id)] : [])]
    const findings = i.requiredSections.flatMap(k => { const matches = i.rows.filter(r => r.section === k); if (matches.length === 1 && issues(matches[0]).length === 0) { covered++; return [] }; return [f(prefix + 'section-not-established', k)] })
    findings.push(...i.rows.flatMap(r => [...issues(r), ...(!i.requiredSections.includes(r.section) ? [f(prefix + 'section-undeclared', r.id)] : [])]))
    return { findings, metrics: [m(prefix + 'established-requested-sections', category, covered)] }
  })
export const TRIAL_REGISTRY_AUDITS = scienceRecordSuite({ category, noun: 'study-level registry/protocol/snapshot declarations', boundary,
  pins: { ...frame, scopeRef: id }, sample: { id: 'trial1', ...sample, scopeRef: 'public-metadata' }, owner: 'registryRef', subject: 'studyRef', revision: 'snapshotRevision', content: 'snapshotDigest', units, unitMeaning: 'study-level aggregate counts' }, [...numeric, timestamp, coverage])
export const BATCH17_TRIALS = TRIAL_REGISTRY_AUDITS.slice(0, 15)
