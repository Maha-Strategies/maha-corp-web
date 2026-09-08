import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { propertyAdapterContract, type PropertyManifest } from '../lib/federation-property-adapter.ts'
import { SITE_CONTRACTS } from '../lib/federation-4000-plan.ts'

const ROOT = resolve(import.meta.dirname, '..')

function argument(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T
}

function write(outputRoot: string, path: string, value: string) {
  const target = resolve(outputRoot, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, value)
}

export function generateFederationPropertyAdapters(outputRoot: string) {
  const contracts = SITE_CONTRACTS.map(({ siteId }) => {
    const manifest = readJson<PropertyManifest>(`content/federation/implementations/${siteId}-pages-v1.json`)
    if (provenanceDigest(manifest) !== manifest.provenanceDigest) throw new Error(`Input manifest does not verify for ${siteId}.`)
    return propertyAdapterContract(manifest)
  })
  const body = {
    schemaVersion: 'maha-federation-property-route-adapter-registry/1.0',
    state: 'local-owner-handoff',
    counts: {
      properties: contracts.length,
      routes: contracts.reduce((sum, value) => sum + value.counts.routes, 0),
      boundedAnswers: contracts.reduce((sum, value) => sum + value.counts.boundedAnswers, 0),
      publicRoutesCreated: 0,
      buildsRun: 0,
    },
    contracts: contracts.map((value) => ({ siteId: value.siteId, canonicalHost: value.canonicalHost, rootPath: value.rootPath, routes: value.counts.routes, boundedAnswers: value.counts.boundedAnswers, contractDigest: value.provenanceDigest })),
    buildBoundary: 'No Next.js or Vercel build is authorized by this registry. Each owner must install its adapter, bind exact-revision review and canonical release, and obtain explicit build authorization.',
  }
  const registry = { ...body, provenanceDigest: provenanceDigest(body) }
  const paths: string[] = []
  for (const contract of contracts) {
    const path = `content/federation/adapters/${contract.siteId}-route-adapter-v1.json`
    write(outputRoot, path, `${JSON.stringify(contract, null, 2)}\n`)
    paths.push(path)
  }
  const registryPath = 'content/federation/adapters/federation-property-route-adapter-registry-v1.json'
  write(outputRoot, registryPath, `${JSON.stringify(registry, null, 2)}\n`)
  paths.push(registryPath)
  const reportPath = 'docs/federation/federation-property-adapter-readiness.md'
  write(outputRoot, reportPath, `${[
    '# Federation property adapter readiness',
    '',
    `Status: **${registry.state}**`,
    '',
    `Seven owner-specific adapter contracts cover **${registry.counts.routes} local routes** and **${registry.counts.boundedAnswers} bounded answers**. They do not create a route on any property by themselves.`,
    '',
    '| Property | Route root | Ready contracts |',
    '| --- | --- | ---: |',
    ...contracts.map((value) => `| ${value.siteId} | \`${value.rootPath}\` | ${value.counts.routes} |`),
    '',
    '## Required owner integration',
    '',
    'Each property installs its own catch-all route under the stated root, obtains static parameters from the contract, disables unspecified dynamic parameters, resolves exact content by path, returns not-found for absent or unready content, and derives metadata plus structured data from the same exact page object.',
    '',
    '## Release boundary',
    '',
    registry.buildBoundary,
    '',
    `Registry digest: \`${registry.provenanceDigest}\``,
  ].join('\n')}\n`)
  paths.push(reportPath)
  return { contracts, registry, paths }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const result = generateFederationPropertyAdapters(resolve(argument('output-root') ?? ROOT))
  console.log(JSON.stringify({ counts: result.registry.counts, registryDigest: result.registry.provenanceDigest, artifacts: result.paths }, null, 2))
}
