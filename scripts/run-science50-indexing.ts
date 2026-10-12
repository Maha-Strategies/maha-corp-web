import { createHash, createHmac } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createPublicClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { SCIENCE_IDS } from '../lib/x402/science/contracts.ts'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { microDigest, verifyMicroProduct } from '../lib/x402/micro-products.ts'
import { microPurchaseHeaders } from '../lib/x402/micro-purchase.ts'
import { MICRO_RECOVERY_MODE_HEADER, MICRO_RECOVERY_PAYER_HEADER } from '../lib/x402/micro-recovery-contract.ts'
import { createPaidFetch, decodeChallenge, decodeReceipt, type PaymentChallenge } from '../lib/x402/client.ts'
import { USDC_NETWORKS } from '../lib/x402/networks.ts'
import { CANARY_BUYER, MAHA_PAYEE, verifyPaymentReceipt } from '../lib/x402/discovery-payment-recipe.ts'
import { confirmSettlement, rpcUrlFor } from '../lib/x402/chain.ts'
import { readProductIndex } from '../lib/x402/product-index.ts'

const ORIGIN = 'https://www.mahastrategies.com', B = 'eip155:8453', A = 'eip155:42161'
export const CONFIRMATION = 'PUBLISHER_FUNDED_SCIENCE_50_ONCE_MAX_3_577_USDC'
export const CAP = BigInt(3577000)
export const OPERATOR_HEADERS = Object.freeze({ 'user-agent': 'maha-canary/science50-indexing', 'x-maha-discovery-source': 'operator-canary', 'x-maha-task-attribution': 'operator-canary' })
export const TARGETS = SCIENCE_IDS.map(id => {
  const offer = X402_OFFERS.find(o=>o.id===id)!
  return { id, path: offer.path, amount: offer.amount, input: offer.discovery.input }
})
export function assertSciencePlan() {
  if (TARGETS.length!==50 || new Set(TARGETS.map(t=>t.path)).size!==50 || TARGETS.reduce((s,t)=>s+BigInt(t.amount),BigInt(0))!==CAP) throw Error('approved_science_plan_changed')
  for(const t of TARGETS) {
    if(BigInt(t.amount)<BigInt(2000)||BigInt(t.amount)>BigInt(300000)) throw Error('approved_price_window_changed')
    if(X402_OFFERS.some(o=>o.id!==t.id && [o.amount,...(o.supersededAmounts??[])].includes(t.amount))) throw Error('price_or_historical_price_collision')
  }
}
export function assertScienceChallenge(c: PaymentChallenge, t: typeof TARGETS[number]) {
  if(c.x402Version!==2 || c.resource.url!==ORIGIN+t.path || c.accepts.length!==2 || new Set(c.accepts.map(r=>r.network)).size!==2) throw Error('challenge_resource_or_networks_changed')
  for(const network of [B,A] as const) {
    const r=c.accepts.find(r=>r.network===network), d=USDC_NETWORKS[network]
    if(!r || r.scheme!=='exact' || r.amount!==t.amount || r.payTo.toLowerCase()!==MAHA_PAYEE || r.asset.toLowerCase()!==d.asset.toLowerCase()
      ||r.extra?.name!==d.domain.name||r.extra?.version!==d.domain.version||r.maxTimeoutSeconds!==60) throw Error('challenge_price_asset_or_payee_changed')
  }
}
type Step={offerId:string;resource:string;amountBaseUnits:string;state:string;recovered?:boolean;transaction?:string;blockNumber?:number;responseSha256?:string;payloadVerified?:boolean;bazaarIndexed?:boolean}
export async function run() {
  assertSciencePlan()
  const args=process.argv.slice(2)
  if(args.some(a=>!['--pay','--index-only'].includes(a))||(args.includes('--pay')&&args.includes('--index-only'))) throw Error('invalid_mode')
  const observe=async()=>{const index=await readProductIndex();const indexed=TARGETS.filter(t=>index.resources.includes(ORIGIN+t.path)).map(t=>t.id);return {checkedAt:index.checkedAt,available:index.available,complete:index.complete,indexed,missing:TARGETS.filter(t=>!indexed.includes(t.id)).map(t=>t.id)}}
  if(args.includes('--index-only')) {console.log(JSON.stringify(await observe()));return}
  // Full unpaid preflight precedes all access to the protected signing key.
  for(const target of TARGETS) {
    const response=await fetch(ORIGIN+target.path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json',...OPERATOR_HEADERS},body:JSON.stringify(target.input)})
    if(response.status!==402) throw Error('unpaid_preflight_failed:'+target.id+':'+response.status)
    const header=decodeChallenge(response.headers.get('PAYMENT-REQUIRED'));assertScienceChallenge(header,target)
    const body=await response.json() as PaymentChallenge;assertScienceChallenge(body,target)
    if(microDigest(header)!==microDigest(body)) throw Error('header_body_disagreement')
  }
  if(!args.includes('--pay')) {console.log(JSON.stringify({state:'preflight_passed',products:50,maximumServiceBaseUnits:String(CAP),index:await observe()}));return}
  const output=process.env.SCIENCE_CANARY_OUTPUT_PATH
  if(process.env.SCIENCE_CANARY_CONFIRMATION!==CONFIRMATION||process.env.GITHUB_RUN_ATTEMPT!=='1'||!output) throw Error('explicit_first_attempt_authorization_and_evidence_required')
  const key=process.env.X402_BUYER_PRIVATE_KEY?.trim()
  if(!key||!/^0x[a-f0-9]{64}$/i.test(key)) throw Error('protected_signer_unavailable')
  const account=privateKeyToAccount(key as `0x${string}`)
  if(account.address.toLowerCase()!==CANARY_BUYER.toLowerCase()) throw Error('unexpected_indexing_wallet')
  const rpcUrl=rpcUrlFor(B,process.env.BASE_RPC_URL)!
  const client=createPublicClient({chain:base,transport:http(rpcUrl,{retryCount:0,timeout:15000})})
  if(await client.getChainId()!==base.id) throw Error('wrong_rpc_chain')
  if(await client.readContract({address:USDC_NETWORKS[B].asset,abi:parseAbi(['function balanceOf(address) view returns (uint256)']),functionName:'balanceOf',args:[account.address]})<CAP) throw Error('insufficient_batch_funding')
  const evidence={version:'maha-science50-indexing/1',classification:'publisher-funded-indexing-canary',customerRevenue:false,organicDemand:false,network:B,
    maximumAuthorizedBaseUnits:String(CAP),newAuthorizedBaseUnits:'0',confirmedBaseUnits:'0',buyer:account.address,payee:MAHA_PAYEE,startedAt:new Date().toISOString(),state:'running',steps:[] as Step[],index:await observe()}
  const save=()=>writeFile(output,JSON.stringify(evidence,null,2)+'\n',{mode:0o600})
  await save()
  try {
    for(const target of TARGETS) {
      // Domain-separated private identity is stable for this ONE batch. A later
      // workflow invocation recovers this purchase instead of silently buying
      // it again. Never publish these derived bearer secrets or the seed key.
      const derive=(label:string)=>createHmac('sha256',key).update(`maha-science50-approved-20261012:${target.id}:${label}`).digest('hex')
      const identity={purchaseId:derive('purchase-id').slice(0,32),recoverySecret:derive('recovery-secret')}
      const headers={'content-type':'application/json',...microPurchaseHeaders(target.id,target.input,identity),...OPERATOR_HEADERS}
      const step:Step={offerId:target.id,resource:ORIGIN+target.path,amountBaseUnits:target.amount,state:'not_attempted'};evidence.steps.push(step);await save()
      let response=await fetch(step.resource,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{...headers,[MICRO_RECOVERY_MODE_HEADER]:'replay',[MICRO_RECOVERY_PAYER_HEADER]:account.address},body:JSON.stringify(target.input)})
      if(response.status===200) step.recovered=true
      else {
        if(response.status!==404) throw Error('existing_or_unknown_purchase_requires_review:'+target.id)
        let signatures=0,challenges=0
        const paidFetch=createPaidFetch({address:account.address,chainId:base.id,
          onPaymentRequired(_r,context){if(++challenges!==1)throw Error('automatic_repayment_refused');assertScienceChallenge(context.challenge,target)},
          async signTypedData(request){
            if(++signatures!==1||request.domain.chainId!==base.id||request.domain.verifyingContract.toLowerCase()!==USDC_NETWORKS[B].asset.toLowerCase()
              ||request.message.to.toLowerCase()!==MAHA_PAYEE||request.message.value!==BigInt(target.amount)) throw Error('authorization_boundary_changed')
            const next=BigInt(evidence.newAuthorizedBaseUnits)+BigInt(target.amount);if(next>CAP)throw Error('service_spend_cap_exceeded')
            evidence.newAuthorizedBaseUnits=String(next);step.state='authorized_outcome_unknown';await save()
            return account.signTypedData({domain:{...request.domain,verifyingContract:request.domain.verifyingContract as `0x${string}`},types:request.types,primaryType:request.primaryType,
              message:{...request.message,from:request.message.from as `0x${string}`,to:request.message.to as `0x${string}`,nonce:request.message.nonce as `0x${string}`}})
          },
        })
        // Exactly one authorization. Any uncertain failure stops the whole run.
        response=await paidFetch(step.resource,{method:'POST',redirect:'error',signal:AbortSignal.timeout(90000),headers,body:JSON.stringify(target.input)})
      }
      const receipt=decodeReceipt(response.headers.get('PAYMENT-RESPONSE'))
      if(!receipt)throw Error('settlement_receipt_missing_or_mismatched')
      verifyPaymentReceipt(receipt,account.address)
      step.transaction=receipt.transaction!;step.state='receipt_recorded';await save()
      const chain=await confirmSettlement({rpcUrl,caip2Network:B,transaction:step.transaction,asset:USDC_NETWORKS[B].asset,payer:account.address,payTo:MAHA_PAYEE,minAmount:target.amount,attempts:3,retryDelayMs:1000})
      if(chain.status!=='confirmed'||chain.amount!==target.amount)throw Error('exact_chain_transfer_not_confirmed')
      step.blockNumber=chain.blockNumber;evidence.confirmedBaseUnits=String(BigInt(evidence.confirmedBaseUnits)+BigInt(target.amount));await save()
      if(!response.ok)throw Error('delivery_not_successful')
      const bytes=await response.text();if(Buffer.byteLength(bytes)>65536)throw Error('delivery_oversized')
      if(!await verifyMicroProduct(target.id,target.input,JSON.parse(bytes)))throw Error('delivered_result_mismatch')
      step.responseSha256='sha256:'+createHash('sha256').update(bytes).digest('hex');step.payloadVerified=true;step.state='confirmed_and_delivered';await save()
    }
    evidence.index=await observe()
    for(const step of evidence.steps)step.bazaarIndexed=evidence.index.indexed.includes(step.offerId as typeof SCIENCE_IDS[number])
    evidence.state=evidence.index.complete&&evidence.index.missing.length===0?'indexed':'payments_complete_index_pending';await save()
    console.log(JSON.stringify({state:evidence.state,delivered:evidence.steps.filter(s=>s.payloadVerified).length,indexed:evidence.index.indexed.length,newAuthorizedBaseUnits:evidence.newAuthorizedBaseUnits,confirmedBaseUnits:evidence.confirmedBaseUnits}))
  } catch {evidence.state='stopped_review_required_no_repayment';await save();throw Error('science_indexing_stopped_preserve_original_purchase')}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) await run()
