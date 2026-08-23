import { verifyMessage } from 'viem'

/**
 * A deliberately narrow adapter for IllWar5047's Base address preflight.
 * It is a pre-money gate: it validates already-fetched responses only and
 * contains no provider fetch, payment, wallet, or settlement operation.
 */
export const PAYABLE_ADDRESS_SCHEMA_VERSION = 1
export const PAYABLE_ADDRESS_FRESHNESS_SECONDS = 60
export const PAYABLE_ADDRESS_PREVIEW_SIGNER = '0x41fb10a9e637c85ce3c1d35c4f059e7de1593fbe'

const RESPONSE_KEYS = new Set([
  'address_schema_version', 'chain', 'address', 'classification', 'code_present',
  'proxy_indication', 'transfer_path', 'direct_recipient_plausibility', 'checked_at',
  'freshness_bound_seconds', 'limitations', 'signed_by', 'signature',
])
const PREVIEW_KEYS = new Set([...RESPONSE_KEYS, 'preview', 'demo_address', 'input_ignored', 'note'])
const PREVIEW_ONLY_KEYS = new Set(['preview', 'demo_address', 'input_ignored', 'note'])

export type PayableAddressResponse = {
  address_schema_version: 1
  chain: 'base'
  address: string
  classification: 'eoa' | 'contract' | 'unknown'
  code_present: boolean | 'not_evaluated'
  proxy_indication: 'eip1967' | 'eip1167' | 'none_detected' | 'not_evaluated'
  transfer_path: { token: string; result: 'simulated_ok' | 'simulated_revert' | 'not_evaluated'; method: string | null; revert_reason: string | null }
  direct_recipient_plausibility: 'plausible_direct_recipient' | 'requires_application_specific_path' | 'not_evaluated'
  checked_at: string
  freshness_bound_seconds: 60
  limitations: Record<string, unknown>
  signed_by: string
  signature: `0x${string}`
}

export type AddressPreflightDecision = {
  decision: 'approved_for_pre_money_progress' | 'review_required' | 'denied'
  reasonCodes: string[]
  response: PayableAddressResponse | null
  signatureVerified: boolean
  freshnessSeconds: number | null
}

type ParseResult = { response: PayableAddressResponse; signedPayload: Record<string, unknown> } | { error: string }

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const sameAddress = (left: string, right: string) => left.toLowerCase() === right.toLowerCase()
const hasOnlyKeys = (value: Record<string, unknown>, allowed: Set<string>) => Object.keys(value).every((key) => allowed.has(key))
const isAddress = (value: unknown) => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)

