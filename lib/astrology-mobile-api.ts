import { z } from 'zod'
import { handleAstrologyAuth, astrologyEmailSession, astrologyCookieName } from './astrology-auth.ts'
import { handleAstrologyChat } from './astrology-chat.ts'
import { handleAstrologyPlatform } from './astrology-platform-api.ts'
import { AstrologyAccessError } from './astrology-entitlements.ts'
import { getRedis } from './redis.ts'
import { scopedRedisKey } from './redis-namespace.ts'
import { isStoreReviewer, isReviewExample, storeReviewConfig } from './astrology-store-review.ts'
const allowed = new Set(['capacitor://localhost', 'https://localhost', 'http://localhost'])
export function mobileOriginAllowed(origin: string | null) {
  return !origin || allowed.has(origin) || (process.env.NODE_ENV !== 'production' && ['http://127.0.0.1:3140','http://localhost:3140'].includes(origin))
}
export async function handleAstrologyMobile(request: Request, deps: {
  auth?: typeof handleAstrologyAuth; chat?: typeof handleAstrologyChat; platform?: typeof handleAstrologyPlatform; session?: typeof astrologyEmailSession; rate?: (userId:string)=>Promise<number>;
} = {}) {
 const origin=request.headers.get('origin'), url=new URL(request.url)
 const headers: Record<string,string>={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','Vary':'Origin'}
 if(origin && mobileOriginAllowed(origin)) { headers['Access-Control-Allow-Origin']=origin; headers['Access-Control-Allow-Headers']='Content-Type, Authorization'; headers['Access-Control-Allow-Methods']='POST, OPTIONS' }
 const json=(body:unknown,status=200)=>Response.json(body,{status,headers})
 if(!mobileOriginAllowed(origin))return json({error:'Origin not permitted.'},403)
 if(url.search)return json({error:'Query parameters are not permitted.'},400)
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(request.method!=='POST')return json({error:'Private POST required.'},405)
 if(process.env.NODE_ENV==='production' && url.protocol!=='https:')return json({error:'HTTPS required.'},400)
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return json({error:'JSON required.'},415)
 try {
  const reader=request.body?.getReader();if(!reader)return json({error:'Request body required.'},400)
  let size=0;const chunks:Uint8Array[]=[]
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();return json({error:'Request too large.'},413)}chunks.push(value)} } finally {reader.releaseLock()}
  let body:unknown
  try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return json({error:'Invalid JSON.'},400)}
  const parsed=z.object({service:z.enum(['auth','chat','platform','delete','report','cloud']),payload:z.record(z.string(),z.unknown())}).strict().safeParse(body)
  if(!parsed.success)return json({error:'Invalid mobile request.'},400)
  const {service,payload}=parsed.data
  const raw=request.headers.get('authorization'), token=raw?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
  if(raw && !token)return json({error:'Invalid session credential.'},401)
  // Deliberately ignore browser cookies. Only this route translates a mobile
  // opaque credential; web routes retain their original same-origin checks.
  const servicePayload={...payload}
  if(service==='chat')delete servicePayload.consentToAi
  const internal=new Request(new URL('/api/astrology/'+service,url.origin),{method:'POST',headers:{'Content-Type':'application/json','Origin':url.origin,...(token?{'Cookie':`${astrologyCookieName(url.toString())}=${token}`}:{})},body:JSON.stringify(servicePayload),signal:request.signal})
  if(service==='auth') {
   const response=await (deps.auth??handleAstrologyAuth)(internal), body=await response.json()
   const cookie=response.headers.get('set-cookie'), issued=cookie?.match(/^[^=]+=([a-f0-9]{64});/)?.[1]
   let accountId:string|undefined
   // Auth has consumed the POST body. Session lookup needs only the URL and
   // issued cookie; cloning the consumed request would reject a valid login.
   if(issued){const verified=new Request(internal.url,{headers:{'Cookie':`${astrologyCookieName(url.toString())}=${issued}`}});accountId=(await (deps.session??astrologyEmailSession)(verified))?.userId}
   return json({...body,...(issued && accountId?{token:issued,accountId}:{})},response.status)
  }
  const session=token?await (deps.session??astrologyEmailSession)(internal):null
  if(!session)return json({error:'Sign in with your email to continue.'},401)
  const count=await (deps.rate?deps.rate(session.userId):getRedis().eval("local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],60) end;return n",[scopedRedisKey(`astrology:mobile:rate:${session.userId}`)],[]))
  if(typeof count!=='number'||count>30)return json({error:'Please wait before sending another request.'},429)
  if(service==='chat' && payload.consentToAi!==true)return json({error:'Permission to send this request to the AI provider is required.'},400)
  if(service==='chat'&&isStoreReviewer(session.userId)){
   const secondary=payload.secondary as {chart?:unknown}|undefined
   if((payload.chart&&!isReviewExample(payload.chart))||(secondary&&!isReviewExample(secondary.chart)))return json({error:'Store review access supports only the unchanged Fictional example chart.'},400)
   servicePayload.example=true
  }
  if(service==='platform' && ['checkout','recover','portal'].includes(String(payload.operation)))return json({error:'Use native store billing in the mobile app.'},400)
  if(service==='cloud'){
   const {handleMobileCloud}=await import('./astrology-mobile-cloud.ts');const result=await handleMobileCloud(session.userId,payload)
   if(Buffer.isBuffer(result))return new Response(new Uint8Array(result),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename=orbital-alignment-dossier.pdf'}})
   return json(result)
  }
  if(service==='report'){
   const reason=z.string().trim().min(3).max(1000).parse(payload.reason)
   const answer=z.string().max(20000).parse(payload.answer)
   const key=scopedRedisKey(`astrology:mobile:reports:${session.userId}:${new Date().toISOString().slice(0,10)}`)
   const count=await getRedis().incr(key);await getRedis().expire(key,86400*30)
   if(count>10)return json({error:'Daily report limit reached.'},429)
   // Sensitive response reports are encrypted, never logged or emailed.
   const {encryptVault}=await import('./astrology-entitlements.ts')
   await getRedis().set(scopedRedisKey(`astrology:mobile:report:${crypto.randomUUID()}`),encryptVault(JSON.stringify({userId:session.userId,reason,answer,createdAt:new Date().toISOString()}),session.userId),{ex:86400*30})
   return json({reported:true})
  }
  if(service==='delete') {
   if(payload.confirm!=='DELETE')return json({error:'Confirm permanent deletion.'},400)
   const prefix=`astrology:account:${session.userId}:`
   // Revoke existing web/mobile sessions, erase birth inputs/PDFs. Retain
   // transaction/usage identifiers needed to avoid payment/quota replay.
   await getRedis().set(scopedRedisKey(prefix+'deletedAt'),Date.now())
   const cloudKeys=['PRODUCTION','SANDBOX'].flatMap(environment=>['vault','pending-dossier'].map(suffix=>scopedRedisKey(`astrology:mobile:${environment}:account:${session.userId}:${suffix}`)))
   if(isStoreReviewer(session.userId))cloudKeys.push(scopedRedisKey(`astrology:mobile:REVIEW:account:${session.userId}:${storeReviewConfig()!.digest}:vault`))
   await getRedis().del(scopedRedisKey(prefix+'vault'),...cloudKeys)
   await (deps.auth??handleAstrologyAuth)(new Request(internal,{body:JSON.stringify({operation:'logout'})}))
   return json({deleted:true})
  }
  const chatRequest=service==='chat'?new Request(internal.url,{method:'POST',headers:internal.headers,body:JSON.stringify(servicePayload),signal:request.signal}):internal
  const response=await (service==='chat'?(deps.chat??handleAstrologyChat)(chatRequest,{consultation:async req=>{if(isStoreReviewer(session.userId)){const {reserveReviewConsultation}=await import('./astrology-review-services.ts');return (await reserveReviewConsultation(session.userId))!}const {reserveMobileConsultation}=await import('./astrology-mobile-billing.ts');const paid=await reserveMobileConsultation(session.userId);if(paid)return paid;const {reserveAstrologyConsultation}=await import('./astrology-entitlements.ts');return reserveAstrologyConsultation(req)}}):(deps.platform??handleAstrologyPlatform)(internal))
  const out=new Headers(response.headers);out.delete('set-cookie');for(const [key,value] of Object.entries(headers))out.set(key,value)
  return new Response(response.body,{status:response.status,headers:out})
 }catch(error){if(error instanceof AstrologyAccessError)return json({error:error.message},error.status);return json({error:'The mobile service is temporarily unavailable. Please retry.'},503)}
}
