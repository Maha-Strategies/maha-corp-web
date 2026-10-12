import test from 'node:test'
import assert from 'node:assert/strict'
import { x402Config, requirementsFor } from '../lib/x402/config.ts'
import { acceptPayment, matchRequirement, type PaymentRequirement, type PaymentPayload } from '../lib/x402/protocol.ts'
import { USDC_NETWORKS, usdcNetwork, type UsdcNetwork } from '../lib/x402/networks.ts'
import { ledgerFromRows, refreshSettlementLedger, MAX_SCAN_BLOCKS, type SettlementReader } from '../lib/x402/settlement-refresh.ts'
import { validLiveSnapshot, refreshStoredSettlements, type LiveSnapshot, type SettlementStore } from '../lib/x402/settlement-live-store.ts'
import { combineSettlementLedgers } from '../lib/x402/settlement-multichain.ts'
import { MAHA_PAYEE, CANARY_BUYER } from '../lib/x402/discovery-payment-recipe.ts'
import { forwardedRequestHeaders } from '../lib/proxy-request-headers.ts'
import { fixture } from './helpers/micro-payment-fixture.ts'
import { MICRO_OFFERS } from '../lib/x402/micro-offers.ts'
import { MICRO_RECOVERY_MODE_HEADER, MICRO_RECOVERY_PAYER_HEADER } from '../lib/x402/micro-recovery-contract.ts'
const B = 'eip155:8453', A = 'eip155:42161', payer = `0x${'a'.repeat(40)}`, tx = `0x${'b'.repeat(64)}`
const env = { X402_ENABLED: 'true', X402_NETWORK: 'base', X402_FACILITATOR_URL: 'https://facilitator.example', X402_PAY_TO: MAHA_PAYEE,
  X402_ASSET: USDC_NETWORKS[B].asset, X402_RESOURCES: JSON.stringify([{ method: 'POST', path: '/api/v1/compress' }]), X402_ARBITRUM_ENABLED: 'true', X402_ARBITRUM_FROM_BLOCK: '100' }
