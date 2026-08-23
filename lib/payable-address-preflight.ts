import { verifyMessage } from 'viem'

/**
 * A deliberately narrow adapter for IllWar5047's Base address preflight.
 * It is a pre-money gate: it validates already-fetched responses only and
 * contains no provider fetch, payment, wallet, or settlement operation.
 */
export const PAYABLE_ADDRESS_SCHEMA_VERSION = 1
export const PAYABLE_ADDRESS_FRESHNESS_SECONDS = 60
export const PAYABLE_ADDRESS_PREVIEW_SIGNER = '0x41fb10a9e637c85ce3c1d35c4f059e7de1593fbe'
export const PAYABLE_ADDRESS_PROOF_MANIFEST_URL = 'https://x402.nsgoods.org/proof/index.json'
export const PAYABLE_ADDRESS_MANIFEST_SERVICE = 'payable-address'

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
  /** True only when the response signer is the signer pinned through the public proof manifest. */
  manifestPinned: boolean
  signatureVerified: boolean
  freshnessSeconds: number | null
}

/**
 * A local, reviewed pin to the provider's public proof manifest. It is not a
 * trust-on-first-use value: a manifest may describe the signer, but it cannot
 * silently replace this pin. A future signer rotation must be explicitly
 * reviewed and shipped with a new pin after the manifest publishes a boundary.
 */
export type PayableAddressManifestPin = {
  manifestUrl: typeof PAYABLE_ADDRESS_PROOF_MANIFEST_URL
  service: typeof PAYABLE_ADDRESS_MANIFEST_SERVICE
  signerAddress: string
}

export const PAYABLE_ADDRESS_MANIFEST_PIN: PayableAddressManifestPin = {
  manifestUrl: PAYABLE_ADDRESS_PROOF_MANIFEST_URL,
  service: PAYABLE_ADDRESS_MANIFEST_SERVICE,
  signerAddress: PAYABLE_ADDRESS_PREVIEW_SIGNER,
}

type ParseResult = { response: PayableAddressResponse; signedPayload: Record<string, unknown> } | { error: string }

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const sameAddress = (left: string, right: string) => left.toLowerCase() === right.toLowerCase()
const hasOnlyKeys = (value: Record<string, unknown>, allowed: Set<string>) => Object.keys(value).every((key) => allowed.has(key))
const isAddress = (value: unknown): value is string => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)

/**
 * Resolve the provider signers from a fetched proof manifest while retaining a
 * local root pin. signer_registry is authoritative; the legacy signers map is
 * deliberately ignored. A new signer becomes reachable only through a
 * machine-readable, time-bounded rotation from the locally pinned signer.
 */
