import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'

// A mechanical, allowlisted export. Never archive the checkout or .env files.
const root = await mkdtemp('/private/tmp/maha-context-package-')
const pkg = join(root, 'maha-context-workflow-v1')
const files = [
  'examples/context-growth/workflow.ts', 'examples/context-growth/run.ts',
  'examples/context-growth/measurement.ts', 'examples/context-growth/report.ts',
  'examples/context-growth/observations.empty.json',
  'test/context-growth-workflow.test.ts',
  'lib/context-compiler.ts', 'lib/context-pack-evaluator.ts',
  'lib/deep-context-evaluation.ts', 'lib/x402/client.ts',
]
const manifest: Record<string, string> = {}
async function emit(path: string, content: string) {
  await mkdir(dirname(join(pkg, path)), { recursive: true })
  await writeFile(join(pkg, path), content, { flag: 'wx' })
  manifest[path] = createHash('sha256').update(content).digest('hex')
}
for (const path of files) await emit(path, await readFile(path, 'utf8'))
const offers = await readFile('lib/x402/offers.ts', 'utf8')
assert.match(offers, /export const DEEP_CONTEXT_EVALUATION_OFFER: X402Offer = \{\s+id: 'deep-context-evaluation'/)
await emit('lib/x402/offers.ts', '// Packaging-only projection of the public offer ID. No algorithm replaced.\nexport const DEEP_CONTEXT_EVALUATION_OFFER = { id: "deep-context-evaluation" } as const\n')
await emit('package.json', JSON.stringify({ name: 'maha-context-workflow-example', private: true, version: '1.0.0', type: 'module', engines: { node: '>=22.18.0' }, scripts: { demo: 'node --experimental-strip-types examples/context-growth/run.ts', test: 'node --experimental-strip-types --test test/context-growth-workflow.test.ts', quotes: 'node --experimental-strip-types examples/context-growth/run.ts quotes' } }, null, 2))
await emit('README.md', await readFile('examples/context-growth/PACKAGE-README.md', 'utf8'))
await emit('MANIFEST.json', JSON.stringify({ version: 1, files: { ...manifest }, packagingNote: 'Only the public offer ID is projected to avoid shipping unrelated catalogue dependencies. All compiler/evaluator/client source is copied unchanged. No production secrets, correspondence, participant mappings or repository installation needed.' }, null, 2))
execFileSync(process.execPath, ['--experimental-strip-types', '--test', 'test/context-growth-workflow.test.ts'], { cwd: pkg, stdio: 'inherit' })
execFileSync(process.execPath, ['--experimental-strip-types', 'examples/context-growth/run.ts'], { cwd: pkg, stdio: 'inherit' })
const archive = join(root, 'maha-context-workflow-v1.tar.gz')
execFileSync('tar', ['-czf', archive, '-C', root, 'maha-context-workflow-v1'], { env: { ...process.env, COPYFILE_DISABLE: '1' } })
const bytes = await readFile(archive)
console.log(JSON.stringify({ archive, directory: pkg, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }))
