import { lookup } from 'node:dns/promises'
import { publicIPv4, pinnedHttpsTransport, type PublicRead, type PublicResolver, type PublicTransport } from '../demand6/public-fetch.ts'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { normalizeDoi, RESEARCH_INPUTS, RESEARCH_RESULTS, type ResearchId } from './research-contracts.ts'
export type ResearchDependencies = { read?: (url: string) => Promise<PublicRead>; now?: () => number }
const clean = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 500) || null : null
function date(raw: unknown): string | null {
  const parts = raw && typeof raw === 'object' ? (raw as Record<string, unknown>)['date-parts'] : null
  const p = Array.isArray(parts) ? parts[0] : null
  if (!Array.isArray(p) || !p.length || p.length > 3 || !p.every(Number.isInteger) || p[0] < 1 || p[0] > 9999
    || p.length > 1 && (p[1] < 1 || p[1] > 12) || p.length > 2 && (p[2] < 1 || p[2] > 31)) return null
  const s = p.map((n: number, i: number) => String(n).padStart(i ? 2 : 4, '0')).join('-')
  if (p.length === 3 && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) !== s) return null
  return s
}
const publicText = z.string().max(2000)
const depositedUpdate = z.object({ DOI: publicText, type: publicText, updated: z.unknown().optional() })
const depositedFunder = z.object({ name: publicText.optional(), DOI: publicText.optional(),
  'doi-asserted-by': publicText.optional(), award: z.array(publicText).max(200).optional() })
const providerWork = z.object({ DOI: publicText, title: z.array(publicText).max(64).optional(), publisher: publicText.optional(), type: publicText.optional(),
  published: z.unknown().optional(), issued: z.unknown().optional(), indexed: z.object({ 'date-time': z.string().max(80) }).optional(),
  'update-to': z.array(depositedUpdate).max(200).optional(),
  relation: z.record(z.string().max(80), z.array(z.object({ id: publicText, 'id-type': publicText })).max(200)).optional(),
  funder: z.array(depositedFunder).max(200).optional() })
