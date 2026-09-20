import assert from 'node:assert/strict'
import test from 'node:test'
import { randomBytes } from 'node:crypto'
import { buyerBriefHandlers } from '../lib/x402/buyer-brief-route.ts'
import { BUYER_BRIEF_OFFER } from '../lib/x402/buyer-brief-offer.ts'
import { briefHash, briefOrderHash, BUYER_BRIEF_RESOURCE, BUYER_BRIEF_TERMS_HASH, parseBriefOrder } from '../lib/x402/buyer-brief-contract.ts'
import { authorizeBriefRecovery, loadBriefBundle } from '../lib/x402/buyer-brief-delivery.ts'
import { validateAdmissionBody } from '../lib/x402/admission-body.ts'
import { apiProxyGate } from '../lib/api-proxy-policy.ts'
const bytes=Buffer.from('synthetic archive, not a real sale')
const bundle={version:'1.0.0',filename:'test.tar.gz',sha256:briefHash(bytes),bytes:bytes.length,base64:bytes.toString('base64'),sourceManifestHash:briefHash('sources')}
const order=()=>({clientRequestId:'octopus-test-0001',version:'1.0.0',bundleHash:bundle.sha256,termsHash:BUYER_BRIEF_TERMS_HASH,recoverySecret:randomBytes(32).toString('hex')})
const transaction='0x'+'a'.repeat(64)
const payer='0x'+'1'.repeat(40)
const row=(o:ReturnType<typeof order>)=>({state:'settled',payment_transaction:transaction,input_hash:briefOrderHash(o),resource:BUYER_BRIEF_RESOURCE,amount:'20000000'})
const request=(o:ReturnType<typeof order>,extra:Record<string,string>={})=>new Request(BUYER_BRIEF_RESOURCE,{method:'POST',headers:{'content-type':'application/json','x-maha-idempotency-key':o.clientRequestId,'x-maha-input-hash':briefOrderHash(o),...extra},body:JSON.stringify(o)})
test('withheld by default; GET discloses pins but not archive bytes',async()=>{
  const h=buyerBriefHandlers({load:async()=>bundle,enabled:false,resolve:async()=>{assert.fail('must not resolve')}})
  assert.equal((await h.POST(request(order()))).status,503)
  const contract=await(await h.GET()).json()
  assert.equal(contract.purchaseEnabled,false);assert.equal(contract.bundle.base64,undefined)
  assert.equal(contract.bundle.sha256,bundle.sha256)
})
test('valid paid response contains exact bundle and always releases slot',async()=>{
  let releases=0
  const o=order()
  const h=buyerBriefHandlers({enabled:true,notificationsReady:async()=>true,load:async()=>bundle,resolve:async()=>({kind:'paid',header:'test-receipt',transaction,payer,amountPaid:'20000000',slot:{resource:BUYER_BRIEF_OFFER.id,token:'test'}}),release:async()=>{releases++}})
  const r=await h.POST(request(o));const body=await r.json()
  assert.equal(r.status,200);assert.equal(body.archive.base64,bundle.base64);assert.equal(body.orderId,o.clientRequestId)
  assert.equal(body.recoverySecret,undefined);assert.equal(body.acceptance,'buyer_review_required');assert.equal(releases,1)
})
test('changed artifact, bad headers, extra fields and oversized input reject before payment',async()=>{
  let calls=0
  const h=buyerBriefHandlers({enabled:true,notificationsReady:async()=>true,load:async()=>bundle,resolve:async()=>{calls++;assert.fail('must not settle')}})
  const o=order()
  assert.equal((await h.POST(request({...o,bundleHash:briefHash('different')}))).status,409)
  assert.equal((await h.POST(request(o,{'x-maha-input-hash':briefHash('wrong')}))).status,409)
  for(const raw of [JSON.stringify({...o,extra:true}),'x'.repeat(2049)]) {
    const r=await h.POST(new Request(BUYER_BRIEF_RESOURCE,{method:'POST',headers:{'content-type':'application/json'},body:raw}))
    assert.ok([400,413].includes(r.status))
  }
  assert.equal(calls,0)
})
test('authorization headers and substituted origin fail closed',async()=>{
  const h=buyerBriefHandlers({enabled:true,notificationsReady:async()=>true,load:async()=>bundle,resolve:async()=>{assert.fail('must not settle')}})
  assert.equal((await h.POST(request(order(),{authorization:'Bearer pretend'}))).status,400)
  assert.equal((await h.POST(new Request('https://other.example/api/v1/cabezon/buyer-brief',{method:'POST'}))).status,400)
})
test('recovery delivers without gateway or a new payment, even when purchasing disabled',async()=>{
  const o=order()
  const h=buyerBriefHandlers({enabled:false,load:async()=>bundle,find:async()=>row(o),resolve:async()=>{assert.fail('no payment for recovery')}})
  const r=await h.RETRIEVE(new Request(BUYER_BRIEF_RESOURCE+'/retrieve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({payer,order:o})}))
  assert.equal(r.status,200);assert.equal((await r.json()).recovered,true)
})
test('wrong secret, unsettled order, wrong resource, amount and transaction do not recover',()=>{
  const o=order()
  assert.throws(()=>authorizeBriefRecovery({...o,recoverySecret:randomBytes(32).toString('hex')},row(o)))
  for(const change of [{state:'reserved'},{amount:'10000'},{resource:BUYER_BRIEF_RESOURCE+'/other'},{payment_transaction:null},{input_hash:briefHash('other')}])assert.throws(()=>authorizeBriefRecovery(o,{...row(o),...change}))
  assert.throws(()=>authorizeBriefRecovery(o,null))
})
test('malformed/unknown terms refused and recovery secrets never accepted in query strings',async()=>{
  assert.throws(()=>parseBriefOrder({...order(),termsHash:briefHash('unapproved')}))
  assert.throws(()=>parseBriefOrder({...order(),recoverySecret:'a'.repeat(64)}))
  const h=buyerBriefHandlers({load:async()=>bundle})
  assert.equal((await h.RETRIEVE(new Request(BUYER_BRIEF_RESOURCE+'/retrieve?secret=redacted',{method:'POST'}))).status,400)
})
test('gateway admission independently checks body binding',async()=>{
  const o=order()
  const claim={offerId:BUYER_BRIEF_OFFER.id,idempotencyKey:o.clientRequestId,inputHash:briefOrderHash(o),resource:BUYER_BRIEF_RESOURCE,amount:'20000000'}
  assert.deepEqual(await validateAdmissionBody(request(o),BUYER_BRIEF_OFFER,claim),{ok:true})
  assert.equal((await validateAdmissionBody(request(o),BUYER_BRIEF_OFFER,{...claim,inputHash:briefHash('wrong')})).ok,false)
})
test('exact self-managed paths only; generated artifact bytes pass integrity check',async()=>{
  assert.equal(apiProxyGate('/api/v1/cabezon/buyer-brief','POST',true),'self_managed')
  assert.equal(apiProxyGate('/api/v1/cabezon/buyer-brief/retrieve','POST',true),'self_managed')
  assert.equal(apiProxyGate('/api/v1/cabezon/buyer-brief/other','POST',true),'protected')
  const real=await loadBriefBundle();assert.ok(real.bytes>0)
})
