import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, normalize } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

import {
  buildWso2ReproductionStages,
  loadAndValidateWso2Reproduction,
  sha256File,
  validateWso2LiveEnvironment,
  type Wso2ReproductionOptions,
} from '../lib/integrations/wso2-reproduction.ts'
import { parseUsdToMicrodollars } from '../lib/integrations/wso2-evaluation-harness.ts'

function argumentValue(argv: string[], name: string): string | undefined {
  return argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1)
}

export function parseWso2ReproductionArgs(argv: string[], defaultOutputDirectory: string): Wso2ReproductionOptions {
  const execute = argv.includes('--execute')
  const maxProviderCostUsd = argumentValue(argv, '--max-provider-cost-usd')
  const unknown = argv.filter((argument) => ![
    '--execute',
    '--skip-gateway-import',
  ].includes(argument) && !argument.startsWith('--max-provider-cost-usd=') && !argument.startsWith('--output-directory='))
  if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`)
  if (!execute && maxProviderCostUsd !== undefined) throw new Error('--max-provider-cost-usd is only valid with --execute.')
  if (!execute && argv.includes('--skip-gateway-import')) throw new Error('--skip-gateway-import is only valid with --execute.')
  if (execute && maxProviderCostUsd === undefined) {
    throw new Error('--execute requires --max-provider-cost-usd=<exact dollars>.')
  }
  if (maxProviderCostUsd !== undefined) parseUsdToMicrodollars(maxProviderCostUsd)
  const requestedOutput = argumentValue(argv, '--output-directory')
    ?? join(defaultOutputDirectory, execute ? 'live' : 'dry-run')
  const outputDirectory = normalize(requestedOutput)
  if (isAbsolute(requestedOutput) || outputDirectory === 'artifacts/wso2' || !outputDirectory.startsWith(`artifacts/wso2/`)) {
    throw new Error('--output-directory must stay beneath artifacts/wso2/.')
  }
  return {
    execute,
    skipGatewayImport: argv.includes('--skip-gateway-import'),
    maxProviderCostUsd,
    outputDirectory,
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function safeArtifact(path: string) {
  try {
    const bytes = readFileSync(path)
    return { path, bytes: bytes.length, sha256: sha256File(path) }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { path, present: false }
    throw error
  }
}

async function run(): Promise<void> {
  const loaded = loadAndValidateWso2Reproduction()
  const options = parseWso2ReproductionArgs(process.argv.slice(2), loaded.contract.outputs.directory)
  const environment = options.execute ? validateWso2LiveEnvironment(process.env) : process.env
  const stages = buildWso2ReproductionStages(loaded.contract, options)
  const runManifestPath = join(options.outputDirectory, loaded.contract.outputs.runManifest)
  const stageResults: { id: string; status: 'pending' | 'running' | 'passed' | 'failed'; exitCode?: number }[] = stages.map((stage) => ({ id: stage.id, status: 'pending' }))
  const startedAt = new Date().toISOString()

  const persistManifest = (status: 'running' | 'passed' | 'failed') => {
    const artifacts = [
      loaded.contract.outputs.comparison,
      loaded.contract.outputs.checkpoint,
      loaded.contract.outputs.blindedAnswers,
      loaded.contract.outputs.blindingKey,
    ].map((name) => safeArtifact(join(options.outputDirectory, name)))
    writeJson(runManifestPath, {
      schemaVersion: '1.0.0',
      suiteId: loaded.contract.suiteId,
      status,
      mode: options.execute ? 'live' : 'dry-run',
      startedAt,
      updatedAt: new Date().toISOString(),
      liveProviderCallsPermitted: options.execute,
      maximumProviderCostUsd: options.maxProviderCostUsd ?? null,
      automaticRetries: 0,
      corpus: {
        path: loaded.contract.corpus.path,
        labelFreezeDigest: loaded.corpus.labelFreeze.digest,
        workloads: loaded.corpus.workloads.length,
        requiredFacts: loaded.requiredFactCount,
        expectedCitations: loaded.expectedCitationCount,
      },
      gateway: {
        product: loaded.contract.gateway.product,
        version: loaded.contract.gateway.version,
        promptCompressor: loaded.contract.gateway.promptCompressor,
        mahaInterceptor: loaded.contract.gateway.mahaInterceptor,
      },
      provider: loaded.contract.provider,
      inputFileDigests: loaded.fileDigests,
      runtime: { node: process.version, platform: process.platform, architecture: process.arch },
      stages: stageResults,
      artifacts,
      limitations: loaded.contract.limitations,
    })
  }

  persistManifest('running')
  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index]
    stageResults[index].status = 'running'
    persistManifest('running')
    console.log(`\n[WSO2 reproduction] ${stage.id}`)
    const result = spawnSync(stage.command, stage.args, {
      cwd: process.cwd(),
      env: environment,
      stdio: 'inherit',
    })
    const exitCode = result.status ?? 1
    stageResults[index] = { id: stage.id, status: exitCode === 0 ? 'passed' : 'failed', exitCode }
    if (result.error) console.error(result.error.message)
    if (exitCode !== 0) {
      persistManifest('failed')
      throw new Error(`${stage.id} failed with exit code ${exitCode}. No later stage was run.`)
    }
    persistManifest('running')
  }
  persistManifest('passed')
  console.log(JSON.stringify({
    status: 'passed',
    mode: options.execute ? 'live' : 'dry-run',
    suiteId: loaded.contract.suiteId,
    workloads: loaded.corpus.workloads.length,
    plannedCalls: loaded.corpus.workloads.length * loaded.contract.gateway.paths.length,
    runManifest: runManifestPath,
  }, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : error)
    process.exitCode = 1
  })
}