type ProviderWork = z.infer<typeof providerWork>
function validateResponse(response: PublicRead) {
  if (![200, 404].includes(response.status) || Buffer.byteLength(response.body) > 131072
    || !/^application\/json(?:\s*;|$)/i.test(response.headers['content-type'] ?? '')
    || (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')) throw Error('invalid_research_response')
  return response
}
const workUrl = (doi: string) => 'https://api.crossref.org/works/' + encodeURIComponent(normalizeDoi(doi))
const TRIAL_FIELDS = 'NCTId,OverallStatus,LastUpdatePostDate'
export function researchTargets(id: ResearchId, supplied: unknown): string[] {
  const input = RESEARCH_INPUTS[id].parse(supplied)
  if ('nctId' in input) {
    const url = new URL('https://clinicaltrials.gov/api/v2/studies/' + input.nctId)
    url.searchParams.set('fields', TRIAL_FIELDS)
    return [url.href]
  }
  if ('dois' in input) return input.dois.map(workUrl)
  const urls = [workUrl(input.doi)]
  if (id === 'research-publication-update-snapshot') {
    const u = new URL('https://api.crossref.org/works')
    u.searchParams.set('filter', 'updates:' + normalizeDoi(input.doi)); u.searchParams.set('rows', '10'); urls.push(u.href)
  }
  return urls
}
/** Exact official API URLs only. Address pinning reuses the reviewed public transport. */
export function createResearchReader(targets: readonly string[], deps: { resolve?: PublicResolver; transport?: PublicTransport } = {}) {
  const allowed = new Set(targets)
  if (allowed.size !== targets.length || !allowed.size || allowed.size > 5) throw new Error('invalid_research_targets')
  for (const target of targets) {
    const u = new URL(target)
    if (u.protocol !== 'https:' || u.port || u.username || u.password || u.hash
      || !['api.crossref.org', 'clinicaltrials.gov'].includes(u.hostname)) throw new Error('invalid_research_origin')
    if (u.hostname === 'clinicaltrials.gov' && (!/^\/api\/v2\/studies\/NCT\d{8}$/.test(u.pathname)
      || u.searchParams.getAll('fields').length !== 1 || u.searchParams.get('fields') !== TRIAL_FIELDS
      || [...u.searchParams.keys()].some(k => k !== 'fields'))) throw Error('invalid_trial_target')
    if (u.hostname === 'api.crossref.org') {
      const single = u.pathname.startsWith('/works/') && !u.search && normalizeDoi(decodeURIComponent(u.pathname.slice(7)))
      const filtered = u.pathname === '/works' && u.searchParams.get('rows') === '10'
        && u.searchParams.getAll('rows').length === 1 && u.searchParams.getAll('filter').length === 1
        && [...u.searchParams.keys()].every(k => ['rows', 'filter'].includes(k))
        && u.searchParams.get('filter')?.startsWith('updates:') && normalizeDoi(u.searchParams.get('filter')!.slice(8))
      if (!single && !filtered) throw Error('invalid_crossref_target')
    }
  }
  const deadline = Date.now() + 25000
  const resolvePublic: PublicResolver = deps.resolve ?? (async host => (await lookup(host, { all: true, family: 4, verbatim: true })).map(r => r.address))
  return async (url: string) => {
    if (!allowed.has(url) || Date.now() >= deadline) throw new Error('unapproved_or_expired_research_target')
    let timer: ReturnType<typeof setTimeout> | undefined
    let addresses: string[]
    try { addresses = await Promise.race([resolvePublic(new URL(url).hostname), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('research_dns_timeout')), Math.max(1, Math.min(4000, deadline - Date.now()))) })]) }
    finally { clearTimeout(timer) }
    if (!addresses.length || addresses.some(a => !publicIPv4(a))) throw new Error('non_public_research_dns')
    if (Date.now() >= deadline) throw Error('research_read_budget_exhausted')
    let response: PublicRead
    try { response = await Promise.race([(deps.transport ?? pinnedHttpsTransport)({ url, method: 'GET' }, addresses[0]),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('research_read_budget_exhausted')), Math.max(1, deadline - Date.now())) })]) }
    finally { clearTimeout(timer) }
    if (response.status >= 300 && response.status < 400) throw new Error('research_redirect_refused')
    if (response.status !== 200 && response.status !== 404) throw new Error('research_source_unavailable')
    return validateResponse(response)
  }
}
function source(url: string, response: PublicRead, at: number, providerUpdatedAt: string | null) {
  return { url, retrievedAt: new Date(at).toISOString(), rawBytesSha256: 'sha256:' + createHash('sha256').update(response.body).digest('hex'),
    providerUpdatedAt, provider: url.startsWith('https://api.crossref.org/') ? 'Crossref' as const : 'ClinicalTrials.gov' as const,
    rightsBasis: url.startsWith('https://api.crossref.org/') ? 'Crossref public bibliographic metadata only; no abstracts, authors, full text or linked files redistributed.'
      : 'Public registry status metadata only; no study descriptions, contacts, participant data or attached documents. Distribution terms need release review.',
    sourceCompletenessEstablished: false as const }
}
function parseWork(response: PublicRead, doi: string) {
  const data = JSON.parse(response.body)
  if (response.status !== 200 || data?.status !== 'ok' || data?.['message-type'] !== 'work' || !data.message
    || typeof data.message.DOI !== 'string' || normalizeDoi(data.message.DOI) !== normalizeDoi(doi)) throw new Error('crossref_identity_or_schema_mismatch')
  return providerWork.parse(data.message)
}
const summary = (work: ProviderWork) => ({ doi: normalizeDoi(work.DOI), title: clean(work.title?.[0]), publisher: clean(work.publisher),
  type: clean(work.type), publicationDate: date(work.published ?? work.issued) })
