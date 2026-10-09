import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { astrologyChartInput, secondaryChartInput, checkedBirthReport } from './astrology-input.ts'
import { fetchMobilePurchases, mobileCheckoutPolicy, purchaseDateMatchesEvent } from './astrology-mobile-billing.ts'
import { encryptVault, decryptVault } from './astrology-entitlements.ts'
import { generateExecutiveDossier } from './dossier/astrology-dossier.ts'
import { getRedis } from './redis.ts'
import { scopedRedisKey } from './redis-namespace.ts'
import { AstrologyAccessError } from './astrology-entitlements.ts'
import { activeMobilePasses, mobileReceiptKey, CLAIM_MOBILE_DOSSIER } from './astrology-mobile-passes.ts'
const inputSchema=z.object({operation:z.enum(['entitlement','list','save','open','pdf','prepare-dossier','pending-dossier','claim-dossier']),reservationId:z.string().uuid().optional(),chart:astrologyChartInput.optional(),secondary:secondaryChartInput.optional(),digest:z.string().regex(/^[a-f0-9]{64}$/).optional(),label:z.string().trim().max(80).optional(),consentToStore:z.boolean().optional()}).strict()
export type MobileVaultEntry={digest:string;label:string;kind:'saved'|'dossier';chart:string;pdf?:string;fundingTransaction?:string;createdAt:string}
export async function handleMobileCloud(userId:string,raw:unknown,deps:{purchases?:typeof fetchMobilePurchases;redis?:ReturnType<typeof getRedis>;generate?:typeof generateExecutiveDossier}={}) {
 const input=inputSchema.parse(raw)
 const {isStoreReviewer}=await import('./astrology-store-review.ts')
 if(isStoreReviewer(userId)){const {handleReviewCloud}=await import('./astrology-review-services.ts');return handleReviewCloud(userId,input)}
 const verified=await (deps.purchases??fetchMobilePurchases)(userId),redis=deps.redis??getRedis()
 const prefix=`astrology:mobile:${verified.environment}:account:${userId}:`,key=(suffix:string)=>scopedRedisKey(prefix+suffix)
 const entries=Object.values(await redis.hgetall<Record<string,MobileVaultEntry>>(key('vault'))??{})
 const revoked=new Set(await redis.smembers<string[]>(scopedRedisKey(`astrology:mobile:${verified.environment}:revoked`)))
 if(verified.active&&revoked.has(verified.active.transactionId))verified.active=null
 const passes=await activeMobilePasses(userId,verified,redis,revoked)
 const pendingKey=key('pending-dossier')
 type Pending={reservationId:string;digest:string;entry:MobileVaultEntry;createdAt:number;previousReceipts:string[]}
 const pending=['prepare-dossier','pending-dossier','claim-dossier'].includes(input.operation)?await redis.get<Pending>(pendingKey):null
 if(input.operation==='pending-dossier')return pending?{reservationId:pending.reservationId,label:pending.entry.label,ready:true}:{ready:false}
 if(input.operation==='claim-dossier'){
  if(!input.reservationId)throw new AstrologyAccessError(400,'A prepared dossier is required.')
  const claimed=await redis.get<string>(key('dossier-claim:'+input.reservationId))
  if(claimed){const report=entries.find(e=>e.digest===claimed);if(!report?.pdf||!report.fundingTransaction||revoked.has(report.fundingTransaction))throw new AstrologyAccessError(403,'This funding payment is no longer authorized.');return {delivered:true,digest:claimed}}
  if(!pending||pending.reservationId!==input.reservationId)throw new AstrologyAccessError(409,'Prepare this report before purchasing. Never buy again to retry delivery.')
  const candidates=verified.dossiers.filter(r=>!pending.previousReceipts.includes(r.id))
  for(const receipt of candidates){
   const proof=await redis.get<{userId:string;transactionId:string;purchasedAt:number;store:string}>(mobileReceiptKey(verified.environment,receipt.id))
   if(!proof||proof.userId!==userId||proof.store!==receipt.store||proof.purchasedAt<pending.createdAt||!purchaseDateMatchesEvent(receipt.purchase_date,proof.purchasedAt)||revoked.has(proof.transactionId))continue
   const entry={...pending.entry,fundingTransaction:proof.transactionId}
   const pass={receiptId:receipt.id,transactionId:proof.transactionId,expiresAt:proof.purchasedAt+30*86400000}
   const result=await redis.eval(CLAIM_MOBILE_DOSSIER,[scopedRedisKey(`astrology:mobile:${verified.environment}:store:${receipt.store}:${createHash('sha256').update(proof.transactionId).digest('hex')}:claim`),key('vault'),key('passes'),scopedRedisKey(`astrology:mobile:${verified.environment}:revoked`),key('dossier-claim:'+pending.reservationId)],[JSON.stringify([userId,pending.digest,pending.reservationId]),pending.digest,JSON.stringify(entry),JSON.stringify(pass),pending.digest,proof.transactionId])
   if(result===-2)throw new AstrologyAccessError(403,'The funding payment was refunded.')
   if(result===-1)continue
   if(result!==0&&result!==1)throw new Error('Invalid fulfillment result')
   await redis.del(pendingKey);return {delivered:true,digest:pending.digest}
  }
  throw new AstrologyAccessError(409,'Purchase verification is still pending. Restore or retry delivery; do not purchase again.')
 }
 const owned=entries.filter(e=>e.kind==='dossier'?Boolean(e.fundingTransaction&&!revoked.has(e.fundingTransaction)):Boolean(verified.active))
 if(input.operation==='entitlement')return {subscriber:Boolean(verified.active),tier:verified.active?.tier??'free',renewsAt:verified.active?.expiresAt,passExpiresAt:passes.length?new Date(Math.max(...passes.map(p=>p.expiresAt))).toISOString():undefined,advancedTools:Boolean(verified.active||passes.length),aiQueriesRemaining:verified.active?Math.max(0,100-Number(await redis.get(key(`ai:month:${new Date().toISOString().slice(0,7)}`))??0)):passes.length?(await Promise.all(passes.map(async p=>Math.max(0,20-Number(await redis.get(key('ai:pass:'+p.transactionId))??0))))).reduce((a,b)=>a+b,0):undefined,dossierCredits:verified.active?(await redis.get(key(`dossier:${new Date().toISOString().slice(0,7)}`)) ? 0 : 1):0,...mobileCheckoutPolicy(userId)}
 if(input.operation==='list')return {entries:owned.map(({digest,label,kind,createdAt})=>({digest,label,kind,createdAt}))}
 const existing=owned.find(e=>e.digest===input.digest)
 if(input.operation==='open' || (input.operation==='pdf'&&input.digest)) {
  if(!existing)throw new Error('This report is not in your authorized mobile vault.')
  if(input.operation==='pdf'){if(!existing.pdf)throw new Error('This chart has no purchased dossier.');return Buffer.from(decryptVault(existing.pdf,userId),'base64')}
  return JSON.parse(decryptVault(existing.chart,userId))
 }
 if(input.operation!=='prepare-dossier'&&!verified.active)throw new AstrologyAccessError(402,'A verified Executive subscription is required.')
 if(!input.chart || !input.consentToStore)throw new Error('Chart inputs and explicit storage consent are required.')
 const chart=checkedBirthReport(input.chart),secondary=input.secondary?{...input.secondary,report:checkedBirthReport(input.secondary.chart)}:undefined
 const payload=JSON.stringify({chart:input.chart,secondary:input.secondary}),digest=createHash('sha256').update(payload).digest('hex')
 const already=owned.find(e=>e.digest===digest)
 if(input.operation==='prepare-dossier'){
  if(already?.pdf)return {alreadyOwned:true,digest}
  if(pending)return {reservationId:pending.reservationId,label:pending.entry.label,ready:true}
  const limit=await redis.eval("local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],86400) end;return n",[key('prepare:'+new Date().toISOString().slice(0,10))],[])
  if(typeof limit!=='number'||limit>5)throw new AstrologyAccessError(429,'Daily report preparation limit reached.')
  const lock=key('prepare-lock'),lockId=randomUUID()
  if(await redis.set(lock,lockId,{nx:true,ex:120})!=='OK')throw new AstrologyAccessError(409,'A report is already being prepared. Retry delivery shortly.')
  try{
   const pdf=await (deps.generate??generateExecutiveDossier)(chart,secondary)
   const reservation:Pending={reservationId:randomUUID(),digest,createdAt:Date.now(),previousReceipts:verified.dossiers.map(r=>r.id),entry:{digest,label:input.label||'Untitled chart',kind:'dossier',chart:encryptVault(payload,userId),pdf:encryptVault(pdf.toString('base64'),userId),createdAt:new Date().toISOString()}}
   if(await redis.set(pendingKey,reservation,{nx:true,ex:90*86400})!=='OK')throw new AstrologyAccessError(409,'Another report is ready. Resume that delivery first.')
   return {reservationId:reservation.reservationId,label:reservation.entry.label,ready:true}
  }finally{await redis.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0",[lock],[lockId])}
 }
 if(input.operation==='pdf' && already?.pdf)return Buffer.from(decryptVault(already.pdf,userId),'base64')
 const entry:MobileVaultEntry={digest,label:input.label||'Untitled chart',kind:input.operation==='pdf'?'dossier':'saved',chart:encryptVault(payload,userId),createdAt:new Date().toISOString()}
 if(input.operation==='save'){
  // Never downgrade an already purchased permanent report.
  if(!already?.pdf)await redis.hset(key('vault'),{[digest]:entry})
  return {saved:true,digest}
 }
 const quota=key(`dossier:${new Date().toISOString().slice(0,7)}`)
 if(await redis.set(quota,randomUUID(),{nx:true})!=='OK')throw new Error('Your included dossier for this calendar month has already been used.')
 try {
  const pdf=await (deps.generate??generateExecutiveDossier)(chart,secondary)
  entry.pdf=encryptVault(pdf.toString('base64'),userId);entry.fundingTransaction=verified.active!.transactionId
  await redis.hset(key('vault'),{[digest]:entry})
  return pdf
 }catch(error){await redis.del(quota);throw error}
}
