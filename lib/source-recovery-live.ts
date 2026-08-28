import type { RecoveryObservation, RecoveryRequest, RecoveryState } from './source-recovery.ts'

const ALLOWED_HOSTS = new Set([
  'doi.org',
  'api.crossref.org',
  'api.openalex.org',
  'www.ebi.ac.uk',
  'api.biorxiv.org',
  'arxiv.org',
  'export.arxiv.org',
  'www.osti.gov',
  'pubs.usgs.gov',
  'www.usgs.gov',
  'nvlpubs.nist.gov',
  'www.nist.gov',
  'pubmed.ncbi.nlm.nih.gov',
  'pmc.ncbi.nlm.nih.gov',
  'www.iter.org',
  'journals.aps.org',
  'lasers.llnl.gov',
  'transformer-circuits.pub',
  'www.cell.com',
  'onlinelibrary.wiley.com',
  'ieeexplore.ieee.org',
  'www.nature.com',
  'www.sciencedirect.com',
])

const MAX_METADATA_BYTES = 1_000_000

function base(request: RecoveryRequest): RecoveryObservation {
  return {
    channel: request.channel,
    requestUrl: request.url,
    status: 'not-found',
    candidateUrl: null,
    artifactVersion: 'unknown',
    observedTitle: null,
    observedIdentifier: null,
    identityVerified: false,
    versionRelationshipVerified: false,
    contentInspected: false,
    exactLocator: null,
    note: 'No candidate was returned.',
  }
}

function assertAllowed(rawUrl: string): URL {
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) throw new Error(`Recovery host is not allowlisted: ${url.hostname}`)
  return url
}

async function boundedText(response: Response): Promise<string> {
  const declared = Number(response.headers.get('content-length') ?? '0')
  if (declared > MAX_METADATA_BYTES) throw new Error('Metadata response exceeds the recovery byte ceiling.')
  const text = await response.text()
  if (Buffer.byteLength(text) > MAX_METADATA_BYTES) throw new Error('Metadata response exceeds the recovery byte ceiling.')
  return text
}

function accessState(response: Response): RecoveryState {
  if ([401, 402, 403].includes(response.status)) return 'authentication-wall'
  if (response.status === 404) return 'not-found'
  return response.ok ? 'version-relationship-unverified' : 'not-found'
}

