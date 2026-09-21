import { createAgentInquiryLedger } from '../agent-inquiry-ledger.ts'
import { briefOrderHash, type BriefOrder } from './buyer-brief-contract.ts'
export type BriefNoticeKind='purchase_recorded'|'delivery_problem'|'correction_requested'|'refund_requested'
export type BriefNotice={id:string;payer:string;order_id:string;kind:BriefNoticeKind;payment_transaction:string;created_at:string;lease_id:string}
const labels:Record<BriefNoticeKind,string>={purchase_recorded:'Purchase recorded',delivery_problem:'Delivery problem — action required',correction_requested:'Correction requested — action required',refund_requested:'Refund requested — review required'}
export function briefNoticeEmail(n:BriefNotice) {
  if(!/^[0-9a-f-]{36}$/.test(n.id)||!/^0x[0-9a-fA-F]{40}$/.test(n.payer)||!/^0x[0-9a-fA-F]{64}$/.test(n.payment_transaction)||!Object.hasOwn(labels,n.kind)||!/^[A-Za-z0-9_-]{8,120}$/.test(n.order_id)||!Number.isFinite(Date.parse(n.created_at)))throw new Error('invalid_notification')
  const synthetic=n.order_id.startsWith('notification-test-')&&n.payer==='0x'+'0'.repeat(40)&&n.payment_transaction==='0x'+'0'.repeat(64)
  return {to:'mayone@mahastrategies.com',subject:`[Buyer-Brief] ${synthetic?'TEST — no purchase':labels[n.kind]}: ${n.order_id}`,text:[
    synthetic?'SYNTHETIC NOTIFICATION TEST. No customer purchase, payment, refund or delivery obligation exists. Please confirm receipt to Mayone’s assistant.':'Paid-order notification',
    labels[n.kind],`Order: ${n.order_id}`,`Payer: ${n.payer}`,`Price: 20 USDC on Base`,`Transaction: ${n.payment_transaction}`,`Event recorded: ${n.created_at}`,
    synthetic?'The zero payer and transaction are placeholders for this email test only. No payment admission record was created.':n.kind==='purchase_recorded'?'The payment admission ledger records settlement. The pack is automatically returned by the API; no manual fulfillment is normally required. Buyer receipt and acceptance have NOT been confirmed. Reconcile the transfer independently.':'Review this paid order and contact the buyer through the agreed support channel. Do not issue another charge.',
    'Approved remedy: restore access or correct a covered defect within two business days; otherwise refund the 20 USDC purchase price after order verification. Refunds require human review; this email does not initiate one.',
    'No recovery secret, payment signature, archive, or customer document is included. This is an invited assisted pilot, not evidence of organic demand.',
  ].join('\n\n')}
}
export async function buyerBriefNotificationsReady() {
  if(!process.env.RESEND_API_KEY || !process.env.CRON_SECRET || !(process.env.BUYER_BRIEF_FROM_EMAIL||process.env.MPS_PREFLIGHT_FROM_EMAIL))return false
  const ledger=createAgentInquiryLedger();if(!ledger)return false
  try {const {data,error}=await ledger.rpc('buyer_brief_notifications_ready');return !error&&data===true}catch{return false}
}
export async function enqueueBriefNotice(payer:string,order:BriefOrder,kind:Exclude<BriefNoticeKind,'purchase_recorded'>):Promise<string> {
  const ledger=createAgentInquiryLedger();if(!ledger)throw new Error('notification_ledger_unavailable')
  const {data,error}=await ledger.rpc('enqueue_buyer_brief_notification',{p_payer:payer,p_order_id:order.clientRequestId,p_input_hash:briefOrderHash(order),p_kind:kind})
  if(error||typeof data!=='string')throw new Error('notification_queue_failed')
  return data
}
type Mail = ReturnType<typeof briefNoticeEmail>
type DispatchDeps={claim:()=>Promise<BriefNotice[]>;send:(email:Mail,key:string)=>Promise<string>;finish:(event:BriefNotice,providerId:string|null)=>Promise<void>}
export async function dispatchBriefNotices(d:DispatchDeps) {
  let accepted=0,failed=0
  for(const event of await d.claim()) {
    let providerId:string|null=null
    try{providerId=await d.send(briefNoticeEmail(event),`buyer-brief/${event.id}`);if(!providerId)throw new Error('missing_provider_id')}
    catch{failed++}
    // If acknowledgement fails, the lease expires; retry uses the SAME provider
    // idempotency key. Do not change the message body between attempts.
    await d.finish(event,providerId)
    if(providerId)accepted++
  }
  return {providerAccepted:accepted,failed,inboxDeliveryConfirmed:false}
}
export async function deliverBriefNotices() {
  const ledger=createAgentInquiryLedger(),key=process.env.RESEND_API_KEY,from=process.env.BUYER_BRIEF_FROM_EMAIL||process.env.MPS_PREFLIGHT_FROM_EMAIL
  if(!ledger||!key||!from||/[\r\n]/.test(from))throw new Error('notifications_unconfigured')
  const result=await dispatchBriefNotices({
    claim:async()=>{const {data,error}=await ledger.rpc('claim_buyer_brief_notifications');if(error)throw new Error('notification_claim_failed');return(data??[]) as BriefNotice[]},
    send:async(email,idempotencyKey)=>{
      const r=await fetch('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({from,...email})})
      if(!r.ok)throw new Error('email_provider_refused')
      const result=await r.json();if(typeof result.id!=='string')throw new Error('email_provider_missing_id');return result.id
    },
    finish:async(event,providerId)=>{
      const {data,error}=await ledger.from('buyer_brief_notifications').update({state:providerId?'sent':'pending',provider_id:providerId,sent_at:providerId?new Date().toISOString():null,next_attempt_at:new Date(Date.now()+300000).toISOString(),lease_id:null,lease_until:null}).eq('id',event.id).eq('lease_id',event.lease_id).eq('state','sending').select('id')
      if(error||data?.length!==1)throw new Error('notification_ack_failed')
    },
  })
  const {count,error}=await ledger.from('buyer_brief_notifications').select('id',{count:'exact',head:true}).eq('state','manual_review')
  if(error||count===null)throw new Error('notification_backlog_unknown')
  return {...result,manualReview:count}
}
