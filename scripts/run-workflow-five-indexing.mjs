import { createCipheriv, createHmac, randomBytes } from 'node:crypto'
import { open, rename } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout as pause } from 'node:timers/promises'
import { createPublicClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { validateDiscoveryExtension, validateDiscoveryExtensionSpec } from '@x402/extensions/bazaar'
import { prepareModularPurchase, submitModularPurchase, validateModularCapsule } from '../lib/x402/modular-buyer.ts'
import { modularPaymentNonce } from '../lib/x402/input-bound-payment.ts'
import { decodeChallenge } from '../lib/x402/client.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'
import { receiptMatchesAuthorization } from '../lib/api-v1/base-proof.ts'
import { MAHA_PAYEE } from '../lib/x402/merchant-identity.ts'
import { usdcNetwork } from '../lib/x402/networks.ts'

export const CAP = 849480n
export const REF = 'refs/heads/codex/workflow-five-indexing-20261114'
export const APPROVAL = 'PUBLISHER_FUNDED_WORKFLOW_FIVE_ONCE_MAX_849480'
const SCOPE = 'maha-workflow-five-indexing/2026-11-14'
const ORIGIN = 'https://www.mahastrategies.com'
const CDP = 'https://api.cdp.coinbase.com/platform/v2/x402'
const WALLET = '0x7b7ff44288fade4a1829aba2584dfceb952146f2'
const NETWORK = 'eip155:8453'
const usdc = usdcNetwork(NETWORK)
const frozen = [
  ["workflow-buyer-recovery-readiness","/api/v1/verify/workflows/buyer-recovery-readiness","145500","c8b8129bad0f8798781d3903bcc7d5346427b82f36d8f535a99598cfd9f50127","86f54fc256338e1a1490b65149e50b6951e93bd646e5fbbb0dc1abb07dc0fd3a"],
  ["workflow-quote-review-v1","/api/v1/verify/workflows/quote-review-v1","165995","702e07948da949fc4a59378dd9a667ec83d64f8d3ad79146634881278618b8b1","46d284d1477ed63564e309cee642732d0849a94ddf869894db97e97b1d3040a1"],
  ["workflow-receipt-review-v1","/api/v1/verify/workflows/receipt-review-v1","195995","5e7a94249f2cd4f0f849ffb2526d0ec1f8eb1efa2997b8da6009b89273c61a9a","2e970e8934dd3b98fe973a64b66ac46213984179c6a8a0186d188722c964989e"],
  ["workflow-api-contract-release-v2","/api/v1/verify/workflows/api-contract-release-v2","155995","08188242386eb4898ee95f4a3ad3b1e44cd1e9f2d76257bd8e6f210b06156ef0","940c00d264ba9cd2c7e5c2ded6260bdb86b3a445530cd3bfbd34792991fc6b7e"],
  ["workflow-tool-contract-release-v2","/api/v1/verify/workflows/tool-contract-release-v2","185995","00635819f9307f20d5320a002ba934028796d115ccb856109cb25ed173c60aaf","dcfe3256e0df19b0d7d951861ad0b8478252cc56050216d7d895ea3ee8bb814f"]
]
export const TARGETS = Object.freeze(frozen.map(([id,path,amount,plan,input]) =>
  Object.freeze({id,path,amount,planHash:'sha256:'+plan,inputHash:'sha256:'+input})))
if (TARGETS.reduce((n,e)=>n+BigInt(e.amount),0n) !== CAP) throw Error('incorrect_cap')
const fail = (code) => { throw Error(code) }
const post = (body) => ({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
const merchantTransport = (url, init={}) => {
  if(new URL(url).origin !== ORIGIN) fail('unexpected_merchant_origin')
  return fetch(url, {...init,redirect:'error',signal:AbortSignal.timeout(20000),
    headers:{...Object.fromEntries(new Headers(init.headers)), 'user-agent':'maha-operator-workflow-five/1','x-maha-discovery-source':'maha_canary'}})
}
async function read(url, init, requester=fetch) {
  const response=await requester(url, {...init,redirect:'error',signal:AbortSignal.timeout(16000),cache:'no-store'})
  if (!response.ok) fail('public_read_failed_'+response.status)
  const reader=response.body?.getReader()
  if(!reader) fail('public_body_missing')
  let count=0; const chunks=[]
  try { for(;;){const x=await reader.read();if(x.done)break;count+=x.value.length;if(count>8388608)fail('public_body_limit');chunks.push(x.value)}
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))
  } finally { await reader.cancel().catch(()=>{}) }
}
function sameTerms(a,e) {
  return a?.scheme==='exact' && a.network===NETWORK && a.amount===e.amount
    && a.asset?.toLowerCase()===usdc.asset.toLowerCase() && a.payTo?.toLowerCase()===MAHA_PAYEE
}
export function listingMatches(row,e) {
  return row?.resource===ORIGIN+e.path && row.extensions?.bazaar?.info?.input?.method==='POST'
    && row.accepts?.some(a=>sameTerms(a,e))
}
async function snapshot() {
  const seen=new Map();let total
  for(let offset=0;offset<2000;offset+=100){
    const u=new URL(CDP+'/discovery/merchant');u.search=new URLSearchParams({payTo:MAHA_PAYEE,limit:'100',offset:String(offset)})
    const p=await read(u)
    if(p.payTo?.toLowerCase()!==MAHA_PAYEE||p.pagination?.offset!==offset||!Number.isSafeInteger(p.pagination?.total)
      ||p.pagination.total<0||p.pagination.total>2000||total!==undefined&&total!==p.pagination.total
      ||!Array.isArray(p.resources)||p.resources.length!==Math.min(100,p.pagination.total-offset)) fail('incomplete_merchant_snapshot')
    total=p.pagination.total
    for(const row of p.resources){if(typeof row.resource!=='string'||seen.has(row.resource))fail('invalid_merchant_resource');seen.set(row.resource,row)}
    if(seen.size===total) return seen
  }
  fail('incomplete_merchant_snapshot')
}
export function exactFromSurfaces(e, merchantRow, searchRows) {
  if(!Array.isArray(searchRows)) fail('invalid_bazaar_search')
  const exact=searchRows.filter(row=>row.resource===ORIGIN+e.path)
  if(merchantRow)exact.push(merchantRow)
  if(exact.some(row=>!listingMatches(row,e)))fail('existing_listing_terms_conflict_no_payment')
  return exact.length>0
}
async function findExact(e, merchantIndex) {
  // Exact URL search can surface a real listing before the merchant cache
  // catches up. Never count a fuzzy hit or validator simulation as listed.
  const u=new URL(CDP+'/discovery/search')
  u.search=new URLSearchParams({urlSubstring:ORIGIN+e.path,payTo:MAHA_PAYEE,network:NETWORK,limit:'10'})
  const s=await read(u)
  return exactFromSurfaces(e,merchantIndex?.get(ORIGIN+e.path),s.resources)
}
export function budget() {
  const seen=new Set(); let authorized=0n
  return { get authorized(){return authorized}, reserve(e) {
    if(!TARGETS.includes(e)||seen.has(e.id)||authorized+BigInt(e.amount)>CAP)fail('duplicate_or_unapproved_authorization')
    seen.add(e.id);authorized+=BigInt(e.amount)
  }}
}
export function contract(e) {
  return {id:e.id,path:e.path,amount:e.amount,recoverySeconds:86400,
    validateInput(input) {
      if(input?.planHash!==e.planHash||demandDigest(input)!==e.inputHash||input.nonpersonalMetadata!==true)fail('unpinned_input')
      return input
    },
    validateOutput(data) {
      const {resultHash,receiptDigest,...payload}=data
      if(data.version!=='maha-task-workflow/1'||data.workflowId!==e.id||data.planHash!==e.planHash||data.inputHash!==e.inputHash
        ||data.componentPayments!==0||data.liveModelCalls!==0||demandDigest(payload)!==resultHash
        ||demandDigest({version:data.version,workflowId:e.id,inputHash:e.inputHash,planHash:e.planHash,resultHash})!==receiptDigest)
        fail('workflow_receipt_binding_mismatch')
      return data
    }}
}
async function assertQuote(e,input) {
  const q=await merchantTransport(ORIGIN+e.path,post(input))
  const encoded=q.headers.get('payment-required');await q.body?.cancel()
  if(q.status!==402||!encoded||Buffer.byteLength(encoded)>=8000)fail('workflow_unsigned_challenge_invalid')
  const c=decodeChallenge(encoded),a=c.accepts[0],b=c.extensions?.bazaar
  if(c.x402Version!==2||c.resource.url!==ORIGIN+e.path||c.accepts.length!==1||!sameTerms(a,e)
    ||!b||b.info?.input?.method!=='POST'||!validateDiscoveryExtensionSpec(b).valid||!validateDiscoveryExtension(b).valid)
    fail('workflow_quote_or_discovery_changed')
  const w=c.extensions?.['maha-task-workflow-contract']?.info
  const contractUrl=ORIGIN+'/api/v1/discovery/describe?productId='+e.id
  // A compact quote may omit its plan pin. The independent describe and
  // preflight checks below still enforce the pinned plan and input.
  if(w?.workflowId!==e.id||w.contractUrl!==contractUrl||(w.planHash!==undefined&&w.planHash!==e.planHash))fail('workflow_contract_pin_changed')
}
async function readTarget(e){
  const live=await read(ORIGIN+'/api/v1/discovery/describe?id='+e.id,{},merchantTransport)
  if(live.id!==e.id||live.path!==e.path||live.amount!==e.amount||live.method!=='POST'||live.planHash!==e.planHash||live.paymentEnabled!==true)
    fail('live_contract_changed')
  const input=contract(e).validateInput(live.examples?.input)
  const prepared=await read(ORIGIN+'/api/v1/discovery/preflight',post({productId:e.id,input}),merchantTransport)
  if(prepared.status!=='authorizer_required'||prepared.readyToSign!==false||prepared.productId!==e.id
    ||prepared.inputHash!==e.inputHash||prepared.priceAtomicUSDC!==e.amount||prepared.recovery?.retentionSeconds!==86400
    ||prepared.recovery?.automaticRepayment!==false)fail('live_preflight_changed')
  contract(e).validateInput(prepared.normalizedInput)
  await assertQuote(e,input)
  const v=await read(CDP+'/validate',post({resource:ORIGIN+e.path,method:'POST'}))
  if(v.valid!==true||v.simulation?.outcome!=='accepted')fail('coinbase_validation_refused')
  return input
}
export async function sequence(targets, isListed, buy, confirmListing, event=async()=>{}) {
  for(const target of targets){
    if(await isListed(target)){ await event(target,'already_listed_no_payment'); continue }
    await buy(target)
    if(!await confirmListing(target))fail('settled_listing_unconfirmed_do_not_repay')
    await event(target,'listed_verified')
  }
}
function guard(){
  const e=process.env
  if(e.GITHUB_ACTIONS!=='true'||e.GITHUB_REPOSITORY!=='Maha-Strategies/maha-corp-web'||e.GITHUB_REF!==REF||e.GITHUB_RUN_ATTEMPT!=='1'
    ||e.WORKFLOW_FIVE_CONFIRMATION!==APPROVAL||!e.WORKFLOW_FIVE_EVIDENCE||dirname(e.WORKFLOW_FIVE_EVIDENCE)!==e.RUNNER_TEMP)
    fail('protected_exact_branch_and_confirmation_required')
}
async function saveJson(path,value){
  const tmp=path+'.part-'+randomBytes(12).toString('hex')
  const f=await open(tmp,'wx',0o600)
  try{await f.writeFile(JSON.stringify(value,null,2)+'\n');await f.sync()}finally{await f.close()}
  await rename(tmp,path)
  const d=await open(dirname(path),'r');try{await d.sync()}finally{await d.close()}
}
async function run(mode){
  if(!['--plan','--pay'].includes(mode)||process.argv.length!==3)fail('explicit_mode_required')
  if(mode==='--pay')guard()
  const inputs=new Map()
  for(const e of TARGETS){inputs.set(e.id,await readTarget(e));console.log(JSON.stringify({id:e.id,status:'unsigned_valid',amount:e.amount}))}
  let index=await snapshot()
  if(mode==='--plan'){const listed=[];for(const e of TARGETS)if(await findExact(e,index))listed.push(e.id);console.log(JSON.stringify({cap:String(CAP),listed}));return}
  const k=process.env.X402_BUYER_PRIVATE_KEY?.trim(),rpc=process.env.BASE_RPC_URL?.trim()
  if(!k||!/^0x[a-f0-9]{64}$/i.test(k)||!rpc||new URL(rpc).protocol!=='https:')fail('protected_signer_or_rpc_missing')
  const account=privateKeyToAccount(k),payer=account.address.toLowerCase()
  if(payer!==WALLET)fail('unexpected_payer')
  const client=createPublicClient({chain:base,transport:http(rpc,{retryCount:0,timeout:13000})})
  const abi=parseAbi(['function balanceOf(address) view returns (uint256)','function authorizationState(address,bytes32) view returns(bool)'])
  if(await client.getChainId()!==8453)fail('wrong_payment_chain')
  const balance=await client.readContract({address:usdc.asset,abi,functionName:'balanceOf',args:[account.address]})
  if(balance<CAP)fail('insufficient_balance')
  const out=process.env.WORKFLOW_FIVE_EVIDENCE, cap=budget(), packets=[]
  const key=createHmac('sha256',k).update(SCOPE+':encrypted-capsule-v1').digest()
  const log={scope:SCOPE,classification:'publisher-funded-operator-activity',customerRevenue:false,automaticRepayment:false,
    state:'in_progress',approvedAtomic:String(CAP),authorizedAtomic:'0',confirmedAtomic:'0',steps:[]}
  const save=()=>saveJson(out,log)
  await save()
  try{
    await sequence(TARGETS,async e=>{
      index=await snapshot()
      return findExact(e,index)
    },async e=>{
      const input=inputs.get(e.id),c=contract(e),secret=createHmac('sha256',k).update(SCOPE+':once:'+e.id).digest('hex')
      const nonce=modularPaymentNonce(e.id,e.inputHash,secret)
      if(await client.readContract({address:usdc.asset,abi,functionName:'authorizationState',args:[account.address,nonce]}))fail('prior_authorization_used_do_not_repay')
      await assertQuote(e,input)
      cap.reserve(e)
      const step={id:e.id,amount:e.amount,state:'authorization_reserved'};log.steps.push(step);log.authorizedAtomic=String(cap.authorized);await save()
      const capsule=await prepareModularPurchase(c,{input,payer,maximumAmount:BigInt(e.amount),secret,fetchImpl:merchantTransport,
        signTypedData:t=>account.signTypedData(t),persist:async x=>{
          const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(SCOPE))
          const ct=Buffer.concat([cipher.update(JSON.stringify(x)),cipher.final()])
          packets.push({id:e.id,iv:iv.toString('hex'),ciphertext:ct.toString('base64'),tag:cipher.getAuthTag().toString('hex')})
          await saveJson(out+'.encrypted.json',{scope:SCOPE,packets})
          step.state='capsule_saved_submission_about_to_start';await save()
        }})
      const proof=await validateModularCapsule(c,capsule)
      const posted=proof.payment.extensions?.bazaar
      if(!posted||!validateDiscoveryExtensionSpec(posted).valid||!validateDiscoveryExtension(posted).valid||posted.info?.input?.method!=='POST')fail('signed_capsule_missing_bazaar_do_not_send')
      const result=await submitModularPurchase(c,capsule,{fetchImpl:merchantTransport})
      step.http=result.status; if(result.errorCode)step.errorCode=result.errorCode
      if(result.delivery!=='validated_response'||!result.transaction){
        step.authorizationUsed=await client.readContract({address:usdc.asset,abi,functionName:'authorizationState',args:[account.address,nonce]}).catch(()=>null)
        step.state='unresolved_do_not_repay';await save();fail('payment_or_delivery_unresolved_do_not_repay')
      }
      step.transaction=result.transaction;step.state='provider_reported_awaiting_chain';await save()
      const rc=await client.waitForTransactionReceipt({hash:result.transaction,timeout:45000,pollingInterval:2500})
      if(!receiptMatchesAuthorization(rc,{transaction:result.transaction,payer,payee:MAHA_PAYEE,amount:e.amount,nonce}))fail('receipt_not_bound_do_not_repay')
      log.confirmedAtomic=String(BigInt(log.confirmedAtomic)+BigInt(e.amount))
      step.state='settled_delivery_confirmed_awaiting_listing';await save();console.log(JSON.stringify(step))
    },async e=>{
      for(let n=0;n<38;n++){
        let listed
        try{listed=await findExact(e)}catch(error){
          if(error.message==='existing_listing_terms_conflict_no_payment')throw error
        }
        if(listed)return true
        // Merchant inventory also qualifies when search is delayed.
        try{index=await snapshot()}catch{if(n<37){await pause(30000);continue}return false}
        const row=index.get(ORIGIN+e.path)
        if(row){if(!listingMatches(row,e))fail('new_listing_terms_conflict_do_not_repay');return true}
        if(n<37)await pause(30000)
      }
      return false
    },async(e,state)=>{
      let step=log.steps.find(x=>x.id===e.id)
      if(!step){step={id:e.id,amount:'0'};log.steps.push(step)}
      step.state=state;await save();console.log(JSON.stringify(step))
    })
    index=await snapshot()
    for(const e of TARGETS)if(!await findExact(e,index))fail('final_snapshot_incomplete_do_not_repay')
    log.state='all_five_exact_listings_verified';await save();console.log(JSON.stringify({state:log.state,confirmedAtomic:log.confirmedAtomic}))
  }catch(err){log.state='stopped_no_repayment';await save();throw err}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)run(process.argv[2]).catch(e=>{
  console.error(/^[a-z0-9_]+(?::[0-9]+)?$/i.test(e?.message||'')?e.message:'workflow_indexing_stopped_no_repayment');process.exitCode=1
})
