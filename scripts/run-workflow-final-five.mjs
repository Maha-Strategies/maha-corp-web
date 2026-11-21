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

export const CAP = 195950n
export const REF = 'refs/heads/codex/workflow-trial-only-20261121'
export const APPROVAL = 'PUBLISHER_FUNDED_WORKFLOW_TRIAL_ONLY_ONCE_MAX_195950'
// Keep the original nonce namespace so an earlier authorization cannot be paid again.
const SCOPE = 'maha-workflow-final-five/2026-11-15'
const ORIGIN = 'https://www.mahastrategies.com'
const CDP = 'https://api.cdp.coinbase.com/platform/v2/x402'
const WALLET = '0x7b7ff44288fade4a1829aba2584dfceb952146f2'
const NETWORK = 'eip155:8453'
const usdc = usdcNetwork(NETWORK)
const frozen = [
  ["workflow-trial-registry-evidence-handoff","/api/v1/intel/workflows/trial-registry-evidence-handoff","195950","20185f943789d93df226c0d8bdbe869ef8f46a0080525dd177b2733a4a26a063","491b8003a881c678be9ccbd40e64f7a3db02550fd0feef2a0181f0ee0a8bbc0a"]
]
export const TARGETS = Object.freeze(frozen.map(([id,path,amount,plan,input]) =>
  Object.freeze({id,path,amount,planHash:'sha256:'+plan,inputHash:'sha256:'+input})))
if (TARGETS.length!==1 || new Set(TARGETS.map(e=>e.id)).size!==1
  || new Set(TARGETS.map(e=>e.path)).size!==1 || TARGETS.reduce((n,e)=>n+BigInt(e.amount),0n)!==CAP) throw Error('incorrect_batch_or_cap')
const fail = (code) => { throw Error(code) }
const post = (body) => ({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
const merchantTransport = (url, init={}) => {
  if(new URL(url).origin !== ORIGIN) fail('unexpected_merchant_origin')
  return fetch(url, {...init,redirect:'error',signal:AbortSignal.timeout(20000),
    headers:{...Object.fromEntries(new Headers(init.headers)), 'user-agent':'maha-operator-workflow-final-five/1','x-maha-discovery-source':'maha_canary'}})
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
    if(p.partialResults===true||p.payTo?.toLowerCase()!==MAHA_PAYEE||p.pagination?.offset!==offset||!Number.isSafeInteger(p.pagination?.total)
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
  // Separate public query variants can have different cache ages. Both are
  // checked against the same strict URL, method, chain, asset, amount and payee.
  const rows=await Promise.all([
    {urlSubstring:ORIGIN+e.path,payTo:MAHA_PAYEE,network:NETWORK,limit:'10'},
    {urlSubstring:e.path,network:NETWORK,limit:'10'},
    {urlSubstring:e.path.split('/').at(-1),limit:'10'},
  ].map(async params=>{
    const s=await read(CDP+'/discovery/search?'+new URLSearchParams(params))
    if(s.partialResults===true||!Array.isArray(s.resources))fail('invalid_bazaar_search')
    return s.resources
  }))
  return exactFromSurfaces(e,merchantIndex?.get(ORIGIN+e.path),rows.flat())
}
export function budget() {
  const seen=new Set(); let authorized=0n
  return { get authorized(){return authorized}, reserve(e) {
    if(!TARGETS.includes(e)||seen.has(e.id)||authorized+BigInt(e.amount)>CAP)fail('duplicate_or_unapproved_authorization')
    seen.add(e.id);authorized+=BigInt(e.amount)
  }}
}
export function requirePassingDelivery(data) {
  if(data?.overallStatus!=='REQUIREMENTS_SATISFIED')fail('paid_nonpassing_workflow_do_not_repay')
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
export function validUnsignedChallenge(status, encoded) {
  return status === 402 && typeof encoded === 'string' && encoded.length > 0 && Buffer.byteLength(encoded) < 8000
}
async function assertQuote(e,input) {
  const q=await merchantTransport(ORIGIN+e.path,post(input))
  const encoded=q.headers.get('payment-required');await q.body?.cancel()
  if(!validUnsignedChallenge(q.status,encoded))fail('workflow_unsigned_challenge_invalid')
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
    const delivery=await buy(target)
    if(!await confirmListing(target))fail('settled_listing_unconfirmed_do_not_repay')
    await event(target,'listed_verified')
    requirePassingDelivery(delivery)
  }
}
function guard(){
  const e=process.env
  if(e.GITHUB_ACTIONS!=='true'||e.GITHUB_REPOSITORY!=='Maha-Strategies/maha-corp-web'||e.GITHUB_REF!==REF||e.GITHUB_RUN_ATTEMPT!=='1'
    ||e.WORKFLOW_TRIAL_ONLY_CONFIRMATION!==APPROVAL||!e.WORKFLOW_TRIAL_ONLY_EVIDENCE||dirname(e.WORKFLOW_TRIAL_ONLY_EVIDENCE)!==e.RUNNER_TEMP)
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
  const out=process.env.WORKFLOW_TRIAL_ONLY_EVIDENCE, cap=budget(), packets=[]
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
      step.overallStatus=result.data.overallStatus
      step.state='settled_delivery_confirmed_awaiting_listing';await save();console.log(JSON.stringify(step))
      return result.data
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
    log.state='trial_exact_listing_verified';await save();console.log(JSON.stringify({state:log.state,confirmedAtomic:log.confirmedAtomic}))
  }catch(err){log.state='stopped_no_repayment';await save();throw err}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)run(process.argv[2]).catch(e=>{
  console.error(/^[a-z0-9_]+(?::[0-9]+)?$/i.test(e?.message||'')?e.message:'workflow_indexing_stopped_no_repayment');process.exitCode=1
})
