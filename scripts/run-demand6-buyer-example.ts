import assert from 'node:assert/strict'
import { privateKeyToAccount } from 'viem/accounts'
import { prepareDemandPurchase,submitDemandPurchase,type DemandPurchaseCapsule } from '../lib/x402/demand6/buyer.ts'
import { demand6Handlers } from '../lib/x402/demand6/route.ts'
import { memoryDemandStore } from '../lib/x402/demand6/store.ts'
import { DEMAND6_SAMPLES } from '../lib/x402/demand6/contracts.ts'
import { buildDemandProduct } from '../lib/x402/demand6/products.ts'
import { fixtureDependencies,FIXTURE_NOW } from '../lib/x402/demand6/fixtures.ts'
import { buildPaymentRequired,encodePaymentResponse } from '../lib/x402/protocol.ts'
import { MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'
import { usdcNetwork } from '../lib/x402/networks.ts'
// This runnable example never uses global fetch, live RPC, an environment key, or a funded account.
if (process.argv.length>2) throw Error('Offline example accepts no live-payment options.')
const account=privateKeyToAccount(('0x'+'11'.repeat(32)) as `0x${string}`), id='csv-import-preflight',network='eip155:8453'
const resource='https://www.mahastrategies.com/api/v1/demand/'+id,definition=usdcNetwork(network)
const requirement={scheme:'exact' as const,network,asset:definition.asset,payTo:MAHA_PAYEE,amount:'13500',maxTimeoutSeconds:60,extra:definition.domain}
const challenge=buildPaymentRequired([requirement],{url:resource})
let settlements=0,signatures=0,stored:DemandPurchaseCapsule|undefined
const handler=demand6Handlers(id,{environment:'test',now:()=>FIXTURE_NOW,store:memoryDemandStore(),verify:async()=>true,
  build:(id,input)=>buildDemandProduct(id,input,fixtureDependencies),record:async()=>{},recordPurchase:async()=>{},release:async()=>{},
  acquirePreparation:async()=>({admitted:true,active:1,token:'mock'}),releasePreparation:async()=>{},
  resolve:async request=>{
    if(!request.headers.has('PAYMENT-SIGNATURE'))return {kind:'challenge',status:402,body:challenge,header:Buffer.from(JSON.stringify(challenge)).toString('base64')}
    settlements++;return {kind:'paid',network,payer:account.address,amountPaid:'13500',transaction:'0x'+'ab'.repeat(32),
      header:encodePaymentResponse({network,payer:account.address,transaction:'0x'+'ab'.repeat(32)}),slot:{resource:id,token:'mock'}}
  }})
const mockFetch:typeof fetch=async(url,init)=>handler.POST(new Request(url,init))
const capsule=await prepareDemandPurchase({productId:id,input:{...DEMAND6_SAMPLES[id],dataClass:'synthetic'},network,payer:account.address,
  maximumAmount:BigInt(13500),now:FIXTURE_NOW,fetchImpl:mockFetch,discoverySource:'alsp',
  signTypedData:async data=>{signatures++;return account.signTypedData(data as Parameters<typeof account.signTypedData>[0])},
  persist:async value=>{stored=structuredClone(value)}})
assert.ok(stored)
const lost=await submitDemandPurchase(capsule,async(url,init)=>{await mockFetch(url,init);throw Error('simulated_response_loss')})
const recovery=await submitDemandPurchase(stored,mockFetch)
assert.equal(lost.settlement,'unknown');assert.equal(recovery.delivery,'validated_response');assert.equal(settlements,1);assert.equal(signatures,1)
console.log(JSON.stringify({mode:'offline_mocks_only',productId:id,lostResponse:lost.delivery,recovery:recovery.delivery,
  signatures,mockedSettlements:settlements,livePayments:0,automaticRepayment:false},null,2))
