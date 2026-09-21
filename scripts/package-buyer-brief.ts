import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { localWorkflow, fixture } from '../examples/context-growth/workflow.ts'
import { quote } from '../examples/buyer-brief/purchase.ts'
import { BUYER_BRIEF_OFFER } from '../lib/x402/buyer-brief-offer.ts'
assert.equal(BUYER_BRIEF_OFFER.status, 'withheld', 'Do not overwrite an activated paid artifact; create a new version with retained recovery support.')
const digest = (x: string | Buffer) => 'sha256:' + createHash('sha256').update(x).digest('hex')
const root = await mkdtemp('/private/tmp/maha-buyer-brief-')
const pkg = join(root, 'maha-buyer-brief-v1')
const manifest: Record<string,string> = {}
async function emit(path: string, value: string) {
  await mkdir(dirname(join(pkg,path)), {recursive:true})
  await writeFile(join(pkg,path),value,{flag:'wx'})
  manifest[path] = digest(value)
}
const files = ['examples/buyer-brief/purchase.ts','examples/buyer-brief/buy-pack.ts','examples/buyer-brief/run.ts','examples/context-growth/workflow.ts','test/buyer-brief.test.ts','test/buyer-brief-pack-client.test.ts','lib/x402/buyer-brief-contract.ts','lib/context-compiler.ts','lib/context-pack-evaluator.ts','lib/deep-context-evaluation.ts','lib/x402/client.ts']
for (const f of files) await emit(f,await readFile(f,'utf8'))
for (const f of ['README.md','BUYER-BRIEF.md','RUNBOOK.md','offer.json','run-report.template.json']) await emit(f,await readFile('examples/buyer-brief/'+f,'utf8'))
await emit('lib/x402/offers.ts','// Export projection only; compiler and evaluator copied unchanged.\nexport const DEEP_CONTEXT_EVALUATION_OFFER = { id: "deep-context-evaluation" } as const\n')
await emit('package.json',JSON.stringify({name:'maha-buyer-brief',private:true,version:'1.0.0',type:'module',engines:{node:'>=22.18.0'}},null,2))
const sources=[]
let total=0
if(process.argv.includes('--reuse-snapshots')) {
  // Repackage an unpublished review using its hash-checked dated snapshots;
  // never relabel these captures as a fresh network observation.
  const prior='output/bryan-buyer-brief-2026-09-20/maha-buyer-brief-v1.tar.gz'
  const pin=JSON.parse(await readFile('output/bryan-buyer-brief-2026-09-20/archive-pin.json','utf8'))
  assert.equal(digest(await readFile(prior)),pin.sha256)
  const extract=(path:string)=>execFileSync('tar',['-xOf',prior,'maha-buyer-brief-v1/'+path],{maxBuffer:1000000}).toString('utf8')
  const previous=JSON.parse(extract('sources.json'))
  assert.equal(previous.sources.length,4)
  for(const id of ['catalog','offer','menu','quote']){
    const source=previous.sources.find((s:{id:string})=>s.id===id)
    assert.ok(source);assert.equal(source.file,`sources/${id}.json`)
    const text=extract(source.file);assert.equal(digest(text),source.sha256)
    total+=Buffer.byteLength(text);assert.ok(total<=250000)
    await emit(source.file,text);sources.push(source)
  }
} else {
for(const [name,path] of [['catalog','/api/discovery/carp/catalog'],['offer','/api/discovery/x402-offers/deep-context-evaluation'],['menu','/index.json']]) {
  const url='https://www.mahastrategies.com'+path
  const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)})
  assert.equal(r.status,200,url)
  const text=await r.text(); total+=Buffer.byteLength(text)
  assert.ok(total<=250000,'Source byte cap exceeded')
  const value=JSON.parse(text)
  if(name==='catalog') {
    const offer=value.find((x:Record<string,unknown>)=>x.offerId==='deep-context-evaluation')
    assert.equal(offer.directSettlement.amountBaseUnits,'10000')
    assert.equal(offer.directSettlement.resource,'https://www.mahastrategies.com/api/v1/compress/evaluate')
  }
  await emit(`sources/${name}.json`,text)
  sources.push({id:name,url,fetchedAt:new Date().toISOString(),httpStatus:r.status,bytes:Buffer.byteLength(text),sha256:digest(text),file:`sources/${name}.json`,evidenceClass:'public_seller_declaration'})
}
const q=JSON.stringify(await quote(),null,2)
await emit('sources/quote.json',q)
sources.push({id:'quote',url:'https://www.mahastrategies.com/api/v1/compress/evaluate',fetchedAt:new Date().toISOString(),httpStatus:402,bytes:Buffer.byteLength(q),sha256:digest(q),file:'sources/quote.json',evidenceClass:'unpaid_challenge_no_settlement'})
}
await emit('sources.json',JSON.stringify({version:1,sources,limitation:'Hashes establish byte identity, not truth or signer authority.'},null,2))
await emit('request.json',JSON.stringify(fixture(),null,2))
await emit('expected-local.json',JSON.stringify(localWorkflow(),null,2))
await emit('negative-local.json',JSON.stringify(localWorkflow(64).summary,null,2))
await emit('brief.json',JSON.stringify({version:'1.0.0',service:'deep-context-evaluation',resource:'https://www.mahastrategies.com/api/v1/compress/evaluate',amountBaseUnits:'10000',packPriceBaseUnits:'20000000',packPurchaseEnabled:false,expectedRetainedSpans:4,negativeOutcome:'STOP_REQUIRED_EVIDENCE_OMITTED',accuracyAssessed:false,sources: sources.map(s=>s.id)},null,2))
await emit('MANIFEST.json',JSON.stringify({version:1,files:{...manifest},note:'Compare the archive against its separately communicated digest. No secrets or correspondence included.'},null,2))
execFileSync(process.execPath,['--experimental-strip-types','--test','test/buyer-brief.test.ts','test/buyer-brief-pack-client.test.ts'],{cwd:pkg,stdio:'inherit'})
execFileSync(process.execPath,['--experimental-strip-types','examples/buyer-brief/run.ts','verify'],{cwd:pkg,stdio:'inherit'})
const archive=join(root,'maha-buyer-brief-v1.tar.gz')
execFileSync('tar',['-czf',archive,'-C',root,'maha-buyer-brief-v1'],{env:{...process.env,COPYFILE_DISABLE:'1'}})
const bytes=await readFile(archive)
// Generated delivery artifact, deliberately outside public/.
await mkdir('content/buyer-brief',{recursive:true})
await writeFile('content/buyer-brief/bundle.json',JSON.stringify({version:'1.0.0',filename:'maha-buyer-brief-v1.tar.gz',sha256:digest(bytes),bytes:bytes.length,base64:bytes.toString('base64'),sourceManifestHash:digest(await readFile(join(pkg,'sources.json')))},null,2))
await mkdir('output/bryan-buyer-brief-2026-09-20',{recursive:true})
await writeFile('output/bryan-buyer-brief-2026-09-20/maha-buyer-brief-v1.tar.gz',bytes)
await writeFile('output/bryan-buyer-brief-2026-09-20/archive-pin.json',JSON.stringify({sha256:digest(bytes),bytes:bytes.length,version:'1.0.0',status:'review_release_not_deployed'},null,2))
console.log(JSON.stringify({archive,directory:pkg,sha256:digest(bytes),bytes:bytes.length}))
