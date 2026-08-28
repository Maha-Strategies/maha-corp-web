import { createHash } from 'node:crypto'

import { FRONTIER_DOMAIN_GRAPH_RECORDS } from './frontier-domain-graphs.ts'
import { FRONTIER_ALIGNMENT_AUDIT } from './frontier-source-alignment.ts'

export const SOURCE_RECOVERY_SCHEMA = 'maha-source-recovery/1.0' as const
export const SOURCE_RECOVERY_INPUT_DATE = '2026-08-26' as const

export const RECOVERY_STATES = [
  'not-attempted',
  'open-copy-located',
  'manual-inspection-ready',
  'metadata-only',
  'version-relationship-unverified',
  'authentication-wall',
  'not-found',
  'wrong-document',
] as const
export type RecoveryState = (typeof RECOVERY_STATES)[number]

export const ARTIFACT_VERSIONS = [
  'version-of-record',
  'accepted-manuscript',
  'preprint',
  'repository-copy',
  'government-report',
  'living-specification',
  'unknown',
] as const
export type RecoveryArtifactVersion = (typeof ARTIFACT_VERSIONS)[number]

export const RECOVERY_CHANNELS = [
  'doi-resolver',
  'crossref',
  'europe-pmc',
  'arxiv',
  'biorxiv',
  'osti',
  'institutional-repository',
  'official-publisher',
  'usgs',
  'nist',
] as const
export type RecoveryChannel = (typeof RECOVERY_CHANNELS)[number]

export interface RecoveryRequest {
  channel: RecoveryChannel
  url: string
  purpose: 'metadata' | 'open-copy' | 'version-link'
}

export interface RecoveryObservation {
  channel: RecoveryChannel
  requestUrl: string
  status: RecoveryState
  candidateUrl: string | null
  artifactVersion: RecoveryArtifactVersion
  observedTitle: string | null
  observedIdentifier: string | null
  identityVerified: boolean
  versionRelationshipVerified: boolean
  contentInspected: false
  exactLocator: null
  note: string
}

export interface RecoveryPacket {
  schemaVersion: typeof SOURCE_RECOVERY_SCHEMA
  inputDate: typeof SOURCE_RECOVERY_INPUT_DATE
  sourceContractId: string
  domainSlug: string
  sourceTitle: string
  sourceIdentifier: string | null
  declaredUrl: string
  affectedRecordIds: readonly string[]
  currentAlignmentStates: readonly string[]
  priority: number
  requests: readonly RecoveryRequest[]
  observations: readonly RecoveryObservation[]
  disposition: RecoveryState
  inspectionAuthorized: false
  canonicalMutationAuthorized: false
  digest: string
}

// Frozen canary: twenty source contracts, selected for inaccessible state,
// downstream page value, and coverage across scientific and technical domains.
export const SOURCE_RECOVERY_CANARY_IDS = [
  'source-advanced-materials-vdw',
  'source-agentic-systems-mcp-autogen',
  'source-biomolecular-engineering-toehold',
  'source-biomolecular-engineering-pace',
  'source-critical-supply-chains-mcs-specialty',
  'source-critical-supply-chains-mcs-industrial',
  'source-critical-supply-chains-pp1802',
  'source-critical-supply-chains-mcs-gallium-germanium',
  'source-fusion-plasma-systems-nif-ignition',
  'source-longevity-metabolism-autophagy-guidelines',
  'source-longevity-metabolism-hallmarks',
  'source-longevity-metabolism-mitophagy',
  'source-mechanistic-interpretability-induction',
  'source-mechanistic-interpretability-feature-visualization',
  'source-neurotechnology-bci-intracortical-bci',
  'source-neurotechnology-bci-channelrhodopsin',
  'source-neurotechnology-bci-foreign-body',
  'source-neurotechnology-bci-closed-loop',
  'source-neurotechnology-bci-micro-ecog',
  'source-longevity-metabolism-bioenergetics',
] as const

/** Every source contract still attached to at least one uninspected record. */
export const SOURCE_RECOVERY_OUTSTANDING_IDS = [...new Set(
  FRONTIER_ALIGNMENT_AUDIT
    .filter((entry) => !entry.evidence.sourceContentInspected)
    .map((entry) => entry.sourceContractId),
)].sort()