export async function executeRecoveryRequest(request: RecoveryRequest, signal?: AbortSignal): Promise<RecoveryObservation> {
  assertAllowed(request.url)
  const initial = base(request)
  let response: Response
  try {
    response = await fetch(request.url, {
      headers: { Accept: request.channel === 'crossref' || request.channel === 'europe-pmc' || request.channel === 'biorxiv' || request.channel === 'osti' || request.channel === 'institutional-repository' ? 'application/json' : '*/*' },
      redirect: 'follow',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12_000)]) : AbortSignal.timeout(12_000),
    })
  } catch (error) {
    return { ...initial, note: `Retrieval failed: ${error instanceof Error ? error.message : 'unknown error'}` }
  }

  const finalUrl = response.url || request.url
  try {
    assertAllowed(finalUrl)
  } catch {
    await response.body?.cancel()
    return { ...initial, status: 'wrong-document', note: `Redirect left the approved recovery boundary: ${new URL(finalUrl).hostname}` }
  }
  const generic = {
    ...initial,
    status: accessState(response),
    candidateUrl: response.ok ? finalUrl : null,
    note: `HTTP ${response.status}; no content inspection performed.`,
  }
  if (!response.ok) {
    await response.body?.cancel()
    return generic
  }

  try {
    if (request.channel === 'crossref') {
      const json = JSON.parse(await boundedText(response)) as { message?: { title?: string[]; DOI?: string; URL?: string } }
      return {
        ...generic,
        status: 'metadata-only',
        candidateUrl: json.message?.URL ?? finalUrl,
        observedTitle: json.message?.title?.[0] ?? null,
        observedIdentifier: json.message?.DOI ?? null,
        artifactVersion: 'version-of-record',
        versionRelationshipVerified: true,
        note: 'Crossref metadata located. Metadata is not an open copy and was not inspected for claim support.',
      }
    }
    if (request.channel === 'doi-resolver') {
      const json = JSON.parse(await boundedText(response)) as { responseCode?: number; values?: Array<{ type?: string; data?: { value?: string } }> }
      const candidateUrl = json.values?.find((value) => value.type === 'URL')?.data?.value ?? null
      const encodedIdentifier = request.url.split('/api/handles/')[1] ?? ''
      return {
        ...generic,
        status: json.responseCode === 1 && candidateUrl?.startsWith('https://') ? 'version-relationship-unverified' : 'not-found',
        candidateUrl,
        observedIdentifier: encodedIdentifier.split('/').map((part) => decodeURIComponent(part)).join('/') || null,
        artifactVersion: 'version-of-record',
        versionRelationshipVerified: json.responseCode === 1,
        note: 'The DOI handle registry was queried. Resolution establishes identity routing only; content was not inspected.',
      }
    }
    if (request.channel === 'europe-pmc') {
      const json = JSON.parse(await boundedText(response)) as { resultList?: { result?: Array<{ title?: string; doi?: string; pmcid?: string; isOpenAccess?: string }> } }
      const result = json.resultList?.result?.[0]
      if (!result) return { ...generic, status: 'not-found', candidateUrl: null, note: 'Europe PMC returned no matching record.' }
      const open = result.isOpenAccess === 'Y' && result.pmcid
      return {
        ...generic,
        status: open ? 'open-copy-located' : 'metadata-only',
        candidateUrl: open ? `https://pmc.ncbi.nlm.nih.gov/articles/${result.pmcid}/` : finalUrl,
        observedTitle: result.title ?? null,
        observedIdentifier: result.doi ?? null,
        artifactVersion: open ? 'repository-copy' : 'version-of-record',
        versionRelationshipVerified: Boolean(result.doi),
        note: open ? 'Europe PMC reports an open repository copy. Content has not been inspected.' : 'Europe PMC metadata located; no open copy was reported.',
      }
    }
    if (request.channel === 'biorxiv') {
      const json = JSON.parse(await boundedText(response)) as { collection?: Array<{ title?: string; doi?: string; version?: string }> }
      const result = json.collection?.[0]
      if (!result) return { ...generic, status: 'not-found', candidateUrl: null, note: 'bioRxiv returned no matching preprint.' }
      return {
        ...generic,
        status: 'version-relationship-unverified',
        observedTitle: result.title ?? null,
        observedIdentifier: result.doi ?? null,
        artifactVersion: 'preprint',
        note: `bioRxiv candidate version ${result.version ?? 'unknown'} located; relationship to the bound source requires verification.`,
      }
    }
    if (request.channel === 'arxiv') {
      const xml = await boundedText(response)
      const title = xml.match(/<entry>[\s\S]*?<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
      const id = xml.match(/<entry>[\s\S]*?<id>([^<]+)<\/id>/)?.[1] ?? null
      if (!title || !id) return { ...generic, status: 'not-found', candidateUrl: null, note: 'arXiv returned no candidate entry.' }
      return { ...generic, status: 'version-relationship-unverified', candidateUrl: id.replace('/abs/', '/pdf/'), observedTitle: title, artifactVersion: 'preprint', note: 'arXiv title candidate located; DOI/version relationship requires verification.' }
    }
    if (request.channel === 'institutional-repository') {
      const json = JSON.parse(await boundedText(response)) as {
        results?: Array<{
          title?: string
          doi?: string
          open_access?: { oa_url?: string; is_oa?: boolean }
          best_oa_location?: { landing_page_url?: string; pdf_url?: string; version?: string; source?: { type?: string } }
        }>
      }
      const result = json.results?.[0]
      if (!result) return { ...generic, status: 'not-found', candidateUrl: null, note: 'OpenAlex returned no repository candidate.' }
      const location = result.best_oa_location
      const candidateUrl = location?.pdf_url ?? location?.landing_page_url ?? result.open_access?.oa_url ?? null
      const repository = location?.source?.type === 'repository'
      const version = location?.version === 'acceptedVersion' ? 'accepted-manuscript'
        : location?.version === 'submittedVersion' ? 'preprint'
          : repository ? 'repository-copy' : 'version-of-record'
      return {
        ...generic,
        status: candidateUrl && result.open_access?.is_oa ? 'open-copy-located' : 'metadata-only',
        candidateUrl,
        observedTitle: result.title ?? null,
        observedIdentifier: result.doi ?? null,
        artifactVersion: version,
        versionRelationshipVerified: Boolean(result.doi),
        note: candidateUrl && result.open_access?.is_oa
          ? 'OpenAlex reports an open location. Identity and version are normalized, but content has not been inspected.'
          : 'OpenAlex metadata located without a reported open copy.',
      }
    }
    await response.body?.cancel()
    return generic
  } catch (error) {
    return { ...initial, candidateUrl: finalUrl, status: 'version-relationship-unverified', note: `Candidate responded but normalized metadata could not be parsed: ${error instanceof Error ? error.message : 'unknown error'}` }
  }
}

export async function executeRecoveryRequests(requests: readonly RecoveryRequest[], concurrency = 3): Promise<readonly RecoveryObservation[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 5) throw new Error('Recovery concurrency must be an integer from 1 to 5.')
  const results: RecoveryObservation[] = new Array(requests.length)
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, requests.length) }, async () => {
    while (cursor < requests.length) {
      const index = cursor++
      results[index] = await executeRecoveryRequest(requests[index])
    }
  }))
  return results
}