/** Python json.dumps(sort_keys=True, separators=(',', ':')) compatible for this JSON-only contract. */
export function payableAddressCanonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite numbers are not valid signed JSON.')
    return JSON.stringify(value)
  }
  if (typeof value === 'string') {
    return JSON.stringify(value).replace(/[\u0080-\uffff]/g, (character) =>
      [...character].map((unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, '0')}`).join(''))
  }
  if (Array.isArray(value)) return `[${value.map(payableAddressCanonicalJson).join(',')}]`
  if (!isObject(value)) throw new Error('Unsupported signed JSON value.')
  return `{${Object.keys(value).sort().map((key) => `${payableAddressCanonicalJson(key)}:${payableAddressCanonicalJson(value[key])}`).join(',')}}`
}

function parse(raw: unknown, preview: boolean): ParseResult {
  if (!isObject(raw)) return { error: 'response_not_an_object' }
  if (!hasOnlyKeys(raw, preview ? PREVIEW_KEYS : RESPONSE_KEYS)) return { error: 'unknown_response_field' }
  if (preview && (raw.preview !== true || !isAddress(raw.demo_address) || typeof raw.input_ignored !== 'boolean' || typeof raw.note !== 'string')) {
    return { error: 'invalid_preview_envelope' }
  }
  for (const key of RESPONSE_KEYS) if (!(key in raw)) return { error: `missing_${key}` }
  if (raw.address_schema_version !== PAYABLE_ADDRESS_SCHEMA_VERSION || raw.chain !== 'base' || !isAddress(raw.address)) return { error: 'unsupported_schema_or_chain' }
  if (!['eoa', 'contract', 'unknown'].includes(String(raw.classification))) return { error: 'invalid_classification' }
  if (typeof raw.code_present !== 'boolean' && raw.code_present !== 'not_evaluated') return { error: 'invalid_code_present' }
  if (!['eip1967', 'eip1167', 'none_detected', 'not_evaluated'].includes(String(raw.proxy_indication))) return { error: 'invalid_proxy_indication' }
  if (!['plausible_direct_recipient', 'requires_application_specific_path', 'not_evaluated'].includes(String(raw.direct_recipient_plausibility))) return { error: 'invalid_direct_recipient_plausibility' }
  if (raw.freshness_bound_seconds !== PAYABLE_ADDRESS_FRESHNESS_SECONDS || !isObject(raw.limitations) || !isAddress(raw.signed_by) || typeof raw.signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(raw.signature)) return { error: 'invalid_signed_metadata' }
  if (!isObject(raw.transfer_path) || !hasOnlyKeys(raw.transfer_path, new Set(['token', 'result', 'method', 'revert_reason'])) || !isAddress(raw.transfer_path.token) || !['simulated_ok', 'simulated_revert', 'not_evaluated'].includes(String(raw.transfer_path.result)) || !(typeof raw.transfer_path.method === 'string' || raw.transfer_path.method === null) || !(typeof raw.transfer_path.revert_reason === 'string' || raw.transfer_path.revert_reason === null)) return { error: 'invalid_transfer_path' }
  if (Number.isNaN(Date.parse(String(raw.checked_at)))) return { error: 'invalid_checked_at' }

  const signedPayload = { ...raw }
  delete signedPayload.signature
  delete signedPayload.signed_by
  for (const key of PREVIEW_ONLY_KEYS) delete signedPayload[key]
  return { response: raw as PayableAddressResponse, signedPayload }
}

export async function evaluatePayableAddressPreflight(raw: unknown, options: {
  address: string
  now?: Date
  expectedSignerAddresses: string[]
  preview?: boolean
}): Promise<AddressPreflightDecision> {
  const parsed = parse(raw, options.preview === true)
  if ('error' in parsed) return { decision: 'denied', reasonCodes: [parsed.error], response: null, signatureVerified: false, freshnessSeconds: null }
  const { response, signedPayload } = parsed
  if (!sameAddress(response.address, options.address)) return { decision: 'denied', reasonCodes: ['response_address_mismatch'], response, signatureVerified: false, freshnessSeconds: null }
  if (!options.expectedSignerAddresses.some((address) => sameAddress(address, response.signed_by))) return { decision: 'denied', reasonCodes: ['untrusted_signer'], response, signatureVerified: false, freshnessSeconds: null }

  const signatureVerified = await verifyMessage({ address: response.signed_by as `0x${string}`, message: payableAddressCanonicalJson(signedPayload), signature: response.signature })
  if (!signatureVerified) return { decision: 'denied', reasonCodes: ['signature_invalid'], response, signatureVerified: false, freshnessSeconds: null }

  const freshnessSeconds = (options.now ?? new Date()).getTime() / 1000 - Date.parse(response.checked_at) / 1000
  if (freshnessSeconds < -5 || freshnessSeconds > response.freshness_bound_seconds) return { decision: 'denied', reasonCodes: ['preflight_stale_or_future'], response, signatureVerified: true, freshnessSeconds }
  if (response.classification === 'unknown' || response.code_present === 'not_evaluated' || response.transfer_path.result === 'not_evaluated' || response.direct_recipient_plausibility === 'not_evaluated') {
    return { decision: 'denied', reasonCodes: ['required_field_not_evaluated'], response, signatureVerified: true, freshnessSeconds }
  }
  if (response.transfer_path.result === 'simulated_revert') return { decision: 'denied', reasonCodes: ['transfer_path_reverted'], response, signatureVerified: true, freshnessSeconds }
  if (response.classification === 'contract' || response.code_present === true || response.direct_recipient_plausibility === 'requires_application_specific_path') {
    return { decision: 'review_required', reasonCodes: ['contract_recipient_path_not_established'], response, signatureVerified: true, freshnessSeconds }
  }
  return { decision: 'approved_for_pre_money_progress', reasonCodes: ['signed_fresh_eoa_direct_recipient'], response, signatureVerified: true, freshnessSeconds }
}
