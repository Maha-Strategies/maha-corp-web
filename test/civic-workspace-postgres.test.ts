import assert from 'node:assert/strict'
import { execFile, execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { promisify } from 'node:util'
import test from 'node:test'
import { makeAiSafetyRecord } from '../lib/civic/ai-safety-service.ts'
import { changeConsultation, changeSafetyCase, initialSafetyCase, validateSafetyCase } from '../lib/civic/workspace-engine.ts'
import { civicDigest } from '../lib/civic/receipt.ts'
import type { Consultation, SafetyCase } from '../lib/civic/workspace-types.ts'
const database = process.env.CIVIC_WORKSPACE_TEST_DATABASE_URL
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`
const sql = (query: string) => execFileSync('psql', [database!, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const json = (value: unknown) => `${quote(JSON.stringify(value))}::jsonb`
const mutation = (state: SafetyCase) => ({ id: state.id, expectedRevision: state.revision, operationId: randomUUID() })
const commit = (kind: string, state: SafetyCase | Consultation, previous: number, key: string | null = null, operation = randomUUID()) => `set role service_role; select public.commit_civic_workspace_record(${quote(kind)},${json(state)},${previous},${quote(operation)},${quote(civicDigest({ state, operation }))},${key ? quote(key) : 'null'});`
test('PostgreSQL case workflow binds access keys, serializes edits, gates publication and erases withdrawals', { skip: !database }, async () => {
  assert.match(database!, /^postgres(?:ql)?:\/\/[^/]*@?(?:127\.0\.0\.1|localhost)(?::\d+)?\/civic_workspace_test(?:\?.*)?$/)
  assert.equal(sql("select count(*) from information_schema.tables where table_schema='public'"), '0', 'Use a fresh disposable database.')
  sql("do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end $$; create schema extensions; create extension pgcrypto with schema extensions;")
  for (const file of ['20261004090000_civic_transparency_ledger.sql', '20261008090000_civic_ai_safety_participation.sql', '20261008100000_civic_participation_workspace.sql']) sql(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
  const record = makeAiSafetyRecord({ submissionId: randomUUID(), topic: 'oversight', basis: 'concern', concern: 'SYNTHETIC_PRIVATE_CONCERN for a transaction test.', requestedAction: 'Investigate synthetic permissions and keep these notes private.', sourceUrls: [], consentToPrivateReview: true })
  const original = initialSafetyCase(record), hash = 'a'.repeat(64)
  const submit = (key: string) => `set role service_role; select public.submit_civic_safety_case(${json(record)},${quote('b'.repeat(64))},${quote(key)},${json(original)});`
  assert.deepEqual(JSON.parse(sql(submit(hash))), record); assert.deepEqual(JSON.parse(sql(submit(hash))), record)
  assert.throws(() => sql(submit('c'.repeat(64))), /workspace_access/)
  assert.equal(sql(`set role service_role; select public.read_civic_workspace_record('case',${quote(original.id)},${quote('c'.repeat(64))});`), '')
  const read = () => validateSafetyCase(JSON.parse(sql(`set role service_role; select public.read_civic_workspace_record('case',${quote(original.id)},${quote(hash)});`)).state)
  assert.deepEqual(read(), original)
  for (const role of ['anon', 'authenticated']) {
    assert.throws(() => sql(`set role ${role}; select public.read_civic_workspace_record('case',${quote(original.id)},null);`), /permission denied/)
    assert.throws(() => sql(`set role ${role}; select public.read_civic_public_participation();`), /permission denied/)
  }
  assert.throws(() => sql('set role service_role; select * from public.civic_safety_cases;'), /permission denied/)
  const edits = [0, 1].map(i => changeSafetyCase(original, { ...mutation(original), action: 'update', assignedReviewer: `Reviewer ${i}`, nextAction: 'Check the synthetic source.', dueOn: null, status: 'investigating', privateNote: 'SYNTHETIC_INTERNAL_NOTE', citizenUpdate: 'The case is assigned for investigation.', clarificationRequest: null, graph: original.graph }, 'operator'))
  const run = promisify(execFile)
  const races = await Promise.allSettled(edits.map(state => run('psql', [database!, '-X', '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', commit('case', state, 1)])))
  assert.equal(races.filter(result => result.status === 'fulfilled').length, 1)
  let state = read()
  assert.equal(state.revision, 2)
  assert.throws(() => sql(commit('case', { ...state, receipt: { ...state.receipt, digest: '0'.repeat(64) }, revision: state.revision + 1 }, state.revision)), /invalid_workspace_receipt/)
  let next = changeSafetyCase(state, { ...mutation(state), action: 'draft-publication', privacyReviewed: true, privacyReviewer: 'Reviewer A', draft: {
    id: randomUUID(), title: 'Synthetic public investigation', youRaised: 'A permission question was raised in a synthetic test.', weInvestigated: 'A synthetic source was inspected without alleging a real incident.', whatChanged: 'A boundary test was documented for further review.', unresolved: ['Deployment impact remains unknown.'], decisionRationale: 'Additional evidence is needed before wider conclusions.', sources: [],
  } }, 'operator')
  sql(commit('case', next, state.revision)); state = read()
  assert.throws(() => sql(commit('case', { ...state, revision: state.revision + 1, publication: { ...state.publication!, publishedAt: new Date().toISOString() } }, state.revision)), /publication_consent_required/)
  next = changeSafetyCase(state, { ...mutation(state), action: 'approve-publication', draftDigest: state.publication!.digest }, 'citizen')
  sql(commit('case', next, state.revision, hash)); state = read()
  next = changeSafetyCase(state, { ...mutation(state), action: 'publish' }, 'operator')
  sql(commit('case', next, state.revision)); state = read()
  const feed = () => JSON.parse(sql('set role service_role; select public.read_civic_public_participation();'))
  assert.equal(feed().summaries.length, 1)
  assert.doesNotMatch(JSON.stringify(feed()), new RegExp(`SYNTHETIC_PRIVATE_CONCERN|SYNTHETIC_INTERNAL_NOTE|${original.id}`))
  next = changeSafetyCase(state, { ...mutation(state), action: 'withdraw', confirm: true }, 'citizen')
  sql(commit('case', next, state.revision, hash)); state = read()
  assert.equal(state.status, 'withdrawn'); assert.equal(feed().summaries.length, 0)
  assert.equal(sql(`select count(*) from public.civic_safety_concerns where id=${quote(state.id)};`), '0')
  assert.doesNotMatch(JSON.stringify(state), /SYNTHETIC_PRIVATE_CONCERN|SYNTHETIC_INTERNAL_NOTE/)

  const now = new Date(), id = randomUUID()
  let consultation = changeConsultation(null, { action: 'save-draft', id, expectedRevision: 0, operationId: randomUUID(), packet: {
    title: 'Synthetic testing consultation', question: 'Which test approach should be investigated?', scope: 'Synthetic discussion without substantive policy claims.', opensAt: new Date(now.getTime() - 60000).toISOString(), closesAt: new Date(now.getTime() + 86400000).toISOString(),
    alternatives: ['baseline', 'independent'].map(id => ({ id, title: `${id} option`, description: 'A synthetic approach for comparison in this database test.', benefits: ['Potential evidence benefit'], tradeoffs: ['Unmeasured cost assumption'] })),
    evidence: [{ citation: 'Synthetic fixture source', url: 'https://example.test/fixture', publishedOn: null, checkedOn: null, contentDigest: null, verification: 'unreviewed-pointer' }], questions: ['What evidence is missing?'], decisionCriteria: ['Quality of available evidence'],
  } }, now)
  sql(commit('consultation', consultation, 0)); assert.equal(feed().consultations.length, 0)
  consultation = changeConsultation(consultation, { action: 'open', id, expectedRevision: 1, operationId: randomUUID(), privacyReviewed: true }, now)
  sql(commit('consultation', consultation, 1)); assert.equal(feed().consultations.length, 1)
  const response = makeAiSafetyRecord({ ...record.submission, submissionId: randomUUID(), consultationResponse: { consultationId: id, packetDigest: consultation.packetDigest, alternativeId: 'independent', missingEvidence: 'The actual testing cost is unknown.', assumptionChallenge: 'The assumed testing effectiveness is not measured.' } })
  const submitResponse = () => `set role service_role; select public.submit_civic_safety_case(${json(response)},${quote('d'.repeat(64))},${quote(hash)},${json(initialSafetyCase(response))});`
  assert.deepEqual(JSON.parse(sql(submitResponse())), response)
  consultation = changeConsultation(consultation, { action: 'close', id, expectedRevision: 2, operationId: randomUUID(), privacyReviewed: true, responseRationale: 'The synthetic consultation identified unresolved cost and effectiveness questions.' }, now)
  sql(commit('consultation', consultation, 2)); assert.equal(feed().consultations[0].status, 'closed')
  // An already accepted response can retry, but a new response cannot enter a closed window.
  assert.deepEqual(JSON.parse(sql(submitResponse())), response)
  const late = makeAiSafetyRecord({ ...response.submission, submissionId: randomUUID() })
  assert.throws(() => sql(`set role service_role; select public.submit_civic_safety_case(${json(late)},${quote('e'.repeat(64))},${quote(hash)},${json(initialSafetyCase(late))});`), /consultation_closed_or_changed/)
  sql(`update public.civic_safety_cases set expires_at=now()-interval '1 second'; set role service_role; select public.purge_expired_civic_safety_concerns();`)
  assert.equal(sql('select count(*) from public.civic_safety_cases;'), '0')
})
