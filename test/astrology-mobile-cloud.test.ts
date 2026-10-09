import test from 'node:test'
import assert from 'node:assert/strict'
import {handleMobileCloud} from '../lib/astrology-mobile-cloud.ts'
import type {getRedis} from '../lib/redis.ts'
const user='astro_email_'+'a'.repeat(64)
const active={product:'maha_jyotisha_executive_monthly',tier:'executive_monthly' as const,expiresAt:'2026-11-01T00:00:00Z',transactionId:'order-fixture',purchasedAt:'2026-10-01T00:00:00Z'}
test('UUID dossier reservations become zero remaining credits, never NaN; native keys remain tenant/environment scoped',async()=>{
 const touched:string[]=[]
 const redis={hgetall:async(key:string)=>{touched.push(key);return {}},smembers:async()=>[],get:async(key:string)=>{touched.push(key);return key.includes(':dossier:')?'d9311e31-14ad-4c72-990a-f42df1196a9b':5}} as unknown as ReturnType<typeof getRedis>
 const result=await handleMobileCloud(user,{operation:'entitlement'},{redis,purchases:async()=>({active,dossiers:[],environment:'SANDBOX'})})
 assert.equal((result as {dossierCredits:number}).dossierCredits,0)
 assert.equal((result as {aiQueriesRemaining:number}).aiQueriesRemaining,95)
 assert.ok(touched.every(key=>key.includes(`astrology:mobile:SANDBOX:account:${user}:`)))
})
test('permanent reports survive subscription expiry while refunded funding and saved-only charts do not',async()=>{
 const entries={permanent:{digest:'a'.repeat(64),label:'Owned report',kind:'dossier',fundingTransaction:'paid',createdAt:'2026-10-01'},revoked:{digest:'b'.repeat(64),label:'Revoked report',kind:'dossier',fundingTransaction:'refunded',createdAt:'2026-10-01'},saved:{digest:'c'.repeat(64),label:'Saved chart',kind:'saved',createdAt:'2026-10-01'}}
 const redis={hgetall:async()=>entries,smembers:async()=>['refunded']} as unknown as ReturnType<typeof getRedis>
 const result=await handleMobileCloud(user,{operation:'list'},{redis,purchases:async()=>({active:null,dossiers:[],environment:'PRODUCTION'})})
 assert.deepEqual((result as {entries:{label:string}[]}).entries.map(e=>e.label),['Owned report'])
})
