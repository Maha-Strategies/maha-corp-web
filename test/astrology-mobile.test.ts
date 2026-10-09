import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { handleAstrologyMobile } from '../lib/astrology-mobile-api.ts'
import { STORE_REVIEW_USER_ID } from '../lib/astrology-store-review.ts'
test('store reviewer cannot send personal or secondary personal charts to AI',async()=>{
 const oldDigest=process.env.ASTROLOGY_STORE_REVIEW_TOKEN_SHA256,oldExpiry=process.env.ASTROLOGY_STORE_REVIEW_EXPIRES_AT
 process.env.ASTROLOGY_STORE_REVIEW_TOKEN_SHA256='a'.repeat(64);process.env.ASTROLOGY_STORE_REVIEW_EXPIRES_AT=new Date(Date.now()+86400000).toISOString()
 let called=false
 const deps={session:async()=>({userId:STORE_REVIEW_USER_ID,email:'store-review@mahastrategies.com'}),rate:async()=>1,chat:async()=>{called=true;return Response.json({answer:'should not be called'})}}
 try{
  assert.equal((await handleAstrologyMobile(req('chat',{consentToAi:true,chart:{instantUtc:'2000-01-01T00:00:00Z'}},{authorization:`Bearer ${token}`}),deps)).status,400)
  assert.equal((await handleAstrologyMobile(req('chat',{consentToAi:true,secondary:{chart:{instantUtc:'2000-01-01T00:00:00Z'}}},{authorization:`Bearer ${token}`}),deps)).status,400)
  assert.equal(called,false)
 }finally{if(oldDigest===undefined)delete process.env.ASTROLOGY_STORE_REVIEW_TOKEN_SHA256;else process.env.ASTROLOGY_STORE_REVIEW_TOKEN_SHA256=oldDigest;if(oldExpiry===undefined)delete process.env.ASTROLOGY_STORE_REVIEW_EXPIRES_AT;else process.env.ASTROLOGY_STORE_REVIEW_EXPIRES_AT=oldExpiry}
})
import { handleMobileRevenueCatWebhook, verifiedMobilePurchases, verifyRevenueCatSignature, MOBILE_PRODUCTS, mobilePurchaseEnvironment, mobileCheckoutPolicy, fetchMobilePurchases, purchaseDateMatchesEvent } from '../lib/astrology-mobile-billing.ts'
test('receipt timestamps match supplied REST precision without crossing seconds or accepting ambiguity',async()=>{
 const second=Date.parse('2026-10-04T08:03:43Z')
 assert.equal(purchaseDateMatchesEvent('2026-10-04T08:03:43Z',second+132),true)
 assert.equal(purchaseDateMatchesEvent('2026-10-04T08:03:43Z',second-1),false)
 assert.equal(purchaseDateMatchesEvent('2026-10-04T08:03:43Z',second+1000),false)
 assert.equal(purchaseDateMatchesEvent('2026-10-04T08:03:43.132Z',second+133),false)
 const oldApps=process.env.REVENUECAT_ASTROLOGY_APP_IDS
 process.env.REVENUECAT_ASTROLOGY_APP_IDS='fixture-app'
 const writes:unknown[]=[]
 const redis={get:async()=>null,set:async(...args:unknown[])=>{writes.push(args);return 'OK'}} as unknown as ReturnType<typeof import('../lib/redis.ts').getRedis>
 const receipt={id:'canonical-fixture',store:'play_store' as const,is_sandbox:true,purchase_date:'2026-10-04T08:03:43Z'}
 const make=()=>{const t=Math.floor(Date.now()/1000),raw=JSON.stringify({event:{id:crypto.randomUUID(),app_id:'fixture-app',app_user_id:user,environment:'SANDBOX',type:'NON_RENEWING_PURCHASE',product_id:MOBILE_PRODUCTS.dossier,transaction_id:'fixture-order',purchased_at_ms:second+132,event_timestamp_ms:Date.now(),store:'PLAY_STORE'}});return new Request('https://fixture.example/webhook',{method:'POST',headers:{'x-revenuecat-webhook-signature':`t=${t},v1=${createHmac('sha256','fixture-secret').update(`${t}.${raw}`).digest('hex')}`},body:raw})}
 try{
  const deps={redis,environment:'SANDBOX' as const,signingSecret:'fixture-secret',purchases:async()=>({active:null,dossiers:[receipt],environment:'SANDBOX'})}
  assert.equal((await handleMobileRevenueCatWebhook(make(),deps)).status,200)
  assert.equal((writes[0] as [string,{purchasedAt:number}])[1].purchasedAt,second+132)
  writes.length=0
  assert.equal((await handleMobileRevenueCatWebhook(make(),{...deps,purchases:async()=>({active:null,dossiers:[receipt,{...receipt,id:'second-fixture'}],environment:'SANDBOX'})})).status,503)
  assert.equal(writes.length,0)
 }finally{if(oldApps===undefined)delete process.env.REVENUECAT_ASTROLOGY_APP_IDS;else process.env.REVENUECAT_ASTROLOGY_APP_IDS=oldApps}
})
const user='astro_email_'+'b'.repeat(64),token='a'.repeat(64)
function req(service:string,payload:Record<string,unknown>,headers:Record<string,string>={}) {return new Request('https://maha.example/api/astrology/mobile',{method:'POST',headers:{'content-type':'application/json',origin:'capacitor://localhost',...headers},body:JSON.stringify({service,payload})})}
test('mobile rejects hostile origins, forged tokens, oversized bodies and unauthenticated AI',async()=>{
 assert.equal((await handleAstrologyMobile(req('chat',{}, {origin:'https://evil.example'}))).status,403)
 assert.equal((await handleAstrologyMobile(req('chat',{}, {authorization:'Bearer fake'}))).status,401)
 assert.equal((await handleAstrologyMobile(req('chat',{}, {cookie:`__Host-maha_astrology=${token}`}))).status,401)
 assert.equal((await handleAstrologyMobile(req('chat',{text:'x'.repeat(33000)}))).status,413)
})
test('verified opaque mobile session bridges to existing AI without forwarding client cookies or developer keys',async()=>{
 let called=false
 const response=await handleAstrologyMobile(req('chat',{question:'Explain geometry',consentToAi:true}, {authorization:`Bearer ${token}`,cookie:'attacker=chosen'}),{rate:async()=>1,session:async r=>{assert.equal(r.headers.get('cookie'),`__Host-maha_astrology=${token}`);return {userId:user,email:'fictional@example.com'}},chat:async r=>{called=true;assert.equal(r.headers.get('authorization'),null);assert.equal(r.headers.get('origin'),'https://maha.example');assert.equal((await r.json()).consentToAi,undefined);return Response.json({answer:'Fixture answer'})}})
 assert.equal(response.status,200);assert.equal(called,true);assert.equal(response.headers.get('access-control-allow-origin'),'capacitor://localhost');assert.equal(response.headers.get('set-cookie'),null)
})
test('malformed JSON and absent AI consent cannot invoke a provider',async()=>{
 const malformed=new Request('https://maha.example/api/astrology/mobile',{method:'POST',headers:{'content-type':'application/json'},body:'{'})
 assert.equal((await handleAstrologyMobile(malformed)).status,400)
 let called=false
 const result=await handleAstrologyMobile(req('chat',{question:'A question'}, {authorization:`Bearer ${token}`}),{session:async()=>({userId:user,email:'fictional@example.com'}),rate:async()=>1,chat:async()=>{called=true;return Response.json({answer:'not sent'})}})
 assert.equal(result.status,400);assert.equal(called,false)
})
test('mobile cannot open external Stripe checkout and per-account rate is bounded',async()=>{
 const deps={session:async()=>({userId:user,email:'fictional@example.com'}),rate:async()=>1}
 assert.equal((await handleAstrologyMobile(req('platform',{operation:'checkout'}, {authorization:`Bearer ${token}`}),deps)).status,400)
 assert.equal((await handleAstrologyMobile(req('chat',{}, {authorization:`Bearer ${token}`}),{...deps,rate:async()=>31})).status,429)
})
test('OTP emits a token only after resolving a real issued session; cookies stay off the mobile response',async()=>{
 const response=await handleAstrologyMobile(req('auth',{operation:'verify'}),{auth:async r=>{await r.json();return Response.json({signedIn:true},{headers:{'set-cookie':`__Host-maha_astrology=${token}; Path=/; HttpOnly; Secure`}})},session:async r=>{assert.equal(r.body,null);assert.equal(r.headers.get('cookie'),`__Host-maha_astrology=${token}`);return {userId:user,email:'fictional@example.com'}}})
 const body=await response.json();assert.equal(body.token,token);assert.equal(body.accountId,user);assert.equal(response.headers.get('set-cookie'),null)
})
const now=Date.UTC(2026,9,3)
const snapshot=(patch:Record<string,unknown>={})=>({subscriber:{original_app_user_id:user,subscriptions:{[MOBILE_PRODUCTS.monthly]:{store:'app_store',is_sandbox:false,purchase_date:'2026-10-01T00:00:00Z',expires_date:'2026-11-01T00:00:00Z',store_transaction_id:'verified-order',...patch}},non_subscriptions:{}}})
test('paid authority requires owner, exact product, production receipt, unrefunded state and current expiration',()=>{
 assert.equal(verifiedMobilePurchases(snapshot(),user,now).active?.tier,'executive_monthly')
 for(const patch of [{is_sandbox:true},{expires_date:'2026-10-02T00:00:00Z'},{refunded_at:'2026-10-02T00:00:00Z'},{store:'promotional'},{ownership_type:'FAMILY_SHARED'}])assert.equal(verifiedMobilePurchases(snapshot(patch),user,now).active,null)
 assert.throws(()=>verifiedMobilePurchases(snapshot(),user+'x',now),/identity/)
 assert.equal(verifiedMobilePurchases({subscriber:{original_app_user_id:user,subscriptions:{made_up:{}}}},user,now).active,null)
})
test('RevenueCat HMAC rejects forged or stale events and byte changes',()=>{
 const raw=JSON.stringify({event:{id:'fixture'}}),secret='test-only-secret',timestamp=now/1000
 const signature=createHmac('sha256',secret).update(`${timestamp}.${raw}`).digest('hex'),header=`t=${timestamp},v1=${signature}`
 assert.equal(verifyRevenueCatSignature(raw,header,secret,now),true)
 assert.equal(verifyRevenueCatSignature(raw+' ',header,secret,now),false)
 assert.equal(verifyRevenueCatSignature(raw,header,secret,now+301000),false)
 assert.equal(verifyRevenueCatSignature(raw,'t=0,v1=bad',secret,now),false)
})
test('signed dashboard TEST only acknowledges delivery; unsigned probes cannot bypass HMAC',async()=>{
 const previous=process.env.REVENUECAT_WEBHOOK_SECRET
 process.env.REVENUECAT_WEBHOOK_SECRET='test-only-probe-secret'
 try {
  const raw=JSON.stringify({event:{type:'TEST',app_user_id:'synthetic-dashboard-user'}}),t=Math.floor(Date.now()/1000)
  const signature=createHmac('sha256','test-only-probe-secret').update(`${t}.${raw}`).digest('hex')
  const make=(header?:string)=>new Request('https://fixture.example/webhook',{method:'POST',headers:header?{'x-revenuecat-webhook-signature':header}:{},body:raw})
  const response=await handleMobileRevenueCatWebhook(make(`t=${t},v1=${signature}`),{purchases:async()=>{throw new Error('TEST must not look up purchases')}})
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{received:true,test:true})
  assert.equal((await handleMobileRevenueCatWebhook(make())).status,401)
 }finally{if(previous===undefined)delete process.env.REVENUECAT_WEBHOOK_SECRET;else process.env.REVENUECAT_WEBHOOK_SECRET=previous}
})
test('sandbox webhook uses its own signature and rejects live events without touching paid storage',async()=>{
 const previous=process.env.REVENUECAT_ASTROLOGY_APP_IDS
 process.env.REVENUECAT_ASTROLOGY_APP_IDS='fixture-app'
 try {
  const secret='sandbox-fixture-secret',t=Math.floor(Date.now()/1000)
  const make=(environment:string,key=secret)=>{
   const raw=JSON.stringify({event:{id:'fixture',app_id:'fixture-app',type:'TRANSFER',environment,event_timestamp_ms:Date.now()}})
   const signature=createHmac('sha256',key).update(`${t}.${raw}`).digest('hex')
   return new Request('https://fixture.example/sandbox-webhook',{method:'POST',headers:{'x-revenuecat-webhook-signature':`t=${t},v1=${signature}`},body:raw})
  }
  const deps={environment:'SANDBOX' as const,signingSecret:secret}
  assert.equal((await handleMobileRevenueCatWebhook(make('PRODUCTION'),deps)).status,403)
  assert.equal((await handleMobileRevenueCatWebhook(make('SANDBOX','live-fixture-secret'),deps)).status,401)
  assert.equal((await handleMobileRevenueCatWebhook(make('SANDBOX'),{...deps,signingSecret:''})).status,401)
  assert.equal(verifiedMobilePurchases(snapshot({is_sandbox:true}),user,now,'SANDBOX').active?.tier,'executive_monthly')
  assert.equal(verifiedMobilePurchases(snapshot(),user,now,'SANDBOX').active,null)
 }finally{if(previous===undefined)delete process.env.REVENUECAT_ASTROLOGY_APP_IDS;else process.env.REVENUECAT_ASTROLOGY_APP_IDS=previous}
})
test('sandbox checkout is server-allowlisted and canonical receipts stay environment isolated',async()=>{
 const names=['ASTROLOGY_MOBILE_SANDBOX_TESTER_IDS','ASTROLOGY_MOBILE_PURCHASES_ENABLED','REVENUECAT_SANDBOX_WEBHOOK_SECRET','ASTROLOGY_REVENUECAT_ENVIRONMENT','ASTROLOGY_REVENUECAT_SECRET_KEY'] as const
 const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]))
 try{
  process.env.ASTROLOGY_MOBILE_SANDBOX_TESTER_IDS=user
  process.env.ASTROLOGY_MOBILE_PURCHASES_ENABLED='false'
  process.env.REVENUECAT_SANDBOX_WEBHOOK_SECRET='fixture-key'
  process.env.ASTROLOGY_REVENUECAT_ENVIRONMENT='PRODUCTION'
  process.env.ASTROLOGY_REVENUECAT_SECRET_KEY='fixture-provider-key'
  assert.deepEqual(mobileCheckoutPolicy(user),{purchasesEnabled:true,sandboxTesting:true})
  assert.deepEqual(mobileCheckoutPolicy('astro_email_'+'c'.repeat(64)),{purchasesEnabled:false,sandboxTesting:false})
  assert.equal(mobilePurchaseEnvironment(user),'SANDBOX')
  assert.equal(mobilePurchaseEnvironment('astro_email_'+'c'.repeat(64)),'PRODUCTION')
  const future=new Date(Date.now()+86400000).toISOString(),past=new Date(Date.now()-1000).toISOString()
  const make=(sandbox:boolean)=>({subscriber:{original_app_user_id:user,subscriptions:{[MOBILE_PRODUCTS.monthly]:{store:'play_store',is_sandbox:sandbox,purchase_date:past,expires_date:future,store_transaction_id:'fixture'}}}})
  const request=async(sandbox:boolean,environment?:'PRODUCTION'|'SANDBOX')=>fetchMobilePurchases(user,async()=>Response.json(make(sandbox)),environment)
  assert.equal((await request(true)).active?.tier,'executive_monthly')
  assert.equal((await request(false)).active,null)
  // The production webhook pins its own environment even for a test user.
  assert.equal((await request(true,'PRODUCTION')).active,null)
  assert.equal((await request(false,'PRODUCTION')).active?.tier,'executive_monthly')
  process.env.REVENUECAT_SANDBOX_WEBHOOK_SECRET=''
  assert.equal(mobileCheckoutPolicy(user).purchasesEnabled,false)
 }finally{for(const name of names){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name]}}
})
