import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  SUPABASE_SESSION_POOLER_PORT,
  previewSessionPoolerEnvironment,
} from '../lib/batch-11-supabase-pooler.ts'

const ROOT = resolve(import.meta.dirname, '..')
const REF = 'abcdefghijklmnopqrst'
const PARENT_REF = 'uvwxyzabcdefghijklmn'
const PASSWORD = 'preview-only-password'

const primary = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  identifier: 'primary',
  database_type: 'PRIMARY',
  db_user: `postgres.${PARENT_REF}`,
  db_host: 'aws-0-us-east-1.pooler.supabase.com',
  db_port: 6543,
  db_name: 'postgres',
  connection_string: `postgresql://postgres.${PARENT_REF}:ignored@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  pool_mode: 'transaction',
  ...overrides,
})

test('authoritative transaction pooler configuration becomes an IPv4 session connection', () => {
  const env = previewSessionPoolerEnvironment({
    branchRef: REF,
    parentProjectRef: PARENT_REF,
    branchPassword: PASSWORD,
    poolerConfiguration: [primary()],
  })
  assert.deepEqual(env, {
    PGHOST: 'aws-0-us-east-1.pooler.supabase.com',
    PGPORT: SUPABASE_SESSION_POOLER_PORT,
    PGUSER: `postgres.${REF}`,
    PGPASSWORD: PASSWORD,
    PGDATABASE: 'postgres',
    PGSSLMODE: 'require',
  })
  assert.equal(env.PGPORT, '5432', 'port 5432 selects shared Supavisor session mode')
  assert.notEqual(env.PGPASSWORD, 'ignored', 'the API connection-string password must never be trusted')
})

test('camel-case connectionString is accepted when it is the sole authoritative value', () => {
  const row = primary()
  const connectionString = row.connection_string
  delete row.connection_string
  row.connectionString = connectionString
  const env = previewSessionPoolerEnvironment({
    branchRef: REF,
    parentProjectRef: PARENT_REF,
    branchPassword: PASSWORD,
    poolerConfiguration: [row],
  })
  assert.equal(env.PGHOST, 'aws-0-us-east-1.pooler.supabase.com')
})

test('a replica alongside one exact PRIMARY is ignored', () => {
  const env = previewSessionPoolerEnvironment({
    branchRef: REF,
    parentProjectRef: PARENT_REF,
    branchPassword: PASSWORD,
    poolerConfiguration: [{ ...primary(), database_type: 'READ_REPLICA' }, primary()],
  })
  assert.equal(env.PGUSER, `postgres.${REF}`)
})

test('auxiliary config fields cannot override the authoritative connection string', () => {
  const env = previewSessionPoolerEnvironment({
    branchRef: REF,
    parentProjectRef: PARENT_REF,
    branchPassword: PASSWORD,
    poolerConfiguration: [primary({
      db_host: 'an-internal-database-host',
      db_user: 'postgres',
      db_port: 9999,
      db_name: 'an-internal-name',
    })],
  })
  assert.equal(env.PGHOST, 'aws-0-us-east-1.pooler.supabase.com')
  assert.equal(env.PGUSER, `postgres.${REF}`)
  assert.equal(env.PGPORT, '5432')
  assert.equal(env.PGDATABASE, 'postgres')
})

test('missing or duplicate PRIMARY configurations fail closed', () => {
  for (const poolerConfiguration of [
    [],
    [{ ...primary(), database_type: 'READ_REPLICA' }],
    [primary(), primary({ identifier: 'other' })],
    { database_type: 'PRIMARY' },
  ]) {
    assert.throws(
      () => previewSessionPoolerEnvironment({ branchRef: REF, parentProjectRef: PARENT_REF, branchPassword: PASSWORD, poolerConfiguration }),
      /pooler configuration|exactly one PRIMARY/,
    )
  }
})

test('a direct endpoint can never stand in for the IPv4 shared pooler', () => {
  assert.throws(
    () => previewSessionPoolerEnvironment({
      branchRef: REF,
      parentProjectRef: PARENT_REF,
      branchPassword: PASSWORD,
      poolerConfiguration: [primary({
        db_host: `db.${REF}.supabase.co`,
        connection_string: `postgresql://postgres.${PARENT_REF}:${PASSWORD}@db.${REF}.supabase.co:5432/postgres`,
      })],
    }),
    /shared Supavisor endpoint/,
  )
})

test('a substituted Preview ref, user, host or database is refused', () => {
  const cases = [
    primary({ db_user: 'postgres.other', connection_string: 'postgresql://postgres.other:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres' }),
    primary({ db_host: 'evil.example', connection_string: `postgresql://postgres.${PARENT_REF}:x@evil.example:6543/postgres` }),
    primary({ db_name: 'other', connection_string: `postgresql://postgres.${PARENT_REF}:x@aws-0-us-east-1.pooler.supabase.com:6543/other` }),
    primary({ connection_string: `postgresql://postgres.otherref0000000000:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres` }),
  ]
  for (const row of cases) {
    assert.throws(
      () => previewSessionPoolerEnvironment({ branchRef: REF, parentProjectRef: PARENT_REF, branchPassword: PASSWORD, poolerConfiguration: [row] }),
    )
  }
})

test('conflicting API aliases and malformed connection strings fail closed', () => {
  for (const row of [
    primary({ connectionString: `postgresql://postgres.${PARENT_REF}:x@another.pooler.supabase.com:6543/postgres` }),
    primary({ connection_string: 'not a url' }),
    primary({ connection_string: `https://postgres.${PARENT_REF}:x@aws-0-us-east-1.pooler.supabase.com/postgres` }),
    primary({ connection_string: '' }),
  ]) {
    assert.throws(
      () => previewSessionPoolerEnvironment({ branchRef: REF, parentProjectRef: PARENT_REF, branchPassword: PASSWORD, poolerConfiguration: [row] }),
    )
  }
})

test('the remote runner fetches the parent-authorized pooler and binds its user to the branch', () => {
  const source = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
  assert.match(source, /\/v1\/projects\/\$\{parentRef\}\/config\/database\/pooler/)
  assert.doesNotMatch(source, /\/v1\/projects\/\$\{branchRef\}\/config\/database\/pooler/)
  assert.match(source, /previewSessionPoolerEnvironment/)
  assert.match(source, /parentProjectRef: parentRef/)
  assert.doesNotMatch(source, /PGHOST:\s*String\(detail\.db_host/)
  assert.match(source, /execFileSync\('psql'/)
  assert.match(source, /env:\s*\{\s*\.\.\.process\.env,\s*\.\.\.branchEnv\s*\}/)
  assert.doesNotMatch(source, /psql[\s\S]{0,500}(?:postgres|postgresql):\/\//)
})

test('a missing branch password or substituted parent pooler user fails closed', () => {
  assert.throws(
    () => previewSessionPoolerEnvironment({
      branchRef: REF,
      parentProjectRef: PARENT_REF,
      branchPassword: undefined,
      poolerConfiguration: [primary()],
    }),
    /branch password/,
  )
  assert.throws(
    () => previewSessionPoolerEnvironment({
      branchRef: REF,
      parentProjectRef: PARENT_REF,
      branchPassword: PASSWORD,
      poolerConfiguration: [primary({
        connection_string: 'postgresql://postgres.substitutedproject:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
      })],
    }),
    /parent project ref/,
  )
})
