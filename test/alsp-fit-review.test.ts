import assert from 'node:assert/strict'
import test from 'node:test'
import { ALSP_CODE_COMMIT, artifactSha256, reviewAlspSample } from '../lib/x402/alsp-fit-review.ts'
import { MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'
import { usdcNetwork } from '../lib/x402/networks.ts'
// Minimal original fixtures for the reviewer, not copies of or executions of ALSP.
const closed = (body: unknown) => ({ summary: { state: 'CLOSED',verifiedSpent:'1000',unresolved:0 }, evidence:[{wire:{status:200,body}}] })
const sample = { fixtureMetadata:{mainSha:ALSP_CODE_COMMIT},nativeExports:{success:closed({syntheticFixture:true}),
  noWireAndUnrecoverableOutput:{summary:{state:'RECONCILIATION_REQUIRED',verifiedSpent:'0',unresolved:1},evidence:[{wire:null}]},
  lostThenBodylessRecovery:{afterRecovery:closed(null)},directHttp200NullBody:closed(null)} }
const mapping = {publicContractMapping:{resource:'https://www.mahastrategies.com/api/v1/compress',offerId:'context-compression',
  payment:{network:'eip155:8453',amount:'1000',asset:usdcNetwork('eip155:8453').asset,payTo:MAHA_PAYEE}},
  requestSerializationObservation:{requestBodyPresent:false,payloadQueryPresent:true}}
test('ALSP closed null responses never become delivery evidence in Maha review',()=>{
  const report=reviewAlspSample(sample,mapping)
  assert.equal(report.jsonPostCompatible,false);assert.equal(report.liveInteroperabilityEstablished,false)
  assert.deepEqual(report.observations.map(row=>row.outputAvailable),[true,false,false,false])
  assert.equal(report.observations[1].settlementEvidence,'absent_from_native_export')
  assert.ok(report.observations.every(row=>row.buyerReceiptEstablished===false))
})
test('ALSP review refuses a changed version, wrong payee or missing native export',()=>{
  assert.throws(()=>reviewAlspSample({...sample,fixtureMetadata:{mainSha:'different'}},mapping),/version/)
  const wrong=structuredClone(mapping);wrong.publicContractMapping.payment.payTo='0x'+'ab'.repeat(20)
  assert.throws(()=>reviewAlspSample(sample,wrong),/mapping_mismatch/)
  assert.throws(()=>reviewAlspSample({...sample,nativeExports:{}},mapping),/invalid_alsp_sample/)
  assert.equal(artifactSha256('hello'),'2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
})
