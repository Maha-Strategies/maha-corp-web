import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { discoverySourceFrom } from '../lib/x402/offer-telemetry.ts'
import { recordPurchaseAttribution, summarizePurchaseAttribution, readDiscoveryAttribution, pruneDiscoveryAttribution, type AttributionRow } from '../lib/x402/discovery-attribution.ts'
import { OPERATOR_WALLETS } from '../lib/x402/discovery-payment-recipe.ts'
const row = (extra: Partial<AttributionRow> = {}): AttributionRow => ({ offer_id:'csv-import-preflight', payment_id:'ab'.repeat(32), network:'eip155:8453',
  payer_key:'cd'.repeat(32), discovery_source:'reddit', settlement_state:'confirmed', response_prepared:true, operator_activity:false, ...extra })
test('explicit discovery labels are allowlisted and spoofable, not inferred identity', () => {
  for (const source of ['reddit','alsp','bazaar','nohumans','tanod','nsgoods','direct']) assert.equal(discoverySourceFrom(new Headers({ 'X-Maha-Discovery-Source':source })),source)
  assert.equal(discoverySourceFrom(new Headers({ 'X-Maha-Discovery-Source':'https://private.example/path?secret=x', 'User-Agent':'x402-bazaar' })),'unknown')
  assert.equal(discoverySourceFrom(new Headers({ Referer:'https://evilmahastrategies.com/' })),'unknown')
  assert.equal(discoverySourceFrom(new Headers({ Referer:'https://evilx402.org/' })),'unknown')
  assert.equal(discoverySourceFrom(new Headers({ Referer:'https://www.mahastrategies.com/' })),'direct')
})
test('retention uses only the restricted bounded RPC and reports unavailable or backlog honestly', async () => {
  let called=''
  const result=await pruneDiscoveryAttribution({rpc:async name=>{called=name;return {data:{deleted:1000,expiredRemaining:true,retentionDays:90},error:null}}})
  assert.equal(called,'prune_x402_purchase_attributions')
  assert.deepEqual(result,{available:true,deleted:1000,expiredRemaining:true,retentionDays:90})
  assert.equal((await pruneDiscoveryAttribution({rpc:async()=>({data:{deleted:1001,expiredRemaining:false,retentionDays:90},error:null})})).available,false)
  assert.equal((await pruneDiscoveryAttribution(null)).available,false)
  assert.equal((await pruneDiscoveryAttribution({rpc:async()=>{throw Error('outage')}})).available,false)
})
test('privacy promises, scheduled cleanup and discovery links agree with the new schema', () => {
  const sql=readFileSync('supabase/migrations/20261012120000_x402_discovery_attribution.sql','utf8')
  const cleanup=sql.slice(sql.indexOf('create function public.prune_x402_purchase_attributions'))
  assert.match(cleanup,/first_observed_at < now\(\)-interval '90 days'/)
  assert.match(cleanup,/limit 1000 for update skip locked/)
  assert.match(cleanup,/delete from public.x402_purchase_attributions/)
  assert.doesNotMatch(cleanup,/delete from public\.(?:x402_payments|x402_settlements|x402_offer_usage_daily|x402_micro_purchases)/)
  assert.match(cleanup,/from public,anon,authenticated/)
  const cron=readFileSync('app/api/cron/x402-settlements/route.ts','utf8')
  assert.ok(cron.indexOf('authorizeObservatoryCron(request)')<cron.indexOf('await pruneDiscoveryAttribution()'))
  assert.ok(cron.indexOf("process.env.VERCEL_ENV !== 'production'")<cron.indexOf('await pruneDiscoveryAttribution()'))
  assert.match(readFileSync('app/developers/x402-privacy/page.tsx','utf8'),/90-day active reporting window/)
  assert.match(readFileSync('app/developers/x402-products/page.tsx','utf8'),/href="\/developers\/x402-privacy"/)
})
test('receipt metrics count unique payments, separate unknown outcomes and exclude known operators', () => {
  const report=summarizePurchaseAttribution([row(),row({payment_id:'ac'.repeat(32)}),row({payment_id:'ad'.repeat(32),settlement_state:'unknown',response_prepared:false}),
    row({payment_id:'ae'.repeat(32),operator_activity:true})])
  assert.deepEqual(report.sources.reddit,{purchases:2,responsesPrepared:2,unresolved:1,operatorPurchases:1})
  assert.equal(report.returningChainWalletOfferPairs,1); assert.equal(report.customerIdentityEstablished,false)
  assert.throws(()=>summarizePurchaseAttribution([row(),row()]),/invalid_attribution/)
})
test('accounting RPC uses verified wallet classification rather than a claimed canary source', async () => {
  const args: Record<string,unknown>[]=[]
  const ledger={rpc:async (_name:string, parameters:Record<string,unknown>)=>{args.push(parameters);return {error:null}}}
  const base={offerId:'csv-import-preflight',paymentId:'ab'.repeat(32),network:'eip155:8453',amount:'13500',transaction:'0x'+'ac'.repeat(32),
    source:'maha_canary' as const,settlement:'confirmed' as const,responsePrepared:true,replayed:false}
  await recordPurchaseAttribution({...base,payer:'0x'+'12'.repeat(20)},ledger)
  await recordPurchaseAttribution({...base,payer:OPERATOR_WALLETS[0]},ledger)
  assert.equal(args[0].p_operator,false);assert.equal(args[1].p_operator,true)
  assert.ok(!JSON.stringify(args).includes(OPERATOR_WALLETS[0]));assert.match(String(args[0].p_payer_key),/^[a-f0-9]{64}$/)
  await recordPurchaseAttribution({...base,payer:'invalid'},ledger);assert.equal(args.length,2)
  await recordPurchaseAttribution({...base,payer:'0x'+'12'.repeat(20)},{rpc:async()=>{throw Error('database_unavailable')}})
})
test('partial attribution reads and missing schema never produce confident zeros', async () => {
  const result=await readDiscoveryAttribution(async()=>({data:[row()],error:null}),async()=>({data:null,error:Error('table_missing')}))
  assert.equal(result.available,false)
  const report=await readDiscoveryAttribution(async()=>({data:[row()],error:null}),async()=>({data:[{discovery_source:'reddit',event_count:4}],error:null}))
  assert.equal(report.available,true)
  if(report.available){assert.equal(report.quotesByClaimedSource.reddit,4);assert.equal(report.purchases.sources.reddit.purchases,1)}
})
test('migration restricts access, deduplicates authorizations and preserves source and settlement state', () => {
  const sql=readFileSync('supabase/migrations/20261012120000_x402_discovery_attribution.sql','utf8')
  assert.match(sql,/primary key\(network,payment_id\)/);assert.match(sql,/enable row level security/)
  assert.match(sql,/from public,anon,authenticated,service_role/);assert.match(sql,/grant select on table/)
  assert.doesNotMatch(sql,/grant .* to anon|grant .* to authenticated/)
  const update=sql.slice(sql.indexOf('update public.x402_purchase_attributions set'))
  assert.doesNotMatch(update.split('end; $$')[0],/discovery_source\s*=/)
  assert.match(update,/v_row.settlement_state='confirmed' or p_settlement='confirmed'/)
  assert.match(sql,/v_inserted=0 and p_replayed/)
})
