import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createAgentInquiryLedger } from '../agent-inquiry-ledger.ts'
import { briefHash, briefOrderHash, BUYER_BRIEF_AMOUNT, BUYER_BRIEF_ID, BUYER_BRIEF_RESOURCE, BUYER_BRIEF_VERSION, type BriefOrder } from './buyer-brief-contract.ts'
export type BriefBundle = { version:string; filename:string; sha256:string; bytes:number; base64:string; sourceManifestHash:string }
export async function loadBriefBundle(): Promise<BriefBundle> {
  const b = JSON.parse(await readFile(join(process.cwd(),'content/buyer-brief/bundle.json'),'utf8')) as BriefBundle
  const bytes=Buffer.from(b.base64,'base64')
  if (b.version !== BUYER_BRIEF_VERSION || bytes.length !== b.bytes || briefHash(bytes)!==b.sha256 || b.bytes>2000000) throw new Error('bundle_integrity_failure')
  return b
}
export type PaidBriefRecord = {state:string;payment_transaction:string|null;input_hash:string;resource:string;amount:string|number}
export async function findPaidBrief(payer:string,orderId:string):Promise<PaidBriefRecord|null> {
  const ledger=createAgentInquiryLedger()
  if(!ledger) throw new Error('ledger_unavailable')
  if(!/^0x[0-9a-fA-F]{40}$/.test(payer)) throw new Error('invalid_payer')
  const {data,error}=await ledger.from('x402_offer_admissions').select('state,payment_transaction,input_hash,resource,amount').eq('offer_id',BUYER_BRIEF_ID).ilike('payer',payer).eq('idempotency_key',orderId).maybeSingle()
  if(error) throw new Error('ledger_unavailable')
  return data as PaidBriefRecord|null
}
export function authorizeBriefRecovery(order:BriefOrder,row:PaidBriefRecord|null):string {
  if(!row || row.state!=='settled' || !/^0x[0-9a-fA-F]{64}$/.test(row.payment_transaction??'') || row.input_hash!==briefOrderHash(order) || row.resource!==BUYER_BRIEF_RESOURCE || String(row.amount)!==BUYER_BRIEF_AMOUNT) throw new Error('paid_order_not_found')
  return row.payment_transaction!
}
export function briefDelivery(order:BriefOrder,bundle:BriefBundle,transaction:string,recovered:boolean) {
  if(order.bundleHash!==bundle.sha256) throw new Error('bundle_version_unavailable')
  return {productId:BUYER_BRIEF_ID,version:bundle.version,clientRequestId:order.clientRequestId,orderId:order.clientRequestId,transaction,recovered,delivery:'inline_base64_archive',archive:bundle,acceptance:'buyer_review_required',limitations:['Seller-authored assisted pilot','Payment is not delivery or correctness','Verify archive against the approved digest before extraction']}
}
