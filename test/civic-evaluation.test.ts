import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateCivicAi, verifyEvaluationReport } from '../lib/civic/evaluation.ts'
import { answerTownhall } from '../lib/civic/townhall-agent.ts'
test('measured report contains actual finite-scope results and excludes fixture content', async () => {
  const report = await evaluateCivicAi({ codeDigest: '1'.repeat(64), now: new Date('2026-10-08T00:00:00Z') })
  assert.equal(report.total, 12); assert.equal(report.passed, 12)
  assert.equal(new Set(report.cases.map(item => item.category)).size, 5)
  assert.doesNotMatch(JSON.stringify(report), /SYNTHETIC_INTERNAL_NOTE_CANARY|SYNTHETIC_PRIVATE_EVAL_CANARY/)
  assert.deepEqual(verifyEvaluationReport(report), report)
  assert.throws(() => verifyEvaluationReport({ ...report, passed: 0 }), /Invalid evaluation report/)
})
test('evaluation detects a regressed output rather than stamping every run as passed', async () => {
  const report = await evaluateCivicAi({ codeDigest: '2'.repeat(64), answer: async (...args) => {
    const result = await answerTownhall(...args)
    return { ...result, answer: 'Unsupported promise: all risks are eliminated.', markdown: 'No limits disclosed.', citations: [] }
  } })
  assert.ok(report.passed < report.total)
  assert.equal(report.cases.find(item => item.id === 'healthcare-gap')?.passed, false)
})
