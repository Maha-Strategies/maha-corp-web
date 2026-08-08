import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

test('MCRB-1 publishes a complete frozen cohort and raw method records', async () => {
  const [result, cohort, raw] = await Promise.all([
    readFile(new URL('benchmarks/mcrb-1/results.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('benchmarks/mcrb-1/cohort.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('benchmarks/mcrb-1/cases.jsonl', root), 'utf8'),
  ])
  const rows = raw.trim().split('\n').map((line) => JSON.parse(line))
  const methods = result.protocol.methods as string[]

  assert.equal(result.id, 'mcrb-1')
  assert.equal(result.dataset.cases, 250)
  assert.equal(cohort.length, 250)
  assert.equal(new Set(cohort.map((entry: { questionId: string }) => entry.questionId)).size, 250)
  assert.equal(rows.length, cohort.length * methods.length)
  assert.ok(rows.every((row: { outputTokens: number }) => row.outputTokens <= result.protocol.declaredTokenBudget))

  for (const entry of cohort) {
    const caseRows = rows.filter((row: { caseId: string }) => row.caseId === entry.questionId)
    assert.deepEqual(caseRows.map((row: { method: string }) => row.method).sort(), [...methods].sort())
  }
})

test('MCRB-1 aggregates match the published case records', async () => {
  const [result, raw] = await Promise.all([
    readFile(new URL('benchmarks/mcrb-1/results.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('benchmarks/mcrb-1/cases.jsonl', root), 'utf8'),
  ])
  const rows = raw.trim().split('\n').map((line) => JSON.parse(line))

  for (const aggregate of result.results) {
    const subset = rows.filter((row: { method: string }) => row.method === aggregate.method)
    const complete = Number((subset.filter((row: { completeEvidenceSet: boolean }) => row.completeEvidenceSet).length / subset.length * 100).toFixed(1))
    const any = Number((subset.filter((row: { anyEvidenceHit: boolean }) => row.anyEvidenceHit).length / subset.length * 100).toFixed(1))
    const recall = Number((subset.reduce((sum: number, row: { evidenceRecall: number }) => sum + row.evidenceRecall, 0) / subset.length).toFixed(1))
    assert.equal(aggregate.completeEvidenceSetPercent, complete)
    assert.equal(aggregate.anyEvidenceHitPercent, any)
    assert.equal(aggregate.meanEvidenceRecallPercent, recall)
  }
})

test('MCRB-1 states its comparison boundary', async () => {
  const readme = await readFile(new URL('benchmarks/mcrb-1/README.md', root), 'utf8')
  assert.match(readme, /CC BY 4\.0/)
  assert.match(readme, /does not establish.*downstream model/i)
  assert.match(readme, /Generative LLM and LangChain summarization are not assigned/i)
  assert.match(readme, /oracle.*not a competitor/i)
})
