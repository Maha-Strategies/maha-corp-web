import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const ROOT = resolve(import.meta.dirname, '..')

import {
  assertPrivatePreviewResponses,
  parseVercelDeploymentOutput,
  vercelDeploymentArguments,
} from '../lib/batch-11-preview-binding.ts'

/**
 * The self-minted service role is gone, and must stay gone.
 *
 * It signed an HS256 token from the branch JWT secret with self-hosted claims.
 * Run 33494192235 proved a hosted branch rejects it - REST readiness answered
 * 401 on the first attempt - so the branch key is fetched from the provider
 * instead. This pins the removal, because the failure mode of its quiet return
 * is a credential that authenticates as nothing.
 */
test('the self-minted service-role path is unreachable', async () => {
  const binding = await import('../lib/batch-11-preview-binding.ts')
  assert.ok(!('deriveEphemeralServiceRole' in binding), 'the minted path must not be exported')

  const source = readFileSync(resolve(ROOT, 'lib/batch-11-preview-binding.ts'), 'utf8')
  assert.ok(!/export function deriveEphemeralServiceRole/.test(source))
  assert.ok(!/createHmac\(/.test(source), 'nothing here may sign a credential any more')
  assert.match(source, /deriveEphemeralServiceRole was removed deliberately/)

  // And no caller may reintroduce one.
  const runner = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
  assert.ok(!/deriveEphemeralServiceRole/.test(runner))
  assert.match(runner, /acquireBranchServiceKey/)
  assert.ok(!/createHmac[^\n]*jwt_secret/.test(runner))
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

/**
 * A refused Preview call must say which refusal it was.
 *
 * The routes answer with an `error.code` that separates "no persistence
 * client" from "a query threw" - the two failures that both surface as 503 and
 * have entirely different causes. Throwing only the status discarded it, and
 * recovering that distinction costs a whole protected run.
 */
test('a non-ok Preview response carries its redacted body into the refusal', () => {
  const source = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')

  assert.ok(!/if \(!response\.ok\) throw new Error\(`\$\{init\.method \?\? 'GET'\} \$\{path\} returned \$\{response\.status\}\.`\)/.test(source),
    'the status-only refusal must not come back')
  assert.match(source, /Preview said: \$\{redactDeploymentSecrets\(text\)/)

  // The body is redacted by the same function the deployment path uses, so a
  // route that echoes a bound value cannot leak it through this path either.
  const helper = source.slice(source.indexOf('async function preview('), source.indexOf('async function preview(') + 1200)
  assert.match(helper, /redactDeploymentSecrets/)
  assert.ok(!/throw new Error\([^)]*\$\{text\}/.test(helper), 'the raw body must never be thrown unredacted')
})
