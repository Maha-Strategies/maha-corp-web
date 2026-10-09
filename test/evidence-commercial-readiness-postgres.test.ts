import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

const ROOT = resolve(import.meta.dirname, '..')
const PG_BIN = ['/opt/homebrew/opt/postgresql@17/bin', '/usr/lib/postgresql/17/bin', '/usr/local/opt/postgresql@17/bin']
  .find((directory) => existsSync(join(directory, 'initdb')))

test('the commercial migration enforces acknowledgement and privacy-safe paid attribution in PostgreSQL', { skip: PG_BIN ? false : 'no local PostgreSQL 17' }, (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'mps-commercial-'))
  const data = join(directory, 'data')
  const port = String(50_000 + Math.floor(Math.random() * 10_000))
  const pg = (name: string) => join(PG_BIN!, name)
  const environment = { ...process.env, LC_ALL: 'C', LANG: 'C', PGHOST: directory, PGPORT: port, PGUSER: 'postgres' }
  const psql = (arguments_: string[], input?: string) => execFileSync(
    pg('psql'),
    ['-v', 'ON_ERROR_STOP=1', '-q', '-At', ...arguments_],
    { env: environment, input, encoding: 'utf8' },
  )
  let started = false

  try {
    try {
      execFileSync(pg('initdb'), ['-D', data, '-U', 'postgres', '--auth=trust', '--locale=C'], { env: environment })
    } catch (error) {
      const detail = String((error as { stderr?: Buffer }).stderr ?? error)
      if (detail.includes('could not create shared memory segment')) {
        context.skip('host shared-memory capacity is exhausted')
        return
      }
      throw error
    }
    execFileSync(
      pg('pg_ctl'),
      ['-D', data, '-o', `-p ${port} -k ${directory} -c listen_addresses=''`, '-l', join(directory, 'log'), '-w', 'start'],
      { env: environment, stdio: 'ignore' },
    )
    started = true
    psql(['-d', 'postgres'], `
      create schema if not exists extensions;
      do $$ begin
        if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
        if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
        if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
      end $$;
      create table public.growth_experiments (public_id text primary key);
    `)
    for (const migration of [
      '20260716000400_mps_preflight_orders.sql',
      '20260722010000_privacy_safe_conversion_measurement.sql',
      '20260904090000_mps_preflight_commercial_readiness.sql',
    ]) {
      psql(['-d', 'postgres', '--single-transaction', '-f', resolve(ROOT, 'supabase/migrations', migration)])
    }

    const orderId = `preflight_${'1'.repeat(32)}`
    const reportSha256 = `sha256:${'2'.repeat(64)}`
    const acknowledgementSha256 = `sha256:${'3'.repeat(64)}`
    psql(['-d', 'postgres'], `
      insert into public.mps_preflight_orders
        (public_id, access_hash, customer_email, status, report, report_sha256, completed_at)
      values
        ('${orderId}', 'sha256:${'4'.repeat(64)}', 'synthetic@example.invalid', 'completed', '{"synthetic":true}', '${reportSha256}', now());
    `)

    const acknowledge = (target: string, acknowledgement: string) => psql(['-d', 'postgres'], `
      set role service_role;
      select public.record_mps_preflight_acknowledgement(
        '${orderId}', '${target}', '${acknowledgement}', '2026-09-04T10:05:00Z'
      );
    `).trim().split('\n').pop()
    assert.equal(acknowledge(`sha256:${'5'.repeat(64)}`, acknowledgementSha256), 'target_mismatch')
    assert.equal(acknowledge(reportSha256, acknowledgementSha256), 'processed')
    assert.equal(acknowledge(reportSha256, acknowledgementSha256), 'duplicate')
    assert.equal(acknowledge(reportSha256, `sha256:${'6'.repeat(64)}`), 'conflict')

    const checkoutReference = `preflight_${'7'.repeat(32)}`
    const checkoutEvent = `sha256:${'8'.repeat(64)}`
    const paidEvent = `sha256:${'9'.repeat(64)}`
    assert.equal(psql(['-d', 'postgres'], `
      set role service_role;
      select public.record_checkout_conversion_attribution(
        '${checkoutReference}', 'mps-preflight', null, '/mps/preflight', '${checkoutEvent}', '2026-09-04T10:00:00Z'
      );
    `).trim().split('\n').pop(), 'recorded')
    assert.equal(psql(['-d', 'postgres'], `
      set role service_role;
      select public.record_verified_checkout_conversion(
        '${checkoutReference}', 'mps-preflight', '${paidEvent}', '2026-09-04T10:01:00Z'
      );
    `).trim().split('\n').pop(), 'recorded')
    assert.equal(psql(['-d', 'postgres', '-c', `select string_agg(event_type || ':' || source_kind, ',' order by recorded_at) from public.conversion_measurements;`]).trim(), 'checkout_started:server_checkout,paid_conversion:stripe_verified')
    assert.equal(psql(['-d', 'postgres', '-c', `select count(*) from information_schema.columns where table_schema='public' and table_name in ('conversion_measurements','conversion_checkout_attributions') and column_name ~ '(claim|excerpt|document|email|content)';`]).trim(), '0')
    assert.equal(psql(['-d', 'postgres', '-c', `select has_function_privilege('anon', 'public.record_mps_preflight_acknowledgement(text,text,text,timestamptz)', 'execute');`]).trim(), 'f')
    assert.equal(psql(['-d', 'postgres', '-c', `select has_function_privilege('service_role', 'public.record_mps_preflight_acknowledgement(text,text,text,timestamptz)', 'execute');`]).trim(), 't')
  } finally {
    if (started) spawnSync(pg('pg_ctl'), ['-D', data, '-m', 'immediate', 'stop'], { env: environment, stdio: 'ignore' })
    rmSync(directory, { recursive: true, force: true })
  }
})
