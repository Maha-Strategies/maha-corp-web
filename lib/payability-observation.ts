import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { recoverMessageAddress } from 'viem'

type Obj = Record<string, unknown>
const object = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v)
const fail = (message: string): never => { throw new Error(message) }
export const PAYABILITY_SIGNER = '0x41fb10a9e637c85ce3c1d35c4f059e7de1593fbe'
export const PREVIEW_FIELDS = ['preview', 'demo_resource', 'input_ignored', 'note']
export const rawDigest = (raw: string) => createHash('sha256').update(raw).digest('hex')

/** Python is intentional: JS number formatting is not Python json.dumps.
 * Raw JSON enters this boundary before any JS parse/re-serialization. Reject
 * duplicate keys and nonfinite numbers, including in additive fields.
 * No shell, network, caller-supplied executable or code is invoked.
 */
const PYTHON = `import json,sys
def pairs(items):
 d={}
 for k,v in items:
  if k in d: raise ValueError('duplicate JSON key')
  d[k]=v
 return d
def invalid(v): raise ValueError('nonfinite JSON number')
d=json.loads(sys.stdin.read(),object_pairs_hook=pairs,parse_constant=invalid)
if sys.argv[1]=='payload':
 if not isinstance(d,dict): raise ValueError('expected object')
 for k in ['preview','demo_resource','input_ignored','note','signature','signed_by']: d.pop(k,None)
print(json.dumps(d,sort_keys=True,separators=(',',':'),ensure_ascii=True,allow_nan=False),end='')`

export function canonicalJson(raw: string, payload = false): string {
  if (Buffer.byteLength(raw) > 1_000_000) fail('input_too_large')
  const result = spawnSync('python3', ['-c', PYTHON, payload ? 'payload' : 'all'], {
    input: raw, encoding: 'utf8', timeout: 5000, maxBuffer: 8_000_000,
  })
  if (result.error || result.status !== 0) fail('invalid_json_or_canonicalization')
  return result.stdout
}
export function parseStrict(raw: string): unknown { return JSON.parse(canonicalJson(raw)) }
const topVerdicts = ['PAYABLE', 'NOT_PAYABLE', 'UNREACHABLE', 'MALFORMED_402', 'CANNOT_PAY_EITHER_VERB']
const optionVerdicts = ['PAYABLE', 'EVM_NO_ATA_CHECK_NEEDED', 'ATA_MISSING_NEVER_EXISTED', 'ATA_CLOSED_AFTER_USE', 'NOT_SPL_SETTLEMENT', 'MALFORMED_402']
const reasons = ['PARSES', 'i_unreachable', 'i_no_402', 'ii_402_no_header_no_body', 'iii_header_decode_error', 'iv_missing_field']
export const REQUIRED = ['schema_version', 'resource', 'verdict', 'options', 'payable_networks', 'checked_at', 'reachable', 'returns_402', 'accepts_wellformed', 'method', 'get_status', 'post_status', 'reason']

function timestamp(v: unknown): number {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(v)) return NaN
  const n = Date.parse(v)
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 19) === v.slice(0, 19) ? n : NaN
}
function url(v: unknown): string {
  if (typeof v !== 'string') return fail('invalid_resource')
  const u = new URL(v)
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.hash) fail('invalid_resource')
  return v // Never normalize signed resource strings for production joins.
}

