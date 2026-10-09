import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { EBOOK_IDS, EBOOK_VERSION, ebookArtifacts, ebookHash, type EbookId } from '../lib/x402/ebook-contract.ts'
import { EBOOK_STORAGE_BUCKET, ebookStoragePath, loadEbook } from '../lib/x402/ebook-delivery.ts'

// Publish one current PDF only. Historical objects and every EPUB remain immutable.
const args = process.argv.slice(2)
if (args.length !== 4 || args[0] !== '--keys' || args[2] !== '--book' || !EBOOK_IDS.includes(args[3] as EbookId)) {
  throw new Error('Expected --keys <private key file> --book <current ebook ID>.')
}
if (process.env.X402_EBOOK_STORAGE === 'private') throw new Error('Publisher must validate the selected local PDF before upload.')
const id = args[3] as EbookId
const files = await loadEbook(id)
const manifest = ebookArtifacts(id)
const index = manifest.findIndex(file => file.mediaType === 'application/pdf')
if (index < 0) throw new Error('Selected current bundle has no PDF.')
const file = manifest[index], bytes = files[index], path = ebookStoragePath(file)
const keys = JSON.parse(readFileSync(args[1], 'utf8')) as Array<{ name: string; api_key: string }>
const key = keys.find(k => k.name === 'service_role')?.api_key
if (!key) throw new Error('Production credential unavailable.')
const origin = 'https://uhwuullakihgszxhiygz.supabase.co'
const client = createClient(origin, key, { auth: { persistSession: false, autoRefreshToken: false } })
const buckets = await client.storage.listBuckets()
if (buckets.error || !buckets.data.some(bucket => bucket.name === EBOOK_STORAGE_BUCKET && !bucket.public)) {
  throw new Error('Existing private CABEZON bucket required; publisher cannot create or change buckets.')
}
const existing = await client.storage.from(EBOOK_STORAGE_BUCKET).list(path.slice(0, path.lastIndexOf('/')), { limit: 10 })
if (existing.error) throw new Error('Cannot verify immutable PDF object existence.')
let uploaded = false
if (!existing.data.some(object => object.name === file.filename)) {
  const result = await client.storage.from(EBOOK_STORAGE_BUCKET).upload(path, bytes, { contentType: file.mediaType, upsert: false })
  if (result.error) throw new Error('Single-PDF upload failed; no existing object overwritten.')
  uploaded = true
}
const checked = await client.storage.from(EBOOK_STORAGE_BUCKET).download(path)
if (checked.error || !checked.data) throw new Error('Private PDF read-back failed.')
const recovered = new Uint8Array(await checked.data.arrayBuffer())
if (recovered.byteLength !== file.bytes || ebookHash(recovered) !== file.sha256) throw new Error('Private PDF integrity failure.')
const publicProbe = await fetch(`${origin}/storage/v1/object/public/${EBOOK_STORAGE_BUCKET}/${path}`, {
  redirect: 'error', signal: AbortSignal.timeout(10_000),
})
if (publicProbe.status !== 400 && publicProbe.status !== 404) throw new Error('Could not verify denied public access to the PDF.')
console.log(JSON.stringify({ bookId: id, version: EBOOK_VERSION, uploadedObjects: uploaded ? 1 : 0,
  filename: file.filename, bytes: file.bytes, sha256: file.sha256, privateReadBackIntegrity: true, publicAccessDenied: true }))
