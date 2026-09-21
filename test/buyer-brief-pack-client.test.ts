import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { preparePackOrder,purchasePack,recoverPack,validatePackDelivery } from '../examples/buyer-brief/buy-pack.ts'
import { briefHash,briefOrderHash,BUYER_BRIEF_RESOURCE,BUYER_BRIEF_TERMS_HASH } from '../lib/x402/buyer-brief-contract.ts'
import { PAYEE,ASSET } from '../examples/buyer-brief/buy-pack.ts'
const bytes=Buffer.from('synthetic bundle');const order=preparePackOrder(briefHash(bytes));const tx='0x'+'a'.repeat(64)
const delivery={productId:'cabezon-buyer-brief-pack',version:'1.0.0',orderId:order.clientRequestId,transaction:tx,archive:{base64:bytes.toString('base64'),sha256:briefHash(bytes),bytes:bytes.length}}
const terms={scheme:'exact',network:'eip155:8453',amount:'20000000',asset:ASSET,payTo:PAYEE,maxTimeoutSeconds:60,extra:{name:'USD Coin',version:'2'}}
test('pack validation rejects swapped bytes and a different order',()=>{
  assert.deepEqual(validatePackDelivery(delivery,order),bytes)
  assert.throws(()=>validatePackDelivery({...delivery,orderId:'other'},order))
  assert.throws(()=>validatePackDelivery({...delivery,archive:{...delivery.archive,base64:Buffer.from('changed').toString('base64')}},order))
})
test('one $20 authorization; private saved order supports no-payment recovery; repeated attempt stops',async()=>{
  const statePath=join(await mkdtemp(join(tmpdir(),'pack-client-')),'private-state.json')
  let signatures=0,settlements=0
  const fetchImpl:typeof fetch=async(url,init)=>{
    if(String(url).endsWith('/retrieve')) {assert.equal(new Headers(init?.headers).has('PAYMENT-SIGNATURE'),false);return Response.json(delivery)}
    if(!init?.method)return Response.json({purchaseEnabled:true,bundle:{sha256:order.bundleHash},termsHash:BUYER_BRIEF_TERMS_HASH})
    if(!new Headers(init.headers).has('PAYMENT-SIGNATURE'))return new Response(null,{status:402,headers:{'PAYMENT-REQUIRED':Buffer.from(JSON.stringify({x402Version:2,resource:{url:BUYER_BRIEF_RESOURCE},accepts:[terms]})).toString('base64')}})
    settlements++;return Response.json(delivery,{headers:{'PAYMENT-RESPONSE':Buffer.from(JSON.stringify({success:true,network:'eip155:8453',transaction:tx})).toString('base64')}})
  }
  const options={order,address:PAYEE,statePath,signTypedData:async()=>{signatures++;return '0x00'},approval:{reference:'synthetic-only',inputHash:briefOrderHash(order),amountBaseUnits:'20000000' as const,expiresAt:new Date(Date.now()+60000).toISOString()},fetchImpl}
  assert.deepEqual((await purchasePack(options)).archiveBytes,bytes)
  assert.deepEqual((await recoverPack(statePath,fetchImpl)).archiveBytes,bytes)
  await assert.rejects(purchasePack(options));assert.equal(signatures,1);assert.equal(settlements,1)
})
test('withheld contract never reaches signer',async()=>{
  await assert.rejects(purchasePack({order,address:PAYEE,statePath:'/unused',signTypedData:async()=>{assert.fail('must not sign')},approval:{reference:'test',inputHash:briefOrderHash(order),amountBaseUnits:'20000000',expiresAt:new Date(Date.now()+60000).toISOString()},fetchImpl:async()=>Response.json({purchaseEnabled:false})}),/not enabled/)
})