export function inspectObservation(v: unknown): { observation: Obj; issues: string[] } {
  if (!object(v) || REQUIRED.some(k => !Object.hasOwn(v, k))) return fail('missing_required_field')
  if (v.schema_version !== 3) fail('unsupported_schema_version')
  if (typeof v.verdict !== 'string') fail('invalid_verdict_type')
  url(v.resource)
  if (!Number.isFinite(timestamp(v.checked_at))) fail('invalid_checked_at')
  for (const k of ['reachable', 'returns_402', 'accepts_wellformed']) if (typeof v[k] !== 'boolean') fail('invalid_boolean')
  if (v.method !== null && v.method !== 'GET' && v.method !== 'POST') fail('unsupported_method')
  for (const k of ['get_status', 'post_status']) if (v[k] !== null && !(Number.isInteger(v[k]) && Number(v[k]) >= 100 && Number(v[k]) <= 599)) fail('invalid_http_status')
  if (!Array.isArray(v.options) || !Array.isArray(v.payable_networks) || !v.payable_networks.every(n => typeof n === 'string') || typeof v.reason !== 'string') return fail('invalid_observation_shape')
  const issues: string[] = []
  if (!topVerdicts.includes(String(v.verdict))) issues.push('unknown_verdict')
  if (!reasons.includes(v.reason)) issues.push('unknown_reason')
  const payable = new Set<string>()
  for (const o of v.options) {
    if (!object(o) || typeof o.network !== 'string' || typeof o.amount !== 'string' || !/^\d+$/.test(o.amount) || typeof o.pay_to !== 'string' || !o.pay_to || typeof o.asset !== 'string' || !o.asset) fail('invalid_option')
    if (!object(o)) return fail('invalid_option')
    if (!optionVerdicts.includes(String(o.verdict))) issues.push('unknown_option_verdict')
    if (!/^(eip155:[0-9]+|solana:[A-Za-z0-9]+)$/.test(String(o.network)) || o.scheme !== 'exact') issues.push('unsupported_payment_option')
    if (!Number.isSafeInteger(o.maxTimeoutSeconds) || Number(o.maxTimeoutSeconds) < 0) issues.push('invalid_option_timeout')
    if (o.facilitator !== null && o.facilitator !== undefined) issues.push('facilitator_not_assessed')
    if (o.verdict === 'EVM_NO_ATA_CHECK_NEEDED' && !String(o.network).startsWith('eip155:')) issues.push('evm_verdict_network_mismatch')
    if (o.verdict === 'PAYABLE' && String(o.network).startsWith('solana:') && (!object(o.detail) || o.detail.ata_exists !== true)) issues.push('solana_ata_inconsistent')
    if (o.verdict === 'PAYABLE' || o.verdict === 'EVM_NO_ATA_CHECK_NEEDED') payable.add(String(o.network))
  }
  if (new Set(v.payable_networks).size !== v.payable_networks.length || payable.size !== v.payable_networks.length || v.payable_networks.some(n => !payable.has(n))) issues.push('payable_subset_mismatch')
  if (v.verdict === 'PAYABLE' || v.verdict === 'NOT_PAYABLE') {
    if ((payable.size > 0 ? 'PAYABLE' : 'NOT_PAYABLE') !== v.verdict) issues.push('aggregation_mismatch')
    if (!v.reachable || !v.returns_402 || !v.accepts_wellformed || v.reason !== 'PARSES' || v.options.length === 0) issues.push('parsed_observation_inconsistent')
  } else if (topVerdicts.includes(String(v.verdict))) {
    if (v.options.length || v.payable_networks.length || v.accepts_wellformed) issues.push('pre_option_verdict_inconsistent')
    if (v.verdict === 'UNREACHABLE' && (v.reachable || v.returns_402 || v.get_status !== null || v.post_status !== null || v.method !== null || v.reason !== 'i_unreachable')) issues.push('unreachable_inconsistent')
    if (v.verdict === 'CANNOT_PAY_EITHER_VERB' && (!v.reachable || v.returns_402 || v.get_status === 402 || v.post_status === 402 || v.method !== null || v.reason !== 'i_no_402')) issues.push('no_402_inconsistent')
    if (v.verdict === 'MALFORMED_402' && (!v.reachable || !v.returns_402 || !reasons.slice(3).includes(v.reason))) issues.push('malformed_inconsistent')
  }
  if (v.method !== null && v[v.method === 'GET' ? 'get_status' : 'post_status'] !== 402) issues.push('method_status_mismatch')
  if (v.returns_402 && v.get_status !== 402 && v.post_status !== 402) issues.push('missing_402_status')
  return { observation: v, issues }
}

