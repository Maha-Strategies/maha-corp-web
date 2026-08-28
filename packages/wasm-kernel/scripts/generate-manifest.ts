import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const digest = (path: string): string => `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`
const lock = JSON.parse(readFileSync(resolve(root, '../../package-lock.json'), 'utf8')) as { packages?: Record<string, { version?: string }> }
const compilerVersion = lock.packages?.['node_modules/assemblyscript']?.version
if (!compilerVersion) throw new Error('AssemblyScript compiler version is missing from the root lockfile.')

const manifest = {
  schemaVersion: 'maha-wasm-kernel-manifest/1.0',
  kernelVersion: '0.2.0',
  abi: 'wasm-i64-fixed-point',
  compiler: { name: 'assemblyscript', version: compilerVersion, flags: ['--optimize', '--runtime=stub', '--exportRuntime'] },
  arithmetic: { integerModel: 'signed-i64', rounding: 'nearest-ties-to-even', overflow: 'abort' },
  sourceSha256: digest(resolve(root, 'assembly/index.ts')),
  conformanceSha256: digest(resolve(root, 'conformance/vectors.json')),
  kernelSha256: digest(resolve(root, 'dist/kernel.wasm')),
}
writeFileSync(resolve(root, 'conformance/kernel-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
