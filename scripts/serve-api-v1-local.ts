import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { localOnlyEnvironment } from './lib/api-v1-local-only-environment.ts'
import { MAHA_PAYEE } from '../lib/x402/merchant-identity.ts'
const port = process.argv[2] ?? '8794'
if (!/^\d{4,5}$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw Error('invalid_local_port')
const env: NodeJS.ProcessEnv = { ...localOnlyEnvironment(), NODE_ENV: 'development' }
// Next loads dotenv files itself. Blank only credential/network keys in the
// inherited environment so those files cannot re-enable hosted services.
// No dotenv values are logged, copied to artifacts or transmitted.
for (const name of ['.env', '.env.local', '.env.development', '.env.development.local']) {
  if (!existsSync(name)) continue
  for (const line of readFileSync(name, 'utf8').split('\n')) {
    const key = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1]
    if (key && localOnlyEnvironment({ [key]: 'probe' })[key] === undefined) env[key] = ''
  }
}
env.X402_ENABLED = 'false'; env.X402_FACILITATOR_URL = 'https://facilitator.invalid'
env.BASE_PAYEE_ADDRESS = MAHA_PAYEE
// The local verification checkout shares node_modules through a symlink;
// webpack supports that layout without widening Turbopack's filesystem root.
const child = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', port], { env, stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => child.kill(signal))
child.once('exit', code => { process.exitCode = code ?? 1 })
