import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_MODEL, ANTHROPIC_MESSAGE_SETTINGS, ANTHROPIC_PRICING } from '../lib/anthropic-model.ts'
import { PREFLIGHT_MODEL } from '../lib/mps-preflight.ts'
import { MPS_AUDIT_MODEL } from '../lib/x402/mps-audit-job.ts'
import { RESEARCH_INTAKE_MODEL } from '../lib/x402/research-intake-job.ts'
import { WSO2_EVALUATION_MODEL, WSO2_EVALUATION_PRICING, WSO2_EVALUATION_TEMPERATURE } from '../lib/integrations/wso2-evaluation-harness.ts'

test('all provider boundaries and prices use Sonnet 5.5', () => {
  for (const model of [PREFLIGHT_MODEL, MPS_AUDIT_MODEL, RESEARCH_INTAKE_MODEL, WSO2_EVALUATION_MODEL]) {
    assert.equal(model, 'claude-sonnet-5-5')
  }
  assert.deepEqual(ANTHROPIC_PRICING, { inputPerMillionUsd: 2, outputPerMillionUsd: 10 })
  assert.equal(WSO2_EVALUATION_PRICING.inputPerMillion, BigInt(2_000_000))
  assert.equal(WSO2_EVALUATION_PRICING.outputPerMillion, BigInt(10_000_000))
  assert.equal(WSO2_EVALUATION_TEMPERATURE, 1)
})

test('the SDK serializes a compatible bounded request without sampling overrides', async () => {
  let captured: Record<string, unknown> | undefined
  const client = new Anthropic({
    apiKey: 'synthetic-test-key', maxRetries: 0,
    fetch: async (_url, init) => {
      captured = JSON.parse(String(init?.body))
      return Response.json({ id: 'msg_test', type: 'message', role: 'assistant', model: ANTHROPIC_MODEL,
        content: [{ type: 'text', text: 'OK' }], stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 1 } })
    },
  })
  const result = await client.messages.create({ ...ANTHROPIC_MESSAGE_SETTINGS,
    model: ANTHROPIC_MODEL, max_tokens: 1500, messages: [{ role: 'user', content: 'Synthetic fixture' }] })
  assert.equal(captured?.model, ANTHROPIC_MODEL)
  assert.deepEqual(captured?.thinking, { type: 'between_tools' })
  assert.deepEqual(captured?.output_config, { effort: 'medium' })
  assert.equal(captured?.max_tokens, 1500)
  for (const forbidden of ['temperature', 'top_p', 'top_k', 'tool_choice']) assert.equal(captured?.[forbidden], undefined)
  assert.equal(result.content[0].type, 'text')
})

test('every SDK call site shares compatible settings and cannot select a stale model override', () => {
  function files(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : []
    })
  }
  let calls = 0
  for (const path of [...files('app/api'), ...files('lib')]) {
    const source = readFileSync(path, 'utf8')
    if (!source.includes("'@anthropic-ai/sdk'")) continue
    assert.doesNotMatch(source, /claude-(?:sonnet-4|haiku)/, path)
    assert.doesNotMatch(source, /process\.env\.(?:CONTENT_DRAFT_ASSISTANT_MODEL|CONTENT_CANDIDATE_ASSISTANT_MODEL|ASTROLOGY_CHAT_MODEL)/, path)
    const boundaries = [...source.matchAll(/client\.messages\.create\(\{\s*([^\n]*)/g)]
    for (const boundary of boundaries) assert.match(boundary[1], /\.\.\.ANTHROPIC_MESSAGE_SETTINGS/, path)
    calls += boundaries.length
  }
  assert.equal(calls, 15)
})
