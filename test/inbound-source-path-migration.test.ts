import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { contactSourcePath } from '../lib/contact-qualification.ts'

const migration = readFileSync('supabase/migrations/20260831140000_allow_evidence_audit_inbound_source.sql', 'utf8')

test('the inbound ledger permits each normalized public human-intake source path', () => {
  assert.equal(contactSourcePath('/contact'), '/contact')
  assert.equal(contactSourcePath('/evidence-audit'), '/evidence-audit')
  assert.match(migration, /drop constraint if exists inbound_submissions_source_path_check/i)
  assert.match(migration, /source_path in \('\/contact', '\/evidence-audit'\)/i)
})
