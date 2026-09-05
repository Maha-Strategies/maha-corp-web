import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { adjudicateSemantics, buildDependencyGraph, calibrateDemand, selectTrancheOne, type CandidateMap, type GscPage, type GscQuery, type GscSnapshot } from '../lib/federation-4000-adjudication.ts'
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import type { FrozenBaseline } from '../lib/federation-4000-plan.ts'

const ROOT = resolve(import.meta.dirname, '..')
const DEFAULT_SNAPSHOT = resolve(ROOT, 'content/federation/federation-gsc-demand-snapshot-v1.json')

function argument(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function csvRows(value: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!
    if (quoted && character === '"' && value[index + 1] === '"') { cell += '"'; index += 1; continue }
    if (character === '"') { quoted = !quoted; continue }
    if (!quoted && character === ',') { row.push(cell); cell = ''; continue }
    if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && value[index + 1] === '\n') index += 1
      row.push(cell)
      if (row.some((entry) => entry.trim())) rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += character
  }
  if (quoted) throw new Error('Unclosed quoted value in GSC CSV.')
  row.push(cell)
  if (row.some((entry) => entry.trim())) rows.push(row)
  return rows
}

function numeric(value: string, field: string): number {
  const result = Number(value.replace('%', '').trim())
  if (!Number.isFinite(result) || result < 0) throw new Error(`Invalid ${field}: ${value}`)
  return result
}

function extract(archive: string, name: string): string {
  return execFileSync('unzip', ['-p', archive, name], { encoding: 'utf8', maxBuffer: 2_000_000 })
}

function parseQueries(csv: string): GscQuery[] {
  const [header, ...rows] = csvRows(csv)
  if (header?.map((value) => value.trim()).join('|') !== 'Top queries|Clicks|Impressions|CTR|Position') throw new Error('Unexpected Queries.csv header.')
  return rows.map((row) => {
    if (row.length !== 5) throw new Error('Unexpected Queries.csv row width.')
    return { query: row[0]!.trim().replace(/\s+/g, ' '), clicks: numeric(row[1]!, 'query clicks'), impressions: numeric(row[2]!, 'query impressions'), ctr: numeric(row[3]!, 'query CTR'), position: numeric(row[4]!, 'query position') }
  })
}

function parsePages(csv: string): GscPage[] {
  const [header, ...rows] = csvRows(csv)
  if (header?.map((value) => value.trim()).join('|') !== 'Top pages|Clicks|Impressions|CTR|Position') throw new Error('Unexpected Pages.csv header.')
  return rows.map((row) => {
    if (row.length !== 5) throw new Error('Unexpected Pages.csv row width.')
    const url = row[0]!.trim()
    if (new URL(url).protocol !== 'https:') throw new Error(`GSC page is not HTTPS: ${url}`)
    return { url, clicks: numeric(row[1]!, 'page clicks'), impressions: numeric(row[2]!, 'page impressions'), ctr: numeric(row[3]!, 'page CTR'), position: numeric(row[4]!, 'page position') }
  })
}

export function snapshotFromArchive(archivePath: string): GscSnapshot {
  const archive = resolve(archivePath)
  const chart = csvRows(extract(archive, 'Chart.csv')).slice(1)
  const filters = extract(archive, 'Filters.csv')
  if (!filters.includes('Search type,Web')) throw new Error('Only the reviewed Web Search export is accepted.')
  const dates = chart.map((row) => row[0]!).sort()
  const body = {
    schemaVersion: 'maha-federation-gsc-demand-snapshot/1.0' as const,
    exportedOn: '2026-08-28',
    window: { start: dates[0]!, end: dates.at(-1)!, searchType: 'Web' as const },
    archiveSha256: `sha256:${createHash('sha256').update(readFileSync(archive)).digest('hex')}`,
    sourceCounts: { queryRows: 0, pageRows: 0 },
    queries: parseQueries(extract(archive, 'Queries.csv')),
    pages: parsePages(extract(archive, 'Pages.csv')),
  }
  body.sourceCounts = { queryRows: body.queries.length, pageRows: body.pages.length }
  if (body.window.start !== '2026-08-20') throw new Error(`Unexpected GSC window start: ${body.window.start}`)
  if (body.window.end !== '2026-08-26') throw new Error(`Unexpected GSC window end: ${body.window.end}`)
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

export function generateTrancheOne(options: { outputRoot: string; snapshot: GscSnapshot }) {
  const outputRoot = resolve(options.outputRoot)
  const baseline = JSON.parse(readFileSync(resolve(ROOT, 'content/federation/federation-route-baseline-v1.json'), 'utf8')) as FrozenBaseline
  const candidateMap = JSON.parse(readFileSync(resolve(ROOT, 'content/federation/federation-route-candidates-v1.json'), 'utf8')) as CandidateMap
  const semantic = adjudicateSemantics(candidateMap, baseline)
  const demand = calibrateDemand(candidateMap, options.snapshot)
  const graph = buildDependencyGraph(candidateMap, semantic)
  const cohort = selectTrancheOne(candidateMap, semantic, graph, demand)
  const artifacts = [
    ['content/federation/federation-gsc-demand-snapshot-v1.json', options.snapshot],
    ['content/federation/federation-semantic-adjudication-v1.json', semantic],
    ['content/federation/federation-gsc-demand-calibration-v1.json', demand],
    ['content/federation/federation-dependency-graph-v1.json', graph],
    ['content/federation/federation-tranche-1-cohort-v1.json', cohort],
  ] as const
  for (const [relative, value] of artifacts) writeJson(resolve(outputRoot, relative), value)
  return { semantic, demand, graph, cohort, artifacts: artifacts.map(([relative]) => relative) }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const outputRoot = resolve(argument('output-root') ?? ROOT)
  const archive = argument('gsc-archive')
  const snapshotPath = resolve(argument('gsc-snapshot') ?? DEFAULT_SNAPSHOT)
  if (!archive && !existsSync(snapshotPath)) throw new Error('Provide --gsc-archive=<zip> for the initial freeze or --gsc-snapshot=<json> for regeneration.')
  const snapshot = archive ? snapshotFromArchive(archive) : JSON.parse(readFileSync(snapshotPath, 'utf8')) as GscSnapshot
  if (provenanceDigest(snapshot) !== snapshot.provenanceDigest) throw new Error('GSC snapshot digest does not verify.')
  const result = generateTrancheOne({ outputRoot, snapshot })
  console.log(JSON.stringify({
    semanticCounts: result.semantic.counts,
    demandCounts: result.demand.counts,
    graphCounts: result.graph.counts,
    cohortCounts: result.cohort.counts,
    digests: { semantic: result.semantic.provenanceDigest, demand: result.demand.provenanceDigest, graph: result.graph.provenanceDigest, cohort: result.cohort.provenanceDigest },
  }, null, 2))
}
