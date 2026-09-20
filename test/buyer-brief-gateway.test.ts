import assert from 'node:assert/strict'
import test from 'node:test'
import { randomBytes } from 'node:crypto'
import { buyerBriefHandlers } from '../lib/x402/buyer-brief-route.ts'
import { BUYER_BRIEF_OFFER } from '../lib/x402/buyer-brief-offer.ts'
import { BUYER_BRIEF_RESOURCE, BUYER_BRIEF_TERMS_HASH, briefHash, briefOrderHash } from '../lib/x402/buyer-brief-contract.ts'
import { x402Config } from '../lib/x402/config.ts'
import { resolveX402 } from '../lib/x402/gateway.ts'
const payer='0x'+'1'.repeat(40), tx='0x'+'2'.repeat(64)
const bytes=Buffer.from('test'), bundle={version:'1.0.0',filename:'test.tar.gz',sha256:briefHash(bytes),bytes:4,base64:bytes.toString('base64'),sourceManifestHash:briefHash('sources')}
const order={clientRequestId:'octopus-gateway-test',version:'1.0.0',bundleHash:bundle.sha256,termsHash:BUYER_BRIEF_TERMS_HASH,recoverySecret:randomBytes(32).toString('hex')}
test('real gateway: order admission settles once; replay returns same artifact; capacity refuses before settlement',async()=>{
  const config=x402Config({X402_ENABLED:'true',X402_FACILITATOR_URL:'https://facilitator.example',X402_PAY_TO:'0x'+'3'.repeat(40),X402_ASSET:'0x'+'4'.repeat(40),X402_NETWORK:'base',X402_RESOURCES:JSON.stringify([{method:'POST',path:BUYER_BRIEF_OFFER.path}])})!
  let settlements=0,paid=false,capacity=true
  const resolve:typeof resolveX402=(request)=>resolveX402(request,{
    config,
    facilitator:{verify:async()=>({ok:true,payer}),settle:async()=>{settlements++;return {ok:true,payer,transaction:tx}}},
    ledger:{rpc:async()=>({data:'claimed',error:null})},
    admissionLedger:{rpc:async(name)=>{if(name==='settle_x402_admission')paid=true;return {data:[{decision:paid?'already_paid':'proceed',payment_transaction:paid?tx:null}],error:null}}},
    acquire:async()=>({admitted:capacity,active:capacity?1:2,token:capacity?'slot':undefined}),release:async()=>{},confirmOnChain:async()=>({status:'confirmed'}),
  })
  const h=buyerBriefHandlers({enabled:true,notificationsReady:async()=>true,load:async()=>bundle,resolve,release:async()=>{}})
  function request(signature?:string){return new Request(BUYER_BRIEF_RESOURCE,{method:'POST',headers:{'content-type':'application/json','x-maha-idempotency-key':order.clientRequestId,'x-maha-input-hash':briefOrderHash(order),...(signature?{'PAYMENT-SIGNATURE':signature}:{})},body:JSON.stringify(order)})}
  const quote=await h.POST(request());assert.equal(quote.status,402)
  const c=await quote.json()
  const signature=Buffer.from(JSON.stringify({x402Version:2,resource:c.resource,accepted:c.accepts[0],extensions:c.extensions,payload:{signature:'0x00'}})).toString('base64')
  capacity=false
  assert.equal((await h.POST(request(signature))).status,429);assert.equal(settlements,0)
  capacity=true
  const first=await h.POST(request(signature));assert.equal(first.status,200)
  const second=await h.POST(request(signature));assert.equal(second.status,200)
  assert.equal((await second.json()).recovered,true);assert.equal(settlements,1)
})
