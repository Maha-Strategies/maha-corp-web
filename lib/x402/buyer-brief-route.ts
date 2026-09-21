import { BUYER_BRIEF_OFFER } from './buyer-brief-offer.ts'
import { BUYER_BRIEF_PATH, BUYER_BRIEF_RESOURCE, BUYER_BRIEF_TERMS, BUYER_BRIEF_TERMS_HASH, briefOrderHash, parseBriefOrder } from './buyer-brief-contract.ts'
import { authorizeBriefRecovery, briefDelivery, findPaidBrief, loadBriefBundle } from './buyer-brief-delivery.ts'
import { resolveX402 } from './gateway.ts'
import { releaseHeldSlot } from './slot.ts'
import { buyerBriefNotificationsReady, enqueueBriefNotice } from './buyer-brief-notifications.ts'
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}
const json=(body:unknown,status=200,extra:Record<string,string>={})=>Response.json(body,{status,headers:{...headers,...extra}})
const fail=(code:string,status:number)=>json({error:{code}},status)
async function readBody(request:Request) {
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??'')) throw new Error('unsupported_media_type')
  const reader=request.body?.getReader(); if(!reader) throw new Error('invalid_order')
  const chunks:Uint8Array[]=[]; let size=0
  try { while(true){ const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();throw new Error('payload_too_large')}chunks.push(value) } }
  finally{reader.releaseLock()}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
type Dependencies={resolve?:typeof resolveX402;release?:typeof releaseHeldSlot;load?:typeof loadBriefBundle;find?:typeof findPaidBrief;enabled?:boolean;notificationsReady?:typeof buyerBriefNotificationsReady;notify?:typeof enqueueBriefNotice}
export function buyerBriefHandlers(d:Dependencies={}) {
  const load=d.load??loadBriefBundle, resolve=d.resolve??resolveX402, release=d.release??releaseHeldSlot
  const ready=d.notificationsReady??buyerBriefNotificationsReady, notify=d.notify??enqueueBriefNotice
  // Explicit additional gate, never enabled merely by adding a catalogue row.
  const enabled=()=>d.enabled??(process.env.X402_BUYER_BRIEF_ENABLED==='true' && BUYER_BRIEF_OFFER.status==='available')
  return {
    GET:async()=>{
      try { const {base64:_,...bundle}=await load();return json({offer:BUYER_BRIEF_OFFER,purchaseEnabled:enabled()&&await ready(),support:BUYER_BRIEF_RESOURCE+'/support',bundle,terms:BUYER_BRIEF_TERMS,termsHash:BUYER_BRIEF_TERMS_HASH,retrieve:BUYER_BRIEF_RESOURCE+'/retrieve',recovery:'POST {payer,order}; order is the exact original body including private recoverySecret. No payment header, wallet signature or second payment. Keep the secret out of URLs and logs.'}) }
      catch{return fail('bundle_unavailable',503)}
    },
    POST:async(request:Request)=>{
      if(!enabled())return fail('buyer_brief_not_enabled',503)
      if(!await ready())return fail('seller_notifications_not_ready',503)
      const url=new URL(request.url)
      if(url.origin!=='https://www.mahastrategies.com' || url.pathname!==BUYER_BRIEF_PATH || url.search || request.method!=='POST')return fail('resource_mismatch',400)
      if(request.headers.has('authorization')||request.headers.has('x-api-key'))return fail('x402_only_no_api_credits',400)
      let order,bundle
      try {
        order=parseBriefOrder(await readBody(request));bundle=await load()
        if(order.bundleHash!==bundle.sha256)return fail('bundle_changed_reapprove',409)
        if(request.headers.get('x-maha-idempotency-key')!==order.clientRequestId || request.headers.get('x-maha-input-hash')!==briefOrderHash(order))return fail('order_headers_mismatch',409)
      } catch(e){const code=e instanceof Error?e.message:'invalid_order';return fail(code==='payload_too_large'?code:code==='unsupported_media_type'?code:'invalid_or_unavailable_order',code==='payload_too_large'?413:code==='unsupported_media_type'?415:400)}
      try {
        const outcome=await resolve(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(order)}))
        if(outcome.kind==='not_applicable')return fail('offer_not_configured',503)
        if(outcome.kind==='challenge')return json(outcome.body,402,{'PAYMENT-REQUIRED':outcome.header})
        if(outcome.kind==='refused')return fail(outcome.code,outcome.status)
        try {return json(briefDelivery(order,bundle,outcome.transaction,Boolean(outcome.replayed)),200,{'PAYMENT-RESPONSE':outcome.header})}
        catch {await notify(outcome.payer,order,'delivery_problem').catch(()=>console.error('[BUYER_BRIEF_NOTICE_QUEUE_FAILED]'));return fail('delivery_unavailable_recover_do_not_repay',503)}
        finally {await release(outcome.slot)}
      }catch{return fail('payment_outcome_unknown_reconcile_do_not_repay',503)}
    },
    RETRIEVE:async(request:Request)=>{
      if(new URL(request.url).search || request.method!=='POST' || request.headers.has('PAYMENT-SIGNATURE') || request.headers.has('authorization'))return fail('retrieval_request_invalid',400)
      try {
        const v=await readBody(request)
        if(typeof v.payer!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(v.payer)||Object.keys(v).sort().join(',')!=='order,payer')return fail('retrieval_request_invalid',400)
        const order=parseBriefOrder(v.order)
        const row=await(d.find??findPaidBrief)(v.payer.toLowerCase(),order.clientRequestId)
        const transaction=authorizeBriefRecovery(order,row)
        try{return json(briefDelivery(order,await load(),transaction,true))}
        catch{await notify(v.payer,order,'delivery_problem').catch(()=>console.error('[BUYER_BRIEF_NOTICE_QUEUE_FAILED]'));return fail('delivery_unavailable_contact_seller_do_not_repay',503)}
      }catch{return fail('recovery_unavailable_contact_seller_do_not_repay',404)}
    },
    SUPPORT:async(request:Request)=>{
      if(new URL(request.url).search || request.method!=='POST' || request.headers.has('PAYMENT-SIGNATURE') || request.headers.has('authorization'))return fail('support_request_invalid',400)
      try{
        const v=await readBody(request)
        if(Object.keys(v).sort().join(',')!=='kind,order,payer'||typeof v.payer!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(v.payer)||!['delivery_problem','correction_requested','refund_requested'].includes(v.kind))return fail('support_request_invalid',400)
        const order=parseBriefOrder(v.order)
        authorizeBriefRecovery(order,await(d.find??findPaidBrief)(v.payer.toLowerCase(),order.clientRequestId))
        const ticket=await notify(v.payer,order,v.kind)
        return json({ticket,status:'queued',emailDeliveryConfirmed:false,refundInitiated:false,contact:'mayone@mahastrategies.com',instructions:'Email details with your order ID. Never email your recovery secret or payment signature.'},202)
      }catch{return fail('support_unavailable_contact_seller',503)}
    },
    OPTIONS:async()=>new Response(null,{status:204,headers:{...headers,Allow:'GET, POST, OPTIONS'}}),
  }
}
