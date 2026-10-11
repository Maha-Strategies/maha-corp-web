import { createHash } from 'node:crypto'
import { arraySchema, enumSchema, HASH_SCHEMA, ID_SCHEMA, objectSchema, schemaAccepts, type MicroSchema } from './micro-schema.ts'

type Row = Record<string, unknown>
type Spec = { amount: string; title: string; description: string; category: string; inputSchema: MicroSchema; sample: Row; resultSchema: MicroSchema }
const INPUT_BYTES = 32 * 1024, RESULT_BYTES = 64 * 1024, MAX_ROWS = 64
const int = (minimum = 0, maximum = 1_000_000): MicroSchema => ({ type: 'integer', minimum, maximum })
const str = (maxLength = 4096, minLength = 0): MicroSchema => ({ type: 'string', minLength, maxLength })
const bool: MicroSchema = { type: 'boolean' }
const no: MicroSchema = { type: 'boolean', enum: [false] }
const nullable = (s: MicroSchema): MicroSchema => ({ oneOf: [s, { type: 'null' }] })
const ids = (min = 0, max = MAX_ROWS) => arraySchema(ID_SCHEMA, min, max)
const rows = (s: MicroSchema, min = 0, max = MAX_ROWS) => arraySchema(s, min, max)
const dataClass = enumSchema('public', 'synthetic')
const inputSchema = (p: Record<string, MicroSchema>) => objectSchema({ dataClass, ...p })
const resultSchema = (p: Record<string, MicroSchema>) => objectSchema({
  dataClass, inputSha256: HASH_SCHEMA, resultSha256: HASH_SCHEMA, sourcesVerified: no,
  limits: arraySchema(str(500, 1), 1, 8), ...p,
})
const cmp = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const sorted = (a: string[]) => [...a].sort(cmp)
const unique = (a: string[], label: string) => { if (new Set(a).size !== a.length) throw new Error(`duplicate-${label}`) }
const refs = (a: string[], known: Set<string>, label: string) => {
  unique(a, label)
  if (a.some(x => !known.has(x))) throw new Error(`dangling-${label}`)
}
const bps = (n: number, d: number) => Math.round(10_000 * n / d)

/** Key-sorted JSON, preserving array order and exact Unicode (no normalization).
 * Reject non-JSON values, hooks/accessors, cycles and ill-formed Unicode BEFORE
 * serialization/schema traversal. All traversal is capped at 4096 nodes/depth 16.
 * This is a local encoding contract, not a claim of full RFC 8785 support.
 */
