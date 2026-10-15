import { z } from 'zod'
import { id, digest, hash } from './batch5-core.ts'
import { publicRecordSuite, declaredMoneyAudits, declaredWindowAudit, declaredModuleCoverage } from './batch18-core.ts'

const category = 'procurement-notices'
const boundary = 'Public or synthetic nonpersonal procurement-notice declarations only. No SAM.gov/API access, contact or supplier-person data, tender submission, award prediction, set-aside qualification, price recommendation or legal/compliance advice. Source bytes, notice authenticity and current status are not verified.'
const frame = { buyerRef: id, noticeRef: id, jurisdictionRef: id, noticeKind: z.enum(['solicitation', 'award', 'amendment', 'other-declared']), noticeRevision: digest, noticeDigest: digest }
const sample = { buyerRef: 'buyer-organization1', noticeRef: 'synthetic-notice1', jurisdictionRef: 'declared-jurisdiction1', noticeKind: 'solicitation', noticeRevision: hash, noticeDigest: hash }
const policy = { category, boundary, frame, sample }
export const BATCH18_PROCUREMENT = publicRecordSuite({ category, noun: 'buyer/notice/kind/jurisdiction/revision-pinned procurement records', boundary,
  pins: { ...frame, scopeRef: id }, sample: { id: 'procurement1', ...sample, scopeRef: 'public-metadata' }, owner: 'buyerRef', subject: 'noticeRef', revision: 'noticeRevision', content: 'noticeDigest', units: ['minor-units', 'major-units'], unitMeaning: 'declared notice amount denomination' },
  [...declaredMoneyAudits(policy), declaredWindowAudit(policy), declaredModuleCoverage({ ...policy, modules: ['notice', 'attachments', 'amendments', 'award-summary'] })])
