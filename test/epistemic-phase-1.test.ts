import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  EPISTEMIC_DOMAINS,
  EPISTEMIC_RECORDS,
  PUBLIC_EPISTEMIC_RECORDS,
  buildDomainRegistry,
  getPublicEpistemicRecord,
} from '../lib/epistemic-pilots.ts'
import {
  buildProvenanceBundle,
  canonicalJson,
  epistemicProvenancePath,
  epistemicRecordPath,
  evaluatePublicationGate,
  recordKindSegment,
  sha256Canonical,
} from '../lib/epistemic-publication.ts'
import type { EpistemicRecord } from '../lib/epistemic-schema.ts'

const root = new URL('../', import.meta.url)

test('multi-axis pilot records retain separate claim, evidence, and review states', () => {
  assert.equal(EPISTEMIC_DOMAINS.length, 2)
  assert.equal(EPISTEMIC_RECORDS.length, 4)
  assert.equal(PUBLIC_EPISTEMIC_RECORDS.length, 2)

  for (const record of PUBLIC_EPISTEMIC_RECORDS) {
    const decision = evaluatePublicationGate(record)
    assert.equal(decision.publicEligible, true, decision.reasons.join(', '))
    assert.equal(record.publication.reviewState, 'published-canonical')
    assert.ok(record.claims.every((claim) => claim.claimKind && claim.evidenceMaturity))
    assert.ok(record.sources.every((source) => source.exactLocator && source.rights.note))
  }

  const theoretical = PUBLIC_EPISTEMIC_RECORDS.find((record) => record.slug === 'transmon-qubit')
  const empirical = PUBLIC_EPISTEMIC_RECORDS.find((record) => record.slug === 'prime-editing')
  assert.equal(theoretical?.claims[0].claimKind, 'theoretical-model')
  assert.equal(empirical?.claims[0].claimKind, 'empirical-claim')
  assert.equal(theoretical?.claims[0].evidenceMaturity, 'single-study')
  assert.equal(empirical?.claims[0].evidenceMaturity, 'single-study')
})

test('draft graph records are withheld instead of becoming thin public pages', () => {
  const withheld = EPISTEMIC_RECORDS.filter((record) => !evaluatePublicationGate(record).publicEligible)
  assert.equal(withheld.length, 2)
  for (const record of withheld) {
    const decision = evaluatePublicationGate(record)
    assert.ok(decision.reasons.includes('public-promotion-not-requested'))
    assert.ok(decision.reasons.includes('review-state-not-canonical'))
    assert.equal(getPublicEpistemicRecord(record.domainSlug, recordKindSegment(record), record.slug), undefined)
  }

  for (const domain of EPISTEMIC_DOMAINS) {
    const registry = buildDomainRegistry(domain.slug)
    assert.equal(registry?.counts.graphRecords, 2)
    assert.equal(registry?.counts.publicCanonicalRecords, 1)
    assert.equal(registry?.counts.withheldRecords, 1)
    const hidden = registry?.records.find((record) => 'withheld' in record && record.withheld)
    assert.equal(hidden && 'canonicalPath' in hidden ? hidden.canonicalPath : 'unexpected', null)
  }
})

test('publication gate blocks missing bridge warnings and formal attachments', () => {
  const base = PUBLIC_EPISTEMIC_RECORDS[0]
  const analogy: EpistemicRecord = {
    ...base,
    id: 'urn:maha:record:analogy-gate-fixture',
    slug: 'analogy-gate-fixture',
    bridges: [{
      id: 'urn:maha:bridge:analogy-gate-fixture',
      sourceConceptId: base.id,
      targetConceptId: 'urn:maha:record:prime-editing',
      bridgeType: 'structural-analogy',
      statement: 'Fixture only.',
    }],
  }
  assert.ok(evaluatePublicationGate(analogy).reasons.includes('bridge-warning-missing:urn:maha:bridge:analogy-gate-fixture'))

  const equivalence: EpistemicRecord = {
    ...analogy,
    id: 'urn:maha:record:equivalence-gate-fixture',
    slug: 'equivalence-gate-fixture',
    bridges: [{ ...analogy.bridges[0], id: 'urn:maha:bridge:equivalence-gate-fixture', bridgeType: 'mathematical-equivalence' }],
  }
  assert.ok(evaluatePublicationGate(equivalence).reasons.includes('formal-attachment-missing:urn:maha:bridge:equivalence-gate-fixture'))
})

test('publication gate accepts explicit undated chronology but never conflates access and publication dates', () => {
  const base = PUBLIC_EPISTEMIC_RECORDS[0]
  const source = base.sources[0]
  const undated: EpistemicRecord = {
    ...base,
    sources: base.sources.map((entry) => entry.id === source.id ? {
      ...entry,
      publishedAt: '',
      sourceChronology: { status: 'living-document', accessedAt: '2026-08-24', sourceVersion: 'test-version' },
    } : entry),
  }
  assert.ok(!evaluatePublicationGate(undated).reasons.includes(`source-publication-date-missing:${source.id}`))

  const conflicting: EpistemicRecord = {
    ...undated,
    sources: undated.sources.map((entry) => entry.id === source.id ? { ...entry, publishedAt: '2026-01-01' } : entry),
  }
  assert.ok(evaluatePublicationGate(conflicting).reasons.includes(`source-chronology-conflict:${source.id}`))
})

test('canonical provenance is deterministic and path-bound', () => {
  const record = PUBLIC_EPISTEMIC_RECORDS[0]
  assert.equal(canonicalJson({ z: 1, a: 2 }), canonicalJson({ a: 2, z: 1 }))
  assert.equal(sha256Canonical(record), sha256Canonical(record))

  const bundle = buildProvenanceBundle(record)
  assert.match(bundle.contentHash, /^sha256:[a-f0-9]{64}$/)
  assert.equal(bundle.canonicalPath, epistemicRecordPath(record))
  assert.equal(epistemicProvenancePath(record), `${bundle.canonicalPath}/provenance.json`)
  assert.equal(bundle.publicationDecision.publicEligible, true)
})

test('Phase 1 routes are static, canonical, Cyber-light scoped, and discoverable', async () => {
  const [system, domain, record, registry, provenance, schema, hub, sitemap, llms, layout] = await Promise.all([
    'app/knowledge/epistemic-system/page.tsx',
    'app/knowledge/[kind]/page.tsx',
    'app/knowledge/[kind]/[slug]/[recordSlug]/page.tsx',
    'app/knowledge/[kind]/registry/route.ts',
    'app/knowledge/[kind]/[slug]/[recordSlug]/provenance.json/route.ts',
    'app/knowledge/epistemic-system/schema/route.ts',
    'app/knowledge/page.tsx',
    'app/sitemap.ts',
    'lib/llms-manifest.ts',
    'app/knowledge/layout.tsx',
  ].map((path) => readFile(new URL(path, root), 'utf8')))

  assert.match(system, /The public page is the result of a passed gate/)
  assert.match(domain, /Withheld records remain non-pages/)
  assert.match(record, /Every proposition keeps its own evidence state/)
  for (const dynamicRoute of [domain, record, registry, provenance]) assert.match(dynamicRoute, /generateStaticParams/)
  assert.match(record, /alternates: \{ canonical: path \}/)
  assert.match(schema, /EPISTEMIC_SCHEMA_DESCRIPTOR/)
  assert.match(hub, /Epistemic publication system/)
  assert.match(sitemap, /PUBLIC_EPISTEMIC_RECORDS/)
  assert.match(llms, /Epistemic publication system/)
  assert.match(layout, /data-visual-scope="knowledge"/)
})
