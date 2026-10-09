import { readFileSync } from 'node:fs'
import { adaptObservation, associateSynthetic, rawDigest } from '../lib/payability-observation.ts'

// Offline only. Reads the private bundle, emits a JSON report to stdout.
const dir = process.argv[2]
if (!dir) throw Error('Usage: node --experimental-strip-types scripts/review-payability-observations.ts PRIVATE_BUNDLE_DIR')
const read = (name: string) => readFileSync(`${dir}/${name}`, 'utf8')
const catalogue = read('synthetic-catalogue.json'), records = read('observation-records.json')
const pins = { catalogue: '73bc04fc601c5da33a631179d0231ed469a580029620e5e61a9dce0fdc0f9e1a', records: '7e287cdb08e631108cd513c6c50b3e1344b41fb2384369cba755932cd61c00e5' }
if (rawDigest(catalogue) !== pins.catalogue || rawDigest(records) !== pins.records) throw Error('Private fixture pin mismatch')
const preview = read('preview.json'), manifestRaw = read('manifest.json'), manifest = JSON.parse(manifestRaw)
const capturedAt = JSON.parse(read('capture.json')).capturedAt
const p = JSON.parse(preview)
const control = await adaptObservation(preview, manifest, { resource: p.resource, method: p.method, now: capturedAt, source: 'free-preview', maxAgeSeconds: 120, futureSkewSeconds: 5 })
console.log(JSON.stringify({
  generatedAt: new Date().toISOString(), profile: 'payability-v3-offline-review/1', capturedAt,
  pinnedFiles: { ...pins, preview: rawDigest(preview), manifest: rawDigest(manifestRaw) },
  mapping: associateSynthetic(catalogue, records).map(r => ({ catalogueId: r.catalogue?.slug, resource: r.observation.resource, providerVerdict: r.observation.verdict, issues: r.issues, purchaseAuthorized: false })),
  positiveControl: { authentication: control.authentication, assessment: control.assessment, resource: p.resource, checkedAt: p.checked_at },
  limits: ['Free preview of provider-selected resource, not a paid call or Maha endpoint test.', 'Historical authentication control; not current freshness evidence.', 'No payment, delivery, quality, on-chain or production integration claim.', 'No rotations automatically trusted; requires reviewed policy update.', 'Non-null facilitator retained but not assessed.'],
}, null, 2))
