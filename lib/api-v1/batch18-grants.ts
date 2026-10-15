import { id, digest, hash } from './batch5-core.ts'
import { publicRecordSuite, declaredMoneyAudits, declaredWindowAudit, declaredModuleCoverage } from './batch18-core.ts'

const category = 'grant-records'
const boundary = 'Public or synthetic nonpersonal opportunity metadata only. No Grants.gov access, applicant/person data, eligibility decisions, grant prediction, application submission, accounting or legal/compliance advice. Agency, program and revision identifiers and source digests are unverified declarations.'
const frame = { agencyRef: id, opportunityRef: id, jurisdictionRef: id, programRef: id, noticeRevision: digest, noticeDigest: digest }
const sample = { agencyRef: 'agency1', opportunityRef: 'synthetic-opportunity1', jurisdictionRef: 'declared-jurisdiction1', programRef: 'program1', noticeRevision: hash, noticeDigest: hash }
const policy = { category, boundary, frame, sample }
const money = declaredMoneyAudits(policy).filter(s => !s.id.endsWith('declared-bound-audit'))
// The existing grant-budget bound product is frozen in an earlier batch.
export const BATCH18_GRANTS = publicRecordSuite({ category, noun: 'agency/opportunity/program/jurisdiction/revision-pinned grant metadata', boundary,
  pins: { ...frame, scopeRef: id }, sample: { id: 'grant1', ...sample, scopeRef: 'public-metadata' }, owner: 'agencyRef', subject: 'opportunityRef', revision: 'noticeRevision', content: 'noticeDigest', units: ['minor-units', 'major-units'], unitMeaning: 'caller-declared budget denomination' },
  [...money, declaredWindowAudit(policy), declaredModuleCoverage({ ...policy, modules: ['synopsis', 'budget', 'attachments', 'amendments'] })]).filter(s => !s.id.endsWith('declared-bound-audit'))
