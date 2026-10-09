import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { EBOOK_IDS, EBOOK_AMOUNT, EBOOK_VERSION, EBOOK_VERSIONS, ebookArtifacts, ebookBundleHash, ebookOrderHash, ebookResource, ebookTermsHash, parseEbookOrder, parseEbookRecoveryOrder } from '../lib/x402/ebook-contract.ts'
import { loadEbook, type PaidEbookRecord } from '../lib/x402/ebook-delivery.ts'
import { ebookHandlers } from '../lib/x402/ebook-route.ts'
import { MAHA_CARP_DIGITAL_OFFERS, handleCarpSellerRequest } from '../lib/carp/seller.ts'
import { EBOOK_OPENAPI_PATHS } from '../lib/x402/ebook-openapi.ts'
const historicalVersions = ['1.0.0', '1.1.0'] as const
const old = (id: typeof EBOOK_IDS[number], version: string = '1.0.0') => parseEbookRecoveryOrder(id, {
  clientRequestId: 'historical-bundle-order', version, artifactHash: ebookBundleHash(id,version),
  termsHash: ebookTermsHash(id,version), recoverySecret: '0123456789abcdef'.repeat(4),
})
test('historical commitments match the published 1.0.0 and 1.1.0 quotes exactly', () => {
  assert.equal(ebookBundleHash('the-maha-principle','1.0.0'), 'sha256:269617833551d9c7143c94f9aef4d1d4da1c60798a8b107aaae70d8d96974457')
  assert.equal(ebookTermsHash('the-maha-principle','1.0.0'), 'sha256:dfb6704f39609d3fdcfca85e874ca0ce262108967f60d352e75226ff05fcc266')
  assert.equal(ebookBundleHash('the-orbital-mind','1.0.0'), 'sha256:200a03da606440071daa9287ae2555d0ea065e6f63fca85112abf98ba7e5aeb6')
  assert.equal(ebookTermsHash('the-orbital-mind','1.0.0'), 'sha256:1fb390692c89e7e6e82aef1402da54b24f42669231f69fca2a4ceb1493d53672')
  assert.equal(ebookBundleHash('the-maha-principle','1.1.0'), 'sha256:b7e99247f3425c28a2375e711212a9ca541934d60696d5ad3e17277c86ce0d35')
  assert.equal(ebookTermsHash('the-maha-principle','1.1.0'), 'sha256:04c6283227c53bf7f73cee5e7db626abdf7182c36225067d4ea9976ee87fae4b')
  assert.equal(ebookBundleHash('the-orbital-mind','1.1.0'), 'sha256:d8b294025e3c008b70b394391aa3eff7bf1ad133f04a86155ea12644e014c522')
  assert.equal(ebookTermsHash('the-orbital-mind','1.1.0'), 'sha256:6b10026358d7875a6bce85624ab4f1ee66e8b90bdd6db20de26b9710d893d509')
  for(const id of EBOOK_IDS) for(const version of historicalVersions) {
    assert.notEqual(ebookTermsHash(id), ebookTermsHash(id,version))
    assert.throws(()=>parseEbookOrder(id,old(id,version)), /edition_or_terms_changed/)
    assert.throws(()=>parseEbookRecoveryOrder(id,{...old(id,version),version:'../../private'}), /edition_or_terms_changed/)
    assert.throws(()=>parseEbookRecoveryOrder(id,{...old(id,version),artifactHash:'sha256:'+'0'.repeat(64)}), /edition_or_terms_changed/)
    assert.throws(()=>parseEbookRecoveryOrder(id,{...old(id,version),termsHash:ebookTermsHash(id)}), /edition_or_terms_changed/)
  }
})
test('API recovery schema advertises all three pinned editions, while new purchases stay current-only', () => {
  assert.equal(EBOOK_VERSION, '1.2.0')
  assert.deepEqual(EBOOK_VERSIONS, ['1.0.0', '1.1.0', '1.2.0'])
  for(const id of EBOOK_IDS) {
    const retrieve=JSON.stringify(EBOOK_OPENAPI_PATHS[ebookResource(id).replace('https://www.mahastrategies.com','')+'/retrieve'])
    for(const version of EBOOK_VERSIONS) {
      assert.ok(retrieve.includes('"const":"'+version+'"'))
      assert.ok(retrieve.includes(ebookBundleHash(id,version)))
      assert.ok(retrieve.includes(ebookTermsHash(id,version)))
    }
    const purchase=JSON.stringify(EBOOK_OPENAPI_PATHS[ebookResource(id).replace('https://www.mahastrategies.com','')].post)
    assert.ok(purchase.includes('"const":"'+EBOOK_VERSION+'"'))
    for(const version of historicalVersions) assert.ok(!purchase.includes('"const":"'+version+'"'))
  }
})
test('book catalogue declares both included formats and current edition, never a free reader', () => {
  for(const id of EBOOK_IDS) {
    const offer=MAHA_CARP_DIGITAL_OFFERS.find(o=>o.offerId==='book-epub-'+id)!
    assert.equal(offer.price.amount,'10.00');assert.equal(offer.ebookBundle?.version,EBOOK_VERSION)
    assert.deepEqual(offer.ebookBundle?.includedFormats,['EPUB','PDF'])
    assert.equal(offer.ebookBundle?.formatChoiceRequired,false)
    assert.deepEqual(offer.ebookBundle?.artifacts,ebookArtifacts(id))
    assert.ok(!JSON.stringify(offer).includes('/books/'+id+'"'))
  }
})
test('a reader can enquire by exact book title without including the format suffix', () => {
  for(const [id,title] of [['the-maha-principle','The Maha Principle'],['the-orbital-mind','The Orbital Mind']]) {
    const response=handleCarpSellerRequest({jsonrpc:'2.0',method:'enquiry',id:'title-test',params:{query:title,tags:[],imgtxt:null}})
    assert.ok('result' in response)
    const ids=(response as {result:Array<{offerId:string}>}).result.map(o=>o.offerId)
    assert.ok(ids.includes('book-epub-'+id))
    assert.ok(!ids.includes('book-epub-'+(id==='the-maha-principle'?'the-orbital-mind':'the-maha-principle')))
  }
})
const currentPresent=EBOOK_IDS.every(id=>ebookArtifacts(id).every(f=>existsSync('content/paid-ebooks/'+f.filename)))
test('synthetic settled purchases deliver both current files and release capacity once', {skip:!currentPresent}, async()=>{
  for(const id of EBOOK_IDS) {
    const order=parseEbookOrder(id,{...old(id),version:EBOOK_VERSION,artifactHash:ebookBundleHash(id),termsHash:ebookTermsHash(id)})
    let paid=0,released=0
    const handler=ebookHandlers(id,{enabled:true,load:loadEbook,record:async()=>{},resolve:async()=>{
      paid++;return {kind:'paid',header:'synthetic-proof',transaction:'0x'+'3'.repeat(64),payer:'0x'+'2'.repeat(40),amountPaid:EBOOK_AMOUNT,slot:{resource:'book-epub-'+id,token:'synthetic'}}
    },release:async()=>{released++}})
    const response=await handler.POST(new Request(ebookResource(id),{method:'POST',headers:{'content-type':'application/json','PAYMENT-SIGNATURE':'synthetic','x-maha-idempotency-key':order.clientRequestId,'x-maha-input-hash':ebookOrderHash(id,order)},body:JSON.stringify(order)}))
    assert.equal(response.status,200);assert.equal(response.headers.get('PAYMENT-RESPONSE'),'synthetic-proof')
    const result=await response.json();assert.equal(result.version,EBOOK_VERSION);assert.equal(result.recovered,false)
    const files=await loadEbook(id)
    for(let i=0;i<files.length;i++)assert.deepEqual(Buffer.from(result.artifacts[i].base64,'base64'),files[i])
    assert.equal(paid,1);assert.equal(released,1)
  }
})
for(const version of historicalVersions) {
const archivesPresent=EBOOK_IDS.every(id=>ebookArtifacts(id,version).every(f=>existsSync('content/paid-ebooks/archive/'+version+'/'+f.filename)))
test(`${version} settled orders recover exact originals with their secret and no payment when new sales are disabled`, {skip:!archivesPresent}, async()=>{
  for(const id of EBOOK_IDS) {
    const order=old(id,version), tx='0x'+'1'.repeat(64),payer='0x'+'2'.repeat(40)
    const row:PaidEbookRecord={state:'settled',payment_transaction:tx,input_hash:ebookOrderHash(id,order),resource:ebookResource(id),amount:EBOOK_AMOUNT}
    let paid=0
    const handler=ebookHandlers(id,{enabled:false,load:loadEbook,find:async()=>row,resolve:async()=>{paid++;throw Error('must_not_pay')}})
    const req=(o=order)=>new Request(ebookResource(id)+'/retrieve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({payer,order:o})})
    const response=await handler.RETRIEVE(req());assert.equal(response.status,200)
    const result=await response.json();assert.equal(result.version,version);assert.equal(result.recovered,true)
    assert.equal(result.manifestSha256,ebookBundleHash(id,version))
    const originals=await loadEbook(id,version)
    assert.deepEqual(result.artifacts.map((file: Record<string,unknown>)=>Object.fromEntries(Object.entries(file).filter(([key])=>key!=='base64'))),ebookArtifacts(id,version))
    for(let i=0;i<originals.length;i++)assert.deepEqual(Buffer.from(result.artifacts[i].base64,'base64'),originals[i])
    assert.equal((await handler.RETRIEVE(req({...order,recoverySecret:'fedcba9876543210'.repeat(4)}))).status,404)
    assert.equal(paid,0)
    const enabled=ebookHandlers(id,{enabled:true,resolve:async()=>{paid++;throw Error('must_not_pay')}})
    const purchase=await enabled.POST(new Request(ebookResource(id),{method:'POST',headers:{'content-type':'application/json','PAYMENT-SIGNATURE':'synthetic','x-maha-idempotency-key':order.clientRequestId,'x-maha-input-hash':ebookOrderHash(id,order)},body:JSON.stringify(order)}))
    assert.equal(purchase.status,400);assert.equal(paid,0)
  }
})
}
