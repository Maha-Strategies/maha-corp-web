import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { handleAstrologyAuth, astrologyAuthDigest, astrologySessionCookie, VERIFY_ASTROLOGY_OTP } from '../lib/astrology-auth.ts'
import { getRedis } from '../lib/redis.ts'
import { transitShortcutDate } from '../lib/astrology-transit-shortcuts.ts'
import { apiProxyGate } from '../lib/api-proxy-policy.ts'
import { createHash } from 'node:crypto'
import { STORE_REVIEW_EMAIL, STORE_REVIEW_USER_ID, isReviewExample } from '../lib/astrology-store-review.ts'
import { astrologyEmailSession } from '../lib/astrology-auth.ts'
const previous=process.env.ASTROLOGY_AUTH_SECRET;process.env.ASTROLOGY_AUTH_SECRET='b'.repeat(64)
after(()=>{if(previous===undefined)delete process.env.ASTROLOGY_AUTH_SECRET;else process.env.ASTROLOGY_AUTH_SECRET=previous})
class Memory {
  now=0;rows=new Map<string,{value:unknown;expires?:number}>()
  async get(key:string){const row=this.rows.get(key);if(row?.expires!==undefined&&row.expires<=this.now){this.rows.delete(key);return null}return row?.value??null}
  async set(key:string,value:unknown,options?:{ex:number}){this.rows.set(key,{value,expires:options?.ex?this.now+options.ex:undefined});return 'OK'}
  async del(key:string){return Number(this.rows.delete(key))}
  async eval(script:string,keys:string[],args:(string|number)[]){
    if(script!==VERIFY_ASTROLOGY_OTP){const n=Number(await this.get(keys[0])??0)+1;await this.set(keys[0],n,{ex:Number(args[0])});return n}
    const c=await this.get(keys[0]) as {emailHash:string;digest:string;attempts:number}|null;if(!c||c.emailHash!==args[0])return 0
    c.attempts++;if(c.attempts>5){await this.del(keys[0]);return 0}
    if(c.digest===args[1]){await this.set(keys[1],JSON.parse(String(args[2])),{ex:Number(args[3])});await this.del(keys[0]);return 1}
    if(c.attempts>=5)await this.del(keys[0]);return 0
  }
}
function setup(){const store=new Memory();let code='';const deps={redis:()=>store as unknown as ReturnType<typeof getRedis>,configured:()=>true,send:async(_email:string,value:string)=>{code=value}};return {store,deps,code:()=>code}}
test('private review access is isolated, rate-limited and revoked on rotation or expiry',async()=>{
 const oldDigest=process.env.ASTROLOGY_STORE_REVIEW_TOKEN_SHA256,oldExpiry=process.env.ASTROLOGY_STORE_REVIEW_EXPIRES_AT
 const credential='a'.repeat(64),ctx=setup()
 process.env.ASTROLOGY_STORE_REVIEW_TOKEN_SHA256=createHash('sha256').update(credential).digest('hex')
 process.env.ASTROLOGY_STORE_REVIEW_EXPIRES_AT=new Date(Date.now()+86400000).toISOString()
 try{
  assert.equal((await handleAstrologyAuth(request({operation:'review',email:'other@example.com',credential}),ctx.deps)).status,401)
  assert.equal((await handleAstrologyAuth(request({operation:'review',email:STORE_REVIEW_EMAIL,credential:'b'.repeat(64)}),ctx.deps)).status,401)
  assert.equal((await handleAstrologyAuth(request({operation:'request',email:STORE_REVIEW_EMAIL}),ctx.deps)).status,400)
  const response=await handleAstrologyAuth(request({operation:'review',email:STORE_REVIEW_EMAIL,credential}),ctx.deps)
  assert.equal(response.status,200);assert.equal(ctx.code(),'')
  const cookie=response.headers.get('set-cookie')!.split(';')[0],sessionRequest=request({operation:'status'},cookie)
  assert.equal((await astrologyEmailSession(sessionRequest,ctx.store as unknown as ReturnType<typeof getRedis>))?.userId,STORE_REVIEW_USER_ID)
  process.env.ASTROLOGY_STORE_REVIEW_EXPIRES_AT='revocable'
  const reusable=await handleAstrologyAuth(request({operation:'review',email:STORE_REVIEW_EMAIL,credential}),ctx.deps)
  assert.equal(reusable.status,200)
  assert.match(reusable.headers.get('set-cookie')!,/Max-Age=2592000/)
  process.env.ASTROLOGY_STORE_REVIEW_TOKEN_SHA256='c'.repeat(64)
  assert.equal(await astrologyEmailSession(sessionRequest,ctx.store as unknown as ReturnType<typeof getRedis>),null)
  process.env.ASTROLOGY_STORE_REVIEW_EXPIRES_AT=new Date(Date.now()-1).toISOString()
  assert.equal((await handleAstrologyAuth(request({operation:'review',email:STORE_REVIEW_EMAIL,credential}),ctx.deps)).status,401)
  for(let i=0;i<30;i++)await handleAstrologyAuth(request({operation:'review',email:STORE_REVIEW_EMAIL,credential}),ctx.deps)
  assert.equal((await handleAstrologyAuth(request({operation:'review',email:STORE_REVIEW_EMAIL,credential}),ctx.deps)).status,429)
  assert.equal(isReviewExample({instantUtc:'1990-06-15T05:00:00.000Z',latitudeDegrees:6.9271,longitudeDegrees:79.8612,uncertaintyMinutes:0}),true)
  assert.equal(isReviewExample({instantUtc:'1991-06-15T05:00:00.000Z',latitudeDegrees:6.9271,longitudeDegrees:79.8612,uncertaintyMinutes:0}),false)
 }finally{if(oldDigest===undefined)delete process.env.ASTROLOGY_STORE_REVIEW_TOKEN_SHA256;else process.env.ASTROLOGY_STORE_REVIEW_TOKEN_SHA256=oldDigest;if(oldExpiry===undefined)delete process.env.ASTROLOGY_STORE_REVIEW_EXPIRES_AT;else process.env.ASTROLOGY_STORE_REVIEW_EXPIRES_AT=oldExpiry}
})
const request=(body:unknown,cookie?:string,extra:Record<string,string>={})=>new Request('https://maha.example/api/astrology/auth',{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{}),...extra},body:JSON.stringify(body)})
test('email codes create revocable cookie sessions; replay and forged cookies are rejected',async()=>{
 const ctx=setup(),response=await handleAstrologyAuth(request({operation:'request',email:' Buyer@Example.com '}),ctx.deps),issued=await response.json()
 assert.equal(response.status,200);assert.match(ctx.code(),/^\d{6}$/);assert.equal('code' in issued,false)
 const body={operation:'verify',email:'buyer@example.com',challenge:issued.challenge,code:ctx.code()}
 const verified=await handleAstrologyAuth(request(body),ctx.deps);assert.equal(verified.status,200);const cookie=verified.headers.get('set-cookie')!
 assert.match(cookie,/^__Host-maha_astrology=[a-f0-9]{64};/);assert.match(cookie,/HttpOnly; SameSite=Lax/);assert.match(cookie,/Secure/)
 assert.equal((await handleAstrologyAuth(request(body),ctx.deps)).status,401)
 const status=await handleAstrologyAuth(request({operation:'status'},cookie),ctx.deps);assert.equal((await status.json()).signedIn,true)
 const forged=await handleAstrologyAuth(request({operation:'status'},`__Host-maha_astrology=${'a'.repeat(64)}`),ctx.deps);assert.equal((await forged.json()).signedIn,false)
 const logout=await handleAstrologyAuth(request({operation:'logout'},cookie),ctx.deps);assert.match(logout.headers.get('set-cookie')!,/Max-Age=0/)
 assert.equal((await (await handleAstrologyAuth(request({operation:'status'},cookie),ctx.deps)).json()).signedIn,false)
})
test('wrong-email, expiry and five wrong attempts cannot authenticate',async()=>{
 const ctx=setup();const issued=await (await handleAstrologyAuth(request({operation:'request',email:'a@example.com'}),ctx.deps)).json()
 assert.equal((await handleAstrologyAuth(request({operation:'verify',email:'b@example.com',challenge:issued.challenge,code:ctx.code()}),ctx.deps)).status,401)
 const wrong=ctx.code()==='000000'?'999999':'000000'
 for(let i=0;i<5;i++)assert.equal((await handleAstrologyAuth(request({operation:'verify',email:'a@example.com',challenge:issued.challenge,code:wrong}),ctx.deps)).status,401)
 assert.equal((await handleAstrologyAuth(request({operation:'verify',email:'a@example.com',challenge:issued.challenge,code:ctx.code()}),ctx.deps)).status,401)
 const next=await (await handleAstrologyAuth(request({operation:'request',email:'c@example.com'}),ctx.deps)).json();ctx.store.now+=601
 assert.equal((await handleAstrologyAuth(request({operation:'verify',email:'c@example.com',challenge:next.challenge,code:ctx.code()}),ctx.deps)).status,401)
})
test('disabled delivery, failed delivery and cross-origin requests never expose a usable code',async()=>{
 const ctx=setup();assert.equal((await handleAstrologyAuth(request({operation:'request',email:'a@example.com'}),{...ctx.deps,configured:()=>false})).status,503)
 const failure=await handleAstrologyAuth(request({operation:'request',email:'a@example.com'}),{...ctx.deps,send:async()=>{throw new Error('provider-secret')}});assert.equal(failure.status,503);assert.doesNotMatch(await failure.text(),/provider-secret/)
 assert.equal((await handleAstrologyAuth(request({operation:'request',email:'a@example.com'},undefined,{origin:'https://evil.example'}),ctx.deps)).status,403)
 assert.equal(apiProxyGate('/api/astrology/auth','POST',true),'self_managed')
 assert.notEqual(astrologyAuthDigest('a@example.com','one','123456'),astrologyAuthDigest('a@example.com','two','123456'))
 assert.match(astrologySessionCookie('http://localhost:3138','x'),/^maha_astrology_local=/)
})
test('delivery budgets reject a sixth request to the same address',async()=>{
 const ctx=setup();for(let i=0;i<5;i++)assert.equal((await handleAstrologyAuth(request({operation:'request',email:'a@example.com'}),ctx.deps)).status,200)
 assert.equal((await handleAstrologyAuth(request({operation:'request',email:'a@example.com'}),ctx.deps)).status,429)
})
test('transit shortcuts use UTC dates and clamp calendar months without claiming a planetary sign',()=>{
 assert.equal(transitShortcutDate('2026-10-03','30days'),'2026-11-02');assert.equal(transitShortcutDate('2026-08-31','6months'),'2027-02-28');assert.equal(transitShortcutDate('2026-10-03','feb2027'),'2027-02-01')
})
