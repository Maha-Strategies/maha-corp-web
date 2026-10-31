import assert from 'node:assert/strict'
import test from 'node:test'
import {readFile} from 'node:fs/promises'
import {renderInactivityIssue} from '../scripts/render-inactivity-issue.mjs'
import {createUnpaidMonitorFetch} from '../lib/x402/monitor-transport.ts'
import {classifyDiscoveryReport} from '../lib/x402/discovery-monitor.ts'

test('large inactivity reports produce a bounded UTF-8 issue with urgent rows first',()=>{
  const reports=Array.from({length:1500},(_,i)=>({offerId:'route-'+i+'🙂'.repeat(200),level:i===1499?'urgent':'unknown',reason:'listing_missing',lastCalledAt:'unknown',daysRemaining:i===1499?2:null}))
  const body=renderInactivityIssue({reports,catalogueComplete:true},'https://github.com/Maha-Strategies/maha-corp-web/actions/runs/123')
  assert.ok(Buffer.byteLength(body)<12000);assert.ok(body.includes('Checked 1500'));assert.ok(body.includes('route-1499'));assert.ok(body.indexOf('route-1499')<body.indexOf('route-0'));assert.equal(body.split('\n').filter(l=>l.startsWith('| route-')).length,20);assert.ok(!body.includes('\ufffd'))
})
test('missing report stays unknown, not healthy',()=>{
  const body=renderInactivityIssue(null,'bad\nlink');assert.match(body,/NO — absence is not established/);assert.doesNotMatch(body,/bad\nlink/)
})
test('workflow passes a body filename, never a full catalogue in process argv',async()=>{
  const y=await readFile('.github/workflows/production-x402-bazaar-inactivity.yml','utf8');assert.match(y,/--body-file "\$BODY_FILE"/);assert.doesNotMatch(y,/DETAIL=|--body "\$BODY"/)
})
test('parallel requests remain below 60 per five minutes with no retries',async()=>{
  let now=0;const starts=[]
  const f=createUnpaidMonitorFetch({now:()=>now,sleep:async ms=>{now+=ms},fetchImpl:async()=>{starts.push(now);return new Response('',{status:429})}})
  const results=await Promise.all(Array.from({length:120},()=>f('https://example.invalid')))
  assert.equal(starts.length,120);assert.ok(results.every(r=>r.status===429))
  for(let i=1;i<starts.length;i++)assert.ok(starts[i]-starts[i-1]>=6000)
  for(const start of starts)assert.ok(starts.filter(t=>t>=start&&t<start+300000).length<=50)
})
test('failed requests do not stall the queue or cause automatic retries',async()=>{
  let now=0,calls=0;const f=createUnpaidMonitorFetch({now:()=>now,sleep:async ms=>{now+=ms},fetchImpl:async()=>{if(++calls===1)throw Error('offline');return new Response('ok')}})
  await assert.rejects(f('https://example.invalid'),/offline/);assert.equal((await f('https://example.invalid')).status,200);assert.equal(calls,2)
})
test('aborted queued probes never reach the network',async()=>{
  let now=0,calls=0;const controller=new AbortController()
  const f=createUnpaidMonitorFetch({now:()=>now,sleep:async ms=>{now+=ms;controller.abort(Error('cancelled'))},fetchImpl:async()=>{calls++;return new Response('ok')}})
  await f('https://example.invalid');await assert.rejects(f('https://example.invalid',{signal:controller.signal}),/cancelled/);assert.equal(calls,1)
})
test('monitor refuses payment headers before any network request',async()=>{
  let calls=0;const f=createUnpaidMonitorFetch({fetchImpl:async()=>{calls++;return new Response('')}})
  for(const h of ['PAYMENT-SIGNATURE','X-PAYMENT-SIGNATURE','X-PAYMENT'])await assert.rejects(f('https://example.invalid',{headers:{[h]:'anything'}}),/monitor_payment_forbidden/)
  assert.equal(calls,0);assert.throws(()=>createUnpaidMonitorFetch({intervalMs:5000}),/unsafe_monitor_interval/)
})
const subject='https://www.mahastrategies.com/api/v1/compute/test/check'
const report=(live,rule='x402.http.challenge_status')=>({schemaVersion:'1.0.0',tool:{name:'x402-doctor'},endpoint:subject,checkedAt:'2026-10-31T00:00:00Z',ok:false,summary:{errors:1,warnings:0},findings:[{ruleId:rule,level:'error'}],live})
test('429 primary and crawler results are inconclusive rate limits, never broken contracts or clean',()=>{
  assert.equal(classifyDiscoveryReport(report({status:429}),subject,'failure'),'probe_rate_limited')
  assert.equal(classifyDiscoveryReport(report({status:402,crawlerStatus:429},'x402.bazaar.crawler_status'),subject,'failure'),'probe_rate_limited')
  assert.equal(classifyDiscoveryReport(report({status:503}),subject,'failure'),'contract_failure')
  assert.equal(classifyDiscoveryReport(report({status:402,crawlerStatus:429},'x402.resource'),subject,'failure'),'contract_failure')
})
test('workflow runs one paced batch at a time with sufficient timeout',async()=>{
  const y=await readFile('.github/workflows/production-x402-discovery-drift.yml','utf8');assert.match(y,/max-parallel: 1/);assert.match(y,/timeout-minutes: 25/)
  const script=await readFile('scripts/x402-discovery-monitor.ts','utf8');assert.match(script,/fetchImpl:monitorFetch/)
})
