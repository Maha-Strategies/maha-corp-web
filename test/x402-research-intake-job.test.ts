import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createResearchIntakeJobId,
  deriveResearchIntakeRetrievalToken,
  researchIntakeJobResponse,
  researchIntakeRetrievalTokenHash,
  researchIntakeRetrievalTokenMatches,
  validResearchIntakeJobId,
} from '../lib/x402/research-intake-job.ts'

test('research-intake retrieval credentials bind one valid pack id', () => {
  const packId = createResearchIntakeJobId()
  assert.equal(validResearchIntakeJobId(packId), true)
  const token = deriveResearchIntakeRetrievalToken(packId, 'offline-test-secret-with-enough-entropy')
  assert.ok(token)
  const hash = researchIntakeRetrievalTokenHash(token)
  assert.equal(researchIntakeRetrievalTokenMatches(token, hash), true)
  assert.equal(researchIntakeRetrievalTokenMatches(`${token}x`, hash), false)
})

test('failed-job guidance promises section-local recovery, never a whole-pack rerun', () => {
  const response = researchIntakeJobResponse({
    public_id: 'intake_9b3f71ac52d84e6fa0c8d1e37b5942af',
    client_request_id: 'research-intake-request-001',
    input_hash: `sha256:${'a'.repeat(64)}`,
    status: 'failed',
    result: null,
    failure_code: 'section_audit_failed',
    section_count: 10,
    sections_completed: 9,
    sections_failed: 1,
    total_model_calls: 10,
  })
  assert.deepEqual(response.progress, { sectionCount: 10, sectionsCompleted: 9, sectionsFailed: 1, totalModelCalls: 10 })
  assert.match(JSON.stringify(response.error), /only failed or missing sections/i)
  assert.doesNotMatch(JSON.stringify(response), /rerun (?:the )?(?:entire|whole) pack/i)
})

test('the migration persists section-local progress and makes completed checkpoints immutable', async () => {
  const { readFile } = await import('node:fs/promises')
  const sql = await readFile(new URL('../supabase/migrations/20260906090000_x402_research_intake_packs.sql', import.meta.url), 'utf8')
  assert.match(sql, /x402_research_intake_section_audits/)
  assert.match(sql, /status in \('pending', 'failed'\)/)
  assert.match(sql, /completed research-intake section audits are immutable/)
  assert.match(sql, /before update on public\.x402_research_intake_section_audits/)
  assert.doesNotMatch(sql, /resume_x402_research_intake\s*\(/)
})
