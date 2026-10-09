import { z } from 'zod'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { getRedis } from './redis.ts'
import { scopedRedisKey } from './redis-namespace.ts'
import { activeMobilePasses, mobileAccountKey, mobileReceiptKey } from './astrology-mobile-passes.ts'
import { AstrologyAccessError } from './astrology-entitlements.ts'
export const MOBILE_PRODUCTS={monthly:'maha_jyotisha_executive_monthly',annual:'maha_jyotisha_executive_annual',dossier:'maha_jyotisha_dossier'} as const
const subscription=z.object({store:z.enum(['app_store','play_store']),is_sandbox:z.boolean(),expires_date:z.string().datetime({offset:true}),purchase_date:z.string().datetime({offset:true}),refunded_at:z.string().nullable().optional(),store_transaction_id:z.union([z.string(),z.number()]),ownership_type:z.string().optional()})
const purchase=z.object({id:z.string(),store:z.enum(['app_store','play_store']),is_sandbox:z.boolean(),purchase_date:z.string().datetime({offset:true})})
const responseSchema=z.object({subscriber:z.object({original_app_user_id:z.string(),subscriptions:z.record(z.string(),z.unknown()),non_subscriptions:z.record(z.string(),z.unknown()).default({})})})
export type MobilePurchaseState={active:{product:string;tier:'executive_monthly'|'executive_annual';expiresAt:string;transactionId:string;purchasedAt:string}|null;dossiers:z.infer<typeof purchase>[];environment:string}
type PurchaseEnvironment='PRODUCTION'|'SANDBOX'
// RevenueCat REST dates can omit fractional seconds while webhook timestamps
// retain milliseconds. Match only the precision actually supplied by REST.
export function purchaseDateMatchesEvent(date:string,eventMs:number) {
 const canonicalMs=Date.parse(date),fraction=date.match(/\.(\d+)(?:Z|[+-])/i)?.[1]
 const precision=fraction?10**Math.max(0,3-fraction.length):1000
 return Number.isFinite(canonicalMs)&&Number.isSafeInteger(eventMs)&&eventMs>=canonicalMs&&eventMs<canonicalMs+precision
}
function configuredPurchaseEnvironment():PurchaseEnvironment {return process.env.ASTROLOGY_REVENUECAT_ENVIRONMENT==='SANDBOX'?'SANDBOX':'PRODUCTION'}
export function mobileSandboxTester(userId:string) {
 if(!/^astro_email_[a-f0-9]{64}$/.test(userId))return false
 return (process.env.ASTROLOGY_MOBILE_SANDBOX_TESTER_IDS??'').split(',').map(id=>id.trim()).includes(userId)
}
export function mobilePurchaseEnvironment(userId:string):PurchaseEnvironment {return mobileSandboxTester(userId)?'SANDBOX':configuredPurchaseEnvironment()}
export function mobileCheckoutPolicy(userId:string) {
 const sandboxTesting=mobileSandboxTester(userId)&&Boolean(process.env.REVENUECAT_SANDBOX_WEBHOOK_SECRET?.trim())
 return {purchasesEnabled:sandboxTesting||process.env.ASTROLOGY_MOBILE_PURCHASES_ENABLED==='true',sandboxTesting}
}
export function verifiedMobilePurchases(raw:unknown,userId:string,now=Date.now(),environment:PurchaseEnvironment=configuredPurchaseEnvironment()):MobilePurchaseState {
 const {subscriber:s}=responseSchema.parse(raw)
 if(s.original_app_user_id!==userId)throw new Error('purchase_identity_mismatch')
 const sandbox=environment==='SANDBOX'
 const active=Object.entries(s.subscriptions).flatMap(([id,value])=>{
  const product=id.split(':')[0],parsed=subscription.safeParse(value)
  if(!parsed.success || ![MOBILE_PRODUCTS.monthly,MOBILE_PRODUCTS.annual].includes(product as typeof MOBILE_PRODUCTS.monthly))return []
  const row=parsed.data
  if(row.is_sandbox!==sandbox || row.refunded_at || Date.parse(row.expires_date)<=now || Date.parse(row.purchase_date)>now || row.ownership_type==='FAMILY_SHARED')return []
  return [{product,tier:product===MOBILE_PRODUCTS.monthly?'executive_monthly' as const:'executive_annual' as const,expiresAt:row.expires_date,transactionId:String(row.store_transaction_id),purchasedAt:row.purchase_date}]
 }).sort((a,b)=>Date.parse(b.expiresAt)-Date.parse(a.expiresAt))[0]??null
 const rawDossiers=s.non_subscriptions[MOBILE_PRODUCTS.dossier]
 const dossiers=Array.isArray(rawDossiers)?rawDossiers.flatMap(value=>{const parsed=purchase.safeParse(value);if(!parsed.success||parsed.data.is_sandbox!==sandbox||Date.parse(parsed.data.purchase_date)>now)return [];return [parsed.data]}):[]
 return {active,dossiers,environment}
}
export async function fetchMobilePurchases(userId:string,fetcher:typeof fetch=fetch,environment:PurchaseEnvironment=mobilePurchaseEnvironment(userId)) {
 const secret=process.env.ASTROLOGY_REVENUECAT_SECRET_KEY?.trim() || process.env.REVENUECAT_SECRET_KEY?.trim()
 if(!secret)return {active:null,dossiers:[],environment} as ReturnType<typeof verifiedMobilePurchases>
 const response=await fetcher(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,{headers:{Authorization:`Bearer ${secret}`},cache:'no-store',signal:AbortSignal.timeout(12000)})
 if(!response.ok)throw new Error('purchase_verification_unavailable')
 return verifiedMobilePurchases(await response.json(),userId,Date.now(),environment)
}
export function verifyRevenueCatSignature(raw:string,header:string|null,secret:string,now=Date.now()) {
 if(!header||!secret)return false
 const match=header.match(/^t=(\d+),v1=([a-f0-9]{64})$/i);if(!match||Math.abs(now/1000-Number(match[1]))>300)return false
 const expected=createHmac('sha256',secret).update(`${match[1]}.${raw}`).digest()
 return timingSafeEqual(expected,Buffer.from(match[2],'hex'))
}
export async function handleMobileRevenueCatWebhook(request:Request,deps:{purchases?:typeof fetchMobilePurchases;redis?:ReturnType<typeof getRedis>;environment?:PurchaseEnvironment;signingSecret?:string}={}) {
 if(request.method!=='POST'||new URL(request.url).search)return Response.json({error:'POST required'},{status:400})
 const reader=request.body?.getReader();if(!reader)return Response.json({error:'Body required'},{status:400})
 const chunks:Uint8Array[]=[];let size=0
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();return Response.json({error:'Too large'},{status:413})}chunks.push(value)}}finally{reader.releaseLock()}
 const raw=Buffer.concat(chunks).toString('utf8')
 if(!verifyRevenueCatSignature(raw,request.headers.get('x-revenuecat-webhook-signature'),deps.signingSecret??process.env.REVENUECAT_WEBHOOK_SECRET??''))return Response.json({error:'Signature invalid'},{status:401})
 try {
  const payload:unknown=JSON.parse(raw)
  // Dashboard delivery probes contain synthetic identities. A signed TEST
  // acknowledges transport only; it must never query purchases or write grants.
  const probe=z.object({event:z.object({type:z.literal('TEST')})}).safeParse(payload)
  if(probe.success)return Response.json({received:true,test:true})
  const {event}=z.object({event:z.object({id:z.string().max(150),app_id:z.string(),app_user_id:z.string().optional(),transferred_from:z.array(z.string()).optional(),transferred_to:z.array(z.string()).optional(),store:z.enum(['APP_STORE','PLAY_STORE']).optional(),purchased_at_ms:z.number().optional(),environment:z.enum(['SANDBOX','PRODUCTION']),type:z.string(),product_id:z.string().optional(),transaction_id:z.string().optional(),event_timestamp_ms:z.number(),cancel_reason:z.string().optional()})}).parse(payload)
  const apps=(process.env.REVENUECAT_ASTROLOGY_APP_IDS??'').split(',').map(s=>s.trim()).filter(Boolean)
  // Environment and key come from the server route, never a client override.
  const environment=deps.environment??configuredPurchaseEnvironment()
  if(!apps.includes(event.app_id)||event.environment!==environment)return Response.json({error:'Wrong app or environment'},{status:403})
  const redis=deps.redis??getRedis()
  const key=scopedRedisKey(`astrology:mobile:${environment}:event:${event.id}`)
  if(await redis.get(key))return Response.json({received:true})
  // Read the canonical, freshly verified state instead of granting directly
  // from events; out-of-order delivery cannot resurrect expired subscriptions.
  // Transfer events omit app_user_id. They never grant access or move private charts.
  // Every subsequent request still checks canonical, account-bound ownership.
  if(event.type==='TRANSFER'){await redis.set(key,true,{ex:86400*400});return Response.json({received:true})}
  if(!event.app_user_id||!/^astro_email_[a-f0-9]{64}$/.test(event.app_user_id))return Response.json({error:'Verified account required'},{status:403})
  const verified=await (deps.purchases??fetchMobilePurchases)(event.app_user_id,fetch,environment)
  if(verified.environment!==environment)throw new Error('purchase_environment_mismatch')
  if(event.type==='NON_RENEWING_PURCHASE'&&event.product_id===MOBILE_PRODUCTS.dossier&&event.transaction_id&&event.purchased_at_ms&&event.store){
   const store=event.store==='APP_STORE'?'app_store':'play_store'
   const receipts=verified.dossiers.filter(r=>r.store===store&&purchaseDateMatchesEvent(r.purchase_date,event.purchased_at_ms!))
   // REST non_subscription ids differ from store transaction ids. Match only
   // an unambiguous canonical receipt and authenticated event at REST precision.
   if(receipts.length!==1)throw new Error('receipt_not_yet_reconciled')
   await redis.set(mobileReceiptKey(environment,receipts[0].id),{userId:event.app_user_id,transactionId:event.transaction_id,purchasedAt:event.purchased_at_ms,store},{nx:true})
  }
  if(event.type==='CANCELLATION' && event.cancel_reason==='CUSTOMER_SUPPORT' && event.transaction_id)await redis.sadd(scopedRedisKey(`astrology:mobile:${environment}:revoked`),event.transaction_id)
  await redis.set(key,true,{ex:86400*400})
  return Response.json({received:true})
 }catch{return Response.json({error:'Verification failed; retry delivery'},{status:503})}
}
export async function reserveMobileConsultation(userId:string,deps:{purchases?:typeof fetchMobilePurchases;redis?:ReturnType<typeof getRedis>}={}) {
 const verified=await (deps.purchases??fetchMobilePurchases)(userId),redis=deps.redis??getRedis()
 const revoked=new Set(await redis.smembers<string[]>(scopedRedisKey(`astrology:mobile:${verified.environment}:revoked`)))
 if(verified.active&&revoked.has(verified.active.transactionId))verified.active=null
 const passes=await activeMobilePasses(userId,verified,redis,revoked)
 if(!verified.active&&!passes.length)return null
 const candidates=[...(verified.active?[{key:mobileAccountKey(userId,verified.environment,`ai:month:${new Date().toISOString().slice(0,7)}`),limit:100}]:[]),...passes.map(pass=>({key:mobileAccountKey(userId,verified.environment,'ai:pass:'+pass.transactionId),limit:20}))]
 for(const {key,limit} of candidates){
  const ok=await redis.eval("local n=tonumber(redis.call('GET',KEYS[1]) or '0');if n>=tonumber(ARGV[1]) then return 0 end;redis.call('INCR',KEYS[1]);return 1",[key],[limit])
  if(ok!==1)continue
  let finished=false
  return {entitlement:{isSubscriber:Boolean(verified.active),passExpiresAt:passes.length?new Date(Math.max(...passes.map(p=>p.expiresAt))).toISOString():undefined},finish:async(success:boolean)=>{if(finished)return;finished=true;if(!success)await redis.eval("local n=tonumber(redis.call('GET',KEYS[1]) or '0');if n>0 then redis.call('DECR',KEYS[1]);end;return 1",[key],[])}}
 }
 throw new AstrologyAccessError(402,'Your consultation credits have been used.')
}
