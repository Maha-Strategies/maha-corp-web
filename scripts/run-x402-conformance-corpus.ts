import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { runConformanceCorpus, validateConformanceCorpus } from '../lib/x402/conformance.ts'

type Options = { corpusPath: string; fixture?: string; json: boolean; list: boolean }

export function parseConformanceArgs(argv: string[]): Options {
  const options: Options = {
    corpusPath: resolve('public/conformance/x402-v2/corpus.json'),
    json: false,
    list: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--json') options.json = true
    else if (argument === '--list') options.list = true
    else if (argument === '--corpus') {
      const path = argv[++index]
      if (!path) throw new Error('--corpus requires a path.')
      options.corpusPath = resolve(path)
    } else if (argument === '--fixture') {
      const id = argv[++index]
      if (!id) throw new Error('--fixture requires an id.')
      options.fixture = id
    } else throw new Error(`Unknown argument: ${argument}`)
  }
  return options
}

async function main(): Promise<void> {
  const options = parseConformanceArgs(process.argv.slice(2))
  const corpus = JSON.parse(await readFile(options.corpusPath, 'utf8')) as unknown
  validateConformanceCorpus(corpus)

  if (options.list) {
    for (const fixture of corpus.fixtures) console.log(`${fixture.id}\t${fixture.title}`)
    return
  }

  const selected = options.fixture
    ? { ...corpus, fixtures: corpus.fixtures.filter((fixture) => fixture.id === options.fixture) }
    : corpus
  if (selected.fixtures.length === 0) throw new Error(`Fixture not found: ${options.fixture}`)

  const results = await runConformanceCorpus(selected)
  const failed = results.filter((result) => !result.passed)
  if (options.json) {
    console.log(JSON.stringify({
      schemaVersion: '1.0.0',
      corpusVersion: corpus.corpusVersion,
      passed: failed.length === 0,
      summary: { total: results.length, passed: results.length - failed.length, failed: failed.length },
      results,
    }, null, 2))
  } else {
    console.log(`x402 v2 conformance corpus ${corpus.corpusVersion}`)
    for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'}  ${result.id}  ${result.actual.code}`)
    console.log(`\n${results.length - failed.length}/${results.length} fixtures passed.`)
  }
  if (failed.length > 0) process.exitCode = 1
}

if (process.argv[1]?.endsWith('run-x402-conformance-corpus.ts')) {
  main().catch((error) => {
    console.error(`x402 conformance runner failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
