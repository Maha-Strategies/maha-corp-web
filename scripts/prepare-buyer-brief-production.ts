import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
const ref='uhwuullakihgszxhiygz',bucket='buyer-brief-private'
const digest='067bb1156b81dc95bb38ab7a0207a9ec4b9541a8b06abe3af8bd2e843c49a003'
const object=`v1/${digest}.json`
assert.equal(process.env.GITHUB_REF,'refs/heads/main','Production workflow must run reviewed main')
const mode=process.env.BUYER_BRIEF_OPERATION
assert.ok(['prepare','inspect','notification-test'].includes(mode??''))
const token=process.env.SUPABASE_ACCESS_TOKEN
assert.ok(token)
const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)})
assert.equal(response.status,200,'Could not obtain authorized production database access')
const keys=await response.json()
const key=keys.find((k:{name:string})=>k.name==='service_role')?.api_key
assert.ok(key,'Service-role key unavailable')
const client=createClient(`https://${ref}.supabase.co`,key,{auth:{persistSession:false,autoRefreshToken:false}})
const ready=await client.rpc('buyer_brief_notifications_ready')
assert.ok(!ready.error&&ready.data===true,'Notification migration not ready')
if(mode==='prepare'){
  const payload=[1,2,3,4].map(i=>process.env[`BUYER_BRIEF_ARTIFACT_${i}`]??'').join('')
  const bundle=JSON.parse(payload)
  assert.equal(bundle.version,'1.0.0');assert.equal(bundle.sha256,`sha256:${digest}`)
  const bytes=Buffer.from(bundle.base64,'base64')
  assert.equal(bytes.length,bundle.bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'),digest)
  const existing=await client.storage.getBucket(bucket)
  if(existing.error){const created=await client.storage.createBucket(bucket,{public:false,fileSizeLimit:2800000,allowedMimeTypes:['application/json']});assert.ok(!created.error,'Private bucket creation failed')}
  else assert.equal(existing.data.public,false,'Artifact bucket must not be public')
  const old=await client.storage.from(bucket).download(object)
  if(old.error){const uploaded=await client.storage.from(bucket).upload(object,payload,{contentType:'application/json',upsert:false});assert.ok(!uploaded.error,'Artifact upload failed')}
  else assert.deepEqual(JSON.parse(await old.data.text()),bundle,'Never overwrite a pinned artifact')
}
const stored=await client.storage.from(bucket).download(object)
assert.ok(!stored.error&&stored.data,'Private artifact missing')
const bundle=JSON.parse(await stored.data.text())
assert.equal(createHash('sha256').update(Buffer.from(bundle.base64,'base64')).digest('hex'),digest)
const publicProbe=await fetch(`https://${ref}.supabase.co/storage/v1/object/public/${bucket}/${object}`,{signal:AbortSignal.timeout(15000)})
assert.ok(!publicProbe.ok,'Artifact unexpectedly public')
const testOrder='notification-test-buyer-brief-20260921'
if(mode==='notification-test'){
  const test=await client.from('buyer_brief_notifications').upsert({payer:'0x'+'0'.repeat(40),order_id:testOrder,kind:'purchase_recorded',payment_transaction:'0x'+'0'.repeat(64)},{onConflict:'payer,order_id,kind',ignoreDuplicates:true})
  assert.ok(!test.error,'Could not queue labelled synthetic notification')
}
const notification=await client.from('buyer_brief_notifications').select('state,attempts,provider_id,sent_at').eq('order_id',testOrder).maybeSingle()
assert.ok(!notification.error,'Could not inspect test notification')
console.log(JSON.stringify({syntheticNotification:notification.data,inboxReceiptNotInferred:true}))
console.log(JSON.stringify({operation:mode,productionRef:ref,migrationReady:true,privateArtifactVerified:true,publicAccessDenied:true,sha256:digest,bytes:bundle.bytes,paymentAttempted:false}))
