import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,createHmac} from 'node:crypto'
import {handleMobileCloud} from '../lib/astrology-mobile-cloud.ts'
import {handleMobileRevenueCatWebhook,reserveMobileConsultation,type MobilePurchaseState,MOBILE_PRODUCTS} from '../lib/astrology-mobile-billing.ts'
import {getRedis} from '../lib/redis.ts'
import {scopedRedisKey} from '../lib/redis-namespace.ts'
// Explicit opt-in exercises real Redis Lua/concurrency, never a store charge.
test('real ledger: concurrent fulfillment grants once, retries do not recharge, refund revokes PDF and pass', {skip:process.env.ASTROLOGY_LIVE_LEDGER_TEST!=='true'},async()=>{
 const oldNamespace=process.env.MAHA_REDIS_NAMESPACE,oldApps=process.env.REVENUECAT_ASTROLOGY_APP_IDS,oldSecret=process.env.REVENUECAT_WEBHOOK_SECRET
 process.env.MAHA_REDIS_NAMESPACE='orbital-ledger-'+randomBytes(5).toString('hex');process.env.REVENUECAT_ASTROLOGY_APP_IDS='fixture-native-app';process.env.REVENUECAT_WEBHOOK_SECRET='fixture-signing-secret'
 const redis=getRedis(),user='astro_email_'+randomBytes(32).toString('hex'),state:MobilePurchaseState={active:null,dossiers:[],environment:'PRODUCTION'}
 const deps={redis,purchases:async()=>structuredClone(state),generate:async()=>Buffer.from('%PDF-fixture-prepared-before-payment')}
 const chart={instantUtc:'1990-01-01T06:00:00Z',latitudeDegrees:6.9271,longitudeDegrees:79.8612,uncertaintyMinutes:0,referenceInstantUtc:'2026-10-03T00:00:00Z'}
 const event=async(fields:Record<string,unknown>)=>{const raw=JSON.stringify({event:{id:crypto.randomUUID(),app_id:'fixture-native-app',app_user_id:user,environment:'PRODUCTION',product_id:MOBILE_PRODUCTS.dossier,transaction_id:'fixture-store-order',event_timestamp_ms:Date.now(),store:'APP_STORE',...fields}}),t=Math.floor(Date.now()/1000),h=createHmac('sha256','fixture-signing-secret').update(`${t}.${raw}`).digest('hex');return handleMobileRevenueCatWebhook(new Request('https://fixture.example/webhook',{method:'POST',headers:{'x-revenuecat-webhook-signature':`t=${t},v1=${h}`},body:raw}),deps)}
 try{
  const ready=await handleMobileCloud(user,{operation:'prepare-dossier',chart,consentToStore:true,label:'Synthetic report'},deps) as {reservationId:string}
  assert.ok(ready.reservationId);await assert.rejects(handleMobileCloud(user,{operation:'claim-dossier',reservationId:ready.reservationId},deps),/pending/)
  const purchasedAt=Date.now();state.dossiers=[{id:'canonical-fixture-id',store:'app_store',is_sandbox:false,purchase_date:new Date(purchasedAt).toISOString().replace(/\.\d{3}Z$/,'Z')}]
  assert.equal((await event({type:'NON_RENEWING_PURCHASE',purchased_at_ms:purchasedAt})).status,200)
  const claims=await Promise.all([1,2,3].map(()=>handleMobileCloud(user,{operation:'claim-dossier',reservationId:ready.reservationId},deps)))
  assert.ok(claims.every(c=>(c as {delivered:boolean}).delivered));const digest=(claims[0] as {digest:string}).digest
  assert.equal((await handleMobileCloud(user,{operation:'list'},deps) as {entries:unknown[]}).entries.length,1)
  assert.equal((await handleMobileCloud(user,{operation:'entitlement'},deps) as {aiQueriesRemaining:number}).aiQueriesRemaining,20)
  const reservations=await Promise.all(Array.from({length:21},()=>reserveMobileConsultation(user,deps).catch(()=>null)));assert.equal(reservations.filter(Boolean).length,20)
  await reservations.find(Boolean)!.finish(false)
  await handleMobileCloud(user,{operation:'claim-dossier',reservationId:ready.reservationId},deps)
  assert.equal((await handleMobileCloud(user,{operation:'entitlement'},deps) as {aiQueriesRemaining:number}).aiQueriesRemaining,1)
  assert.ok(Buffer.isBuffer(await handleMobileCloud(user,{operation:'pdf',digest},deps)))
  assert.equal((await event({type:'CANCELLATION',cancel_reason:'CUSTOMER_SUPPORT'})).status,200)
  assert.equal((await handleMobileCloud(user,{operation:'list'},deps) as {entries:unknown[]}).entries.length,0)
  assert.equal((await handleMobileCloud(user,{operation:'entitlement'},deps) as {advancedTools:boolean}).advancedTools,false)
  await assert.rejects(handleMobileCloud(user,{operation:'pdf',digest},deps),/authorized/)
  const stranger='astro_email_'+'f'.repeat(64);await assert.rejects(handleMobileCloud(stranger,{operation:'claim-dossier',reservationId:ready.reservationId},deps),/Prepare/)
 }finally{
  // Only keys in this uniquely named synthetic fixture namespace are removed.
  let cursor=0;do{const scan=await redis.scan(cursor,{match:scopedRedisKey('*'),count:100});cursor=Number(scan[0]);if(scan[1].length)await redis.del(...scan[1]);}while(cursor!==0)
  for(const [name,value] of Object.entries({MAHA_REDIS_NAMESPACE:oldNamespace,REVENUECAT_ASTROLOGY_APP_IDS:oldApps,REVENUECAT_WEBHOOK_SECRET:oldSecret})){if(value===undefined)delete process.env[name];else process.env[name]=value}
 }
})
