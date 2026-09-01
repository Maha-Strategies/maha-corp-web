import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'

import frozen from '../content/batch-12b/frozen-cohort.json' with { type: 'json' }
import investigations from '../content/batch-12b/source-investigations.json' with { type: 'json' }
import packets from '../content/batch-12b/remediation-packets.json' with { type: 'json' }
import decisions from '../content/batch-12b/editorial-decisions.json' with { type: 'json' }
import batch12a from '../content/batch-12a/source-investigations.json' with { type: 'json' }
import capacity from '../content/scaling/capacity-model.json' with { type: 'json' }
import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }
import scopeImpact from '../content/batch-12/scope-join-impact.json' with { type: 'json' }
import { REVIEW_AXES } from '../lib/exact-revision-review.ts'

const ROOT = resolve(import.meta.dirname, '..')

test('the cohort was frozen before research and excludes Batch 12A', () => {
  assert.equal(frozen.frozenBeforeResearch, true)
  assert.equal(frozen.cohortSize, 15)
  const done = new Set([
    ...(batch12a.investigations as { recordId: string }[]).map((entry) => entry.recordId),
    ...(batch12a.unresolved as { recordId: string }[]).map((entry) => entry.recordId),
  ])
  for (const record of frozen.records as { recordId: string }[]) {
    assert.ok(!done.has(record.recordId), `${record.recordId} was already handled in Batch 12A`)
  }
})

test('the frozen cohort is exactly what was investigated: no substitution', () => {
  const frozenIds = new Set((frozen.records as { recordId: string }[]).map((entry) => entry.recordId))
  const investigated = new Set((packets.packets as { recordId: string }[]).map((entry) => entry.recordId))
  assert.deepEqual([...frozenIds].sort(), [...investigated].sort(),
    'a record was added or dropped after freezing')
})

test('every record is inspected or has a bounded, recorded retrieval failure', () => {
  for (const packet of packets.packets as Record<string, unknown>[]) {
    if (packet.contentInspected) {
      // A locator must exist and the depth it represents must be recorded.
      // "Abstract" is a legitimate locator; what matters is that the packet
      // then declares abstract depth rather than implying it read a section.
      assert.ok(String(packet.exactInspectedLocator ?? '').trim().length > 0, `${packet.recordId} lacks a locator`)
      assert.ok(['section-or-full-text', 'abstract-or-metadata-only'].includes(String(packet.inspectionDepth)),
        `${packet.recordId} must declare its inspection depth`)
      assert.ok(String(packet.rightsBasis ?? '').length > 8, `${packet.recordId} lacks a rights basis`)
      assert.ok(String(packet.doesNotEstablish ?? '').length > 10, `${packet.recordId} must state what the source does not establish`)
    } else {
      assert.ok(Array.isArray(packet.attemptedRoutes) && (packet.attemptedRoutes as unknown[]).length >= 1)
      assert.equal(packet.shortPassage, null, 'an uninspected record cannot carry a passage')
      assert.equal(packet.inspectionDepth, 'not-inspected')
    }
  }
})

test('quotations stay short', () => {
  for (const source of investigations.sources as { boundedPassage: string }[]) {
    assert.ok(source.boundedPassage.split(/\s+/).length <= 30, source.boundedPassage.slice(0, 40))
  }
})

test('abstract-depth inspection cannot approve passage support', () => {
  const shallow = (packets.packets as { recordId: string; inspectionDepth: string }[])
    .filter((packet) => packet.inspectionDepth === 'abstract-or-metadata-only')
  assert.ok(shallow.length > 0)
  const rows = decisions.decisions as { recordId: string; disposition: string }[]
  for (const packet of shallow) {
    for (const row of rows.filter((entry) => entry.recordId === packet.recordId)) {
      assert.equal(row.disposition, 'revise', `${packet.recordId} was inspected only at abstract depth`)
    }
  }
})

test('a subject mismatch is rejected, never narrowed', () => {
  const mismatched = (packets.packets as { recordId: string; subjectVerdict: string }[])
    .filter((packet) => packet.subjectVerdict === 'subject-mismatch')
  assert.ok(mismatched.length >= 6, 'the RevModPhys, Cao and Distill mismatches')
  const rows = decisions.decisions as { recordId: string; disposition: string; note: string }[]
  for (const packet of mismatched) {
    for (const row of rows.filter((entry) => entry.recordId === packet.recordId)) {
      assert.equal(row.disposition, 'reject')
      assert.match(row.note, /another subject entirely/)
    }
  }
})

test('an inaccessible record is inaccessible on every axis', () => {
  const blocked = (packets.packets as { recordId: string; contentInspected: boolean }[])
    .filter((packet) => !packet.contentInspected).map((packet) => packet.recordId)
  assert.equal(blocked.length, 3)
  const rows = decisions.decisions as { recordId: string; axis: string; disposition: string }[]
  for (const recordId of blocked) {
    const forRecord = rows.filter((row) => row.recordId === recordId)
    assert.equal(forRecord.length, REVIEW_AXES.length)
    for (const row of forRecord) assert.equal(row.disposition, 'remain-inaccessible')
  }
})