export function resolvePayableAddressManifestSigner(
  manifest: unknown,
  pin: PayableAddressManifestPin = PAYABLE_ADDRESS_MANIFEST_PIN,
  at: Date = new Date(),
): { signerAddresses: string[] } | { error: string } {
  if (pin.manifestUrl !== PAYABLE_ADDRESS_PROOF_MANIFEST_URL || pin.service !== PAYABLE_ADDRESS_MANIFEST_SERVICE || !isAddress(pin.signerAddress)) {
    return { error: 'invalid_manifest_pin' }
  }
  if (!isObject(manifest) || manifest.schema_version !== '1.0' || !isObject(manifest.signer_registry) || !Array.isArray(manifest.signer_rotations) || !Array.isArray(manifest.services)) {
    return { error: 'invalid_proof_manifest' }
  }
  const atMs = at.getTime()
  if (!Number.isFinite(atMs)) return { error: 'invalid_manifest_evaluation_time' }
  const serviceEntries = manifest.services.filter((candidate): candidate is Record<string, unknown> =>
    isObject(candidate) && candidate.name === pin.service)
  if (serviceEntries.length !== 1 || serviceEntries[0].base_url !== 'https://payable.nsgoods.org' || !isAddress(serviceEntries[0].signer)) {
    return { error: 'payable_service_missing_or_ambiguous' }
  }
  const service = serviceEntries[0]

  const registryEntries = Object.entries(manifest.signer_registry)
  if (registryEntries.some(([address, entry]) => !isAddress(address) || !isObject(entry))) return { error: 'invalid_signer_registry' }
  if (new Set(registryEntries.map(([address]) => address.toLowerCase())).size !== registryEntries.length) return { error: 'ambiguous_signer_registry' }
  const entryFor = (address: string) => registryEntries.find(([candidate]) => sameAddress(candidate, address))?.[1] as Record<string, unknown> | undefined
  const activeForServiceAt = (address: string) => {
    const entry = entryFor(address)
    if (!entry || entry.status !== 'active' || !Array.isArray(entry.services) || !entry.services.includes(pin.service)) return false
    if (entry.valid_from !== null && (typeof entry.valid_from !== 'string' || !Number.isFinite(Date.parse(entry.valid_from)) || atMs < Date.parse(entry.valid_from))) return false
    if (entry.valid_until !== null && (typeof entry.valid_until !== 'string' || !Number.isFinite(Date.parse(entry.valid_until)) || atMs > Date.parse(entry.valid_until))) return false
    return true
  }

  const reachable = new Set<string>([pin.signerAddress.toLowerCase()])
  const rotations = manifest.signer_rotations as unknown[]
  let advanced = true
  while (advanced) {
    advanced = false
    for (const value of rotations) {
      if (!isObject(value) || !isAddress(value.address_old) || !isAddress(value.address_new) || sameAddress(value.address_old, value.address_new) ||
        typeof value.old_valid_until !== 'string' || !Number.isFinite(Date.parse(value.old_valid_until)) ||
        typeof value.new_valid_from !== 'string' || !Number.isFinite(Date.parse(value.new_valid_from)) ||
        typeof value.announced_at !== 'string' || !Number.isFinite(Date.parse(value.announced_at)) ||
        !Array.isArray(value.services) || !value.services.every((item) => typeof item === 'string')) {
        return { error: 'invalid_signer_rotation' }
      }
      if (!value.services.includes(pin.service)) continue
      const oldAddress = value.address_old.toLowerCase()
      const newAddress = value.address_new.toLowerCase()
      const oldUntilMs = Date.parse(value.old_valid_until)
      const newFromMs = Date.parse(value.new_valid_from)
      const announcedAtMs = Date.parse(value.announced_at)
      if (announcedAtMs > newFromMs || newFromMs > oldUntilMs) return { error: 'invalid_signer_rotation_boundary' }
      const oldEntry = entryFor(value.address_old)
      const newEntry = entryFor(value.address_new)
      if (!oldEntry || !newEntry || oldEntry.valid_until !== value.old_valid_until || newEntry.valid_from !== value.new_valid_from) {
        return { error: 'rotation_registry_boundary_mismatch' }
      }
      if (reachable.has(oldAddress) && atMs >= newFromMs && !reachable.has(newAddress)) {
        reachable.add(newAddress)
        advanced = true
      }
    }
  }

  const signerAddresses = registryEntries
    .map(([address]) => address)
    .filter((address) => reachable.has(address.toLowerCase()) && activeForServiceAt(address))
  if (signerAddresses.length === 0 || !signerAddresses.some((address) => sameAddress(address, service.signer as string))) {
    return { error: 'manifest_signer_inactive_unannounced_or_service_mismatched' }
  }
  return { signerAddresses }
}

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
  /** Already-fetched public proof manifest; this adapter never fetches it itself. */
  signerManifest: unknown
  manifestPin?: PayableAddressManifestPin
  preview?: boolean
}): Promise<AddressPreflightDecision> {
  const parsed = parse(raw, options.preview === true)
  if ('error' in parsed) return { decision: 'denied', reasonCodes: [parsed.error], response: null, manifestPinned: false, signatureVerified: false, freshnessSeconds: null }
  const responseTime = new Date(parsed.response.checked_at)
  const trustedSigner = resolvePayableAddressManifestSigner(options.signerManifest, options.manifestPin, responseTime)
  if ('error' in trustedSigner) return { decision: 'denied', reasonCodes: [trustedSigner.error], response: parsed.response, manifestPinned: false, signatureVerified: false, freshnessSeconds: null }
  const { response, signedPayload } = parsed
  if (!sameAddress(response.address, options.address)) return { decision: 'denied', reasonCodes: ['response_address_mismatch'], response, manifestPinned: true, signatureVerified: false, freshnessSeconds: null }
  if (!trustedSigner.signerAddresses.some((address) => sameAddress(address, response.signed_by))) return { decision: 'denied', reasonCodes: ['unannounced_signer_change'], response, manifestPinned: true, signatureVerified: false, freshnessSeconds: null }

  const signatureVerified = await verifyMessage({ address: response.signed_by as `0x${string}`, message: payableAddressCanonicalJson(signedPayload), signature: response.signature })
  if (!signatureVerified) return { decision: 'denied', reasonCodes: ['signature_invalid'], response, manifestPinned: true, signatureVerified: false, freshnessSeconds: null }

  const freshnessSeconds = (options.now ?? new Date()).getTime() / 1000 - Date.parse(response.checked_at) / 1000
  if (freshnessSeconds < -5 || freshnessSeconds > response.freshness_bound_seconds) return { decision: 'denied', reasonCodes: ['preflight_stale_or_future'], response, manifestPinned: true, signatureVerified: true, freshnessSeconds }
  if (response.classification === 'unknown' || response.code_present === 'not_evaluated' || response.transfer_path.result === 'not_evaluated' || response.direct_recipient_plausibility === 'not_evaluated') {
    return { decision: 'denied', reasonCodes: ['required_field_not_evaluated'], response, manifestPinned: true, signatureVerified: true, freshnessSeconds }
  }
  if (response.transfer_path.result === 'simulated_revert') return { decision: 'denied', reasonCodes: ['transfer_path_reverted'], response, manifestPinned: true, signatureVerified: true, freshnessSeconds }
  if (response.classification === 'contract' || response.code_present === true || response.direct_recipient_plausibility === 'requires_application_specific_path') {
    return { decision: 'review_required', reasonCodes: ['contract_recipient_path_not_established'], response, manifestPinned: true, signatureVerified: true, freshnessSeconds }
  }
  return { decision: 'approved_for_pre_money_progress', reasonCodes: ['signed_fresh_eoa_direct_recipient'], response, manifestPinned: true, signatureVerified: true, freshnessSeconds }
}
