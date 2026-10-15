import { z } from 'zod'
import { input, records, id, digest, spec, hash, utc, time, later, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, samePins } from './batch11-science-core.ts'
import { declaredCountAudits } from './batch17-counts.ts'

const category = 'publication-records', prefix = category + '-'
const boundary = 'Public or synthetic nonpersonal bibliographic declarations only. No author/person profiles, abstract/full-text processing, DOI resolution, Crossref access, copyright clearance, plagiarism detection or research-quality certification. Version, correction and retraction labels are caller declarations, not independently verified status.'
const doi = z.string().min(8).max(200).regex(/^10\.[0-9]{4,9}\/[A-Za-z0-9._;()/:-]+$/)
const frame = { publisherRef: id, workRef: id, doi, editionRef: id, metadataRevision: digest, metadataDigest: digest }
const sample = { publisherRef: 'publisher1', workRef: 'synthetic-work1', doi: '10.5555/synthetic', editionRef: 'edition1', metadataRevision: hash, metadataDigest: hash }
const quantities = ['reference-count', 'citation-count', 'page-count'] as const, units = ['references', 'citations', 'pages'] as const
const numeric = declaredCountAudits({ category, boundary, frame, sample: { id: 'm1', ...sample }, quantities, units,
  compatible: { 'reference-count': ['references'], 'citation-count': ['citations'], 'page-count': ['pages'] }, sampleQuantity: 'reference-count', sampleUnit: 'references' })
const timestamp = spec(prefix + 'timestamp-order-audit', 'Check declared issue/update/retrieval chronology against an assessment instant in one exact publisher/work/DOI/edition/snapshot frame. Missing issue or update times remain unknown. No inferred publication priority, live freshness or correction status. ' + boundary,
  input({ ...frame, assessedAt: utc, rows: records({ ...frame, issuedAt: utc.nullable(), updatedAt: utc.nullable(), retrievedAt: utc }) }),
  { ...sample, assessedAt: time, rows: [{ id: 'p1', ...sample, issuedAt: time, updatedAt: time, retrievedAt: time }] },
  { ...sample, assessedAt: time, rows: [{ id: 'p1', ...sample, issuedAt: time, updatedAt: time, retrievedAt: later }] },
  [prefix + 'chronology-conflict', prefix + 'chronology-frame-mismatch', prefix + 'issue-time-unknown', prefix + 'update-time-unknown'], [prefix + 'complete-ordered-records'], i => {
    unique(i.rows.map(r => r.id)); let ordered = 0
    const findings = i.rows.flatMap(r => { const issues = [...(!samePins(r, i, Object.keys(frame)) ? [f(prefix + 'chronology-frame-mismatch', r.id)] : []), ...(r.issuedAt === null ? [f(prefix + 'issue-time-unknown', r.id)] : []), ...(r.updatedAt === null ? [f(prefix + 'update-time-unknown', r.id)] : []), ...(r.retrievedAt > i.assessedAt || r.issuedAt !== null && r.issuedAt > r.retrievedAt || r.updatedAt !== null && r.updatedAt > r.retrievedAt || r.issuedAt !== null && r.updatedAt !== null && r.updatedAt < r.issuedAt ? [f(prefix + 'chronology-conflict', r.id)] : [])]; if (!issues.length) ordered++; return issues })
    return { findings, metrics: [m(prefix + 'complete-ordered-records', category, ordered)] }
  })
const relation = z.enum(['is-version-of', 'is-preprint-of', 'is-correction-of'])
const coverage = spec(prefix + 'condition-coverage-map', 'Require exactly one available caller-declared relation per requested bibliographic relation kind, with identical publisher/work/DOI/edition/snapshot pins and a different target work. Unknown, missing, duplicate or self-referential declarations do not establish relation coverage. Does not assert actual correction/preprint status. ' + boundary,
  input({ ...frame, requiredRelations: z.array(relation).min(1).max(3), rows: records({ ...frame, relation, targetWorkRef: id, state: z.enum(['available', 'missing', 'unknown']) }, 0) }),
  { ...sample, requiredRelations: ['is-version-of'], rows: [{ id: 'link1', ...sample, relation: 'is-version-of', targetWorkRef: 'other-work1', state: 'available' }] },
  { ...sample, requiredRelations: ['is-version-of'], rows: [] },
  [prefix + 'relation-not-established', prefix + 'relation-frame-mismatch', prefix + 'relation-undeclared', prefix + 'relation-not-available', prefix + 'relation-self-reference'], [prefix + 'established-requested-relations'], i => {
    unique(i.requiredRelations); unique(i.rows.map(r => r.id)); let covered = 0
    const issues = (r: typeof i.rows[number]) => [...(!samePins(r, i, Object.keys(frame)) ? [f(prefix + 'relation-frame-mismatch', r.id)] : []), ...(r.state !== 'available' ? [f(prefix + 'relation-not-available', r.id)] : []), ...(r.targetWorkRef === i.workRef ? [f(prefix + 'relation-self-reference', r.id)] : [])]
    const findings = i.requiredRelations.flatMap(k => { const matches = i.rows.filter(r => r.relation === k); if (matches.length === 1 && issues(matches[0]).length === 0) { covered++; return [] }; return [f(prefix + 'relation-not-established', k)] })
    findings.push(...i.rows.flatMap(r => [...issues(r), ...(!i.requiredRelations.includes(r.relation) ? [f(prefix + 'relation-undeclared', r.id)] : [])]))
    return { findings, metrics: [m(prefix + 'established-requested-relations', category, covered)] }
  })
export const BATCH17_PUBLICATIONS = scienceRecordSuite({ category, noun: 'publisher/work/DOI/edition-pinned bibliographic metadata', boundary,
  pins: { ...frame, scopeRef: id }, sample: { id: 'publication1', ...sample, scopeRef: 'public-metadata' }, owner: 'publisherRef', subject: 'workRef', revision: 'metadataRevision', content: 'metadataDigest', units, unitMeaning: 'bibliographic aggregate counts' }, [...numeric, timestamp, coverage])
