import {randomBytes,createHash} from 'node:crypto'
import {releaseSchema,bookManifestHash,bookAuthorizationNonce,bookRecoveryOrder} from '../carp/book-delivery-v2.ts'
import {decodeChallenge} from './client.ts'

/** Unsigned contract + quote check only. No wallet, payment header, chain read,
 * Redis write, facilitator call or paid file retrieval. Never returns secrets. */
export async function checkBookDiscoveryContract(subject:string,fetcher:typeof fetch=fetch){
  const url=new URL(subject)
  if(url.origin!=='https://www.mahastrategies.com'||!/^\/api\/v1\/books\/[a-z-]+\/bundle$/.test(url.pathname)||url.search||url.hash)throw Error('Invalid book probe')
  const options={redirect:'error' as const,credentials:'omit' as const,cache:'no-store' as const}
  const contract=await fetcher(subject,{...options,signal:AbortSignal.timeout(20000)})
  if(contract.status!==200)throw Error('Book contract unavailable')
  const meta=await contract.json(),r=releaseSchema.parse(meta.release)
  if(meta.purchaseEnabled!==true||r.resource!==subject||meta.manifestHash!==bookManifestHash(r)||typeof meta.terms!=='string'
    ||'sha256:'+createHash('sha256').update(meta.terms).digest('hex')!==r.termsHash)throw Error('Invalid book contract')
  const order=bookRecoveryOrder.parse({clientRequestId:'monitor_'+randomBytes(12).toString('hex'),version:r.version,
    manifestHash:bookManifestHash(r),termsHash:r.termsHash,recoverySecret:randomBytes(32).toString('hex')})
  const response=await fetcher(subject,{...options,signal:AbortSignal.timeout(20000),method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(order)})
  const raw=response.headers.get('PAYMENT-REQUIRED')
  if(response.status!==402||!raw||Buffer.byteLength(raw)>=8000)throw Error('Invalid unsigned book quote')
  const challenge=decodeChallenge(raw),q=challenge.accepts[0],body=await response.json()
  if(challenge.resource?.url!==subject||challenge.accepts.length!==1||q.scheme!=='exact'||q.network!=='eip155:8453'
    ||q.amount!==r.amount||q.asset.toLowerCase()!=='0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
    ||q.payTo.toLowerCase()!=='0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28'||q.maxTimeoutSeconds!==60
    ||q.extra?.name!=='USD Coin'||q.extra?.version!=='2'
    ||body.extensions?.['maha-book-recovery']?.info?.nonce!==bookAuthorizationNonce(r,order))throw Error('Book quote differs from contract')
  return {classification:'book_contract_only' as const,bookId:r.id,version:r.version,amount:r.amount,
    network:q.network,quoteStatus:402,headerBytes:Buffer.byteLength(raw),listingChecked:false,paidDeliveryChecked:false,paidCalls:0}
}
