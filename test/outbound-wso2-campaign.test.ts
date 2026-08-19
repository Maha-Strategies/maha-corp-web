import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL('../supabase/migrations/20260819000100_wso2_outbound_provider_delivery.sql', import.meta.url), 'utf8')

test('WSO2 campaign freezes four public business recipients as unapproved drafts', () => {
  for (const email of ['info@x-venture.io', 'apac-info@chakray.com', 'info@claria.com', 'info@tellestia.com']) assert.match(migration, new RegExp(email.replace('.', '\\.')))
  assert.equal((migration.match(/'wso2-context-compiler-pilot'/g) ?? []).length, 1)
  assert.match(migration, /values \(d_id,p_id,1,item\.subject,item\.body,'draft'\)/)
  assert.doesNotMatch(migration, /values \(d_id,p_id,1,item\.subject,item\.body,'approved'\)/)
})

test('provider delivery has a one-draft claim and no automatic retry path', () => {
  assert.match(migration, /draft_id text not null unique/)
  assert.match(migration, /p_confirmation <> 'SEND ' \|\| p_draft_id/)
  assert.match(migration, /No automatic retry is permitted/)
  assert.doesNotMatch(migration, /retry_outbound_provider_send/)
})