export async function authenticate(raw: string, manifest: unknown, at: string) {
  const v = parseStrict(raw)
  if (!object(v)) return { status: 'failed', reason: 'invalid_record' }
  const message = canonicalJson(raw, true)
  const evidence = { payloadSha256: rawDigest(message) }
  if (/^0x0{130}$/.test(String(v.signature))) return { ...evidence, status: 'fixture_placeholder' }
  try {
    const recovered = (await recoverMessageAddress({ message, signature: String(v.signature) as `0x${string}` })).toLowerCase()
    if (recovered !== String(v.signed_by).toLowerCase() || recovered !== PAYABILITY_SIGNER) return { ...evidence, status: 'failed', reason: 'signer_mismatch' }
    if (!object(manifest) || manifest.schema_version !== '1.0' || !object(manifest.signer_registry) || !Array.isArray(manifest.services) || !Array.isArray(manifest.signer_rotations)) throw Error('invalid_manifest')
    // New rotations require explicit local review, not automatic trust expansion.
    if (manifest.signer_rotations.length) throw Error('rotation_requires_review')
    const entries = Object.entries(manifest.signer_registry).filter(([k]) => k.toLowerCase() === recovered)
    if (entries.length !== 1 || !object(entries[0][1])) throw Error('ambiguous_signer')
    const entry = entries[0][1]
    const services = manifest.services.filter(s => object(s) && s.name === 'payable')
    if (entry.status !== 'active' || !Array.isArray(entry.services) || !entry.services.includes('payable') || services.length !== 1 || !object(services[0]) || services[0].base_url !== 'https://payable.nsgoods.org' || String(services[0].signer).toLowerCase() !== recovered) throw Error('unauthorized_scope')
    for (const time of [timestamp(at), timestamp(v.checked_at)]) {
      if (!Number.isFinite(time)) throw Error('invalid_time')
      if (entry.valid_from !== null && (!Number.isFinite(timestamp(entry.valid_from)) || time < timestamp(entry.valid_from))) throw Error('before_validity')
      if (entry.valid_until !== null && (!Number.isFinite(timestamp(entry.valid_until)) || time >= timestamp(entry.valid_until))) throw Error('after_validity')
    }
    return { ...evidence, status: 'verified', recoveredSigner: recovered }
  } catch { return { ...evidence, status: 'failed', reason: 'signature_or_manifest_failed' } }
}

export async function adaptObservation(raw: string, manifest: unknown, context: {
  resource: string; method: 'GET' | 'POST' | null; now: string;
  source: 'synthetic' | 'free-preview' | 'production'; maxAgeSeconds: number; futureSkewSeconds: number;
  expectedOptions?: unknown;
}) {
  if (![context.maxAgeSeconds, context.futureSkewSeconds].every(n => Number.isFinite(n) && n >= 0) || !Number.isFinite(timestamp(context.now))) fail('invalid_consumer_policy')
  const { observation, issues } = inspectObservation(parseStrict(raw))
  const authentication = await authenticate(raw, manifest, context.now)
  const ageSeconds = (timestamp(context.now) - timestamp(observation.checked_at)) / 1000
  if (observation.resource !== context.resource || observation.method !== context.method) issues.push('resource_method_binding_mismatch')
  if (context.expectedOptions !== undefined && canonicalJson(JSON.stringify(context.expectedOptions)) !== canonicalJson(JSON.stringify(observation.options))) issues.push('option_binding_mismatch')
  if (ageSeconds > context.maxAgeSeconds || ageSeconds < -context.futureSkewSeconds) issues.push('outside_freshness_policy')
  return {
    source: { kind: context.source, rawSha256: rawDigest(raw), raw }, observation, authentication,
    assessment: { issues, ageSeconds, status: issues.length ? 'review' : 'structurally_consistent',
      purchaseAuthorized: false, deliveryVerified: false, qualityVerified: false,
      usage: 'offline-review-only' },
  }
}

/** Restricted fixture join. Production uses the exact caller binding above. */
export function associateSynthetic(catalogueRaw: string, observationsRaw: string) {
  const c = parseStrict(catalogueRaw), o = parseStrict(observationsRaw)
  if (!object(c) || !Array.isArray(c.data) || !object(o) || !Array.isArray(o.records)) return fail('invalid_bundle')
  const root = (value: unknown) => {
    const raw = url(value), u = new URL(raw)
    if (!u.hostname.endsWith('.invalid')) fail('non_synthetic_host')
    return /^https?:\/\/[^/?#]+\/?$/.test(raw) ? raw.replace(/\/$/, '') : raw
  }
  const slugs = new Set(), entries = new Map<string, Obj>()
  for (const entry of c.data) {
    if (!object(entry) || typeof entry.slug !== 'string' || entry.source !== 'synthetic' || entry.status !== 'fixture') return fail('invalid_catalogue')
    const key = root(entry.base_url); root(entry.website_url)
    if (slugs.has(entry.slug) || entries.has(key)) fail('duplicate_catalogue')
    slugs.add(entry.slug); entries.set(key, entry)
  }
  const seen = new Set()
  const mapped = o.records.map(record => {
    const { observation, issues } = inspectObservation(record)
    const key = root(observation.resource)
    if (seen.has(key)) fail('duplicate_observation')
    seen.add(key)
    const catalogue = entries.get(key)
    if (!catalogue) fail('unmatched_observation')
    return { catalogue, observation, issues: [...issues, ...(catalogue?.payment_ready !== (observation.verdict === 'PAYABLE') ? ['catalogue_hint_disagreement'] : [])], synthetic: true, purchaseAuthorized: false }
  })
  if (entries.size !== seen.size) fail('unmatched_catalogue')
  return mapped
}
