import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto'
import { z } from 'zod'
import { Resend } from 'resend'
import { getRedis } from './redis.ts'
import { scopedRedisKey } from './redis-namespace.ts'
import { STORE_REVIEW_EMAIL, STORE_REVIEW_USER_ID, storeReviewConfig, validStoreReviewCredential } from './astrology-store-review.ts'
const TTL = 30 * 86400
export const normalizeAstrologyEmail = (value: string) => value.trim().toLowerCase()
export const astrologyEmailSchema = z.string().trim().email().max(254).transform(normalizeAstrologyEmail)
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const redisKey = (suffix: string) => scopedRedisKey(`astrology:auth:${suffix}`)
export function astrologyAuthConfigured() { return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.ASTROLOGY_AUTH_FROM_EMAIL?.trim() && /^[a-f0-9]{64}$/i.test(process.env.ASTROLOGY_AUTH_SECRET?.trim() || process.env.ASTROLOGY_VAULT_ENCRYPTION_KEY?.trim() || '')) }
export function astrologyAuthDigest(email: string, challenge: string, code: string, secret = process.env.ASTROLOGY_AUTH_SECRET?.trim() || process.env.ASTROLOGY_VAULT_ENCRYPTION_KEY?.trim()) {
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) throw new Error('auth_not_configured')
  return createHmac('sha256', Buffer.from(secret, 'hex')).update(JSON.stringify(['maha-astrology-otp-v1', normalizeAstrologyEmail(email), challenge, code])).digest('hex')
}
export function astrologyCookieName(url: string) { return new URL(url).protocol === 'https:' ? '__Host-maha_astrology' : 'maha_astrology_local' }
export function astrologySessionCookie(url: string, token: string, ttl = TTL) { return `${astrologyCookieName(url)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttl}${new URL(url).protocol === 'https:' ? '; Secure' : ''}` }
function sessionToken(request: Request) { const name = astrologyCookieName(request.url); const value = request.headers.get('cookie')?.split(';').map(p=>p.trim()).find(p=>p.startsWith(`${name}=`))?.slice(name.length+1); return value && /^[a-f0-9]{64}$/.test(value) ? value : null }
export async function astrologyEmailSession(request: Request, store?: ReturnType<typeof getRedis>) {
  const token = sessionToken(request); if (!token) return null
  const redis = store ?? getRedis()
  const session = await redis.get<{ userId: string; email: string; createdAt?: number; reviewVersion?: string }>(redisKey(`session:${hash(token)}`))
  if (!session) return null
  if (session.userId === STORE_REVIEW_USER_ID) { const review=storeReviewConfig(); if(!review || session.reviewVersion!==review.digest)return null }
  const deletedAt = await redis.get<number>(scopedRedisKey(`astrology:account:${session.userId}:deletedAt`))
  return deletedAt && (session.createdAt ?? 0) <= Number(deletedAt) ? null : session
}
// Wrong guesses, expiration and successful consumption are atomic. A guessed
// challenge cannot reset its five-attempt budget. Codes never enter logs/JSON.
export const VERIFY_ASTROLOGY_OTP = `local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end; local c=cjson.decode(raw); if c.emailHash~=ARGV[1] then return 0 end; c.attempts=c.attempts+1; if c.attempts>5 then redis.call('DEL',KEYS[1]); return 0 end; if c.digest==ARGV[2] then redis.call('SET',KEYS[2],ARGV[3],'EX',ARGV[4]); redis.call('DEL',KEYS[1]); return 1 end; local ttl=redis.call('TTL',KEYS[1]); if c.attempts>=5 or ttl<=0 then redis.call('DEL',KEYS[1]); else redis.call('SET',KEYS[1],cjson.encode(c),'EX',ttl); end; return 0`
const RATE = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n`
export class AstrologyAuthError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status=status } }
export async function handleAstrologyAuth(request: Request, deps: { send?: (email: string, code: string) => Promise<void>; configured?: () => boolean; redis?: typeof getRedis } = {}) {
  const headers={ 'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer', 'X-Robots-Tag':'noindex, nofollow' }, json=(body: unknown,status=200)=>Response.json(body,{status,headers})
  if (request.method!=='POST' || new URL(request.url).search) return json({error:'Use a private POST request.'},400)
  const origin=request.headers.get('origin'); if ((origin && origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site') return json({error:'Open sign-in from the Maha app.'},403)
  if (request.headers.get('content-type')?.split(';')[0].trim()!=='application/json') return json({error:'JSON required.'},415)
  try {
    const store=(deps.redis??getRedis)()
    const reader=request.body?.getReader(); if(!reader)return json({error:'Enter your email.'},400); let size=0;const chunks:Uint8Array[]=[]
    try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();return json({error:'Request too large.'},413)}chunks.push(value)}}finally{reader.releaseLock()}
    let parsed;try{parsed=z.object({operation:z.enum(['status','request','verify','logout','review']),email:astrologyEmailSchema.optional(),challenge:z.string().regex(/^[a-f0-9]{64}$/).optional(),code:z.string().regex(/^\d{6}$/).optional(),credential:z.string().regex(/^[a-f0-9]{64}$/).optional()}).strict().parse(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch{return json({error:'Check your sign-in details.'},400)}
    if(parsed.operation==='status')return json({signedIn:Boolean(await astrologyEmailSession(request,store)),configured:(deps.configured??astrologyAuthConfigured)()})
    if(parsed.operation==='logout'){const token=sessionToken(request);if(token)await store.del(redisKey(`session:${hash(token)}`));return Response.json({signedIn:false},{headers:{...headers,'Set-Cookie':astrologySessionCookie(request.url,'',0)}})}
    if(parsed.operation==='review'){
      const config=storeReviewConfig()
      if(await store.eval(RATE,[redisKey('review:attempts')],[600]) as number>30)return json({error:'Please wait before trying review access again.'},429)
      if(parsed.email!==STORE_REVIEW_EMAIL || !parsed.credential || !config || !validStoreReviewCredential(parsed.credential))return json({error:'Review access is invalid or expired.'},401)
      const token=randomBytes(32).toString('hex'),ttl=Math.min(TTL,Math.floor((config.expiresAt-Date.now())/1000))
      if(ttl<1)return json({error:'Review access has expired.'},401)
      await store.set(redisKey(`session:${hash(token)}`),{userId:STORE_REVIEW_USER_ID,email:STORE_REVIEW_EMAIL,createdAt:Date.now(),reviewVersion:config.digest},{ex:ttl})
      return Response.json({signedIn:true},{headers:{...headers,'Set-Cookie':astrologySessionCookie(request.url,token,ttl)}})
    }
    if(!(deps.configured??astrologyAuthConfigured)())return json({error:'Email sign-in is awaiting email delivery configuration.'},503)
    if(!parsed.email)return json({error:'Enter your email.'},400)
    if(parsed.email===STORE_REVIEW_EMAIL)return json({error:'Use the private Store reviewer access option for this account.'},400)
    const emailHash=hash(parsed.email)
    if(parsed.operation==='request'){
      if(await store.eval(RATE,[redisKey(`send:${emailHash}`)],[3600]) as number>5)return json({error:'Please wait before requesting another code.'},429)
      // Global hourly provider budget also bounds automated multi-email abuse.
      if(await store.eval(RATE,[redisKey('send:global')],[3600]) as number>100)return json({error:'Sign-in delivery is at capacity. Please retry later.'},429)
      const challenge=randomBytes(32).toString('hex'),code=String(randomInt(0,1000000)).padStart(6,'0'),key=redisKey(`challenge:${challenge}`)
      await store.set(key,{emailHash,digest:astrologyAuthDigest(parsed.email,challenge,code),attempts:0},{ex:600})
      try { await (deps.send??(async(email,code)=>{const {error}=await new Resend(process.env.RESEND_API_KEY).emails.send({from:process.env.ASTROLOGY_AUTH_FROM_EMAIL!,to:email,subject:'Your Maha Jyotisha sign-in code',text:`Your sign-in code is ${code}. It expires in 10 minutes and can be used once. If you did not request it, ignore this email.`});if(error)throw new Error('delivery_failed')}))(parsed.email,code) }catch{await store.del(key);return json({error:'The sign-in email could not be sent. Please retry.'},503)}
      return json({challenge,message:'Check your email for a six-digit code. It expires in 10 minutes.'})
    }
    if(!parsed.challenge||!parsed.code)return json({error:'Enter the code from your email.'},400)
    if(await store.eval(RATE,[redisKey(`verify:${emailHash}`)],[600]) as number>30)return json({error:'Too many verification attempts. Request a new code later.'},429)
    const token=randomBytes(32).toString('hex'),session={userId:`astro_email_${emailHash}`,email:parsed.email,createdAt:Date.now()}
    const success=await store.eval(VERIFY_ASTROLOGY_OTP,[redisKey(`challenge:${parsed.challenge}`),redisKey(`session:${hash(token)}`)],[emailHash,astrologyAuthDigest(parsed.email,parsed.challenge,parsed.code),JSON.stringify(session),TTL])
    if(success!==1)return json({error:'Code invalid, expired or already used. Request a new code if needed.'},401)
    return Response.json({signedIn:true},{headers:{...headers,'Set-Cookie':astrologySessionCookie(request.url,token)}})
  }catch{return json({error:'Sign-in is temporarily unavailable. Please retry.'},503)}
}
