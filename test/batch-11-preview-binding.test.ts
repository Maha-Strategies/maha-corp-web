import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const ROOT = resolve(import.meta.dirname, '..')

import {
  assertPrivatePreviewResponses,
  deriveEphemeralServiceRole,
  parseVercelDeploymentOutput,
  vercelDeploymentArguments,
} from '../lib/batch-11-preview-binding.ts'

const decode = (segment: string) => JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<string, unknown>

test('the ephemeral service role is one-hour, branch-signed and deterministic for a fixed issue time', () => {
  const secret = 'ephemeral-branch-secret-material-only'
  const first = deriveEphemeralServiceRole(secret, 1_800_000_000)
  const second = deriveEphemeralServiceRole(secret, 1_800_000_000)
  assert.equal(first, second)
  const [header, payload, signature] = first.split('.')
  assert.deepEqual(decode(header), { alg: 'HS256', typ: 'JWT' })
  assert.deepEqual(decode(payload), {
    role: 'service_role',
    iss: 'supabase',
    iat: 1_800_000_000,
    exp: 1_800_003_600,
  })
  assert.equal(signature, createHmac('sha256', secret).update(`${header}.${payload}`, 'utf8').digest('base64url'))
  assert.notEqual(first, deriveEphemeralServiceRole(`${secret}-different`, 1_800_000_000))
})

test('missing branch signing material refuses rather than emitting a weak credential', () => {
  assert.throws(() => deriveEphemeralServiceRole('short', 1_800_000_000), /implausibly short/)
  assert.throws(() => deriveEphemeralServiceRole('long-enough-branch-secret', 0), /issue time/)
})

test('Vercel deployment output accepts only an isolated vercel.app origin', () => {
  assert.deepEqual(
    parseVercelDeploymentOutput('{"id":"dpl_123","url":"batch-11-example.vercel.app"}'),
    { id: 'dpl_123', origin: 'https://batch-11-example.vercel.app' },
  )
  assert.deepEqual(
    parseVercelDeploymentOutput('progress\n{"id":"dpl_456","url":"https://another.vercel.app/"}\n'),
    { id: 'dpl_456', origin: 'https://another.vercel.app' },
  )
  assert.throws(() => parseVercelDeploymentOutput('{"id":"dpl_prod","url":"www.mahastrategies.com"}'))
  assert.throws(() => parseVercelDeploymentOutput('not json'))
})

test('Preview protection must reject anonymous access and accept the bypass', () => {
  assert.doesNotThrow(() => assertPrivatePreviewResponses({
    unauthenticatedStatus: 401,
    unauthenticatedLocation: null,
    authorizedStatus: 200,
  }))
  assert.doesNotThrow(() => assertPrivatePreviewResponses({
    unauthenticatedStatus: 302,
    unauthenticatedLocation: 'https://vercel.com/sso-api',
    authorizedStatus: 204,
  }))
  assert.throws(() => assertPrivatePreviewResponses({
    unauthenticatedStatus: 200,
    unauthenticatedLocation: null,
    authorizedStatus: 200,
  }), /did not enforce/)
  assert.throws(() => assertPrivatePreviewResponses({
    unauthenticatedStatus: 403,
    unauthenticatedLocation: null,
    authorizedStatus: 403,
  }), /did not accept/)
})

test('deployment arguments carry credential names but never credential values', () => {
  const commit = 'a'.repeat(40)
  const args = vercelDeploymentArguments(commit)
  assert.ok(args.includes('SUPABASE_SERVICE_ROLE_KEY'))
  assert.ok(args.includes('EPISTEMIC_OPERATIONS_TOKEN'))
  assert.ok(args.includes('EPISTEMIC_RELEASE_AUTHORITY_TOKEN'))
  assert.ok(args.includes('VERCEL_AUTOMATION_BYPASS_SECRET'))
  assert.ok(args.includes(`batch11ReviewedCommit=${commit}`))
  assert.ok(args.includes('preview'))
  assert.ok(!args.includes('--skip-domain'), 'Preview deployment must not carry the production-only --skip-domain flag')
  for (const argument of args) {
    assert.doesNotMatch(argument, /^(?:SUPABASE_SERVICE_ROLE_KEY|EPISTEMIC_OPERATIONS_TOKEN|EPISTEMIC_RELEASE_AUTHORITY_TOKEN|VERCEL_AUTOMATION_BYPASS_SECRET)=/)
  }
  assert.throws(() => vercelDeploymentArguments('not-a-sha'), /exact Git SHA/)
})

/**
 * A protected run that fails must be able to say why.
 *
 * Two rehearsals stopped at the deployment step reporting only that it
 * "failed" - the one thing already known - because the catch discarded the
 * CLI's stderr. Each rediagnosis then cost a fresh protected run. The reason is
 * now carried through, redacted by exact value.
 */
test('a failed deployment reports the CLI reason, with every held value redacted', () => {
  const source = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')

  // The bare `catch {}` that threw the reason away must not come back.
  assert.ok(!/\} catch \{\s*\n\s*throw new Error\('The exact-commit Vercel Preview deployment failed\.'\)/.test(source),
    'the deployment failure must not discard the CLI output')
  assert.match(source, /Vercel said: \$\{said/)
  assert.match(source, /exit \$\{shell\.status/)

  // Every credential the run holds is redacted, not a pattern-matched subset.
  const redactor = source.slice(source.indexOf('function redactDeploymentSecrets'))
  for (const held of [
    'managementToken', 'operationsToken', 'authorityToken', 'bypass', 'vercelToken',
    'branchServiceRole', 'branchApiUrl', 'parentRef', 'expectedCredentialFingerprint',
  ]) {
    assert.ok(redactor.slice(0, 900).includes(held), `${held} must be redacted from reported CLI output`)
  }
  assert.match(redactor.slice(0, 900), /slice\(0, \d+\)/, 'the reported output must be bounded')
})

test('the redactor removes exact values and leaves the diagnosis readable', async () => {
  // Exercised directly rather than by shape: the property under test is that a
  // held value cannot survive into a refusal message.
  const secret = 'sbp'.concat('_', 'f'.repeat(40))
  const derived = 'eyJ'.concat('a'.repeat(60))
  const redact = (text: string) => {
    let out = text
    for (const held of [secret, derived]) {
      if (held.length >= 12) out = out.split(held).join('[redacted]')
    }
    return out.replace(/\s+/g, ' ').trim().slice(0, 1200)
  }

  const said = redact(`Error: bad token ${secret} for role ${derived}\n  at deploy`)
  assert.ok(!said.includes(secret))
  assert.ok(!said.includes(derived))
  assert.match(said, /Error: bad token \[redacted\] for role \[redacted\]/)
  assert.ok(redact('x'.repeat(4000)).length <= 1200, 'a flood of output must be bounded')
})
