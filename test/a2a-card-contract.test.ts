import assert from 'node:assert/strict'
import test from 'node:test'

import { A2A_TASK_INPUT_SCHEMA, a2aAgentCard, handleA2ATask, resetA2AReplayMemory } from '../lib/maha-a2a/index.ts'

/**
 * The agent card must be sufficient to call the agent.
 *
 * An independent caller has only the card. If the card omits the task envelope,
 * the caller has to guess it from prose — and the natural guesses are all
 * rejected. These tests assert the card carries enough to build an accepted
 * task, and that it keeps carrying it.
 */

/** A task built strictly from the published schema — nothing read from source. */
function taskFromPublishedSchema(taskId: string) {
  const schema = a2aAgentCard().skills as { inputSchema?: Record<string, unknown> }[]
  const published = schema[0].inputSchema as typeof A2A_TASK_INPUT_SCHEMA
  const required = published.required as string[]
  assert.deepEqual([...required].sort(), ['policy', 'request', 'taskId'])
  return {
    taskId,
    policy: { tokenBudget: 512 },
    request: {
      model: 'synthetic', messages: [],
      maha_context: {
        task: 'Summarise the synthetic coverage clause for evaluation.',
        tokenBudget: 512,
        documents: [{ id: 'syn-1', text: 'Alpha beta gamma delta epsilon zeta eta theta iota kappa.' }],
      },
    },
  }
}

test('the agent card publishes the task envelope a caller must send', () => {
  const card = a2aAgentCard('https://example.invalid')
  const skill = (card.skills as Record<string, unknown>[])[0]
  assert.ok(skill.inputSchema, 'the skill must publish an inputSchema')
  const schema = skill.inputSchema as Record<string, unknown>
  assert.equal(schema.type, 'object')
  assert.deepEqual([...(schema.required as string[])].sort(), ['policy', 'request', 'taskId'])
  // The field names an outsider is most likely to guess wrong are the ones the
  // schema has to name explicitly.
  const properties = schema.properties as Record<string, unknown>
  assert.ok('taskId' in properties, 'taskId must be named; `id` is the natural wrong guess')
  assert.ok('request' in properties, 'request must be named; a nested input.payload is the natural wrong guess')
  const policy = properties.policy as Record<string, unknown>
  assert.deepEqual(policy.required, ['tokenBudget'], 'the mandatory budget must be discoverable')
})

test('a task built only from the published schema is accepted', () => {
  resetA2AReplayMemory()
  const result = handleA2ATask(taskFromPublishedSchema('card-derived-1'))
  assert.equal(result.state, 'completed', `a card-derived task must be accepted, got ${JSON.stringify(result.failure)}`)
})

test('the card and the handler cannot drift apart', () => {
  resetA2AReplayMemory()
  // Drop each required field in turn. Every one must be rejected — a field the
  // schema calls required but the handler ignores would be a lie in the card.
  for (const omitted of ['taskId', 'policy', 'request'] as const) {
    const task: Record<string, unknown> = taskFromPublishedSchema(`drift-${omitted}`)
    delete task[omitted]
    const result = handleA2ATask(task)
    assert.notEqual(result.state, 'completed', `omitting ${omitted} must not be accepted`)
  }
})

test('the shapes an outsider would guess from the old card are still refused', () => {
  resetA2AReplayMemory()
  const card = a2aAgentCard()
  const skillId = (card.skills as { id: string }[])[0].id
  // `id` instead of `taskId`, and a nested input.payload — the guesses a caller
  // reading only name/description/inputModes would make.
  const guessed = { id: 'guessed-1', skillId, input: { contentType: 'application/json', payload: { task: 'x', tokenBudget: 512, documents: [] } } }
  const result = handleA2ATask(guessed)
  assert.equal(result.state, 'rejected')
  assert.equal(result.failure?.code, 'invalid_task')
})

test('a task addressed to another skill is refused, not silently served', () => {
  resetA2AReplayMemory()
  const wrong = { ...taskFromPublishedSchema('wrong-skill-1'), skillId: 'maha.context-control.__nope' }
  const result = handleA2ATask(wrong)
  assert.equal(result.state, 'rejected', 'an unknown skillId must not be accepted by the one skill that exists')
  assert.equal(result.failure?.code, 'unknown_skill')
  // The advertised skill id still works, so this is a filter and not a ban.
  resetA2AReplayMemory()
  const skillId = (a2aAgentCard().skills as { id: string }[])[0].id
  const ok = handleA2ATask({ ...taskFromPublishedSchema('right-skill-1'), skillId })
  assert.equal(ok.state, 'completed')
})

test('the card does not claim a strictness the handler does not apply', () => {
  resetA2AReplayMemory()
  const schema = (a2aAgentCard().skills as { inputSchema: Record<string, unknown> }[])[0].inputSchema
  const task = { ...taskFromPublishedSchema('extra-1'), someUnknownField: 'ignored' }
  const result = handleA2ATask(task)
  // The handler ignores unknown fields, so the schema must not say otherwise.
  assert.equal(result.state, 'completed')
  assert.equal(schema.additionalProperties, true)
})

test('an explicit budget is required and never defaulted', () => {
  resetA2AReplayMemory()
  const task = taskFromPublishedSchema('nobudget-1') as Record<string, unknown>
  task.policy = {}
  const result = handleA2ATask(task)
  assert.equal(result.state, 'rejected')
  assert.equal(result.failure?.code, 'policy_required')
})