function updates(work: ProviderWork) {
  if (work['update-to'] !== undefined && !Array.isArray(work['update-to'])) throw new Error('invalid_update_metadata')
  return (work['update-to'] ?? []).slice(0, 20).map(u => {
    if (typeof u?.DOI !== 'string' || !clean(u.type)) throw new Error('invalid_update_metadata')
    return { doi: normalizeDoi(u.DOI), type: clean(u.type)!, date: date(u.updated) }
  })
}
export async function buildResearchResult(id: ResearchId, supplied: unknown, dependencies: ResearchDependencies = {}) {
  const input = RESEARCH_INPUTS[id].parse(supplied), targets = researchTargets(id, input), reader = dependencies.read ?? createResearchReader(targets)
  const read = async (url: string) => validateResponse(await reader(url))
  const clock = () => { const value = dependencies.now?.() ?? Date.now(); if (!Number.isSafeInteger(value) || value < 0) throw Error('invalid_research_clock'); return value }
  const first = await read(targets[0]), at = clock()
  if (id === 'research-trial-status-snapshot' && 'nctId' in input) {
    if (first.status !== 200) throw new Error('trial_not_found')
    const record = JSON.parse(first.body), protocol = record.protocolSection
    if (protocol?.identificationModule?.nctId !== input.nctId || !protocol.statusModule || typeof protocol.statusModule !== 'object') throw new Error('trial_identity_or_schema_mismatch')
    const posted = clean(protocol.statusModule.lastUpdatePostDateStruct?.date)
    return RESEARCH_RESULTS[id].parse({ nctId: input.nctId, overallStatus: clean(protocol.statusModule.overallStatus),
      lastUpdatePostDate: posted, source: source(targets[0], first, at, posted), contactOrParticipantDataReturned: false,
      clinicalRecommendationProvided: false, registryStatusIndependentlyVerified: false })
  }
  if ('dois' in input) {
    const records = []
    for (let i = 0; i < input.dois.length; i++) {
      const response = i === 0 ? first : await read(targets[i])
      if (response.status === 404) records.push({ requestedDoi: normalizeDoi(input.dois[i]), state: 'not_found', work: null, source: source(targets[i], response, clock(), null) })
      else { const work = parseWork(response, input.dois[i]); records.push({ requestedDoi: normalizeDoi(input.dois[i]), state: 'exact_metadata_match', work: summary(work), source: source(targets[i], response, clock(), clean(work.indexed?.['date-time'])) }) }
    }
    return RESEARCH_RESULTS['research-bibliography-resolution'].parse({ records, normalization: 'exact-doi-case-fold-and-doi-org-prefix', fuzzyMatchingPerformed: false, fullTextReturned: false })
  }
  if (!('doi' in input)) throw new Error('invalid_research_input')
  const work = parseWork(first, input.doi), observation = source(targets[0], first, at, clean(work.indexed?.['date-time']))
  if (id === 'research-publication-update-snapshot') {
    const response = await read(targets[1])
    const list = z.object({ status: z.literal('ok'), message: z.object({ 'total-results': z.number().int().nonnegative(), items: z.array(providerWork).max(10) }) }).parse(JSON.parse(response.body))
    if (response.status !== 200 || list.message['total-results'] < list.message.items.length) throw new Error('invalid_update_list')
    const found = list.message.items.map(item => {
      const matching = updates(item).filter(u => u.doi === normalizeDoi(input.doi))
      if (typeof item.DOI !== 'string' || !matching.length) throw new Error('unbound_update_record')
      return { doi: normalizeDoi(item.DOI), type: matching[0].type, date: matching[0].date }
    })
    return RESEARCH_RESULTS[id].parse({ queriedDoi: normalizeDoi(input.doi), sources: [observation, source(targets[1], response, clock(), null)],
      thisRecordUpdates: updates(work), recordsUpdatingThisDoi: found, updatingRecordCount: list.message['total-results'],
      truncated: list.message['total-results'] > found.length || (work['update-to']?.length ?? 0) > 20, absenceProvesUnretracted: false })
  }
  if (id === 'research-data-software-links') {
    const relations = work.relation ?? {}
    if (!relations || typeof relations !== 'object' || Array.isArray(relations)) throw new Error('invalid_relation_metadata')
    const all: { relation: string; identifier: string; identifierType: string }[] = []
    for (const [relation, values] of Object.entries(relations)) {
      if (!Array.isArray(values)) throw new Error('invalid_relation_metadata')
      for (const item of values) {
        if (!clean(item?.id) || !clean(item['id-type'])) throw new Error('invalid_relation_metadata')
        all.push({ relation, identifier: clean(item.id)!, identifierType: clean(item['id-type'])! }) }
    }
    return RESEARCH_RESULTS[id].parse({ work: summary(work), source: observation, declaredRelations: all.slice(0, 40),
      missingRelationMetadata: !all.length, relationsTruncated: all.length > 40, linkedDataFetched: false, reproducibilityEstablished: false })
  }
  if (id === 'research-funding-lineage') {
    if (work.funder !== undefined && !Array.isArray(work.funder)) throw new Error('invalid_funding_metadata')
    const all = work.funder ?? []
    return RESEARCH_RESULTS[id].parse({ work: summary(work), source: observation, funders: all.slice(0, 10).map(f => {
      if (f.award !== undefined && !Array.isArray(f.award)) throw new Error('invalid_funding_metadata')
      return { name: clean(f.name), doi: clean(f.DOI), doiAssertedBy: clean(f['doi-asserted-by']), awards: (f.award ?? []).slice(0, 10).map((a: unknown) => { const value = clean(a); if (!value) throw new Error('invalid_funding_metadata'); return value }) }
    }), truncated: all.length > 10 || all.some(f => (f.award?.length ?? 0) > 10), grantAwardVerified: false, completenessEstablished: false })
  }
  throw new Error('unsupported_research_product')
}
