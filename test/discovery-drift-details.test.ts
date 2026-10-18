import test from 'node:test'
import assert from 'node:assert/strict'
import { describeDiscoveryDrift, MAX_DRIFT_PATHS } from '../lib/x402/discovery-drift-details.ts'
import { discoveryEvidenceFingerprint } from '../lib/x402/discovery-monitor.ts'
import { readFile, mkdtemp, mkdir, writeFile, cp } from 'node:fs/promises'
import { dirname } from 'node:path'
import { execFileSync } from 'node:child_process'

const base = {scheme:'exact',network:'eip155:8453',asset:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',payTo:'0x'+'1'.repeat(40),amount:'50000',maxTimeoutSeconds:60,extra:{name:'USD Coin',version:'2'}}
const polygon = {...base,network:'eip155:137',asset:'0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'}
const resource = {url:'https://seller.example/api/a',description:'Description',mimeType:'application/json'}
const declaration = () => ({resource,accepts:[base],extensions:{bazaar:{info:{input:{method:'POST',body:{value:'synthetic'}},output:{example:{value:1}}},schema:{properties:{input:{type:'object'},output:{type:'object'}}}}}})

test('additional Polygon option is an expansion, not a changed price or a clean full declaration',()=>{
  const a=declaration(),b={...a,accepts:[base,polygon]}
  const d=describeDiscoveryDrift(a,b)
  assert.equal(d.paymentOptions,'expanded');assert.deepEqual(d.addedNetworks,['eip155:137'])
  assert.deepEqual(d.changedAreas,['additional_payment_options'])
  assert.equal(d.resolution,'inspect_no_automatic_payment')
})
for(const [key,value] of [['amount','50001'],['payTo','0x'+'2'.repeat(40)],['asset','0x'+'3'.repeat(40)],['maxTimeoutSeconds',30],['extra',{name:'USD Coin',version:'3'}]] as const){
  test('does not hide changed payment '+key,()=>{
    const a=declaration(),b={...a,accepts:[{...base,[key]:value},polygon]}
    const d=describeDiscoveryDrift(a,b);assert.equal(d.paymentOptions,'changed');assert.ok(d.changedAreas.includes('payment_terms'))
  })
}
test('removal differs from expansion and order alone is not a term change',()=>{
 const a=declaration()
 assert.equal(describeDiscoveryDrift({...a,accepts:[base,polygon]},{...a,accepts:[polygon,base]}).paymentOptions,'unchanged')
 const d=describeDiscoveryDrift({...a,accepts:[base,polygon]},a)
 assert.equal(d.paymentOptions,'changed');assert.deepEqual(d.removedNetworks,['eip155:137'])
})
test('omitted catalogue resource fields and extensions are uncompared, not invented differences',()=>{
 const d=describeDiscoveryDrift({resource:resource.url,description:resource.description,accepts:[base]},declaration())
 assert.deepEqual(d.changedAreas,[])
 assert.ok(d.uncomparedPaths.includes('/resource/mimeType'));assert.ok(d.uncomparedPaths.includes('/extensions'))
})
test('an explicitly empty extension object is a real returned value',()=>{
 const d=describeDiscoveryDrift({...declaration(),extensions:{}},declaration())
 assert.ok(d.changedPaths.includes('/extensions/bazaar'))
})
test('input schema, transport, output example and prose get distinct diagnostics without raw values',()=>{
 const a=declaration(),b=structuredClone(a)
 b.resource={...resource,description:'new description'}
 b.extensions.bazaar.info.input.method='GET'
 b.extensions.bazaar.info.input.body.value='PRIVATE_SYNTHETIC_SENTINEL'
 b.extensions.bazaar.info.output.example.value=2
 b.extensions.bazaar.schema.properties.input.type='array'
 const d=describeDiscoveryDrift(a,b)
 for(const c of ['description','request_transport','input_schema','input_example','output_example'])assert.ok(d.changedAreas.includes(c as typeof d.changedAreas[number]))
 assert.ok(!JSON.stringify(d).includes('PRIVATE_SYNTHETIC_SENTINEL'))
})
test('integrity commitment is excluded only from explanation, not used to claim digest agreement',()=>{
 const a={...declaration(),extensions:{'declaration-integrity':{declarationDigest:'sha256:old'}}}
 const b={...a,extensions:{'declaration-integrity':{declarationDigest:'sha256:new'}}}
 const d=describeDiscoveryDrift(a,b);assert.deepEqual(d.changedAreas,[])
 assert.ok(!('matchesLive' in d));assert.equal(d.basis,'returned_fields_only')
})
test('duplicate, missing or unbounded payment data never earns an expansion assertion',()=>{
 const a=declaration()
 for(const accepts of [[base,base],[],[{...base,amount:'NaN'}],Array.from({length:65},()=>base)]){
  assert.equal(describeDiscoveryDrift(a,{...a,accepts}).paymentOptions,'not_comparable')
 }
})
test('diagnostics bound path count and depth and explicitly report truncation',()=>{
 const a={...declaration(),extensions:{many:Object.fromEntries(Array.from({length:100},(_,i)=>['k'+i,i]))}}
 const b={...a,extensions:{many:Object.fromEntries(Array.from({length:100},(_,i)=>['k'+i,i+1]))}}
 const d=describeDiscoveryDrift(a,b);assert.equal(d.truncated,true);assert.equal(d.changedPaths.length,MAX_DRIFT_PATHS)
 let x:unknown='a',y:unknown='b';for(let i=0;i<40;i++){x={x};y={x:y}}
 assert.equal(describeDiscoveryDrift({...declaration(),extensions:{x}},{...declaration(),extensions:{x:y}}).truncated,true)
})
const sample=()=>({offer:'a',classification:'drift',report:{endpoint:resource.url,checkedAt:'2026-10-18T01:00:00Z',durationMs:100,
 live:{status:402,integrityDigest:'sha256:one'},bazaar:{found:true,matchesLive:false,declarationDigest:'sha256:two'},
 findings:[{ruleId:'x402.bazaar.stale_metadata',level:'warning'}]}})
test('unchanged evidence does not create a new fingerprint because clocks or result order changed',()=>{
 const a=sample(),b=structuredClone(a);b.report.checkedAt='2026-10-19T01:00:00Z';b.report.durationMs=300
 assert.equal(discoveryEvidenceFingerprint([a]),discoveryEvidenceFingerprint([b]))
 const c={...a,offer:'b'}
 assert.equal(discoveryEvidenceFingerprint([a,c]),discoveryEvidenceFingerprint([c,a]))
})
test('new digest, status or classification changes the incident fingerprint',()=>{
 const a=sample();for(const change of ['digest','status','classification']){
  const b=structuredClone(a)
  if(change==='digest')b.report.live.integrityDigest='sha256:new'
  if(change==='status')b.report.live.status=503
  if(change==='classification')b.classification='contract_failure'
  assert.notEqual(discoveryEvidenceFingerprint([a]),discoveryEvidenceFingerprint([b]))
 }
 assert.throws(()=>discoveryEvidenceFingerprint([]));assert.throws(()=>discoveryEvidenceFingerprint([null]))
})
test('workflow keeps its incident open while suppressing only identical fingerprints',async()=>{
 const source=await readFile('.github/workflows/production-x402-discovery-drift.yml','utf8')
 assert.match(source,/maha-discovery-evidence:/);assert.match(source,/grep -Fq -- "\$MARKER"/)
 assert.match(source,/keeping the incident open/);assert.match(source,/npm ci --ignore-scripts/)
 assert.ok(!source.includes('X402_BUYER_PRIVATE_KEY'))
})
test('incident shell suppresses an exact repeat but posts new evidence, with no network',async()=>{
 const source=await readFile('.github/workflows/production-x402-discovery-drift.yml','utf8')
 const block=source.split('name: Record bounded aggregate incident, not one email per route')[1]
   .split('run: |\n')[1].split('\n      - name: Close only')[0]
 const script=block.split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n')
 const dir=await mkdtemp('/private/tmp/maha-monitor-notify-test-');await mkdir(dir+'/bin')
 await writeFile(dir+'/bin/gh',`#!/bin/bash\nset -eu\ncase "$1 $2" in\n"issue list") echo 123;;\n"issue view") printf '%s' "$PREVIOUS_BODY";;\n"issue comment"|"issue create") printf '%s\\n' "$*" >> "$NOTIFICATION_LOG";;\n*) exit 90;;\nesac\n`,{mode:0o700})
 const fingerprint='a'.repeat(64)
 for(const [name,previous,expected] of [['same','<!-- maha-discovery-evidence:'+fingerprint+' -->',false],['changed','<!-- maha-discovery-evidence:'+'b'.repeat(64)+' -->',true]] as const){
  const log=dir+'/'+name+'.log'
  execFileSync('bash',['-euo','pipefail','-c',script],{env:{...process.env,PATH:dir+'/bin:'+process.env.PATH,BATCH:'000',SUMMARY:'synthetic',
    EVIDENCE_FINGERPRINT:fingerprint,PREVIOUS_BODY:previous,NOTIFICATION_LOG:log,GITHUB_SERVER_URL:'https://github.com',GITHUB_REPOSITORY:'synthetic/repo',GITHUB_RUN_ID:'1'}})
  let sent=false;try{sent=(await readFile(log,'utf8')).includes('issue comment')}catch{}
  assert.equal(sent,expected,name)
 }
})
test('dependency-free inventory still runs from a fresh directory after fingerprint imports change',async()=>{
 const dir=await mkdtemp('/private/tmp/maha-drift-clean-inventory-')
 for(const file of ['scripts/x402-discovery-inventory.ts','lib/x402/discovery-monitor.ts','lib/x402/merchant-catalog.ts']){
  await mkdir(dirname(dir+'/'+file),{recursive:true});await cp(file,dir+'/'+file)
 }
 await writeFile(dir+'/package.json',JSON.stringify({type:'module'}))
 const legacy={offers:[{id:'test-legacy',status:'active',method:'POST',canonicalResource:'https://www.mahastrategies.com/api/v1/test/legacy',payment:{protocol:'x402'}}]}
 const modular=Array.from({length:1000},(_,i)=>({id:'test-'+i,path:'/api/v1/verify/test/action-'+i,method:'POST',priceAtomicUSDC:'10000'}))
 await writeFile(dir+'/legacy.json',JSON.stringify(legacy));await writeFile(dir+'/modular.json',JSON.stringify(modular))
 await writeFile(dir+'/run.mjs',`import {readFile} from 'node:fs/promises';import {loadDiscoveryInventory} from './scripts/x402-discovery-inventory.ts';const r=await loadDiscoveryInventory(async url=>Response.json(JSON.parse(await readFile(String(url).endsWith('/x402.json')?'modular.json':'legacy.json','utf8'))));console.log(JSON.stringify({offers:r.include.flatMap(x=>x.offers).length,batches:r.include.length}));`)
 const result=JSON.parse(execFileSync(process.execPath,['run.mjs'],{cwd:dir,encoding:'utf8'}))
 assert.deepEqual(result,{offers:1001,batches:21})
})