const config = x402Config(env)!, terms = requirementsFor(config.resources[0], 'https://www.mahastrategies.com/api/v1/compress', config)
const payment = (accepted: PaymentRequirement): PaymentPayload => ({ x402Version: 2, accepted, payload: { signature: 'synthetic' } })
const time = new Date('2026-10-12T00:00:00Z')
function ledger(network: UsdcNetwork, operator = false) {
  return ledgerFromRows([{ payer: operator ? CANARY_BUYER : payer, amountBaseUnits: BigInt(1000), transactionHash: tx, blockNumber: BigInt(10), logIndex: 0, timestampUtc: time.toISOString() }], BigInt(1), BigInt(100), time.toISOString(), network)
}
function memory(initial: LiveSnapshot | null) {
  let value = initial, published = 0
  const store: SettlementStore = { read: async () => value, acquire: async () => true, publish: async (_, next) => { value=next;published++;return true }, release: async () => {} }
  return { store, value: () => value, published: () => published }
}
test('one offer has two native USDC alternatives with the same exact price and payee', () => {
  assert.deepEqual(terms.map(t=>t.network), [B,A]); assert.equal(terms[0].amount,terms[1].amount)
  for(const t of terms) { assert.equal(t.asset,USDC_NETWORKS[t.network as UsdcNetwork].asset); assert.equal(t.payTo,MAHA_PAYEE); assert.deepEqual(t.extra,{name:'USD Coin',version:'2'}) }
  assert.throws(()=>x402Config({...env,X402_ARBITRUM_FROM_BLOCK:undefined}),/FROM_BLOCK/)
  assert.throws(()=>x402Config({...env,X402_ASSET:'0x'+'1'.repeat(40)}),/native USDC/)
  assert.throws(()=>usdcNetwork('toString'),/unsupported/)
})
test('wrong chain or bridged/lookalike USDC cannot reach verify or settle',async()=>{
  for(const change of [{network:'eip155:1'}, {asset:'0xFF970A61A04b1cA14834A43f5de4533eBDDB5CC8'}, {asset:USDC_NETWORKS[B].asset}]) {
    const p = payment({...terms[1],...change} as PaymentRequirement); assert.equal(matchRequirement(p,terms),null)
    let calls=0; const r=await acceptPayment({payment:p,requirements:terms, facilitator:{verify:async()=>{calls++;return {ok:true,payer}},settle:async()=>{calls++;return {ok:true,payer,transaction:tx}}},replayGuard:{claim:async()=>'claimed',recordSettlement:async()=>{}}})
    assert.equal(r.ok,false);assert.equal(calls,0)
  }
})
test('retry choosing Base confirms original Arbitrum settlement without a second charge',async()=>{
  let settled=0,claimed=0; const seen:string[]=[]
  const r=await acceptPayment({payment:payment(terms[0]),requirements:terms,
    facilitator:{verify:async()=>({ok:true,payer}),settle:async()=>{settled++;return {ok:true,payer,transaction:tx}}},
    replayGuard:{claim:async()=>{claimed++;return 'claimed'},recordSettlement:async()=>{}},
    admissionGuard:{reserve:async()=>({kind:'already_paid',transaction:tx,network:A}),settled:async()=>{},released:async()=>{}},
    confirmRecoveryOnChain:network=>async s=>{seen.push(network);assert.equal(s.transaction,tx);return {status:'confirmed'}}})
  assert.equal(r.ok,true);if(r.ok){assert.equal(r.network,A);assert.equal(r.replayed,true)}
  assert.deepEqual(seen,[A]);assert.equal(settled,0);assert.equal(claimed,0)
})
test('unknown legacy chain fails closed when two networks are enabled',async()=>{
  let settled=0
  const r=await acceptPayment({payment:payment(terms[1]),requirements:terms,facilitator:{verify:async()=>({ok:true,payer}),settle:async()=>{settled++;return {ok:true,payer,transaction:tx}}},
    replayGuard:{claim:async()=>'claimed',recordSettlement:async()=>{}},admissionGuard:{reserve:async()=>({kind:'already_paid',transaction:tx}),settled:async()=>{},released:async()=>{}}})
  assert.equal(r.ok,false);if(!r.ok)assert.equal(r.status,409);assert.equal(settled,0)
})
test('first purchase journals the selected chain before settlement',async()=>{
  const seen:string[]=[]
  const r=await acceptPayment({payment:payment(terms[1]),requirements:terms,facilitator:{verify:async()=>({ok:true,payer}),settle:async(_,t)=>{seen.push('settle:'+t.network);return {ok:true,payer,transaction:tx}}},
    replayGuard:{claim:async()=>'claimed',recordSettlement:async()=>{}}, admissionGuard:{reserve:async()=>({kind:'proceed'}),pending:async s=>{seen.push('pending:'+s.network);return true},reconcile:async()=>true,settled:async()=>true,released:async()=>{}},confirmRecoveryOnChain:()=>undefined})
  assert.equal(r.ok,true);if(r.ok)assert.equal(r.network,A);assert.deepEqual(seen,['pending:'+A,'settle:'+A])
})
test('identical hashes on two chains remain distinct; operator funds stay excluded',()=>{
  const combined=combineSettlementLedgers([ledger(B),ledger(A,true)])
  assert.equal(combined.entries.length,2);assert.equal(combined.summary.totalSettlements,2)
  assert.equal(combined.summary.externalSettlements,1);assert.equal(combined.summary.canarySettlements,1)
  assert.equal(combined.summary.externalValueUsdc,'0.001');assert.equal(combined.caip2Network,undefined)
  assert.match(combined.entries.find(e=>e.caip2Network===A)!.explorerUrl,/arbiscan/)
  assert.throws(()=>combineSettlementLedgers([ledger(B),ledger(B)]),/duplicate/)
})
test('chain snapshots cannot be swapped; legacy Base snapshots still validate',()=>{
  for(const network of [B,A] as const){const l=ledger(network);const v:LiveSnapshot={schemaVersion:'maha-live-settlements/1.0',ledger:l,caughtUp:true,finalizedBlock:l.scannedToBlock};assert.equal(validLiveSnapshot(v,network),true);assert.equal(validLiveSnapshot(v,network===B?A:B),false)}
})
test('Arbitrum outage preserves its cursor while Base can publish',async()=>{
  const b=ledger(B),a=ledger(A);const bs=memory({schemaVersion:'maha-live-settlements/1.0',ledger:b,caughtUp:true,finalizedBlock:b.scannedToBlock}),as=memory({schemaVersion:'maha-live-settlements/1.0',ledger:a,caughtUp:true,finalizedBlock:a.scannedToBlock})
  const reader=(network:UsdcNetwork):SettlementReader=>({caip2Network:network,finalizedBlock:async()=>BigInt(120),timestamp:async()=>time.toISOString(),transfers:async()=>[]})
  const results=await Promise.allSettled([refreshStoredSettlements(bs.store,reader(B),time,b),refreshStoredSettlements(as.store,{...reader(A),transfers:async()=>{throw Error('simulated RPC outage')}},time,a)])
  assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected')
  assert.equal(bs.value()!.ledger.scannedToBlock,'120');assert.equal(as.value()!.ledger.scannedToBlock,'100');assert.equal(as.published(),0)
})
test('Arbitrum hourly capacity covers faster block production without changing Base limits',async()=>{
  const r=await refreshSettlementLedger(ledger(A),{caip2Network:A,finalizedBlock:async()=>BigInt(15000),timestamp:async()=>time.toISOString(),transfers:async()=>[]},time)
  assert.equal(r.caughtUp,true);assert.equal(MAX_SCAN_BLOCKS,BigInt(6000))
  await assert.rejects(refreshSettlementLedger(ledger(A),{caip2Network:B,finalizedBlock:async()=>BigInt(15000),timestamp:async()=>time.toISOString(),transfers:async()=>[]}),/network_mismatch/)
})
test('new science purchase recovers the original Arbitrum response without repayment',async()=>{
  const offer=MICRO_OFFERS.find(o=>o.id==='quantum-state-validity')!
  const dual=x402Config({...env,X402_RESOURCES:JSON.stringify([{method:'POST',path:offer.path}])})!
  const f=fixture(offer,{config:dual});const signature=await f.signature(0,1)
  const paid=await f.handlers.POST(f.request(undefined,{'PAYMENT-SIGNATURE':signature}));assert.equal(paid.status,200)
  const body=await paid.json();assert.equal(f.calls.settle,1)
  const replay=await f.handlers.POST(f.request(undefined,{[MICRO_RECOVERY_MODE_HEADER]:'replay',[MICRO_RECOVERY_PAYER_HEADER]:'0x'+'4'.repeat(40)}))
  assert.equal(replay.status,200);assert.deepEqual(await replay.json(),body);assert.equal(f.calls.settle,1)
  assert.equal(JSON.parse(Buffer.from(replay.headers.get('PAYMENT-RESPONSE')!,'base64').toString()).network,A)
  assert.ok(f.calls.rpc.some(r=>r.name==='record_x402_admission_recovery'&&r.p_network===A))
})
test('callers cannot forge the proxy-asserted payment network',()=>{
  assert.equal(forwardedRequestHeaders(new Headers({'x-maha-payment-network':A})).has('x-maha-payment-network'),false)
  assert.equal(forwardedRequestHeaders(new Headers(),{'x-maha-payment-network':B}).get('x-maha-payment-network'),B)
})
