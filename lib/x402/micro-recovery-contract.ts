/** Public protocol declarations. No customer values or server credentials. */
export const MICRO_PURCHASE_VERSION = 'maha-micro-purchase/1'
export const MICRO_RECOVERY_SECRET_HEADER = 'x-maha-recovery-secret'
export const MICRO_RECOVERY_MODE_HEADER = 'x-maha-recovery-mode'
export const MICRO_RECOVERY_PAYER_HEADER = 'x-maha-recovery-payer'
export const MICRO_RECOVERY_WINDOW_DAYS = 30
export const MICRO_PURCHASE_HEADERS = {
  'x-maha-idempotency-key': { algorithm: 'CSPRNG', preimage: '16 cryptographically random bytes, encoded as lowercase hex', format: '32 lowercase hex characters generated from 16 random bytes; persist before payment; reuse for the same purchase' },
  'x-maha-recovery-secret': { algorithm: 'CSPRNG', preimage: '32 cryptographically random bytes, encoded as lowercase hex', format: '64 lowercase hex characters generated from 32 random bytes; private; persist before payment; never put in URLs or logs' },
  'x-maha-input-hash': { algorithm: 'SHA-256', format: 'sha256:<lowercase hex>',
    preimage: 'UTF-8 canonicalMicro({version:"maha-micro-purchase/1",offerId,purchaseId,recoverySecret,input}); input is the exact validated product body. Keys sort recursively; array order is preserved.' },
} as const
export const MICRO_RECOVERY_RETENTION = {
  recoveryWindowDays: MICRO_RECOVERY_WINDOW_DAYS,
  requestBodiesStored: false, resultBodiesStored: false, rawSecretsStored: false, signedPaymentPayloadsStored: false,
  metadataRetention: 'Durable purchase/payment metadata and hash bindings have no automatic deletion. Thirty days limits self-service access, not physical retention. Financial-record and backup retention must be reviewed before deployment; no deletion or anonymization claim is made.',
  access: 'Service-role-only storage. Recovery requires the original purchase ID, payer, private secret and input binding. Hashes are not encryption or proof of lawful input sourcing.',
  recovery: 'Recompute from resubmitted original public/synthetic input and compare with the pre-settlement response digest. Unknown settlement, missing records, expired access or changed response requires operator review; never automatically pay again.',
} as const
