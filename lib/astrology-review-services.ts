import { createHash } from 'node:crypto'
import { getRedis } from './redis.ts'
import { scopedRedisKey } from './redis-namespace.ts'
import { AstrologyAccessError, encryptVault, decryptVault } from './astrology-entitlements.ts'
import { isStoreReviewer, isReviewExample, storeReviewConfig, storeReviewPassExpiresAt } from './astrology-store-review.ts'
import { astrologyChartInput, checkedBirthReport } from './astrology-input.ts'
import { generateExecutiveDossier } from './dossier/astrology-dossier.ts'
import type { MobileVaultEntry } from './astrology-mobile-cloud.ts'

const reviewKey=(userId:string,suffix:string)=>scopedRedisKey(`astrology:mobile:REVIEW:account:${userId}:${storeReviewConfig()!.digest}:${suffix}`)
const reserve=`local n=tonumber(redis.call('GET',KEYS[1]) or '0');if n>=tonumber(ARGV[1]) then return 0 end;redis.call('INCR',KEYS[1]);if tonumber(ARGV[2])>0 then redis.call('EXPIRE',KEYS[1],ARGV[2]) else redis.call('PERSIST',KEYS[1]) end;return 1`
function reviewTtl(){const end=storeReviewConfig()!.expiresAt;return Number.isFinite(end)?Math.max(1,Math.ceil((end-Date.now())/1000)):0}
async function retainReviewKey(key:string){const ttl=reviewTtl();if(ttl)await getRedis().expire(key,ttl);else await getRedis().persist(key)}
export async function reserveReviewConsultation(userId:string){
  if(!isStoreReviewer(userId))return null
  const redis=getRedis(),key=reviewKey(userId,'ai')
  if(await redis.eval(reserve,[key],[100,reviewTtl()])!==1)throw new AstrologyAccessError(402,'The review account consultation limit has been reached.')
  let finished=false
  return {entitlement:{isSubscriber:false,passExpiresAt:storeReviewPassExpiresAt()},finish:async(success:boolean)=>{if(finished)return;finished=true;if(!success)await redis.eval("local n=tonumber(redis.call('GET',KEYS[1]) or '0');if n>0 then redis.call('DECR',KEYS[1]);end;return 1",[key],[])}}
}
export async function handleReviewCloud(userId:string,input:{operation:string;chart?:unknown;secondary?:unknown;digest?:string;label?:string;consentToStore?:boolean}){
  if(!isStoreReviewer(userId))throw new AstrologyAccessError(403,'Review access is unavailable.')
  const redis=getRedis(),key=(suffix:string)=>reviewKey(userId,suffix),expiresAt=storeReviewPassExpiresAt()
  // Retain existing counters when extending access: caps never reset on deployment.
  if(reviewTtl()===0)await Promise.all(['ai','pdf','vault'].map(suffix=>redis.persist(key(suffix))))
  if(input.operation==='entitlement')return {subscriber:false,reviewAccess:true,tier:'store_review',advancedTools:true,passExpiresAt:expiresAt,aiQueriesRemaining:Math.max(0,100-Number(await redis.get(key('ai'))??0)),dossierCredits:Math.max(0,2-Number(await redis.get(key('pdf'))??0)),purchasesEnabled:false,sandboxTesting:false}
  if(input.operation==='pending-dossier')return {ready:false}
  if(['prepare-dossier','claim-dossier'].includes(input.operation))throw new AstrologyAccessError(403,'This review account uses included fictional reports. Store checkout remains separate.')
  const entries=Object.values(await redis.hgetall<Record<string,MobileVaultEntry>>(key('vault'))??{})
  if(input.operation==='list')return {entries:entries.map(({digest,label,kind,createdAt})=>({digest,label,kind,createdAt}))}
  if(input.operation==='open'||input.operation==='pdf'&&input.digest){
    const entry=entries.find(e=>e.digest===input.digest)
    if(!entry)throw new AstrologyAccessError(404,'No matching fictional review report.')
    if(input.operation==='open')return JSON.parse(decryptVault(entry.chart,userId))
    if(!entry.pdf)throw new AstrologyAccessError(404,'This review chart has no dossier.')
    return Buffer.from(decryptVault(entry.pdf,userId),'base64')
  }
  if(!['save','pdf'].includes(input.operation)||!input.consentToStore||!isReviewExample(input.chart)||input.secondary)throw new AstrologyAccessError(400,'Review services require the unchanged Fictional example chart and storage consent.')
  const chart=astrologyChartInput.parse(input.chart),payload=JSON.stringify({chart}),digest=createHash('sha256').update(payload).digest('hex')
  const entry:MobileVaultEntry={digest,label:'Fictional store review example',kind:input.operation==='pdf'?'dossier':'saved',chart:encryptVault(payload,userId),createdAt:new Date().toISOString()}
  if(input.operation==='pdf'){
    if(await redis.eval(reserve,[key('pdf')],[2,reviewTtl()])!==1)throw new AstrologyAccessError(402,'The review dossier limit has been reached.')
    try{const pdf=await generateExecutiveDossier(checkedBirthReport(chart));entry.pdf=encryptVault(pdf.toString('base64'),userId);await redis.hset(key('vault'),{[digest]:entry});await retainReviewKey(key('vault'));return pdf}
    catch(error){await redis.eval("local n=tonumber(redis.call('GET',KEYS[1]) or '0');if n>0 then redis.call('DECR',KEYS[1]);end;return 1",[key('pdf')],[]);throw error}
  }
  // Preserve previously generated dossiers when saving the same chart.
  if(!entries.find(e=>e.digest===digest)?.pdf)await redis.hset(key('vault'),{[digest]:entry})
  await retainReviewKey(key('vault'));return {saved:true,digest}
}
