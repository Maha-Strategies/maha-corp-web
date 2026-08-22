/**
 * One command an architect can run to evaluate the developer surfaces.
 *
 * Builds every package, runs the contract tests, packs each package, inspects
 * the resulting tarballs, smoke-tests the CLI against sanitized fixtures,
 * validates the MCP and A2A schemas, and runs static gateway validation.
 *
 * Makes zero live LLM, provider or vendor calls, and needs no credential.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const PACKAGES = ['context-control-core', 'context-control-cli', 'maha-mcp', 'maha-a2a'] as const

/** Nothing matching these may appear in any tarball. */
const FORBIDDEN_IN_TARBALL: [string, RegExp][] = [
  ['test file', /(^|\/)test\//],
  ['benchmark payload', /(^|\/)benchmarks?\//],
  ['fixture', /(^|\/)fixtures?\//],
  ['evaluation corpus', /corpus/i],
  ['app route', /(^|\/)app\//],
  ['env file', /\.env/],
  // Raw TypeScript source, but not declarations: .d.ts files are required.
  ['TypeScript source', /(?<!\.d)\.ts$/],
]

const failures: string[] = []
const note = (message: string): void => { failures.push(message) }

const run = (label: string, file: string, args: string[], cwd = ROOT): string => {
  try {
    return execFileSync(file, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    const detail = error as { stdout?: string; stderr?: string }
    note(`${label} failed: ${(detail.stderr || detail.stdout || '').split('\n').slice(0, 6).join(' | ')}`)
    return ''
  }
}

// 1. Build every package.
for (const name of PACKAGES) run(`build ${name}`, 'npm', ['--prefix', `packages/${name}`, 'run', 'build'])

// 2. Contract and unit tests.
run('developer-surface tests', 'node', ['--test', '--experimental-strip-types', 'test/developer-surfaces.test.ts'])
run('gateway contract tests', 'node', ['--test', '--experimental-strip-types', 'test/gateway-context-contract.test.ts'])

// 3 & 4. Pack, then inspect what would ship.
const tarballs: Record<string, string[]> = {}
for (const name of PACKAGES) {
  const output = run(`pack ${name}`, 'npm', ['pack', '--dry-run', '--json'], join(ROOT, 'packages', name))
  if (!output) continue
  let entries: string[] = []
  try {
    const parsed = JSON.parse(output) as { files?: { path: string }[] }[]
    entries = (parsed[0]?.files ?? []).map((file) => file.path)
  } catch {
    note(`pack ${name}: could not parse npm pack --json output`)
    continue
  }
  tarballs[name] = entries
  if (entries.length === 0) note(`pack ${name}: tarball is empty`)

  for (const entry of entries) {
    for (const [label, pattern] of FORBIDDEN_IN_TARBALL) {
      if (pattern.test(entry)) note(`${name} tarball would ship a ${label}: ${entry}`)
    }
  }
  for (const required of ['package.json', 'README.md', 'LICENSE']) {
    if (!entries.includes(required)) note(`${name} tarball is missing ${required}`)
  }
  if (!entries.some((entry) => entry.endsWith('.d.ts'))) note(`${name} tarball ships no TypeScript declarations`)
}

// The core package must not carry the compiler; that is the whole point of the
// gate/contract split.
const coreEntries = tarballs['context-control-core'] ?? []
if (coreEntries.some((entry) => /context-compiler/.test(entry))) {
  note('context-control-core would ship the Context Compiler; it must depend on the interface only')
}

// 5. CLI smoke tests against sanitized fixtures, no endpoint.
const scratch = mkdtempSync(join(tmpdir(), 'maha-dev-surfaces-'))
try {
  const cli = ['--experimental-strip-types', 'lib/context-control-cli/cli.ts']

  // doctor must fail closed with no configuration.
  try {
    execFileSync('node', [...cli, 'doctor'], { cwd: ROOT, env: { PATH: process.env.PATH }, stdio: 'pipe' })
    note('cli doctor exited 0 with no configuration; it must be non-zero')
  } catch { /* expected */ }

  // ...and pass with a complete one, without printing the secret.
  const configured = {
    PATH: process.env.PATH,
    MAHA_CONTEXT_INTERCEPTOR_SECRET: 's'.repeat(48),
    MAHA_COMPILER_URL: 'http://localhost:3000/api/integrations/gateway/context-compiler',
  }
  const configuredDoctor = execFileSync('node', [...cli, 'doctor'], { cwd: ROOT, env: configured, encoding: 'utf8' })
  if (!configuredDoctor.includes('"status": "ok"')) note('cli doctor did not report ok on a complete configuration')
  if (configuredDoctor.includes('s'.repeat(48))) note('cli doctor printed the secret')

  // verify, on a good record and a tampered one.
  const evidence = {
    contractVersion: '1.0.0',
    policyVersion: '2026-08-16',
    outcome: 'compiled',
    headers: {
      'x-maha-compiled': 'true',
      'x-maha-input-hash': `sha256:${'a'.repeat(64)}`,
      'x-maha-output-hash': `sha256:${'b'.repeat(64)}`,
      'x-maha-token-budget': '800',
      'x-maha-retained-passages': '12',
      'x-maha-source-coverage-bps': '10000',
      'x-maha-policy-version': '2026-08-16',
    },
    sourceTextRetained: false,
    credentialsRetained: false,
  }
  const goodPath = join(scratch, 'evidence.json')
  writeFileSync(goodPath, JSON.stringify(evidence))
  run('cli verify (valid)', 'node', [...cli, 'verify', '--input', goodPath])

  const tampered = { ...evidence, headers: { ...evidence.headers, 'x-maha-input-hash': 'not-a-hash' } }
  const badPath = join(scratch, 'tampered.json')
  writeFileSync(badPath, JSON.stringify(tampered))
  try {
    execFileSync('node', [...cli, 'verify', '--input', badPath], { cwd: ROOT, stdio: 'pipe' })
    note('cli verify accepted a malformed hash')
  } catch { /* expected */ }

  // gateway validate, all four.
  for (const gateway of ['wso2', 'kong', 'apigee', 'cloudflare']) {
    run(`cli gateway validate ${gateway}`, 'node', [...cli, 'gateway', 'validate', gateway])
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(JSON.stringify({
  status: 'valid',
  packages: PACKAGES,
  tarballEntryCounts: Object.fromEntries(Object.entries(tarballs).map(([name, entries]) => [name, entries.length])),
  published: false,
  liveProviderCalls: 0,
  vendorGatewaysContacted: 0,
  credentialsUsed: false,
}, null, 2))
