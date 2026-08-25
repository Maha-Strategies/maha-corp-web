import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const sitemap = read('app/sitemap.ts')
const llms = read('app/llms.txt/route.ts')

/*
 * A canonical release is created in Production between deployments. Both public
 * indexes therefore have to be rendered per request.
 *
 * A sitemap file is a Route Handler that Next caches by default unless it uses
 * a request-time API or a dynamic config option. Without one, /sitemap.xml is
 * prerendered at build time and a record released after that build never
 * appears until the next deploy. That is exactly how the 40-record frontier
 * canary failed its public-projection check with failedCanaries empty and
 * missingIndexes holding all forty ids.
 */

test('the sitemap renders per request so post-deploy releases appear', () => {
  assert.match(
    sitemap,
    /export const dynamic = 'force-dynamic'/,
    'app/sitemap.ts must opt out of default Route Handler caching',
  )
})

test('the sitemap actually projects active canonical releases', () => {
  assert.match(sitemap, /getActiveEpistemicCanonicalReleases/)
  assert.match(sitemap, /canonicalReleasePages/)
  // The projection must be driven by the release ledger, not a static list.
  assert.match(sitemap, /canonicalReleases\s*\n?\s*\.filter/)
})

test('both public indexes stay in freshness parity', () => {
  // If one index is per-request and the other is cached, a released record can
  // appear in llms.txt while remaining absent from sitemap.xml.
  const perRequest = /export const dynamic = 'force-dynamic'/
  assert.match(llms, perRequest, 'app/llms.txt/route.ts lost its per-request rendering')
  assert.match(sitemap, perRequest, 'app/sitemap.ts lost its per-request rendering')
})

test('the sitemap excludes records that are only statically published', () => {
  // Static pilot records are already emitted; canonical releases must not be
  // duplicated into the same sitemap.
  assert.match(sitemap, /staticEpistemicPaths/)
  assert.match(sitemap, /!staticEpistemicPaths\.has\(release\.canonicalPath\)/)
})
