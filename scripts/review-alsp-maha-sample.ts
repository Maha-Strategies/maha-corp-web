import { ALSP_SAMPLE_COMMIT, artifactSha256, reviewAlspSample } from '../lib/x402/alsp-fit-review.ts'
// Fixed public commit only; downloads JSON as data. No upstream code is executed.
const base = `https://raw.githubusercontent.com/Kairose-master/ALSP/${ALSP_SAMPLE_COMMIT}/docs/examples/maha-offline-session-sample/`
const files = await Promise.all(['samples.json', 'maha-public-mapping.json', 'source-manifest.json'].map(async name => {
  const response = await fetch(base + name, { redirect: 'error', signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error('sample_fetch_unavailable')
  const text = await response.text()
  if (Buffer.byteLength(text) > 512000) throw new Error('sample_size_limit')
  return { name, sha256: artifactSha256(text), value: JSON.parse(text) as unknown }
}))
console.log(JSON.stringify({ artifacts: files.map(({ name, sha256 }) => ({ name, sha256 })),
  review: reviewAlspSample(files[0].value, files[1].value) }, null, 2))