function encode(value: unknown, byteLimit: number): string {
  const parts: string[] = [], ancestors = new Set<object>()
  let bytes = 0, nodes = 0
  const emit = (s: string) => {
    bytes += Buffer.byteLength(s, 'utf8')
    if (bytes > byteLimit) throw new Error('json-byte-limit')
    parts.push(s)
  }
  const string = (s: string) => {
    if (s.length > byteLimit || !s.isWellFormed()) throw new Error('invalid-json-string')
    emit(JSON.stringify(s))
  }
  const visit = (v: unknown, depth: number): void => {
    if (++nodes > 4096 || depth > 16) throw new Error('json-complexity-limit')
    if (v === null) { emit('null'); return }
    if (typeof v === 'string') { string(v); return }
    if (typeof v === 'boolean') { emit(v ? 'true' : 'false'); return }
    if (typeof v === 'number' && Number.isSafeInteger(v)) { emit(JSON.stringify(v)); return }
    if (typeof v !== 'object') throw new Error('non-json-value')
    if (ancestors.has(v)) throw new Error('cyclic-json')
    const proto = Object.getPrototypeOf(v)
    if (Array.isArray(v) ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw new Error('non-json-object')
    const keys = Reflect.ownKeys(v)
    if (keys.length > 4097 || keys.some(k => typeof k !== 'string')) throw new Error('json-complexity-limit')
    const descriptors = Object.getOwnPropertyDescriptors(v)
    if (Object.entries(descriptors).some(([k, d]) => !('value' in d) || (!d.enumerable && !(Array.isArray(v) && k === 'length')))) throw new Error('non-json-property')
    ancestors.add(v)
    if (Array.isArray(v)) {
      if (v.length > 4096 || keys.length !== v.length + 1) throw new Error('non-json-array')
      emit('[')
      for (let i = 0; i < v.length; i++) {
        if (!Object.hasOwn(descriptors, String(i))) throw new Error('non-json-array')
        if (i) emit(',')
        visit(descriptors[String(i)].value, depth + 1)
      }
      emit(']')
    } else {
      emit('{')
      const names = (keys as string[]).sort(cmp)
      for (let i = 0; i < names.length; i++) {
        if (i) emit(',')
        string(names[i]); emit(':'); visit(descriptors[names[i]].value, depth + 1)
      }
      emit('}')
    }
    ancestors.delete(v)
  }
  visit(value, 0)
  return parts.join('')
}
export const canonicalJson = (value: unknown): string => encode(value, RESULT_BYTES)
export function sha256(text: string): string {
  if (text.length > RESULT_BYTES || !text.isWellFormed() || Buffer.byteLength(text) > RESULT_BYTES) throw new Error('hash-text-limit')
  return 'sha256:' + createHash('sha256').update(text, 'utf8').digest('hex')
}
const hashJson = (v: unknown) => sha256(canonicalJson(v))

type Source = { sourceId: string; text: string }
const sourceSchema = objectSchema({ sourceId: ID_SCHEMA, text: str() })
function sources(input: Row): Map<string, string> {
  const list = input.sources as Source[]
  unique(list.map(s => s.sourceId), 'source')
  return new Map(list.map(s => [s.sourceId, s.text]))
}
function span(text: string, start: number, end: number): string {
  const chars = Array.from(text)
  if (start > end || end > chars.length) throw new Error('invalid-codepoint-span')
  return chars.slice(start, end).join('')
}

type Question = { questionId: string; paperId: string; expectedEvidenceIds: string[] }
type Evidence = { evidenceId: string; paperId: string }
type Observation = { questionId: string; paperId: string; retrievedEvidenceIds: string[] }
type Run = { runId: string; cohortSha256: string; observations: Observation[] }
type Cohort = { corpusHash: string; paperIds: string[]; evidence: Evidence[]; questions: Question[] }
const questionSchema = objectSchema({ questionId: ID_SCHEMA, paperId: ID_SCHEMA, expectedEvidenceIds: ids(1, 16) })
const runSchema = objectSchema({ runId: ID_SCHEMA, cohortSha256: HASH_SCHEMA, observations: rows(objectSchema({ questionId: ID_SCHEMA, paperId: ID_SCHEMA, retrievedEvidenceIds: ids(0, 32) }), 1) })
const cohortFields = {
  corpusHash: HASH_SCHEMA, paperIds: ids(1), evidence: rows(objectSchema({ evidenceId: ID_SCHEMA, paperId: ID_SCHEMA }), 1),
  questions: rows(questionSchema, 1), baseline: runSchema, candidate: runSchema,
}
const recoveryState = enumSchema('complete', 'partial', 'miss')
const recoveryCounts = objectSchema({ complete: int(0, 64), partial: int(0, 64), miss: int(0, 64) })
const pairedFields = {
  frozenCohortSha256: HASH_SCHEMA, baselineRunId: ID_SCHEMA, candidateRunId: ID_SCHEMA, matchedPaperIds: ids(1),
  questionCount: int(1, 64), baselineCounts: recoveryCounts, candidateCounts: recoveryCounts,
  baselineCompleteBps: int(0, 10000), candidateCompleteBps: int(0, 10000), completeDeltaBps: int(-10000, 10000),
  improved: int(0, 64), regressed: int(0, 64), unchanged: int(0, 64),
  transitions: rows(objectSchema({ from: recoveryState, to: recoveryState, count: int(0, 64) }), 9, 9),
  questions: rows(objectSchema({ questionId: ID_SCHEMA, paperId: ID_SCHEMA, requiredCount: int(1, 16), baselineRecovered: int(0, 16), candidateRecovered: int(0, 16), baselineState: recoveryState, candidateState: recoveryState }), 1),
  papers: rows(objectSchema({ paperId: ID_SCHEMA, questionCount: int(1, 64), baselineComplete: int(0, 64), candidateComplete: int(0, 64), completeDeltaBps: int(-10000, 10000) }), 1),
}
/** The frozen digest includes the corpus hash, sorted paper/evidence declarations,
 * and sorted question IDs with sorted required evidence IDs. Runs must carry it.
 */
function cohortHash(c: Cohort): string {
  return hashJson({ corpusHash: c.corpusHash, paperIds: sorted(c.paperIds),
    evidence: [...c.evidence].sort((a, b) => cmp(a.evidenceId, b.evidenceId)),
    questions: [...c.questions].sort((a, b) => cmp(a.questionId, b.questionId)).map(q => ({ ...q, expectedEvidenceIds: sorted(q.expectedEvidenceIds) })),
  })
}
function paired(input: Row) {
  const c = input as unknown as Cohort, baseline = input.baseline as Run, candidate = input.candidate as Run
  unique(c.paperIds, 'paper'); unique(c.evidence.map(e => e.evidenceId), 'evidence'); unique(c.questions.map(q => q.questionId), 'question')
  const paperSet = new Set(c.paperIds), evidenceMap = new Map(c.evidence.map(e => [e.evidenceId, e.paperId]))
  if (c.evidence.some(e => !paperSet.has(e.paperId)) || c.questions.some(q => !paperSet.has(q.paperId))) throw new Error('dangling-paper')
  for (const q of c.questions) {
    refs(q.expectedEvidenceIds, new Set(evidenceMap.keys()), 'expected-evidence')
    if (q.expectedEvidenceIds.some(e => evidenceMap.get(e) !== q.paperId)) throw new Error('cross-paper-expected-evidence')
  }
  if (c.paperIds.some(p => !c.questions.some(q => q.paperId === p))) throw new Error('empty-paper-cluster')
  const digest = cohortHash(c), questionMap = new Map(c.questions.map(q => [q.questionId, q]))
  if (baseline.runId === candidate.runId) throw new Error('duplicate-run')
  const validateRun = (r: Run) => {
    if (r.cohortSha256 !== digest) throw new Error('frozen-cohort-mismatch')
    unique(r.observations.map(o => o.questionId), 'observation')
    if (r.observations.length !== c.questions.length) throw new Error('incomplete-paired-cohort')
    for (const o of r.observations) {
      if (!questionMap.has(o.questionId) || questionMap.get(o.questionId)!.paperId !== o.paperId) throw new Error('observation-cohort-mismatch')
      refs(o.retrievedEvidenceIds, new Set(evidenceMap.keys()), 'retrieved-evidence')
    }
    return new Map(r.observations.map(o => [o.questionId, o]))
  }
  const a = validateRun(baseline), b = validateRun(candidate)
  const state = (n: number, required: number): 'complete' | 'partial' | 'miss' => n === required ? 'complete' : n ? 'partial' : 'miss'
  const questions = [...c.questions].sort((a, b) => cmp(a.questionId, b.questionId)).map(q => {
    const baselineRecovered = q.expectedEvidenceIds.filter(e => a.get(q.questionId)!.retrievedEvidenceIds.includes(e)).length
    const candidateRecovered = q.expectedEvidenceIds.filter(e => b.get(q.questionId)!.retrievedEvidenceIds.includes(e)).length
    return { questionId: q.questionId, paperId: q.paperId, requiredCount: q.expectedEvidenceIds.length, baselineRecovered, candidateRecovered,
      baselineState: state(baselineRecovered, q.expectedEvidenceIds.length), candidateState: state(candidateRecovered, q.expectedEvidenceIds.length) }
  })
  const counts = (key: 'baselineState' | 'candidateState') => ({ complete: questions.filter(q => q[key] === 'complete').length, partial: questions.filter(q => q[key] === 'partial').length, miss: questions.filter(q => q[key] === 'miss').length })
  const baselineCounts = counts('baselineState'), candidateCounts = counts('candidateState')
  const rank = { miss: 0, partial: 1, complete: 2 }
  const papers = sorted(c.paperIds).map(paperId => {
    const qs = questions.filter(q => q.paperId === paperId)
    const baselineComplete = qs.filter(q => q.baselineState === 'complete').length, candidateComplete = qs.filter(q => q.candidateState === 'complete').length
    return { paperId, questionCount: qs.length, baselineComplete, candidateComplete, completeDeltaBps: bps(candidateComplete - baselineComplete, qs.length) }
  })
  const states = ['complete', 'partial', 'miss']
  return { frozenCohortSha256: digest, baselineRunId: baseline.runId, candidateRunId: candidate.runId, matchedPaperIds: sorted(c.paperIds), questionCount: questions.length,
    baselineCounts, candidateCounts, baselineCompleteBps: bps(baselineCounts.complete, questions.length), candidateCompleteBps: bps(candidateCounts.complete, questions.length),
    completeDeltaBps: bps(candidateCounts.complete - baselineCounts.complete, questions.length),
    improved: questions.filter(q => rank[q.candidateState] > rank[q.baselineState]).length,
    regressed: questions.filter(q => rank[q.candidateState] < rank[q.baselineState]).length,
    unchanged: questions.filter(q => q.candidateState === q.baselineState).length,
    transitions: states.flatMap(from => states.map(to => ({ from, to, count: questions.filter(q => q.baselineState === from && q.candidateState === to).length }))), questions, papers }
}

const corpusSample: Cohort = {
  corpusHash: sha256('synthetic frozen corpus v1'), paperIds: ['paper-a', 'paper-b'],
  evidence: [{ evidenceId: 'a1', paperId: 'paper-a' }, { evidenceId: 'a2', paperId: 'paper-a' }, { evidenceId: 'b1', paperId: 'paper-b' }],
  questions: [{ questionId: 'q1', paperId: 'paper-a', expectedEvidenceIds: ['a1', 'a2'] }, { questionId: 'q2', paperId: 'paper-b', expectedEvidenceIds: ['b1'] }],
}
const retrievalSample = { dataClass: 'synthetic', ...corpusSample,
  baseline: { runId: 'baseline', cohortSha256: cohortHash(corpusSample), observations: [{ questionId: 'q1', paperId: 'paper-a', retrievedEvidenceIds: ['a1'] }, { questionId: 'q2', paperId: 'paper-b', retrievedEvidenceIds: ['b1'] }] },
  candidate: { runId: 'candidate', cohortSha256: cohortHash(corpusSample), observations: [{ questionId: 'q1', paperId: 'paper-a', retrievedEvidenceIds: ['a1', 'a2'] }, { questionId: 'q2', paperId: 'paper-b', retrievedEvidenceIds: [] }] },
}
const selectionSchema = objectSchema({ selectedPassageIds: ids(), usedTokens: int(0, 131072), totalScore: int(0, 64_000_000), coveredEvidenceIds: ids(), coverageBps: int(0, 10000) })
const artifactSchema = objectSchema({ artifactId: ID_SCHEMA, kind: enumSchema('corpus', 'cohort', 'configuration', 'result', 'code'), content: str(), expectedHash: HASH_SCHEMA, dependsOn: ids(0, 16) })
const parameterSchema = objectSchema({ name: ID_SCHEMA, value: str(256) })
const manifestArtifactSchema = objectSchema({ artifactId: ID_SCHEMA, kind: artifactSchema.properties!.kind, contentSha256: HASH_SCHEMA, expectedHash: HASH_SCHEMA, hashMatches: bool, utf8Bytes: int(0, 16384), dependsOn: ids(0, 16) })
const manifestSchema = objectSchema({ version: int(1, 1), runId: ID_SCHEMA, algorithmVersion: str(80, 1), seed: int(0, 4294967295), parameters: rows(parameterSchema, 0, 32), artifacts: rows(manifestArtifactSchema, 1) })
const spec = (amount: string, title: string, description: string, input: MicroSchema, sample: Row, output: Record<string, MicroSchema>): Spec => ({ amount, title, description, category: 'context', inputSchema: input, sample, resultSchema: resultSchema(output) })

export const SPECS: Record<string, Spec> = {
  'passage-hash-validation': spec('4000', 'Passage hash validation', 'Validate exact UTF-8 SHA-256 hashes for up to 64 public or synthetic passages. No Unicode normalization, source authentication, or semantic validation.',
    inputSchema({ passages: rows(objectSchema({ passageId: ID_SCHEMA, text: str(), expectedHash: HASH_SCHEMA }), 1) }),
    { dataClass: 'synthetic', passages: [{ passageId: 'p1', text: 'Evidence.', expectedHash: sha256('Evidence.') }] },
    { allMatch: bool, checked: int(1, 64), passages: rows(objectSchema({ passageId: ID_SCHEMA, expectedHash: HASH_SCHEMA, contentSha256: HASH_SCHEMA, utf8Bytes: int(0, 16384), matches: bool }), 1) }),
  'claim-citation-coverage': spec('23000', 'Claim citation coverage', 'Check declared citation coverage of up to 64 claims against bounded source and locator inventories. Reject duplicate IDs and dangling references. Coverage is structural, not proof that a source supports a claim.',
    inputSchema({ sources: rows(objectSchema({ sourceId: ID_SCHEMA, locatorIds: ids(1, 32) }), 1), citations: rows(objectSchema({ citationId: ID_SCHEMA, sourceId: ID_SCHEMA, locatorId: ID_SCHEMA })), claims: rows(objectSchema({ claimId: ID_SCHEMA, citationIds: ids(0, 16) }), 1) }),
    { dataClass: 'synthetic', sources: [{ sourceId: 's1', locatorIds: ['l1'] }], citations: [{ citationId: 'c1', sourceId: 's1', locatorId: 'l1' }], claims: [{ claimId: 'claim-1', citationIds: ['c1'] }, { claimId: 'claim-2', citationIds: [] }] },
    { coverageBps: int(0, 10000), coveredClaims: int(0, 64), uncoveredClaimIds: ids(), unusedCitationIds: ids(), claims: rows(objectSchema({ claimId: ID_SCHEMA, covered: bool, citationCount: int(0, 16), sourceIds: ids(0, 16) }), 1), semanticSupportVerified: no }),
  'citation-locator-conversion': spec('24000', 'Citation locator conversion', 'Convert half-open UTF-8 byte, UTF-16 code-unit, or Unicode code-point spans into all three units for supplied text. Reject offsets inside a code point. No PDF parsing, page inference, or external source lookup.',
    inputSchema({ sources: rows(sourceSchema, 1, 16), locators: rows(objectSchema({ locatorId: ID_SCHEMA, sourceId: ID_SCHEMA, unit: enumSchema('utf8', 'utf16', 'codepoint'), start: int(0, 16384), end: int(0, 16384) }), 1) }),
    { dataClass: 'synthetic', sources: [{ sourceId: 's1', text: 'A😀éZ' }], locators: [{ locatorId: 'l1', sourceId: 's1', unit: 'utf8', start: 1, end: 7 }] },
    { locators: rows(objectSchema({ locatorId: ID_SCHEMA, sourceId: ID_SCHEMA, codepointStart: int(0, 4096), codepointEnd: int(0, 4096), utf16Start: int(0, 8192), utf16End: int(0, 8192), utf8Start: int(0, 16384), utf8End: int(0, 16384), excerptSha256: HASH_SCHEMA }), 1), offsetConvention: enumSchema('zero-based-half-open') }),
  'provenance-graph-integrity': spec('32500', 'Provenance graph integrity', 'Inspect a declared dependency graph of up to 64 nodes and 128 edges: exact cycle membership, source-root reachability, and deterministic graph digest. Duplicate edges and dangling references are rejected. Hash declarations are not authenticated.',
    inputSchema({ nodes: rows(objectSchema({ nodeId: ID_SCHEMA, kind: enumSchema('source', 'passage', 'claim'), digestHash: HASH_SCHEMA }), 1), edges: rows(objectSchema({ edgeId: ID_SCHEMA, from: ID_SCHEMA, to: ID_SCHEMA, relation: enumSchema('derived-from', 'cites') }), 0, 128) }),
    { dataClass: 'synthetic', nodes: [{ nodeId: 's1', kind: 'source', digestHash: sha256('source') }, { nodeId: 'p1', kind: 'passage', digestHash: sha256('passage') }], edges: [{ edgeId: 'e1', from: 'p1', to: 's1', relation: 'derived-from' }] },
    { state: enumSchema('rooted', 'unrooted', 'cyclic'), sourceRootIds: ids(), cycleNodeIds: ids(), rootlessNodeIds: ids(), graphSha256: HASH_SCHEMA, edgeDirection: enumSchema('from-depends-on-to') }),
  'retrieval-recovery-regression': spec('74000', 'Retrieval recovery regression', 'Compare complete, partial, and missed evidence recovery on one matched, hash-frozen cohort of up to 64 questions and papers. Report paired transitions and a caller-declared complete-recovery drop threshold. Descriptive evidence-ID overlap, not answer quality or causal inference.',
    inputSchema({ ...cohortFields, maxCompleteDropBps: int(0, 10000) }), { ...retrievalSample, maxCompleteDropBps: 0 },
    { ...pairedFields, maxCompleteDropBps: int(0, 10000), regressionObserved: bool }),
  'paper-cluster-retrieval-comparison': spec('144000', 'Paper-cluster retrieval comparison', 'Compare paired frozen-cohort recovery with seeded whole-paper cluster resampling (100–2000 replicates, 2–64 papers, 64 questions). Report a descriptive percentile interval for question-weighted complete-recovery delta. No question-level bootstrap, significance test, or population guarantee.',
    inputSchema({ ...cohortFields, paperIds: ids(2), seed: int(0, 4294967295), resamples: int(100, 2000) }), { ...retrievalSample, seed: 7, resamples: 200 },
    { ...pairedFields, seed: int(0, 4294967295), resamples: int(100, 2000), resamplingUnit: enumSchema('paperId'), estimator: enumSchema('question-weighted-complete-recovery-delta-bps'), intervalMethod: enumSchema('descriptive-percentile-95-nearest-rank'), intervalLowBps: int(-10000, 10000), intervalHighBps: int(-10000, 10000), distinctBootstrapDeltas: int(1, 2000), descriptiveOnly: { type: 'boolean', enum: [true] } }),
  'packing-displacement-analysis': spec('78000', 'Packing displacement analysis', 'Compare strict rank-prefix packing with rank-order greedy-fit and score-density greedy-fit for up to 64 passages under a 1–2048 token budget. Report evidence displacement and optional observed selection violations. Uses declared integer costs/scores; no tokenization or causal attribution.',
    inputSchema({ budget: int(1, 2048), requiredEvidenceIds: ids(1), candidates: rows(objectSchema({ passageId: ID_SCHEMA, rank: int(1, 128), tokens: int(1, 2048), score: int(), evidenceIds: ids(0, 16) }), 1), observedSelectedPassageIds: nullable(ids()) }),
    { dataClass: 'synthetic', budget: 8, requiredEvidenceIds: ['e1', 'e2'], candidates: [{ passageId: 'p1', rank: 1, tokens: 6, score: 9, evidenceIds: ['e1'] }, { passageId: 'p2', rank: 2, tokens: 5, score: 8, evidenceIds: ['e2'] }, { passageId: 'p3', rank: 3, tokens: 2, score: 3, evidenceIds: ['e2'] }], observedSelectedPassageIds: null },
    { budget: int(1, 2048), rankPrefix: selectionSchema, greedyFit: selectionSchema, densityGreedy: selectionSchema, greedyAddedPassageIds: ids(), densityDisplacedPassageIds: ids(), greedyRecoveredEvidenceIds: ids(), observedSelection: nullable(objectSchema({ selectedPassageIds: ids(), usedTokens: int(0, 131072), overBudget: bool, omittedRequiredEvidenceIds: ids() })), causalityEstablished: no }),
  'evidence-budget-allocation': spec('28000', 'Evidence budget allocation', 'Find an exact 0/1 maximum-declared-value allocation for up to 64 evidence items and a 0–4096 integer token budget. Deterministic ID-based tie handling; items are indivisible. Optimality applies only to the additive caller-declared values, not relevance or answer quality.',
    inputSchema({ budget: int(0, 4096), items: rows(objectSchema({ evidenceId: ID_SCHEMA, tokens: int(1, 4096), value: int() }), 1) }),
    { dataClass: 'synthetic', budget: 10, items: [{ evidenceId: 'a', tokens: 6, value: 12 }, { evidenceId: 'b', tokens: 5, value: 10 }, { evidenceId: 'c', tokens: 5, value: 10 }] },
    { selectedEvidenceIds: ids(), omittedEvidenceIds: ids(), usedTokens: int(0, 4096), unspentTokens: int(0, 4096), totalValue: int(0, 64_000_000), optimalForDeclaredObjective: { type: 'boolean', enum: [true] }, tieRule: enumSchema('sorted-id-order-exclude-on-equal-value') }),
  'source-coverage-drift': spec('44500', 'Source coverage drift', 'Compare source coverage on exactly the same declared record cohort across two snapshots. Report per-record gained/lost sources, per-source count changes, and global coverage drift. Reject unknown sources or missing/duplicate records. Coverage does not establish source quality.',
    inputSchema({ sourceIds: ids(1), recordIds: ids(1), before: objectSchema({ snapshotId: ID_SCHEMA, records: rows(objectSchema({ recordId: ID_SCHEMA, sourceIds: ids() }), 1) }), after: objectSchema({ snapshotId: ID_SCHEMA, records: rows(objectSchema({ recordId: ID_SCHEMA, sourceIds: ids() }), 1) }) }),
    { dataClass: 'synthetic', sourceIds: ['s1', 's2'], recordIds: ['r1'], before: { snapshotId: 'v1', records: [{ recordId: 'r1', sourceIds: ['s1'] }] }, after: { snapshotId: 'v2', records: [{ recordId: 'r1', sourceIds: ['s2'] }] } },
    { beforeCoverageBps: int(0, 10000), afterCoverageBps: int(0, 10000), coverageDeltaBps: int(-10000, 10000), gainedSourceIds: ids(), lostSourceIds: ids(), changedRecordCount: int(0, 64), records: rows(objectSchema({ recordId: ID_SCHEMA, gainedSourceIds: ids(), lostSourceIds: ids() }), 1), sources: rows(objectSchema({ sourceId: ID_SCHEMA, beforeRecordCount: int(0, 64), afterRecordCount: int(0, 64), delta: int(-64, 64) }), 1) }),
  'exact-quote-alignment': spec('26000', 'Exact quote alignment', 'Check exact quotes at declared code-point offsets and enumerate overlapping exact occurrences in supplied text (first 32 offsets, complete count). Unicode/case/whitespace are not normalized. A matching quote does not establish factual or contextual support.',
    inputSchema({ sources: rows(sourceSchema, 1, 16), quotes: rows(objectSchema({ quoteId: ID_SCHEMA, sourceId: ID_SCHEMA, quote: str(512, 1), start: int(0, 4096), end: int(0, 4096) }), 1) }),
    { dataClass: 'synthetic', sources: [{ sourceId: 's1', text: 'A😀 quote. quote.' }], quotes: [{ quoteId: 'q1', sourceId: 's1', quote: 'quote', start: 3, end: 8 }] },
    { allAligned: bool, quotes: rows(objectSchema({ quoteId: ID_SCHEMA, sourceId: ID_SCHEMA, exactAtDeclaredOffsets: bool, declaredSliceSha256: HASH_SCHEMA, occurrenceCount: int(0, 4096), occurrences: rows(objectSchema({ start: int(0, 4096), end: int(0, 4096) }), 0, 32), occurrencesTruncated: bool, uniqueMatch: nullable(objectSchema({ start: int(0, 4096), end: int(0, 4096) })) }), 1), offsetConvention: enumSchema('zero-based-half-open-codepoints') }),
  'extraction-consistency': spec('46500', 'Extraction consistency', 'Compare up to 64 total extracted spans from at most 16 labeled tools against exact code-point slices of supplied source text and declared UTF-8 hashes. Group identical source spans to expose text disagreements. No OCR/PDF execution, normalization, or completeness claim.',
    inputSchema({ sources: rows(sourceSchema, 1, 16), extractions: rows(objectSchema({ extractionId: ID_SCHEMA, sourceId: ID_SCHEMA, toolId: ID_SCHEMA, passages: rows(objectSchema({ passageId: ID_SCHEMA, start: int(0, 4096), end: int(0, 4096), text: str(), expectedHash: HASH_SCHEMA }), 1, 32) }), 1, 16) }),
    { dataClass: 'synthetic', sources: [{ sourceId: 's1', text: 'Hello world.' }], extractions: [{ extractionId: 'x1', sourceId: 's1', toolId: 'tool-a', passages: [{ passageId: 'p1', start: 0, end: 5, text: 'Hello', expectedHash: sha256('Hello') }] }, { extractionId: 'x2', sourceId: 's1', toolId: 'tool-b', passages: [{ passageId: 'p2', start: 0, end: 5, text: 'hello', expectedHash: sha256('hello') }] }] },
    { allExact: bool, allHashesMatch: bool, conflictingSpanCount: int(0, 64), checks: rows(objectSchema({ extractionId: ID_SCHEMA, passageId: ID_SCHEMA, sourceId: ID_SCHEMA, exactSourceMatch: bool, hashMatches: bool, contentSha256: HASH_SCHEMA }), 1), spans: rows(objectSchema({ sourceId: ID_SCHEMA, start: int(0, 4096), end: int(0, 4096), extractionIds: ids(1, 16), contentHashes: arraySchema(HASH_SCHEMA, 1, 16), consistentText: bool, allExact: bool }), 1) }),
  'reproducibility-manifest-builder': spec('64000', 'Reproducibility manifest builder', 'Build a stable hashed manifest of bounded public/synthetic artifact contents, declared dependencies, algorithm version, seed, and parameters. Verify declared content hashes; reject duplicate/dangling dependencies and cycles. No artifact fetching, execution replay, signing, or authenticity guarantee.',
    inputSchema({ runId: ID_SCHEMA, algorithmVersion: str(80, 1), seed: int(0, 4294967295), parameters: rows(parameterSchema, 0, 32), artifacts: rows(artifactSchema, 1) }),
    { dataClass: 'synthetic', runId: 'run-1', algorithmVersion: 'selector-v1', seed: 7, parameters: [{ name: 'budget', value: '2048' }], artifacts: [{ artifactId: 'corpus', kind: 'corpus', content: 'Evidence.', expectedHash: sha256('Evidence.'), dependsOn: [] }, { artifactId: 'result', kind: 'result', content: 'Selected evidence.', expectedHash: sha256('Selected evidence.'), dependsOn: ['corpus'] }] },
    { manifest: manifestSchema, manifestSha256: HASH_SCHEMA, allHashesMatch: bool, topologicalArtifactIds: ids(1), executionReplayed: no, signed: no }),
}

type Node = { nodeId: string; kind: string; digestHash: string }
type Edge = { edgeId: string; from: string; to: string; relation: string }
function graph(nodes: Node[], edges: Edge[]) {
  unique(nodes.map(n => n.nodeId), 'node'); unique(edges.map(e => e.edgeId), 'edge')
  unique(edges.map(e => canonicalJson([e.from, e.to, e.relation])), 'edge-dependency')
  const ordered = [...nodes].sort((a, b) => cmp(a.nodeId, b.nodeId)), index = new Map(ordered.map((n, i) => [n.nodeId, i]))
  if (edges.some(e => !index.has(e.from) || !index.has(e.to))) throw new Error('dangling-edge')
  const reach = ordered.map(() => ordered.map(() => false))
  for (const e of edges) reach[index.get(e.from)!][index.get(e.to)!] = true
  // Floyd-Warshall is bounded at 64^3 operations; unlike Kahn leftovers,
  // diagonal reachability identifies ONLY nodes actually belonging to cycles.
  for (let k = 0; k < ordered.length; k++) for (let i = 0; i < ordered.length; i++) for (let j = 0; j < ordered.length; j++) reach[i][j] ||= reach[i][k] && reach[k][j]
  const sourceRootIds = ordered.filter(n => n.kind === 'source' && !edges.some(e => e.from === n.nodeId)).map(n => n.nodeId)
  const cycleNodeIds = ordered.filter((_, i) => reach[i][i]).map(n => n.nodeId)
  const rootlessNodeIds = ordered.filter((n, i) => !sourceRootIds.some(r => n.nodeId === r || reach[i][index.get(r)!])).map(n => n.nodeId)
  return { state: cycleNodeIds.length ? 'cyclic' : rootlessNodeIds.length ? 'unrooted' : 'rooted', sourceRootIds, cycleNodeIds, rootlessNodeIds,
    graphSha256: hashJson({ nodes: ordered, edges: [...edges].sort((a, b) => cmp(a.edgeId, b.edgeId)) }), edgeDirection: 'from-depends-on-to' }
}

function calculate(id: string, input: Row): Row {
  if (id === 'passage-hash-validation') {
    const ps = input.passages as { passageId: string; text: string; expectedHash: string }[]
    unique(ps.map(p => p.passageId), 'passage')
    const passages = ps.map(p => ({ passageId: p.passageId, expectedHash: p.expectedHash, contentSha256: sha256(p.text), utf8Bytes: Buffer.byteLength(p.text), matches: sha256(p.text) === p.expectedHash }))
    return { checked: passages.length, allMatch: passages.every(p => p.matches), passages }
  }
  if (id === 'claim-citation-coverage') {
    const ss = input.sources as { sourceId: string; locatorIds: string[] }[], cs = input.citations as { citationId: string; sourceId: string; locatorId: string }[], claims = input.claims as { claimId: string; citationIds: string[] }[]
    unique(ss.map(s => s.sourceId), 'source'); unique(cs.map(c => c.citationId), 'citation'); unique(claims.map(c => c.claimId), 'claim')
    for (const s of ss) unique(s.locatorIds, 'locator')
    const sourceMap = new Map(ss.map(s => [s.sourceId, s])), citationMap = new Map(cs.map(c => [c.citationId, c]))
    for (const c of cs) if (!sourceMap.get(c.sourceId)?.locatorIds.includes(c.locatorId)) throw new Error('dangling-citation-locator')
    for (const c of claims) refs(c.citationIds, new Set(citationMap.keys()), 'claim-citation')
    const checks = claims.map(c => ({ claimId: c.claimId, covered: c.citationIds.length > 0, citationCount: c.citationIds.length, sourceIds: sorted([...new Set(c.citationIds.map(id => citationMap.get(id)!.sourceId))]) }))
    const coveredClaims = checks.filter(c => c.covered).length
    return { coveredClaims, coverageBps: bps(coveredClaims, claims.length), uncoveredClaimIds: sorted(checks.filter(c => !c.covered).map(c => c.claimId)), unusedCitationIds: sorted(cs.filter(c => !claims.some(cl => cl.citationIds.includes(c.citationId))).map(c => c.citationId)), claims: checks, semanticSupportVerified: false }
  }
  if (id === 'citation-locator-conversion') {
    const ss = sources(input), ls = input.locators as { locatorId: string; sourceId: string; unit: 'utf8' | 'utf16' | 'codepoint'; start: number; end: number }[]
    unique(ls.map(l => l.locatorId), 'locator')
    const locators = ls.map(l => {
      if (!ss.has(l.sourceId)) throw new Error('dangling-locator-source')
      const chars = Array.from(ss.get(l.sourceId)!), utf16 = [0], utf8 = [0]
      for (const c of chars) { utf16.push(utf16.at(-1)! + c.length); utf8.push(utf8.at(-1)! + Buffer.byteLength(c)) }
      const positions = l.unit === 'utf8' ? utf8 : l.unit === 'utf16' ? utf16 : Array.from({ length: chars.length + 1 }, (_, i) => i)
      const start = positions.indexOf(l.start), end = positions.indexOf(l.end)
      if (start < 0 || end < start) throw new Error('invalid-locator-boundary')
      return { locatorId: l.locatorId, sourceId: l.sourceId, codepointStart: start, codepointEnd: end, utf16Start: utf16[start], utf16End: utf16[end], utf8Start: utf8[start], utf8End: utf8[end], excerptSha256: sha256(chars.slice(start, end).join('')) }
    })
    return { locators, offsetConvention: 'zero-based-half-open' }
  }
  if (id === 'provenance-graph-integrity') return graph(input.nodes as Node[], input.edges as Edge[])
  if (id === 'retrieval-recovery-regression' || id === 'paper-cluster-retrieval-comparison') {
    const p = paired(input)
    if (id === 'retrieval-recovery-regression') return { ...p, maxCompleteDropBps: input.maxCompleteDropBps, regressionObserved: p.completeDeltaBps < -(input.maxCompleteDropBps as number) }
    const seed = input.seed as number, resamples = input.resamples as number
    let rng = seed >>> 0
    const deltas: number[] = []
    // Fixed LCG, including seed=0. Each draw selects a WHOLE paired paper,
    // retaining all of its questions in both arms. Never resample questions.
    for (let r = 0; r < resamples; r++) {
      let a = 0, b = 0, n = 0
      for (let draw = 0; draw < p.papers.length; draw++) {
        rng = (Math.imul(1664525, rng) + 1013904223) >>> 0
        const cluster = p.papers[Math.floor(rng / 4294967296 * p.papers.length)]
        a += cluster.baselineComplete; b += cluster.candidateComplete; n += cluster.questionCount
      }
      deltas.push(bps(b - a, n))
    }
    deltas.sort((a, b) => a - b)
    return { ...p, seed, resamples, resamplingUnit: 'paperId', estimator: 'question-weighted-complete-recovery-delta-bps', intervalMethod: 'descriptive-percentile-95-nearest-rank',
      intervalLowBps: deltas[Math.ceil(.025 * resamples) - 1], intervalHighBps: deltas[Math.ceil(.975 * resamples) - 1], distinctBootstrapDeltas: new Set(deltas).size, descriptiveOnly: true }
  }
  if (id === 'packing-displacement-analysis') {
    type Candidate = { passageId: string; rank: number; tokens: number; score: number; evidenceIds: string[] }
    const cs = input.candidates as Candidate[], required = input.requiredEvidenceIds as string[], budget = input.budget as number
    unique(required, 'required-evidence'); unique(cs.map(c => c.passageId), 'candidate'); unique(cs.map(c => String(c.rank)), 'rank')
    for (const c of cs) refs(c.evidenceIds, new Set(required), 'candidate-evidence')
    const rankOrder = [...cs].sort((a, b) => a.rank - b.rank), densityOrder = [...cs].sort((a, b) => b.score * a.tokens - a.score * b.tokens || a.rank - b.rank)
    const pack = (order: Candidate[], prefix: boolean) => {
      const selected: Candidate[] = []
      let usedTokens = 0
      for (const c of order) {
        if (usedTokens + c.tokens > budget) { if (prefix) break; else continue }
        selected.push(c); usedTokens += c.tokens
      }
      const coveredEvidenceIds = sorted([...new Set(selected.flatMap(c => c.evidenceIds))])
      return { selectedPassageIds: selected.map(c => c.passageId), usedTokens, totalScore: selected.reduce((n, c) => n + c.score, 0), coveredEvidenceIds, coverageBps: bps(coveredEvidenceIds.length, required.length) }
    }
    const rankPrefix = pack(rankOrder, true), greedyFit = pack(rankOrder, false), densityGreedy = pack(densityOrder, false)
    const observed = input.observedSelectedPassageIds as string[] | null
    if (observed !== null) refs(observed, new Set(cs.map(c => c.passageId)), 'observed-passage')
    const actual = observed === null ? [] : cs.filter(c => observed.includes(c.passageId)), actualTokens = actual.reduce((n, c) => n + c.tokens, 0)
    return { budget, rankPrefix, greedyFit, densityGreedy, greedyAddedPassageIds: sorted(greedyFit.selectedPassageIds.filter(x => !rankPrefix.selectedPassageIds.includes(x))),
      densityDisplacedPassageIds: sorted(greedyFit.selectedPassageIds.filter(x => !densityGreedy.selectedPassageIds.includes(x))),
      greedyRecoveredEvidenceIds: sorted(greedyFit.coveredEvidenceIds.filter(x => !rankPrefix.coveredEvidenceIds.includes(x))),
      observedSelection: observed === null ? null : { selectedPassageIds: sorted(observed), usedTokens: actualTokens, overBudget: actualTokens > budget, omittedRequiredEvidenceIds: sorted(required.filter(e => !actual.some(c => c.evidenceIds.includes(e)))) }, causalityEstablished: false }
  }
  if (id === 'evidence-budget-allocation') {
    const items = [...input.items as { evidenceId: string; tokens: number; value: number }[]].sort((a, b) => cmp(a.evidenceId, b.evidenceId)), budget = input.budget as number
    unique(items.map(i => i.evidenceId), 'evidence-item')
    // At most 65 * 4097 cells; reconstruction uses the previous item row,
    // preventing accidental reuse of an item (0/1, not unbounded knapsack).
    const dp = Array.from({ length: items.length + 1 }, () => new Int32Array(budget + 1))
    for (let i = 1; i <= items.length; i++) for (let cap = 0; cap <= budget; cap++) {
      const item = items[i - 1], include = cap >= item.tokens ? dp[i - 1][cap - item.tokens] + item.value : -1
      dp[i][cap] = Math.max(dp[i - 1][cap], include)
    }
    const selected: typeof items = []
    let cap = budget
    for (let i = items.length; i > 0; i--) if (dp[i][cap] > dp[i - 1][cap]) { selected.push(items[i - 1]); cap -= items[i - 1].tokens }
    const selectedEvidenceIds = sorted(selected.map(i => i.evidenceId)), usedTokens = selected.reduce((n, i) => n + i.tokens, 0)
    return { selectedEvidenceIds, omittedEvidenceIds: items.filter(i => !selectedEvidenceIds.includes(i.evidenceId)).map(i => i.evidenceId), usedTokens, unspentTokens: budget - usedTokens, totalValue: dp[items.length][budget], optimalForDeclaredObjective: true, tieRule: 'sorted-id-order-exclude-on-equal-value' }
  }
  if (id === 'source-coverage-drift') {
    const sourceIds = input.sourceIds as string[], recordIds = input.recordIds as string[]
    type Snapshot = { snapshotId: string; records: { recordId: string; sourceIds: string[] }[] }
    const before = input.before as Snapshot, after = input.after as Snapshot
    unique(sourceIds, 'source'); unique(recordIds, 'record')
    if (before.snapshotId === after.snapshotId) throw new Error('duplicate-snapshot')
    for (const s of [before, after]) {
      refs(s.records.map(r => r.recordId), new Set(recordIds), 'snapshot-record')
      if (s.records.length !== recordIds.length) throw new Error('unmatched-record-cohort')
      for (const r of s.records) refs(r.sourceIds, new Set(sourceIds), 'record-source')
    }
    const a = new Map(before.records.map(r => [r.recordId, r.sourceIds])), b = new Map(after.records.map(r => [r.recordId, r.sourceIds]))
    const records = sorted(recordIds).map(recordId => ({ recordId, gainedSourceIds: sorted(b.get(recordId)!.filter(s => !a.get(recordId)!.includes(s))), lostSourceIds: sorted(a.get(recordId)!.filter(s => !b.get(recordId)!.includes(s))) }))
    const ss = sorted(sourceIds).map(sourceId => {
      const beforeRecordCount = before.records.filter(r => r.sourceIds.includes(sourceId)).length, afterRecordCount = after.records.filter(r => r.sourceIds.includes(sourceId)).length
      return { sourceId, beforeRecordCount, afterRecordCount, delta: afterRecordCount - beforeRecordCount }
    })
    const nBefore = ss.filter(s => s.beforeRecordCount > 0).length, nAfter = ss.filter(s => s.afterRecordCount > 0).length
    return { beforeCoverageBps: bps(nBefore, sourceIds.length), afterCoverageBps: bps(nAfter, sourceIds.length), coverageDeltaBps: bps(nAfter - nBefore, sourceIds.length),
      gainedSourceIds: ss.filter(s => s.beforeRecordCount === 0 && s.afterRecordCount > 0).map(s => s.sourceId), lostSourceIds: ss.filter(s => s.beforeRecordCount > 0 && s.afterRecordCount === 0).map(s => s.sourceId),
      changedRecordCount: records.filter(r => r.gainedSourceIds.length || r.lostSourceIds.length).length, records, sources: ss }
  }
  if (id === 'exact-quote-alignment') {
    const ss = sources(input), qs = input.quotes as { quoteId: string; sourceId: string; quote: string; start: number; end: number }[]
    unique(qs.map(q => q.quoteId), 'quote')
    const quotes = qs.map(q => {
      if (!ss.has(q.sourceId)) throw new Error('dangling-quote-source')
      const text = ss.get(q.sourceId)!, declared = span(text, q.start, q.end), chars = Array.from(text), quoteLength = Array.from(q.quote).length
      const utf16 = [0]
      for (const c of chars) utf16.push(utf16.at(-1)! + c.length)
      const occurrences: { start: number; end: number }[] = []
      let occurrenceCount = 0
      // At most 4096 candidate offsets, including overlapping occurrences.
      for (let start = 0; start + quoteLength <= chars.length; start++) if (text.startsWith(q.quote, utf16[start])) {
        occurrenceCount++
        if (occurrences.length < 32) occurrences.push({ start, end: start + quoteLength })
      }
      return { quoteId: q.quoteId, sourceId: q.sourceId, exactAtDeclaredOffsets: declared === q.quote, declaredSliceSha256: sha256(declared), occurrenceCount, occurrences, occurrencesTruncated: occurrenceCount > 32, uniqueMatch: occurrenceCount === 1 ? occurrences[0] : null }
    })
    return { allAligned: quotes.every(q => q.exactAtDeclaredOffsets), quotes, offsetConvention: 'zero-based-half-open-codepoints' }
  }
  if (id === 'extraction-consistency') {
    type Passage = { passageId: string; start: number; end: number; text: string; expectedHash: string }
    type Extraction = { extractionId: string; sourceId: string; toolId: string; passages: Passage[] }
    const ss = sources(input), xs = input.extractions as Extraction[]
    unique(xs.map(x => x.extractionId), 'extraction'); unique(xs.map(x => canonicalJson([x.sourceId, x.toolId])), 'source-tool')
    if (xs.reduce((n, x) => n + x.passages.length, 0) > MAX_ROWS) throw new Error('total-passage-limit')
    const groups = new Map<string, { sourceId: string; start: number; end: number; extractionIds: string[]; texts: string[]; allExact: boolean }>()
    const checks = xs.flatMap(x => {
      if (!ss.has(x.sourceId)) throw new Error('dangling-extraction-source')
      unique(x.passages.map(p => p.passageId), 'extracted-passage'); unique(x.passages.map(p => canonicalJson([p.start, p.end])), 'extracted-span')
      return x.passages.map(p => {
        const exactSourceMatch = span(ss.get(x.sourceId)!, p.start, p.end) === p.text, contentSha256 = sha256(p.text), key = canonicalJson([x.sourceId, p.start, p.end])
        const group = groups.get(key) ?? { sourceId: x.sourceId, start: p.start, end: p.end, extractionIds: [], texts: [], allExact: true }
        group.extractionIds.push(x.extractionId); group.texts.push(p.text); group.allExact &&= exactSourceMatch; groups.set(key, group)
        return { extractionId: x.extractionId, passageId: p.passageId, sourceId: x.sourceId, exactSourceMatch, hashMatches: contentSha256 === p.expectedHash, contentSha256 }
      })
    })
    const spans = [...groups.values()].sort((a, b) => cmp(a.sourceId, b.sourceId) || a.start - b.start || a.end - b.end).map(g => ({ sourceId: g.sourceId, start: g.start, end: g.end, extractionIds: sorted(g.extractionIds), contentHashes: sorted([...new Set(g.texts.map(sha256))]), consistentText: new Set(g.texts).size === 1, allExact: g.allExact }))
    return { allExact: checks.every(c => c.exactSourceMatch), allHashesMatch: checks.every(c => c.hashMatches), conflictingSpanCount: spans.filter(s => !s.consistentText).length, checks, spans }
  }
  if (id === 'reproducibility-manifest-builder') {
    type Artifact = { artifactId: string; kind: string; content: string; expectedHash: string; dependsOn: string[] }
    const artifacts = input.artifacts as Artifact[], parameters = input.parameters as { name: string; value: string }[]
    unique(artifacts.map(a => a.artifactId), 'artifact'); unique(parameters.map(p => p.name), 'parameter')
    const known = new Set(artifacts.map(a => a.artifactId))
    for (const a of artifacts) refs(a.dependsOn, known, 'artifact-dependency')
    const remaining = new Set(known), topologicalArtifactIds: string[] = []
    for (let round = 0; round < artifacts.length && remaining.size; round++) {
      const ready = sorted(artifacts.filter(a => remaining.has(a.artifactId) && a.dependsOn.every(d => !remaining.has(d))).map(a => a.artifactId))
      if (!ready.length) throw new Error('cyclic-artifact-dependencies')
      for (const a of ready) { remaining.delete(a); topologicalArtifactIds.push(a) }
    }
    const entries = [...artifacts].sort((a, b) => cmp(a.artifactId, b.artifactId)).map(a => ({ artifactId: a.artifactId, kind: a.kind, contentSha256: sha256(a.content), expectedHash: a.expectedHash, hashMatches: sha256(a.content) === a.expectedHash, utf8Bytes: Buffer.byteLength(a.content), dependsOn: sorted(a.dependsOn) }))
    const manifest = { version: 1, runId: input.runId, algorithmVersion: input.algorithmVersion, seed: input.seed, parameters: parameters.map(p => ({ ...p })).sort((a, b) => cmp(a.name, b.name)), artifacts: entries }
    return { manifest, manifestSha256: hashJson(manifest), allHashesMatch: entries.every(a => a.hashMatches), topologicalArtifactIds, executionReplayed: false, signed: false }
  }
  throw new Error('unimplemented-evidence-product')
}

const LIMITS: Record<string, string[]> = {
  'passage-hash-validation': ['Exact UTF-8 bytes only; matching a declared hash does not authenticate the author or source.'],
  'claim-citation-coverage': ['Declared locator linkage only; no entailment, relevance, or factual truth is verified.'],
  'citation-locator-conversion': ['Offsets are zero-based half-open and refer only to the exact supplied text, not a PDF or remote document.'],
  'provenance-graph-integrity': ['Edges mean from depends on to. Graph integrity and declared digests do not authenticate provenance.'],
  'retrieval-recovery-regression': ['Complete means all required IDs, partial means some, miss means none; distractors do not improve recovery.', 'Matched frozen-cohort evidence overlap is descriptive, not answer correctness or a causal effect. Threshold comparison uses rounded basis points.'],
  'paper-cluster-retrieval-comparison': ['LCG(1664525,1013904223) over uint32; floor(draw/2^32 * paperCount). Resample paired whole papers with replacement.', 'The question-weighted complete-recovery delta uses sampled cluster sizes, not equal-sized question draws. Basis points are rounded.', '95% descriptive percentile bounds use ceil(p*replicates)-1. Few clusters, dependence between papers, and unrepresentative cohorts limit interpretation; no significance claim.'],
  'packing-displacement-analysis': ['Rank-prefix stops at the first item that does not fit; rank-greedy skips it. Density-greedy orders score/tokens, ties by rank.', 'Declared token costs and additive scores only. Displacement is a policy comparison, not proof of a retrieval or answer-quality cause. Null observed selection means no actual selection was supplied.'],
  'evidence-budget-allocation': ['Exact 0/1 knapsack over declared additive values; no evidence interactions, relevance scoring, or tokenizer is evaluated.'],
  'source-coverage-drift': ['Identical record and source inventories are required; source presence/count drift is not evidence of source quality or corpus completeness.'],
  'exact-quote-alignment': ['Exact Unicode code-point matching only; first 32 overlapping match locations are returned, with a complete bounded occurrence count. No semantic support claim.'],
  'extraction-consistency': ['At most 64 total spans; compare exact source slices and bytes without normalization. Agreement does not establish extraction completeness or real-world source fidelity.'],
  'reproducibility-manifest-builder': ['Hashes bind only supplied bytes and declarations. No execution replay, signatures, external availability, or authenticity check; a caller can recompute hashes after editing.'],
}

/** Unknown IDs return null. Known products throw on invalid/oversized inputs.
 * Schema checks are necessary but cross-record uniqueness/references are checked
 * separately. Outputs are closed-schema checked and bounded before returning.
 * resultSha256 hashes the canonical result with that one field omitted; it is
 * a reproducibility checksum, NOT a signature or trusted tamper-proof receipt.
 */
export function buildEvidenceExpansion(id: string, input: Row): Row | null {
  if (!Object.hasOwn(SPECS, id)) return null
  const spec = SPECS[id], encoded = encode(input, INPUT_BYTES)
  if (!schemaAccepts(spec.inputSchema, input)) throw new Error(`invalid-input:${id}`)
  const result = { dataClass: input.dataClass, inputSha256: sha256(encoded), sourcesVerified: false,
    limits: ['Public/synthetic is a caller declaration, not content inspection. No network, models, secrets, or external verification. Canonical inputs <=32 KiB, results <=64 KiB; JSON depth <=16 and nodes <=4096. Oversized results are rejected, not truncated.', ...LIMITS[id]], ...calculate(id, input) }
  const output: Row = { ...result, resultSha256: hashJson(result) }
  // Hashing the body alone can fit while the final hash field takes it over.
  encode(output, RESULT_BYTES)
  if (!schemaAccepts(spec.resultSchema, output)) throw new Error(`invalid-result:${id}`)
  return output
}
