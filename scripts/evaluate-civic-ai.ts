import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { evaluateCivicAi } from '../lib/civic/evaluation.ts'

const files = ['lib/civic/evaluation.ts', 'lib/civic/townhall-agent.ts', 'lib/civic/policy-graph.ts', 'lib/civic/workspace-engine.ts', 'lib/civic/workspace-types.ts', 'lib/civic/ai-safety.ts']
const hash = createHash('sha256')
for (const path of files) { hash.update(path); hash.update(await readFile(path)) }
const report = await evaluateCivicAi({ codeDigest: hash.digest('hex') })
const directory = 'public/civic/evaluations'
await mkdir(directory, { recursive: true })
const json = `${JSON.stringify(report, null, 2)}\n`
await writeFile(`${directory}/${report.runAt.replaceAll(':', '-')}-${report.digest.slice(0, 12)}.json`, json)
await writeFile(`${directory}/latest.json`, json)
console.log(`Civic AI evaluation: ${report.passed}/${report.total}; scope=${report.scope}; digest=${report.digest}`)
if (report.passed !== report.total) process.exitCode = 1
