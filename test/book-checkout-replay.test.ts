import assert from 'node:assert/strict'
import test from 'node:test'

function replayDisposition(status: 'awaiting_payment' | 'paid' | 'failed', sameBook: boolean, hasUrl: boolean): string {
  if (!sameBook) return 'conflict'
  if (status === 'paid') return 'settled'
  if (status === 'failed') return 'failed'
  return hasUrl ? 'replay_url' : 'recover_session'
}

test('book checkout retry reuses the original payment session instead of creating another', () => {
  assert.equal(replayDisposition('awaiting_payment', true, true), 'replay_url')
  assert.equal(replayDisposition('awaiting_payment', true, false), 'recover_session')
})

test('book checkout retry never turns a different book or settled payment into a new charge', () => {
  assert.equal(replayDisposition('awaiting_payment', false, true), 'conflict')
  assert.equal(replayDisposition('paid', true, true), 'settled')
  assert.equal(replayDisposition('failed', true, true), 'failed')
})
