import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createHash } from 'node:crypto'

import { digest } from '../lib/federation/readiness-tranche-22.ts'

const ROOT = process.cwd()
const FEDERATION = resolve(ROOT, 'content/federation')
const IMPLEMENTATIONS = resolve(FEDERATION, 'implementations')
const PUBLIC = resolve(FEDERATION, 'public')

type LedgerEntry = {
  candidateId: string
  candidateDigest: string
  siteId: string
  path: string
  state: string
  specification: boolean
  implementationState: string
}

type Page = {
  candidateId: string
  siteId: string
  canonicalHost: string
  path: string
  canonicalUrl: string
  contentDigest: string
  adoption: {
    state: string
    blockedDependencies: unknown[]
    exactRevisionReviewed: boolean
    canonicallyReleased: boolean
    crawlable: boolean
  }
}

type PropertyManifest = {
  provenanceDigest: string
  siteId: string
  canonicalHost: string
  pages: Page[]
}

const read = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T
const signed = <T extends Record<string, unknown>>(body: T) => ({ ...body, provenanceDigest: digest(body) })
const verifiedDigest = (value: Record<string, unknown> & { provenanceDigest: string }) => {
  const { provenanceDigest, ...body } = value
  return digest(body) === provenanceDigest
}
const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex')

const ledger = read<{ provenanceDigest: string; entries: LedgerEntry[] }>(resolve(FEDERATION, 'federation-unified-readiness-ledger-v8.json'))
if (!verifiedDigest(ledger as unknown as Record<string, unknown> & { provenanceDigest: string })) throw new Error('The unified readiness ledger digest does not verify.')

const ledgerByCandidate = new Map(ledger.entries.map((entry) => [entry.candidateId, entry]))
const manifests = readdirSync(IMPLEMENTATIONS)
  .filter((name) => /-pages-v2\.json$/.test(name))
  .sort()
  .map((name) => read<PropertyManifest>(resolve(IMPLEMENTATIONS, name)))

const releaseEntries = manifests.flatMap((manifest) => {
  if (!verifiedDigest(manifest as unknown as Record<string, unknown> & { provenanceDigest: string })) throw new Error(`Manifest digest failed: ${manifest.siteId}`)
  return manifest.pages.map((page) => {
    const ledgerEntry = ledgerByCandidate.get(page.candidateId)
    if (!ledgerEntry || ledgerEntry.siteId !== page.siteId || ledgerEntry.path !== page.path) throw new Error(`Ledger identity mismatch: ${page.candidateId}`)
    if (ledgerEntry.state !== 'evidence-ready' || !ledgerEntry.specification || ledgerEntry.implementationState !== 'implementation-ready') throw new Error(`Candidate is not implementation-ready: ${page.candidateId}`)
    if (!page.adoption.exactRevisionReviewed || page.adoption.blockedDependencies.length || page.adoption.canonicallyReleased || page.adoption.crawlable) throw new Error(`Invalid pre-release state: ${page.candidateId}`)
    const identity = { candidateId: page.candidateId, canonicalUrl: page.canonicalUrl, targetContentDigest: page.contentDigest }
    const body = {
      schemaVersion: 'maha-federation-canonical-release/1.0',
      releaseId: `fedrelease_${sha256Hex(JSON.stringify(identity)).slice(0, 32)}`,
      candidateId: page.candidateId,
      candidateDigest: ledgerEntry.candidateDigest,
      siteId: page.siteId,
      canonicalHost: page.canonicalHost,
      path: page.path,
      canonicalUrl: page.canonicalUrl,
      targetContentDigest: page.contentDigest,
      sourceManifestDigest: manifest.provenanceDigest,
      reviewLedgerDigest: ledger.provenanceDigest,
      canonicalVersion: '1.0',
      status: 'active',
      authority: {
        kind: 'explicit-owner-authorization',
        scope: 'property-adapter integration and canonical-release binding across the seven frozen federation properties',
        authorizedOn: '2026-09-07',
      },
      deployment: { state: 'awaiting-deployment', productionMutation: false },
      boundary: 'This release binds one exact reviewed page digest for an authorized build. It does not certify external truth, customer adoption, commercial validation, or deployment.',
    }
    return { ...body, releaseDigest: digest(body) }
  })
}).sort((a, b) => a.canonicalUrl.localeCompare(b.canonicalUrl))

if (releaseEntries.length !== 1_628 || new Set(releaseEntries.map((entry) => entry.candidateId)).size !== 1_628 || new Set(releaseEntries.map((entry) => entry.canonicalUrl)).size !== 1_628) {
  throw new Error('Canonical release cardinality failed.')
}

const releaseBody = {
  schemaVersion: 'maha-federation-canonical-release-ledger/1.0',
  frozenOn: '2026-09-07',
  status: 'active-build-bound-releases-awaiting-deployment',
  sourceReadinessLedgerDigest: ledger.provenanceDigest,
  counts: {
    releases: releaseEntries.length,
    active: releaseEntries.filter((entry) => entry.status === 'active').length,
    properties: manifests.length,
    productionMutations: 0,
    deployments: 0,
  },
  entries: releaseEntries,
  boundary: 'The ledger activates exact local publication bindings for the authorized build. Production deployment and served availability remain separately observable events.',
}

const routeIndexBody = {
  schemaVersion: 'maha-federation-public-route-index/1.0',
  sourceReleaseLedgerDigest: digest(releaseBody),
  counts: { routes: releaseEntries.length, properties: manifests.length },
  entries: releaseEntries.map((entry) => ({
    candidateId: entry.candidateId,
    siteId: entry.siteId,
    canonicalHost: entry.canonicalHost,
    path: entry.path,
    canonicalUrl: entry.canonicalUrl,
    releaseId: entry.releaseId,
    targetContentDigest: entry.targetContentDigest,
    releaseDigest: entry.releaseDigest,
  })),
}

mkdirSync(PUBLIC, { recursive: true })
writeFileSync(resolve(PUBLIC, 'federation-canonical-release-ledger-v1.json'), `${JSON.stringify(signed(releaseBody), null, 2)}\n`)
writeFileSync(resolve(PUBLIC, 'federation-public-route-index-v1.json'), `${JSON.stringify(signed(routeIndexBody), null, 2)}\n`)
console.log(JSON.stringify(releaseBody.counts))
