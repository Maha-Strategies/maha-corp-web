import assert from 'node:assert/strict'
import test from 'node:test'
import { randomBytes } from 'node:crypto'
import { briefNoticeEmail, dispatchBriefNotices, type BriefNotice } from '../lib/x402/buyer-brief-notifications.ts'
import { buyerBriefHandlers } from '../lib/x402/buyer-brief-route.ts'
import { BUYER_BRIEF_RESOURCE, BUYER_BRIEF_TERMS_HASH, briefHash, briefOrderHash } from '../lib/x402/buyer-brief-contract.ts'
import { GET as cron } from '../app/api/cron/buyer-brief-notifications/route.ts'
const event:BriefNotice={id:'12345678-1234-1234-1234-123456789abc',payer:'0x'+'a'.repeat(40),order_id:'test-order-123',kind:'purchase_recorded',payment_transaction:'0x'+'b'.repeat(64),created_at:'2026-09-20T00:00:00Z',lease_id:'test-lease'}
test('cron refuses missing authentication without dispatch',async()=>{
  assert.equal((await cron(new Request('https://www.mahastrategies.com/api/cron/buyer-brief-notifications'))).status,401)
})
test('notice uses fixed seller recipient, minimal metadata and qualified delivery status',()=>{
  const mail=briefNoticeEmail({...event,recoverySecret:'secret-value'} as BriefNotice)
  assert.equal(mail.to,'mayone@mahastrategies.com')
  assert.ok(!JSON.stringify(mail).includes('secret-value'))
  assert.match(mail.text,/NOT been confirmed/);assert.match(mail.text,/two business days/)
  assert.throws(()=>briefNoticeEmail({...event,order_id:'bad\nSubject: injected'}))
})
test('provider failure remains retryable; retries use stable idempotency key',async()=>{
  const keys:string[]=[],results:(string|null)[]=[]
  for(const fail of [true,false]){
    const result=await dispatchBriefNotices({claim:async()=>[event],send:async(_,key)=>{keys.push(key);if(fail)throw Error('offline');return 'mail-123'},finish:async(_,id)=>{results.push(id)}})
    assert.equal(result.inboxDeliveryConfirmed,false);assert.equal(result.failed,Number(fail))
  }
  assert.equal(keys[0],keys[1]);assert.deepEqual(results,[null,'mail-123'])
})
test('unacknowledged provider acceptance propagates rather than silently losing event',async()=>{
  await assert.rejects(dispatchBriefNotices({claim:async()=>[event],send:async()=> 'mail-123',finish:async()=>{throw Error('database down')}}))
})
const order=()=>({clientRequestId:'test-order-123',version:'1.0.0',bundleHash:briefHash('archive'),termsHash:BUYER_BRIEF_TERMS_HASH,recoverySecret:randomBytes(32).toString('hex')})
const req=(body:unknown)=>new Request(BUYER_BRIEF_RESOURCE+'/support',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
test('missing notification readiness prevents payment',async()=>{
  const h=buyerBriefHandlers({enabled:true,notificationsReady:async()=>false,resolve:async()=>{assert.fail('no settlement')}})
  assert.equal((await h.POST(req(order()))).status,503)
})
test('authenticated refund request queues once per invocation but does not refund; wrong secret rejected',async()=>{
  const o=order();let queued=0
  const h=buyerBriefHandlers({enabled:false,find:async()=>({state:'settled',payment_transaction:event.payment_transaction,input_hash:briefOrderHash(o),resource:BUYER_BRIEF_RESOURCE,amount:'20000000'}),notify:async(_,actual,kind)=>{assert.equal(actual.recoverySecret,o.recoverySecret);assert.equal(kind,'refund_requested');queued++;return event.id}})
  const r=await h.SUPPORT(req({payer:event.payer,order:o,kind:'refund_requested'}))
  assert.equal(r.status,202);const b=await r.json();assert.equal(b.refundInitiated,false);assert.equal(b.emailDeliveryConfirmed,false)
  assert.ok(!JSON.stringify(b).includes(o.recoverySecret))
  assert.equal((await h.SUPPORT(req({payer:event.payer,order:{...o,recoverySecret:randomBytes(32).toString('hex')},kind:'refund_requested'}))).status,503)
  assert.equal(queued,1)
})
test('authenticated retrieval failure raises delivery notice even when sales disabled',async()=>{
  const o=order();let queued=0
  const h=buyerBriefHandlers({enabled:false,find:async()=>({state:'settled',payment_transaction:event.payment_transaction,input_hash:briefOrderHash(o),resource:BUYER_BRIEF_RESOURCE,amount:'20000000'}),load:async()=>{throw Error('missing archive')},notify:async(_,__,kind)=>{assert.equal(kind,'delivery_problem');queued++;return event.id}})
  assert.equal((await h.RETRIEVE(req({payer:event.payer,order:o}))).status,503);assert.equal(queued,1)
})
