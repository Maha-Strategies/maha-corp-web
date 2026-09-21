import { createHash } from 'node:crypto'
export const BUYER_BRIEF_ID = 'cabezon-buyer-brief-pack'
export const BUYER_BRIEF_PATH = '/api/v1/cabezon/buyer-brief'
export const BUYER_BRIEF_RESOURCE = 'https://www.mahastrategies.com' + BUYER_BRIEF_PATH
export const BUYER_BRIEF_AMOUNT = '20000000'
export const BUYER_BRIEF_VERSION = '2.0.0'
export const BUYER_BRIEF_TERMS = 'CABEZON Buyer-Brief Pack v2: 20 USDC for the identified prepared seller-authored archive, one selected service, at most five public sources and 250000 source bytes. Assisted pilot, not independent endorsement. Immediate inline archive delivery; recovery via the secret-bound retrieval route without another payment. One correction pass for errors against the frozen sources requested within seven calendar days. Contact mayone@mahastrategies.com. Seller-approved remedy: restore access or correct a covered defect within two business days; otherwise refund the 20 USDC purchase price after order verification. Additional wallet/network fees are not included or authorized. No video, private data, open-ended integration, accuracy certification, or subsequent API purchases. No redistribution of third-party source material beyond applicable rights. Edition 1 was previously exposed publicly. Edition 2 adds a new CABEZON acceptance exercise and incident kit; shared public code and source declarations are not exclusive. Submitting the exact versioned order with payment authorization accepts these bounded terms.'
export const briefHash = (value: string | Uint8Array) => 'sha256:' + createHash('sha256').update(value).digest('hex')
export const BUYER_BRIEF_TERMS_HASH = briefHash(BUYER_BRIEF_TERMS)
export type BriefOrder = { clientRequestId: string; version: string; bundleHash: string; termsHash: string; recoverySecret: string }
export function parseBriefOrder(value: unknown): BriefOrder {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_order')
  const v = value as Record<string, unknown>
  const keys = ['clientRequestId','version','bundleHash','termsHash','recoverySecret']
  if (Object.keys(v).length !== keys.length || keys.some(k => typeof v[k] !== 'string')) throw new Error('invalid_order_fields')
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(v.clientRequestId as string)) throw new Error('invalid_order_id')
  if (v.version !== BUYER_BRIEF_VERSION || v.termsHash !== BUYER_BRIEF_TERMS_HASH) throw new Error('version_or_terms_changed')
  if (!/^sha256:[a-f0-9]{64}$/.test(v.bundleHash as string)) throw new Error('invalid_bundle_hash')
  if (!/^[a-f0-9]{64}$/.test(v.recoverySecret as string) || new Set(v.recoverySecret as string).size < 8) throw new Error('use_random_32_byte_recovery_secret')
  return Object.fromEntries(keys.map(k=>[k,v[k]])) as BriefOrder
}
// Explicit fixed-key preimage; never hash a caller's JSON serialization directly.
export const briefOrderHash = (value: BriefOrder) => briefHash(JSON.stringify(parseBriefOrder(value)))
