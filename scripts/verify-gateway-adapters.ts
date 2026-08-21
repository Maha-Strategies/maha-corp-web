/**
 * One command that proves the gateway adapters hold together.
 *
 * Runs the contract tests, the static artifact checks and a configuration
 * validation pass. Needs no credential, contacts no gateway, and makes no
 * provider call -- so it is safe in CI and safe on a laptop that has never
 * seen a secret.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  GATEWAY_CONTRACT_VERSION,
  GATEWAY_DEFAULT_MAX_BODY_BYTES,
  GATEWAY_DEFAULT_MINIMUM_COMPILE_TOKENS,
  GATEWAY_DEFAULT_TIMEOUT_MS,
  GATEWAY_POLICY_VERSION,
} from '../lib/integrations/gateway-context-contract.ts'

const ROOT = join(import.meta.dirname, '..')
const ADAPTERS = ['gateway-contract', 'wso2', 'kong', 'apigee', 'cloudflare-workers'] as const

const REQUIRED_ARTIFACTS: Record<string, string[]> = {
  'gateway-contract': ['README.md'],
  wso2: ['README.md'],
  kong: ['README.md', 'maha-context-compiler.lua', 'schema.lua', 'kong.declarative.yaml', 'docker-compose.yaml'],
  apigee: [
    'README.md',
    'sharedflowbundle/maha-context-compiler.xml',
    'sharedflowbundle/sharedflows/default.xml',
    'sharedflowbundle/policies/SC-MahaCompile.xml',
    'sharedflowbundle/policies/RF-MahaFailClosed.xml',
    'resources/jsc/maha-prepare.js',
    'resources/jsc/maha-apply.js',
  ],
  'cloudflare-workers': ['README.md', 'wrangler.toml', 'src/worker.ts'],
}

const failures: string[] = []

for (const adapter of ADAPTERS) {
  for (const artifact of REQUIRED_ARTIFACTS[adapter]) {
    if (!existsSync(join(ROOT, 'integrations', adapter, artifact))) {
      failures.push(`missing artifact: integrations/${adapter}/${artifact}`)
    }
  }
}

// The four gateways must agree on the header contract. A renamed header in one
// adapter is a silent contract break everywhere else.
const CONTRACT_HEADERS = [
  'x-maha-compiled', 'x-maha-input-hash', 'x-maha-output-hash',
  'x-maha-token-budget', 'x-maha-retained-passages', 'x-maha-source-coverage-bps', 'x-maha-policy-version',
]
for (const [adapter, file] of [
  ['kong', 'integrations/kong/maha-context-compiler.lua'],
  ['apigee', 'integrations/apigee/resources/jsc/maha-apply.js'],
  ['cloudflare-workers', 'integrations/cloudflare-workers/src/worker.ts'],
] as [string, string][]) {
  const source = readFileSync(join(ROOT, file), 'utf8')
  for (const header of CONTRACT_HEADERS) {
    if (!source.includes(header)) failures.push(`${adapter} does not carry ${header}`)
  }
}

const run = (label: string, args: string[]): void => {
  try {
    execFileSync('node', args, { cwd: ROOT, stdio: 'pipe' })
  } catch (error) {
    const detail = error instanceof Error && 'stdout' in error ? String((error as { stdout: Buffer }).stdout) : ''
    failures.push(`${label} failed\n${detail.split('\n').filter((line) => line.startsWith('✖') || line.startsWith('  ')).slice(0, 12).join('\n')}`)
  }
}

run('contract tests', ['--test', '--experimental-strip-types', 'test/gateway-context-contract.test.ts'])
run('adapter artifact checks', ['--test', '--experimental-strip-types', 'test/gateway-adapter-artifacts.test.ts'])
run('WSO2 interceptor contract', ['--test', '--experimental-strip-types', 'test/wso2-context-interceptor.test.ts'])

if (failures.length > 0) {
  for (const failure of failures) console.error(failure)
  process.exit(1)
}

console.log(JSON.stringify({
  status: 'valid',
  contractVersion: GATEWAY_CONTRACT_VERSION,
  policyVersion: GATEWAY_POLICY_VERSION,
  adapters: ADAPTERS,
  defaults: {
    maxBodyBytes: GATEWAY_DEFAULT_MAX_BODY_BYTES,
    timeoutMs: GATEWAY_DEFAULT_TIMEOUT_MS,
    minimumCompileTokens: GATEWAY_DEFAULT_MINIMUM_COMPILE_TOKENS,
  },
  credentialsUsed: false,
  gatewaysContacted: 0,
  providerCallsMade: 0,
}, null, 2))