test('every decision is the machine tier and names no person', () => {
  for (const row of decisions.decisions as Record<string, unknown>[]) {
    assert.equal(row.reviewerKind, 'automated-internal-editorial')
    for (const field of ['independent', 'humanReviewed', 'externallyReviewed', 'expertEndorsement']) {
      assert.equal(row[field], false, `${field} must be false`)
    }
    assert.equal(row.releaseAuthority, 'separate')
  }
  assert.ok(!/"displayName"|"reviewerId"|"affiliation"/.test(JSON.stringify(decisions)))
})

test('failed Batch 12A routes were not retried', () => {
  const priorFailures = (batch12a.unresolved as { attemptedRoutes: string[] }[]).flatMap((entry) => entry.attemptedRoutes)
  const priorDois = new Set((batch12a.unresolved as { doi: string }[]).map((entry) => entry.doi))
  for (const source of investigations.sources as { identifier: string }[]) {
    assert.ok(!priorDois.has(source.identifier), `${source.identifier} already failed in Batch 12A`)
  }
  assert.ok(priorFailures.length > 0)
  assert.match(investigations.accessPolicy, /were not retried/)
})

/* --- boundaries ----------------------------------------------------------- */

test('the public surface and active bindings are unchanged', () => {
  assert.equal(capacity.crawlable, 764)
  assert.equal(capacity.batch12a.activePublicRoutes, 764)
  assert.equal(capacity.batch12a.activeAlignmentClear, 141)
  assert.equal(capacity.batch12b.activePublicRoutes, 764)
  assert.equal(capacity.batch12b.newlyReleaseReadyProposed, 0)
})

test('no Batch 12B record is in sitemap.xml or llms.txt', () => {
  const surfaces = [...(observation.sitemapPaths as string[]), ...(observation.llmsPaths as string[])]
  for (const packet of packets.packets as { recordId: string }[]) {
    const slug = packet.recordId.split(':').pop()!
    for (const path of surfaces) assert.ok(!path.endsWith(`/${slug}`), `${slug} reachable at ${path}`)
  }
})

test('the global scope repair is untouched', () => {
  assert.equal(scopeImpact.applied, false)
  assert.equal(scopeImpact.affectedRecords, 238)
  const serialized = `${JSON.stringify(packets)}${JSON.stringify(decisions)}`
  assert.ok(!/scope-join|malformed join/i.test(serialized),
    'Batch 12B must not entangle itself with the formatting migration')
})

test('artifacts carry no identity, credential or Production reference', () => {
  for (const file of ['content/batch-12b/source-investigations.json', 'content/batch-12b/remediation-packets.json',
    'content/batch-12b/editorial-decisions.json', 'content/batch-12b/mixed-revision-canary.json']) {
    const text = readFileSync(resolve(ROOT, file), 'utf8')
    for (const [pattern, label] of [
      [/[Bb]earer\s+\S{16,}/, 'bearer token'],
      [/\bsbp_[A-Za-z0-9]{16,}\b/, 'supabase token'],
      [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, 'email address'],
      [/"reviewerId"|"displayName"|"authorityId"/, 'reviewer or authority identity'],
      [/\bhttps?:\/\/[a-z0-9]{20}\.supabase\.(?:co|in)\b/i, 'supabase project host'],
      [/VERCEL_TOKEN|SUPABASE_ACCESS_TOKEN|EPISTEMIC_RELEASE_AUTHORITY/, 'Production credential name'],
    ] as [RegExp, string][]) {
      assert.ok(!pattern.test(text), `${file} contains ${label}`)
    }
  }
})

test('Batch 12B material is unreachable from anything served', () => {
  const seen = new Set<string>()
  const queue: string[] = []
  const collect = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) collect(path)
      else if (/\.tsx?$/.test(entry.name)) queue.push(path)
    }
  }
  collect(join(ROOT, 'app'))
  for (const extra of ['lib/llms-manifest.ts', 'app/sitemap.ts']) {
    if (existsSync(join(ROOT, extra))) queue.push(join(ROOT, extra))
  }
  const guarded = ['batch-12b', 'mixed-revision', 'remediation-packets', 'source-investigations']
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/from\s+'(\.[^']+)'/g)) {
      const target = resolve(dirname(file), match[1])
      for (const candidate of [target, `${target}.ts`, `${target}.tsx`, join(target, 'index.ts')]) {
        if (existsSync(candidate) && !seen.has(candidate)) queue.push(candidate)
      }
    }
    for (const marker of guarded) {
      assert.ok(!file.includes(marker) && !source.includes(marker), `${marker} reachable via ${file}`)
    }
  }
  assert.ok(seen.size > 0)
})

test('regenerating produces byte-identical artifacts', () => {
  const files = ['content/batch-12b/remediation-packets.json', 'content/batch-12b/editorial-decisions.json',
    'content/batch-12b/mixed-revision-canary.json', 'content/scaling/capacity-model.json']
  const before = files.map((file) => readFileSync(resolve(ROOT, file), 'utf8'))
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-batch-12b.ts'], { cwd: ROOT, stdio: 'ignore' })
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-scaling-inventory.ts'], { cwd: ROOT, stdio: 'ignore' })
  const after = files.map((file) => readFileSync(resolve(ROOT, file), 'utf8'))
  for (const [index, file] of files.entries()) assert.equal(after[index], before[index], `${file} is not deterministic`)
})
