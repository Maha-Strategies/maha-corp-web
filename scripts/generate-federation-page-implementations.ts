import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { compileFederationPages } from '../lib/federation-page-implementation.ts'

const ROOT = resolve(import.meta.dirname, '..')

function argument(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T
}

function verified<T extends { provenanceDigest: string }>(path: string): T {
  const value = readJson<T>(path)
  if (provenanceDigest(value) !== value.provenanceDigest) throw new Error(`Input digest does not verify: ${path}`)
  return value
}

function writeJson(root: string, path: string, value: unknown) {
  const output = resolve(root, path)
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`)
}

function implementationReport(result: ReturnType<typeof compileFederationPages>) {
  const counts = result.registry.counts
  const held = result.registry.entries.filter((entry) => entry.adoptionState === 'blocked-on-unready-prerequisite')
  return `${[
    '# Federation Tranches 1–2 local implementation',
    '',
    `Status: **${result.registry.status}**`,
    '',
    '## Outcome',
    '',
    `All **${counts.pages} evidence-ready specifications** now have deterministic, host-specific content implementations containing ${counts.boundedAnswers} bounded answers and ${counts.sourceBindings} source bindings.`,
    '',
    `**${counts.readyForOwnerIntegration}** can enter their owning property’s integration workflow. **${counts.blockedOnUnreadyPrerequisite}** are fully compiled but held because a required definition is not evidence-ready.`,
    '',
    '| Property | Compiled |',
    '| --- | ---: |',
    ...Object.entries(counts.byProperty).map(([siteId, count]) => `| ${siteId} | ${count} |`),
    '',
    '## Dependency hold',
    '',
    held.length
      ? `The ${held.length} held pages depend on an unready candidate definition. The dependency is retained as a blocker and omitted from public related links; it is never treated as an existing route.`
      : 'No implementation is held on an unready dependency.',
    '',
    ...held.map((entry) => `- \`${entry.canonicalUrl}\``),
    '',
    '## Publication boundary',
    '',
    result.registry.releaseBoundary,
    '',
    `Registry digest: \`${result.registry.provenanceDigest}\``,
    '',
  ].join('\n')}\n`
}

export function generateFederationPageImplementations(outputRoot: string) {
  type Input = Parameters<typeof compileFederationPages>[0]
  const candidateMap = verified<Input['candidateMap']>('content/federation/federation-route-candidates-v1.json')
  const tranches: Input['tranches'] = [1, 2].map((tranche) => ({
    tranche: tranche as 1 | 2,
    decisions: verified<Input['tranches'][number]['decisions']>(`content/federation/federation-tranche-${tranche}-decisions-v1.json`),
    specifications: verified<Input['tranches'][number]['specifications']>(`content/federation/federation-tranche-${tranche}-page-specifications-v1.json`),
    packets: verified<Input['tranches'][number]['packets']>(`content/federation/federation-tranche-${tranche}-evidence-packets-v1.json`),
  }))
  const result = compileFederationPages({ candidateMap, tranches })
  const artifacts: string[] = []
  const registryPath = 'content/federation/implementations/federation-page-implementation-registry-v1.json'
  writeJson(outputRoot, registryPath, result.registry)
  artifacts.push(registryPath)
  for (const manifest of result.propertyManifests) {
    const path = `content/federation/implementations/${manifest.siteId}-pages-v1.json`
    writeJson(outputRoot, path, manifest)
    artifacts.push(path)
  }
  const reportPath = 'docs/federation/federation-tranches-1-2-local-implementation.md'
  const reportOutput = resolve(outputRoot, reportPath)
  mkdirSync(dirname(reportOutput), { recursive: true })
  writeFileSync(reportOutput, implementationReport(result))
  artifacts.push(reportPath)
  return { ...result, artifacts }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const result = generateFederationPageImplementations(resolve(argument('output-root') ?? ROOT))
  console.log(JSON.stringify({ counts: result.registry.counts, registryDigest: result.registry.provenanceDigest, artifacts: result.artifacts }, null, 2))
}
