import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const ROOT = join(import.meta.dirname, '..')
const INTEGRATIONS = join(ROOT, 'integrations')
const read = (relative: string) => readFileSync(join(ROOT, relative), 'utf8')

const ADAPTERS = ['gateway-contract', 'wso2', 'kong', 'apigee', 'cloudflare-workers'] as const

/** Every file an operator could deploy. Documentation is checked separately. */
function configFiles(): string[] {
  const out: string[] = []
  const walk = (directory: string, prefix: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      const relative = `${prefix}/${entry.name}`
      if (entry.isDirectory()) { walk(path, relative); continue }
      if (/\.(ya?ml|toml|xml|lua|json|js|ts)$/.test(entry.name)) out.push(relative)
    }
  }
  walk(INTEGRATIONS, 'integrations')
  return out
}

test('every adapter directory exists and documents itself', () => {
  for (const adapter of ADAPTERS) {
    assert.ok(existsSync(join(INTEGRATIONS, adapter)), `missing adapter directory: ${adapter}`)
    assert.ok(existsSync(join(INTEGRATIONS, adapter, 'README.md')), `${adapter} has no README`)
  }
})

/**
 * A credential in a config file is a credential in version control. This looks
 * for values that would actually work, not for the word "secret".
 */
test('no adapter artifact contains a live credential', () => {
  for (const file of configFiles()) {
    const source = read(file)
    for (const [label, pattern] of [
      ['bearer token', /Bearer\s+[A-Za-z0-9._-]{16,}/],
      ['anthropic key', /sk-ant-[A-Za-z0-9_-]{8,}/],
      ['openai key', /\bsk-[A-Za-z0-9]{32,}/],
      ['aws key id', /\bAKIA[0-9A-Z]{16}\b/],
      ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
      ['hex secret literal', /["'][0-9a-f]{40,}["']/],
      ['inline secret assignment', /(?:secret|token|password|api[_-]?key)\s*[:=]\s*["'][^"'{$][^"']{12,}["']/i],
    ] as [string, RegExp][]) {
      assert.ok(!pattern.test(source), `${file} contains a ${label}`)
    }
  }
})

/**
 * A config that resolves is a config that can be applied by accident. Every
 * placeholder host must be unroutable.
 */
test('no adapter config points at a resolvable host that could silently deploy', () => {
  const live: string[] = []
  for (const file of configFiles()) {
    for (const match of read(file).matchAll(/https?:\/\/([A-Za-z0-9._-]+)/g)) {
      const host = match[1].toLowerCase()
      const safe = host.endsWith('.invalid')
        || host === 'localhost'
        || host === 'host.docker.internal'
        || host === '127.0.0.1'
        || host === '0.0.0.0'
        || host.endsWith('.example.com')
        || host === 'example.com'
        || host === 'apigee.googleapis.com' // documented management API, in a README command
      if (!safe) live.push(`${file}: ${host}`)
    }
  }
  assert.deepEqual(live, [], `adapter configs reference routable hosts: ${live.join(', ')}`)
})

test('the Cloudflare worker cannot deploy a route as committed', () => {
  const toml = read('integrations/cloudflare-workers/wrangler.toml')
  // A live routes block would publish on the next `wrangler deploy`.
  assert.ok(!/^\s*\[\[routes\]\]/m.test(toml), 'wrangler.toml has an uncommented routes block')
  assert.match(toml, /#\s*\[\[routes\]\]/, 'the commented routes example was removed')
  assert.ok(!toml.includes('MAHA_CONTEXT_INTERCEPTOR_SECRET ='), 'the secret is a var rather than a wrangler secret')
  assert.match(toml, /wrangler secret put MAHA_CONTEXT_INTERCEPTOR_SECRET/)
})

test('the Kong declarative config carries no secret and no real upstream', () => {
  const declarative = read('integrations/kong/kong.declarative.yaml')
  assert.match(declarative, /secret_env:\s*MAHA_CONTEXT_INTERCEPTOR_SECRET/)
  assert.ok(!/\bsecret:\s*\S/.test(declarative), 'a literal secret field is present')
  assert.match(declarative, /llm-upstream\.invalid/)

  const schema = read('integrations/kong/schema.lua')
  assert.ok(!/\{\s*secret\s*=/.test(schema), 'the schema accepts an inline secret')
  assert.match(schema, /secret_env/)
})

test('the Kong plugin fails closed and never logs a body', () => {
  const handler = read('integrations/kong/maha-context-compiler.lua')
  assert.match(handler, /kong\.response\.exit/)
  assert.match(handler, /x-maha-compiled/)
  assert.match(handler, /os\.getenv/)
  // Any logging at all is a risk here; the plugin does none.
  assert.ok(!/kong\.log|ngx\.log|print\(/.test(handler), 'the Kong plugin logs')
})

test('the Apigee bundle keeps credentials in a KVM, not in the bundle', () => {
  const callout = read('integrations/apigee/sharedflowbundle/policies/SC-MahaCompile.xml')
  assert.match(callout, /\{private\.maha\.interceptor\.secret\}/)
  assert.match(callout, /\{private\.maha\.compiler\.url\}/)
  assert.match(callout, /io\.timeout\.millis/)
  // The flow must refuse anything that did not compile.
  const flow = read('integrations/apigee/sharedflowbundle/sharedflows/default.xml')
  assert.match(flow, /RF-MahaFailClosed/)
  assert.match(flow, /maha\.compile\.ok != "true"/)
  for (const resource of ['maha-prepare.js', 'maha-apply.js']) {
    const source = read(`integrations/apigee/resources/jsc/${resource}`)
    assert.ok(!/console\.log|print\(/.test(source), `${resource} logs`)
  }
})

test('the Worker never logs and never forwards the interceptor secret', () => {
  const worker = read('integrations/cloudflare-workers/src/worker.ts')
  assert.ok(!/console\.(log|info|warn|error|debug)/.test(worker), 'the Worker logs')
  assert.match(worker, /AbortSignal\.timeout/, 'no timeout on the compiler call')
  assert.match(worker, /compiler_unavailable/)
  // The secret goes to the compiler only. The forward() header allow-list must
  // not include it.
  const forwardBlock = worker.slice(worker.indexOf('async function forward('))
  assert.ok(!forwardBlock.includes('MAHA_CONTEXT_INTERCEPTOR_SECRET'), 'the Worker forwards the interceptor secret upstream')
  assert.match(forwardBlock, /'authorization'/)
})

test('every adapter fails closed on an unavailable compiler', () => {
  for (const [file, marker] of [
    ['integrations/kong/maha-context-compiler.lua', /compiler_unavailable/],
    ['integrations/cloudflare-workers/src/worker.ts', /compiler_unavailable/],
    ['integrations/apigee/resources/jsc/maha-apply.js', /compiler_unavailable/],
  ] as [string, RegExp][]) {
    assert.match(read(file), marker, `${file} has no unavailable-compiler path`)
  }
  // And none of them has a passthrough-on-error escape hatch.
  for (const file of configFiles()) {
    assert.ok(!/passthroughOnError["']?\s*[:=]\s*true/i.test(read(file)), `${file} passes through on error`)
  }
})

test('every adapter honours the compiled marker for idempotence', () => {
  for (const file of [
    'integrations/kong/maha-context-compiler.lua',
    'integrations/cloudflare-workers/src/worker.ts',
    'integrations/apigee/resources/jsc/maha-prepare.js',
  ]) {
    assert.match(read(file), /x-maha-compiled/, `${file} does not check the compiled marker`)
  }
})

test('the WSO2 evaluation artifacts referenced by its README still exist', () => {
  for (const path of [
    'content/integrations/wso2-policy-bundle/bundle.json',
    'content/integrations/wso2-reproduction.json',
    'content/integrations/wso2-live-evaluation-evidence.json',
    'docs/integrations/wso2-context-interceptor.md',
  ]) {
    assert.ok(existsSync(join(ROOT, path)), `the WSO2 adapter references a missing artifact: ${path}`)
  }
})
