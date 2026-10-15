import test from 'node:test'
import assert from 'node:assert/strict'
import { validate } from './helpers/json-schema.ts'
test('independent schema checker enforces exclusive numeric boundaries rather than ignoring them', () => {
  const schema = { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 2 }
  assert.deepEqual(validate(1, schema), [])
  for (const x of [-1, 0, 2, 3]) assert.ok(validate(x, schema).length)
})
test('independent schema checker rejects invalid dates, times, URIs and unknown formats', () => {
  for (const [format, values] of Object.entries({ date: ['2026-10-15', '2024-02-29'], 'date-time': ['2026-10-15T12:34:56Z', '2026-10-15T12:34:56.123+05:30'], uri: ['https://example.org/a?x=1', 'urn:example:value'] }))
    for (const value of values) assert.deepEqual(validate(value, { type: 'string', format }), [])
  for (const [format, values] of Object.entries({ date: ['2026-02-30', '2026-13-01'], 'date-time': ['2026-02-30T12:00:00Z', '2026-10-15T24:00:00Z', '2026-10-15'], uri: ['/relative/path', 'https://bad host/'] }))
    for (const value of values) assert.ok(validate(value, { type: 'string', format }).length)
  assert.ok(validate('anything', { type: 'string', format: 'unimplemented-format' }).length)
})
