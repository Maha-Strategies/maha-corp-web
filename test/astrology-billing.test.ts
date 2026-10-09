import test from 'node:test'
import assert from 'node:assert/strict'
import type Stripe from 'stripe'
import { canAccessAdvancedTools, encryptVault, decryptVault, verifyAstrologyPaidSession, type UserAstrologyEntitlement, AstrologyAccessError } from '../lib/astrology-entitlements.ts'
import { astrologyPriceAmount } from '../lib/billing/stripe.ts'
import { handleAstrologyPlatform, platformInput, dossierBundleDigest } from '../lib/astrology-platform-api.ts'
const chart={instantUtc:'2000-01-01T06:00:00.000Z',latitudeDegrees:6.9271,longitudeDegrees:79.8612,uncertaintyMinutes:0,referenceInstantUtc:'2026-10-01T12:00:00.000Z'}
const free:UserAstrologyEntitlement={userId:'account-one',isSubscriber:false,subscriptionTier:'free',aiQueryCredits:1,purchasedDossiers:[],dossierCredits:0,checkoutConfigured:false}
const deps={account:async()=>free.userId,entitlement:async()=>free,rate:async()=>1}
const req=(body:unknown)=>new Request('http://localhost/api/astrology/platform',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
test('vault encryption is randomized, authenticated and bound to the account',()=>{
 const key='a'.repeat(64),a=encryptVault('private birth inputs','a',key),b=encryptVault('private birth inputs','a',key);assert.notEqual(a,b);assert.equal(decryptVault(a,'a',key),'private birth inputs');assert.throws(()=>decryptVault(a,'b',key));assert.throws(()=>decryptVault(a+'x','a',key));assert.throws(()=>encryptVault('x','a','placeholder'))
})
test('expiry is strict and prices follow the approved regular/launch matrix',()=>{
 assert.equal(canAccessAdvancedTools({isSubscriber:false,passExpiresAt:'2026-10-01T00:00:00Z'},Date.parse('2026-10-01T00:00:00Z')),false)
 assert.equal(canAccessAdvancedTools({isSubscriber:true}),true);assert.equal(astrologyPriceAmount('dossier'),7900);assert.equal(astrologyPriceAmount('executive_monthly'),3900);assert.equal(astrologyPriceAmount('executive_annual'),29900);assert.equal(astrologyPriceAmount('dossier',true),4900);assert.equal(astrologyPriceAmount('executive_monthly',true),2900);assert.equal(astrologyPriceAmount('executive_annual',true),19900)
})
test('a session needs paid completion, matching owner, product and single exact price',()=>{
 const session={client_reference_id:'a',metadata:{billing_kind:'maha_astrology',product:'dossier'},status:'complete',payment_status:'paid',line_items:{data:[{quantity:1,price:{id:'price_real'}}]}} as unknown as Stripe.Checkout.Session
 assert.equal(verifyAstrologyPaidSession(session,'a','dossier','price_real'),true)
 assert.equal(verifyAstrologyPaidSession(session,'b','dossier','price_real'),false);assert.equal(verifyAstrologyPaidSession(session,'a','dossier','price_wrong'),false)
 assert.equal(verifyAstrologyPaidSession({...session,payment_status:'unpaid'},'a','dossier','price_real'),false)
})
test('advanced APIs enforce server entitlements before calculating user inputs',async()=>{
 for(const operation of ['aspects','transits','ingress','synastry','save','pdf'])assert.equal((await handleAstrologyPlatform(req({operation,chart}),deps)).status,402)
 assert.equal((await handleAstrologyPlatform(req({operation:'aspects',chart,isSubscriber:true}),deps)).status,400)
 assert.equal((await handleAstrologyPlatform(req({operation:'aspects',chart}),{...deps,account:async()=>{throw new AstrologyAccessError(401,'Connect account.')}})).status,401)
 const authorized={...deps,entitlement:async()=>({...free,isSubscriber:true,subscriptionTier:'executive_monthly' as const})}
 const response=await handleAstrologyPlatform(req({operation:'aspects',chart}),authorized);assert.equal(response.status,200);assert.ok((await response.json()).strategic.aspects.length)
 assert.equal((await handleAstrologyPlatform(req({operation:'aspects',chart}),{...authorized,rate:async()=>31})).status,429)
})
test('checkout bundles are exact snapshots and client ownership/paid flags are rejected',()=>{
 assert.notEqual(dossierBundleDigest({operation:'checkout',chart}),dossierBundleDigest({operation:'checkout',chart:{...chart,referenceInstantUtc:'2026-11-01T12:00:00.000Z'}}))
 assert.equal(platformInput.safeParse({operation:'pdf',chart,paid:true,userId:'other'}).success,false)
})

test('the protected Saturn shortcut returns an ephemeris-derived ingress and its exact overlay instant',async()=>{
 const authorized={...deps,entitlement:async()=>({...free,isSubscriber:true,subscriptionTier:'executive_monthly' as const})}
 const response=await handleAstrologyPlatform(req({operation:'ingress',chart,instantUtc:'2026-10-03T12:00:00.000Z'}),authorized)
 assert.equal(response.status,200);const data=await response.json();assert.equal(data.ingress.planet,'Saturn');assert.notEqual(data.ingress.from,data.ingress.to);assert.equal(data.transit.instantUtc,data.ingress.instantUtc)
 assert.ok(Date.parse(data.ingress.instantUtc)>Date.parse('2026-10-03T12:00:00.000Z'))
})
