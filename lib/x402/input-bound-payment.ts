import { demandDigest } from './demand6/digest.ts'
export const MODULAR_PAYMENT_VERSION = 'maha-api-v1/1'
/** Buyer-safe, shared wire codec. Contains no server or wallet-key handling. */
export function modularPaymentNonce(productId: string, inputHash: string, recoverySecret: string): `0x${string}` {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productId) || !/^sha256:[a-f0-9]{64}$/.test(inputHash) || !/^[a-f0-9]{64}$/.test(recoverySecret)) throw Error('invalid_purchase_binding')
  return `0x${demandDigest({ version: MODULAR_PAYMENT_VERSION, productId, inputHash, recoverySecret }).slice(7)}`
}
export const modularRecoveryContract = (productId: string) => ({ version: MODULAR_PAYMENT_VERSION, productId,
  inputHash: 'sha256: + lowercase HEX(SHA256(RFC8785(strictly parsed input)))',
  recoverySecret: '32 cryptographically random bytes encoded as 64 lowercase hexadecimal characters; keep private',
  nonce: '0x + lowercase HEX(SHA256(RFC8785({version,productId,inputHash,recoverySecret})))',
  paymentSignatureHeader: 'base64 x402-v2 PaymentPayload with EIP-3009 TransferWithAuthorization',
  automaticRepayment: false })
