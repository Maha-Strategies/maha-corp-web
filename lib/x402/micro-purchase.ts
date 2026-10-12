import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { microDigest } from './micro-products.ts'
import { MICRO_PURCHASE_VERSION, MICRO_RECOVERY_SECRET_HEADER } from './micro-recovery-contract.ts'
import { IDEMPOTENCY_KEY_HEADER, INPUT_HASH_HEADER } from './admission.ts'

export const microPurchaseIdentitySchema = z.object({
  purchaseId: z.string().regex(/^[a-f0-9]{32}$/),
  recoverySecret: z.string().regex(/^[a-f0-9]{64}$/),
}).strict()
export type MicroPurchaseIdentity = z.infer<typeof microPurchaseIdentitySchema>

/** Save this identity and input in private durable client storage BEFORE signing. */
export function createMicroPurchaseIdentity(): MicroPurchaseIdentity {
  return { purchaseId: randomBytes(16).toString('hex'), recoverySecret: randomBytes(32).toString('hex') }
}
export function microPurchaseHash(offerId: string, input: unknown, identity: MicroPurchaseIdentity): string {
  const parsed = microPurchaseIdentitySchema.parse(identity)
  return microDigest({ version: MICRO_PURCHASE_VERSION, offerId, ...parsed, input })
}
export function microPurchaseHeaders(offerId: string, input: unknown, identity: MicroPurchaseIdentity): Record<string, string> {
  const parsed = microPurchaseIdentitySchema.parse(identity)
  return { [IDEMPOTENCY_KEY_HEADER]: parsed.purchaseId, [MICRO_RECOVERY_SECRET_HEADER]: parsed.recoverySecret,
    [INPUT_HASH_HEADER]: microPurchaseHash(offerId, input, parsed) }
}
export function readMicroPurchase(headers: Headers, offerId: string, input: unknown) {
  const identity = microPurchaseIdentitySchema.safeParse({ purchaseId: headers.get(IDEMPOTENCY_KEY_HEADER), recoverySecret: headers.get(MICRO_RECOVERY_SECRET_HEADER) })
  if (!identity.success) throw new Error('micro_purchase_identity_required')
  if (headers.get(INPUT_HASH_HEADER) !== microPurchaseHash(offerId, input, identity.data)) throw new Error('micro_purchase_binding_mismatch')
  return { ...identity.data, inputHash: headers.get(INPUT_HASH_HEADER)!, secretHash: 'sha256:' + createHash('sha256').update(identity.data.recoverySecret).digest('hex') }
}