function normalizeTitle(value: string): string {
  return value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function normalizeIdentifier(value: string | null): string | null {
  if (!value) return null
  return value.trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
}

export function sameSourceIdentity(expectedTitle: string, expectedIdentifier: string | null, observation: Pick<RecoveryObservation, 'observedTitle' | 'observedIdentifier'>): boolean {
  const expectedId = normalizeIdentifier(expectedIdentifier)
  const observedId = normalizeIdentifier(observation.observedIdentifier)
  if (expectedId && observedId) return expectedId === observedId
  if (!observation.observedTitle) return false
  return normalizeTitle(expectedTitle) === normalizeTitle(observation.observedTitle)
}

export function finalizeRecoveryObservation(
  expectedTitle: string,
  expectedIdentifier: string | null,
  observation: RecoveryObservation,
): RecoveryObservation {
  const identityVerified = sameSourceIdentity(expectedTitle, expectedIdentifier, observation)
  const hasHttpsCopy = observation.candidateUrl?.startsWith('https://') ?? false
  const manualReady = observation.status === 'open-copy-located'
    && identityVerified
    && observation.versionRelationshipVerified
    && observation.artifactVersion !== 'unknown'
    && hasHttpsCopy

  return {
    ...observation,
    identityVerified,
    status: manualReady
      ? 'manual-inspection-ready'
      : observation.status === 'open-copy-located' && !identityVerified
        ? 'wrong-document'
        : observation.status === 'open-copy-located' && !hasHttpsCopy
          ? 'version-relationship-unverified'
          : observation.status,
  }
}

function query(value: string): string {
  return encodeURIComponent(value)
}

export function recoveryRequests(source: { title: string; url: string; identifier: string | null; publisher: string }): readonly RecoveryRequest[] {
  const requests: RecoveryRequest[] = []
  if (source.identifier) {
    const handlePath = source.identifier.split('/').map((part) => encodeURIComponent(part)).join('/')
    requests.push({ channel: 'doi-resolver', url: `https://doi.org/api/handles/${handlePath}`, purpose: 'version-link' })
    requests.push({ channel: 'crossref', url: `https://api.crossref.org/works/${query(source.identifier)}`, purpose: 'metadata' })
    requests.push({ channel: 'europe-pmc', url: `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${query(source.identifier)}&format=json`, purpose: 'open-copy' })
    requests.push({ channel: 'biorxiv', url: `https://api.biorxiv.org/details/biorxiv/${query(source.identifier)}`, purpose: 'version-link' })
  }
  requests.push({ channel: 'arxiv', url: `https://export.arxiv.org/api/query?search_query=ti:%22${query(source.title)}%22&max_results=5`, purpose: 'open-copy' })
  requests.push({ channel: 'osti', url: `https://www.osti.gov/api/v1/records?q=${query(source.title)}`, purpose: 'open-copy' })
  requests.push({ channel: 'official-publisher', url: source.url, purpose: 'open-copy' })
  if (/U\.S\. Geological Survey|USGS/i.test(source.publisher) || /usgs\.gov/.test(source.url)) {
    requests.push({ channel: 'usgs', url: `https://pubs.usgs.gov/publication/search?q=${query(source.title)}`, purpose: 'open-copy' })
  }
  if (/NIST/i.test(source.publisher) || /nist\.gov/.test(source.url)) {
    requests.push({ channel: 'nist', url: source.url, purpose: 'open-copy' })
  }
  requests.push({ channel: 'institutional-repository', url: `https://api.openalex.org/works?search=${query(source.title)}&per-page=5`, purpose: 'version-link' })
  return requests
}

function packetDigest(packet: Omit<RecoveryPacket, 'digest'>): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(packet)).digest('hex')}`
}

function disposition(observations: readonly RecoveryObservation[]): RecoveryState {
  if (!observations.length) return 'not-attempted'
  if (observations.some((item) => item.status === 'manual-inspection-ready')) return 'manual-inspection-ready'
  if (observations.some((item) => item.status === 'open-copy-located')) return 'open-copy-located'
  if (observations.some((item) => item.status === 'version-relationship-unverified')) return 'version-relationship-unverified'
  if (observations.some((item) => item.status === 'metadata-only')) return 'metadata-only'
  if (observations.some((item) => item.status === 'authentication-wall')) return 'authentication-wall'
  if (observations.some((item) => item.status === 'wrong-document')) return 'wrong-document'
  return 'not-found'
}

export function validateObservation(source: { title: string; identifier: string | null }, observation: RecoveryObservation): readonly string[] {
  const issues: string[] = []
  if (!RECOVERY_CHANNELS.includes(observation.channel)) issues.push('unknown-channel')
  if (!RECOVERY_STATES.includes(observation.status)) issues.push('unknown-status')
  if (!ARTIFACT_VERSIONS.includes(observation.artifactVersion)) issues.push('unknown-artifact-version')
  if (observation.contentInspected !== false || observation.exactLocator !== null) issues.push('recovery-cannot-claim-inspection')
  if (observation.identityVerified !== sameSourceIdentity(source.title, source.identifier, observation)) issues.push('identity-verdict-disagrees')
  if (observation.status === 'manual-inspection-ready') {
    if (!observation.identityVerified) issues.push('inspection-ready-without-identity')
    if (!observation.versionRelationshipVerified) issues.push('inspection-ready-without-version-link')
    if (!observation.candidateUrl?.startsWith('https://')) issues.push('inspection-ready-without-https-copy')
    if (observation.artifactVersion === 'unknown') issues.push('inspection-ready-without-artifact-version')
  }
  if (observation.status === 'open-copy-located' && !observation.candidateUrl?.startsWith('https://')) issues.push('open-copy-without-url')
  return [...new Set(issues)].sort()
}

export function compileRecoveryPackets(
  observationsBySource: Readonly<Record<string, readonly RecoveryObservation[]>> = {},
  sourceContractIds: readonly string[] = SOURCE_RECOVERY_CANARY_IDS,
  uninspectedOnly = false,
): readonly RecoveryPacket[] {
  const auditsBySource = new Map<string, Array<(typeof FRONTIER_ALIGNMENT_AUDIT)[number]>>()
  for (const audit of FRONTIER_ALIGNMENT_AUDIT) {
    const entries = auditsBySource.get(audit.sourceContractId) ?? []
    entries.push(audit)
    auditsBySource.set(audit.sourceContractId, entries)
  }
  const sourceById = new Map(FRONTIER_DOMAIN_GRAPH_RECORDS.flatMap((record) => record.sources.map((source) => [source.id, source] as const)))
  return sourceContractIds.map((sourceContractId, index) => {
    const source = sourceById.get(sourceContractId)
    const allAudits = auditsBySource.get(sourceContractId)
    const audits = uninspectedOnly ? allAudits?.filter((entry) => !entry.evidence.sourceContentInspected) : allAudits
    if (!source || !audits?.length) throw new Error(`${sourceContractId}: canary source does not resolve to the frontier corpus`)
    const identifier = source.identifiers.find((item) => item.scheme === 'doi')?.value ?? null
    const observations = [...(observationsBySource[sourceContractId] ?? [])]
    for (const observation of observations) {
      const issues = validateObservation({ title: source.title, identifier }, observation)
      if (issues.length) throw new Error(`${sourceContractId}: invalid recovery observation: ${issues.join(', ')}`)
    }
    const packetWithoutDigest: Omit<RecoveryPacket, 'digest'> = {
      schemaVersion: SOURCE_RECOVERY_SCHEMA,
      inputDate: SOURCE_RECOVERY_INPUT_DATE,
      sourceContractId,
      domainSlug: audits[0].domainSlug,
      sourceTitle: source.title,
      sourceIdentifier: identifier,
      declaredUrl: source.url,
      affectedRecordIds: audits.map((item) => item.recordId).sort(),
      currentAlignmentStates: [...new Set(audits.map((item) => item.evidence.subjectAligned))].sort(),
      priority: sourceContractIds.length - index,
      requests: recoveryRequests({ title: source.title, url: source.url, identifier, publisher: source.publisher }),
      observations,
      disposition: disposition(observations),
      inspectionAuthorized: false,
      canonicalMutationAuthorized: false,
    }
    return { ...packetWithoutDigest, digest: packetDigest(packetWithoutDigest) }
  })
}

export function compileOutstandingRecoveryPackets(observationsBySource: Readonly<Record<string, readonly RecoveryObservation[]>> = {}): readonly RecoveryPacket[] {
  return compileRecoveryPackets(observationsBySource, SOURCE_RECOVERY_OUTSTANDING_IDS, true)
}

if (SOURCE_RECOVERY_CANARY_IDS.length !== 20 || new Set(SOURCE_RECOVERY_CANARY_IDS).size !== 20) {
  throw new Error('The source-recovery canary must contain exactly twenty unique contracts.')
}
if (SOURCE_RECOVERY_OUTSTANDING_IDS.length !== 19) throw new Error(`Expected 19 outstanding source contracts, found ${SOURCE_RECOVERY_OUTSTANDING_IDS.length}.`)
