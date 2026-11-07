import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildContextProofFixture, validateContextProofFixture } from '../lib/context-proof-fixture.ts'
import { parseContextPackRequest } from '../lib/context-compiler.ts'

function argument(name: string): string | null {
  const inline = process.argv.find((value) => value.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3)
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

const inputPath = argument('input')
const outputPath = argument('output')
const fixtureId = argument('fixture-id')
const description = argument('description')

if (!inputPath || !outputPath || !fixtureId || !description) {
  throw new Error('Usage: npm run export:context-proof-sidecar -- --input request.json --output fixture.json --fixture-id <id> --description <text>')
}
if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(fixtureId)) throw new Error('fixture-id must be a lowercase, hyphenated identifier.')
if (description.length < 12 || description.length > 400) throw new Error('description must contain 12-400 characters.')

const request = parseContextPackRequest(JSON.parse(readFileSync(resolve(inputPath), 'utf8')))
const fixture = buildContextProofFixture({ fixtureId, description, request })
validateContextProofFixture(fixture)
writeFileSync(resolve(outputPath), `${JSON.stringify(fixture, null, 2)}\n`, { flag: 'wx' })

console.log(JSON.stringify({
  fixtureId,
  output: resolve(outputPath),
  proofStatus: fixture.proofDecision.status,
  retainedPassages: fixture.proofDecision.retainedPassageCount,
  shouldAttemptProof: fixture.proofDecision.shouldAttemptProof,
  chargePermitted: fixture.proofDecision.chargePermitted,
}, null, 2))
