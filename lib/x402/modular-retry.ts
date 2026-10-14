import { createDecipheriv, createHmac } from 'node:crypto'
import { validateModularCapsule, type ModularBuyerContract, type ModularCapsule } from './modular-buyer.ts'

function decryptSavedCapsule(key: string, scope: string, id: string, value: unknown): ModularCapsule {
  const outbox = value as { scope?: string; packets?: Array<{ id: string; iv: string; ciphertext: string; tag: string }> }
  if (outbox?.scope !== scope || outbox.packets?.length !== 1) throw Error('previous_outbox_invalid')
  const packet = outbox.packets[0]
  if (packet.id !== id || !/^[a-f0-9]{24}$/.test(packet.iv) || !/^[a-f0-9]{32}$/.test(packet.tag)
    || typeof packet.ciphertext !== 'string' || packet.ciphertext.length > 1048576 || !/^[A-Za-z0-9+/]+={0,2}$/.test(packet.ciphertext)) throw Error('previous_outbox_invalid')
  try {
    const encryptionKey = createHmac('sha256', key).update(scope + ':private-outbox').digest()
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(packet.iv, 'hex'))
    decipher.setAAD(Buffer.from(scope)); decipher.setAuthTag(Buffer.from(packet.tag, 'hex'))
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(packet.ciphertext, 'base64')), decipher.final()]).toString('utf8'))
  } catch { throw Error('previous_outbox_authentication_failed') }
}

// This is an explicit one-off gate for the refused first purchase, not a
// generic reauthorization/resume policy. Decryption runs only in the protected
// signer job. Nothing private is returned to the report or console.
export async function checkRefusedOriginal(o: {
  key: string; payer: string; scope: string; payee: string; maximumBaseUnits: string;
  contract: ModularBuyerContract; report: unknown; outbox: unknown; now: number; chainTimestamp: bigint;
  authorizationUsed(payer: string, nonce: string): Promise<boolean>;
}) {
  const report = o.report as Record<string, unknown>, outbox = o.outbox as { scope?: string; packets?: Array<{ id: string; iv: string; ciphertext: string; tag: string }> }
  const steps = report?.steps as Array<Record<string, unknown>> | undefined
  if (report?.version !== o.scope || report.classification !== 'publisher-funded-operator-activity'
    || report.customerRevenue !== false || report.organicDemand !== false || report.automaticRepayment !== false
    || report.network !== 'eip155:8453' || String(report.buyer).toLowerCase() !== o.payer.toLowerCase()
    || String(report.payee).toLowerCase() !== o.payee.toLowerCase() || report.maximumBaseUnits !== o.maximumBaseUnits
    || report.confirmedBaseUnits !== '0' || report.authorizedBaseUnits !== o.contract.amount
    || report.state !== 'stopped_review_required_no_repayment' || steps?.length !== 1
    || steps[0].id !== o.contract.id || steps[0].path !== o.contract.path || steps[0].amountBaseUnits !== o.contract.amount
    || steps[0].state !== 'authorized_outcome_unknown' || steps[0].transaction || steps[0].chainConfirmed || steps[0].payloadVerified
    || outbox?.scope !== o.scope || outbox.packets?.length !== 1) throw Error('previous_attempt_scope_mismatch')
  const capsule = decryptSavedCapsule(o.key, o.scope, o.contract.id, outbox)
  const { authorization } = await validateModularCapsule(o.contract, capsule, o.now)
  const expectedSecret = createHmac('sha256', o.key).update(o.scope + ':' + o.contract.id).digest('hex')
  if (capsule.payer !== o.payer.toLowerCase() || capsule.headers['X-Maha-Recovery-Secret'] !== expectedSecret) throw Error('previous_authorization_binding_mismatch')
  const expiry = BigInt(String(authorization.validBefore))
  if (BigInt(Math.floor(o.now / 1000)) <= expiry || o.chainTimestamp <= expiry) throw Error('previous_authorization_not_expired')
  if (await o.authorizationUsed(o.payer, String(authorization.nonce))) throw Error('previous_authorization_used_do_not_repay')
  return { previousRunId: '38519203625', previousAuthorizationExpired: true, previousNonceUnused: true,
    checkedAt: new Date(o.now).toISOString(), chainTimestamp: String(o.chainTimestamp), automaticRepayment: false }
}

/** Authenticate the saved first authorization against its ALREADY MINED tx.
 * Returns a private capsule only to the protected caller; only publicEvidence
 * may be copied to reports. It never signs or settles another authorization. */
export async function checkPaidOriginal(o: {
  key: string; payer: string; scope: string; payee: string; maximumBaseUnits: string; transaction: string;
  contract: ModularBuyerContract; report: unknown; outbox: unknown; now: number;
  authorizationUsed(payer: string, nonce: string): Promise<boolean>;
  confirm(input: { transaction: string; payer: string; payee: string; amount: string; nonce: string }): Promise<boolean>;
}) {
  const report = o.report as Record<string, unknown>, steps = report?.steps as Array<Record<string, unknown>> | undefined
  if (report?.version !== o.scope || report.classification !== 'publisher-funded-operator-activity'
    || report.customerRevenue !== false || report.organicDemand !== false || report.automaticRepayment !== false
    || report.network !== 'eip155:8453' || String(report.buyer).toLowerCase() !== o.payer.toLowerCase()
    || String(report.payee).toLowerCase() !== o.payee.toLowerCase() || report.maximumBaseUnits !== o.maximumBaseUnits
    || report.confirmedBaseUnits !== '0' || report.authorizedBaseUnits !== o.contract.amount
    || report.state !== 'stopped_review_required_no_repayment' || steps?.length !== 1
    || steps[0].id !== o.contract.id || steps[0].path !== o.contract.path || steps[0].amountBaseUnits !== o.contract.amount
    || steps[0].status !== 409 || steps[0].errorCode !== 'settlement_unknown_do_not_repay'
    || !/^0x[a-f0-9]{64}$/.test(o.transaction)) throw Error('paid_original_scope_mismatch')
  const capsule = decryptSavedCapsule(o.key, o.scope, o.contract.id, o.outbox)
  const { authorization } = await validateModularCapsule(o.contract, capsule, o.now)
  if (capsule.payer !== o.payer.toLowerCase() || capsule.headers['X-Maha-Recovery-Secret'] !== createHmac('sha256', o.key).update(o.scope + ':' + o.contract.id).digest('hex')) throw Error('previous_authorization_binding_mismatch')
  const nonce = String(authorization.nonce)
  if (!await o.authorizationUsed(o.payer, nonce) || !await o.confirm({ transaction: o.transaction, payer: o.payer.toLowerCase(), payee: o.payee, amount: o.contract.amount, nonce })) throw Error('paid_original_not_chain_confirmed')
  return { capsule, publicEvidence: { previousRunId: '38522050122', originalTransaction: o.transaction,
    originalAuthorizationUsed: true, originalNativeTransferConfirmed: true, noReplacementAuthorization: true, automaticRepayment: false } }
}
