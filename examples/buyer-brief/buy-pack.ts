import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { open, readFile } from 'node:fs/promises'
import { createPaidFetch, type TypedDataSigner } from '../../lib/x402/client.ts'
export const PAYEE = '0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28'
export const ASSET = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
import { BUYER_BRIEF_RESOURCE, BUYER_BRIEF_TERMS_HASH, briefHash, briefOrderHash, parseBriefOrder, type BriefOrder } from '../../lib/x402/buyer-brief-contract.ts'

export function preparePackOrder(bundleHash:string):BriefOrder {
  return parseBriefOrder({clientRequestId:'octopus-'+randomUUID(),version:'1.0.0',bundleHash,termsHash:BUYER_BRIEF_TERMS_HASH,recoverySecret:randomBytes(32).toString('hex')})
}
export function validatePackDelivery(value:unknown,order:BriefOrder) {
  const v=value as {productId:string;version:string;orderId:string;transaction:string;archive:{base64:string;sha256:string;bytes:number}}
  assert.equal(v.productId,'cabezon-buyer-brief-pack');assert.equal(v.version,order.version)
  assert.equal(v.orderId,order.clientRequestId)
  assert.match(v.transaction,/^0x[0-9a-fA-F]{64}$/)
  assert.equal(typeof v.archive.base64,'string');assert.ok(v.archive.base64.length<2800000)
  const bytes=Buffer.from(v.archive.base64,'base64')
  assert.equal(bytes.length,v.archive.bytes);assert.equal(briefHash(bytes),order.bundleHash);assert.equal(v.archive.sha256,order.bundleHash)
  return bytes
}
export async function purchasePack(options:{order:BriefOrder;address:string;signTypedData:TypedDataSigner;statePath:string;approval:{reference:string;inputHash:string;amountBaseUnits:'20000000';expiresAt:string};fetchImpl?:typeof fetch}) {
  const order=parseBriefOrder(options.order)
  assert.ok(options.approval.reference.trim())
  assert.equal(options.approval.inputHash,briefOrderHash(order))
  assert.equal(options.approval.amountBaseUnits,'20000000')
  assert.ok(Date.parse(options.approval.expiresAt)>Date.now())
  assert.match(options.address,/^0x[0-9a-fA-F]{40}$/)
  const network:typeof fetch=(url,init)=>(options.fetchImpl??fetch)(url,{...init,redirect:'error',signal:AbortSignal.timeout(60000)})
  // The buyer must already have reviewed the exact pinned terms and artifact.
  const contractResponse=await network(BUYER_BRIEF_RESOURCE)
  assert.equal(contractResponse.status,200)
  const contract=await contractResponse.json()
  assert.equal(contract.purchaseEnabled,true,'Pack not enabled: do not pay')
  assert.equal(contract.bundle.sha256,order.bundleHash)
  assert.equal(contract.termsHash,order.termsHash)
  let attempted=false
  const paid=createPaidFetch({address:options.address,chainId:8453,signTypedData:options.signTypedData,fetchImpl:network,onPaymentRequired:async(r,{challenge})=>{
    assert.equal(challenge.resource.url,BUYER_BRIEF_RESOURCE)
    assert.equal(r.scheme,'exact');assert.equal(r.network,'eip155:8453');assert.equal(r.amount,'20000000')
    assert.equal(r.asset.toLowerCase(),ASSET);assert.equal(r.payTo.toLowerCase(),PAYEE)
    assert.equal(r.extra?.name,'USD Coin');assert.equal(r.extra?.version,'2')
    assert.ok(Number.isInteger(r.maxTimeoutSeconds)&&r.maxTimeoutSeconds>0&&r.maxTimeoutSeconds<=300)
    assert.ok(Date.parse(options.approval.expiresAt)>Date.now());assert.equal(attempted,false)
    // Save the recovery secret BEFORE signing. Do not log/share this state file.
    const file=await open(options.statePath,'wx',0o600)
    try{await file.writeFile(JSON.stringify({payer:options.address,order,approvalRef:options.approval.reference,status:'attempt_reserved_reconcile_before_retry'}));await file.sync()}
    finally{await file.close()}
    attempted=true
  }})
  const response=await paid(BUYER_BRIEF_RESOURCE,{method:'POST',headers:{'Content-Type':'application/json','x-maha-idempotency-key':order.clientRequestId,'x-maha-input-hash':briefOrderHash(order)},body:JSON.stringify(order)})
  assert.ok(attempted && response.ok)
  const receipt=response.x402?.receipt
  assert.equal(receipt?.success,true);assert.equal(receipt?.network,'eip155:8453')
  const delivery=await response.json();assert.equal(receipt?.transaction,delivery.transaction)
  return {archiveBytes:validatePackDelivery(delivery,order),delivery,settlement:'seller_reported_independent_chain_check_required',acceptance:'buyer_review_required'}
}
export async function recoverPack(statePath:string,fetchImpl=globalThis.fetch) {
  const state=JSON.parse(await readFile(statePath,'utf8'))
  const order=parseBriefOrder(state.order)
  assert.match(state.payer,/^0x[0-9a-fA-F]{40}$/)
  const r=await fetchImpl(BUYER_BRIEF_RESOURCE+'/retrieve',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json'},body:JSON.stringify({payer:state.payer,order})})
  assert.equal(r.status,200,'Recovery unavailable: contact seller; do not pay again')
  const delivery=await r.json()
  return {archiveBytes:validatePackDelivery(delivery,order),delivery,settlement:'ledger_reported_independent_chain_check_required'}
}

export async function requestPackSupport(statePath:string,kind:'delivery_problem'|'correction_requested'|'refund_requested',fetchImpl=globalThis.fetch) {
  assert.ok(['delivery_problem','correction_requested','refund_requested'].includes(kind))
  const state=JSON.parse(await readFile(statePath,'utf8')),order=parseBriefOrder(state.order)
  assert.match(state.payer,/^0x[0-9a-fA-F]{40}$/)
  const r=await fetchImpl(BUYER_BRIEF_RESOURCE+'/support',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json'},body:JSON.stringify({payer:state.payer,order,kind})})
  assert.equal(r.status,202,'Contact mayone@mahastrategies.com with order ID only; never email the secret')
  return r.json()
}
