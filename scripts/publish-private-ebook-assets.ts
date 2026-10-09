import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { EBOOK_IDS, ebookArtifacts } from '../lib/x402/ebook-contract.ts'
import { loadEbook, validateEbookPayload, EBOOK_STORAGE_BUCKET, ebookStoragePath } from '../lib/x402/ebook-delivery.ts'
const args = process.argv.slice(2)
if (args.length !== 2 || args[0] !== '--keys') throw new Error('Explicit production key-file path required; credentials are never printed.')
const keys = JSON.parse(readFileSync(args[1], 'utf8')) as Array<{ name: string; api_key: string }>
const key = keys.find(k => k.name === 'service_role')?.api_key
if (!key) throw new Error('Production credential unavailable.')
const bundles = await Promise.all(EBOOK_IDS.map(async id => ({ id, bytes: await loadEbook(id), manifest: ebookArtifacts(id) })))
const client = createClient('https://uhwuullakihgszxhiygz.supabase.co', key, { auth: { persistSession: false, autoRefreshToken: false } })
const before = await client.storage.listBuckets()
if (before.error) throw new Error('Cannot verify existing bucket configuration.')
const bucket = before.data.find(b => b.name === EBOOK_STORAGE_BUCKET)
if (bucket?.public) throw new Error('Refused public storage bucket.')
if (!bucket) {
  const created = await client.storage.createBucket(EBOOK_STORAGE_BUCKET, { public: false, fileSizeLimit: 10485760, allowedMimeTypes: ['application/epub+zip', 'application/pdf'] })
  if (created.error) throw new Error('Private bucket creation failed; do not change another bucket.')
}
for (const bundle of bundles) {
  const downloaded: Uint8Array[] = []
  for (let i = 0; i < bundle.manifest.length; i++) {
    const file = bundle.manifest[i], path = ebookStoragePath(file)
    const directory = await client.storage.from(EBOOK_STORAGE_BUCKET).list(path.slice(0, path.lastIndexOf('/')), { limit: 10 })
    if (directory.error) throw new Error('Cannot verify immutable object existence.')
    if (!directory.data.some(object => object.name === file.filename)) {
      const uploaded = await client.storage.from(EBOOK_STORAGE_BUCKET).upload(path, bundle.bytes[i], { contentType: file.mediaType, upsert: false })
      if (uploaded.error) throw new Error('Private upload failed; no existing object overwritten.')
    }
    const checked = await client.storage.from(EBOOK_STORAGE_BUCKET).download(path)
    if (checked.error || !checked.data) throw new Error('Private read-back failed.')
    downloaded.push(new Uint8Array(await checked.data.arrayBuffer()))
    const publicProbe = await fetch(`https://uhwuullakihgszxhiygz.supabase.co/storage/v1/object/public/${EBOOK_STORAGE_BUCKET}/${path}`, { redirect: 'error', signal: AbortSignal.timeout(10000) })
    if (publicProbe.ok) throw new Error('Private asset was anonymously accessible; release refused.')
  }
  validateEbookPayload(bundle.id, downloaded)
  console.log(JSON.stringify({ bookId: bundle.id, files: bundle.manifest.length, privateReadBackIntegrity: true, publicAccessDenied: true }))
}
