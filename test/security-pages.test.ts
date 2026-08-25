import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  ALL_CLAIMS,
  BOUNDARY_MARKDOWN_PATH,
  BOUNDARY_VERSION,
  SECTIONS,
  VERIFICATION_COMMANDS,
} from '../lib/security/context-control-boundary.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const securityPage = read('app/security/page.tsx')
const boundaryPage = read('app/security/context-control-boundary/page.tsx')
const footer = read('components/SiteFooter.tsx')
const securityMd = read('SECURITY.md')
const boundaryMd = read(BOUNDARY_MARKDOWN_PATH)

/* ------------------------------------------------------------- published -- */

test('the boundary page renders from the committed claim module, not retyped prose', () => {
  assert.match(boundaryPage, /from '@\/lib\/security\/context-control-boundary'/)
  assert.match(boundaryPage, /SECTIONS\.map/)
  assert.match(boundaryPage, /claim\.text/)
  assert.match(boundaryPage, /claim\.sources\.map/)
  assert.match(boundaryPage, /VERIFICATION_COMMANDS\.map/)

  // No claim sentence may be hard-coded into the page.
  const inlined = ALL_CLAIMS.filter((claim) => boundaryPage.includes(claim.text.slice(0, 60)))
  assert.deepEqual(inlined.map((claim) => claim.id), [], 'claim text was pasted into the page')
})

test('every claim shown carries at least one committed source', () => {
  const orphans = ALL_CLAIMS.filter((claim) => !claim.sources.length).map((claim) => claim.id)
  assert.deepEqual(orphans, [])
  assert.ok(ALL_CLAIMS.length >= 30, `expected the full claim set, saw ${ALL_CLAIMS.length}`)
  assert.ok(SECTIONS.length >= 7, `expected the full section set, saw ${SECTIONS.length}`)
})

test('the boundary page states its scope and claims no certification', () => {
  assert.match(boundaryPage, /not a security certification/i)
  assert.match(boundaryPage, /WSO2 endorsement/i)
  assert.match(boundaryPage, /substitute for your own review/i)
  assert.match(boundaryPage, /BOUNDARY_VERSION/)
  assert.equal(BOUNDARY_VERSION, '1.0.0')
})

/* ------------------------------------------------ drift against SECURITY.md */

test('the security page does not contradict SECURITY.md on reporting', () => {
  assert.match(securityMd, /three business days/)
  assert.match(securityPage, /three business days/)

  assert.match(securityMd, /no bug bounty/)
  assert.match(securityPage, /no bug bounty/)

  assert.match(securityMd, /mayone@mahastrategies\.com/)
  assert.match(securityPage, /mayone@mahastrategies\.com/)
})

test('the published scope matches the scope committed in SECURITY.md', () => {
  for (const fragment of [
    'www.mahastrategies.com',
    '/api',
    'MCP gateway',
    'Stripe webhook endpoints',
    '@mahastrategies/sdk',
  ]) {
    assert.ok(securityMd.includes(fragment), `SECURITY.md lost in-scope item: ${fragment}`)
    assert.ok(securityPage.includes(fragment), `security page lost in-scope item: ${fragment}`)
  }
  for (const vendor of ['Vercel', 'Supabase', 'Upstash', 'Modal', 'Stripe', 'Sentry', 'Resend']) {
    assert.ok(securityPage.includes(vendor), `security page lost out-of-scope vendor: ${vendor}`)
  }
})

test('the platform assumptions on the page are the ones committed in SECURITY.md', () => {
  for (const fragment of [
    'disclosed exactly once at issuance',
    'append-only',
    'scrubbed before transmission',
    'never persisted',
  ]) {
    assert.ok(securityMd.includes(fragment), `SECURITY.md lost assumption: ${fragment}`)
    assert.ok(securityPage.includes(fragment), `security page lost assumption: ${fragment}`)
  }
})

test('the source document still contains the sections the page presents', () => {
  for (const section of SECTIONS) {
    assert.ok(
      boundaryMd.includes(section.title),
      `${BOUNDARY_MARKDOWN_PATH} no longer contains section "${section.title}"`,
    )
  }
  for (const entry of VERIFICATION_COMMANDS) {
    assert.ok(boundaryMd.includes(entry.command), `source document lost command: ${entry.command}`)
  }
})

/* ----------------------------------------------------------------- footer -- */

test('the footer exposes a trust column pointing at both published surfaces', () => {
  assert.match(footer, /aria-label="Trust and security footer links"/)
  assert.match(footer, /href: '\/security'/)
  assert.match(footer, /href: '\/security\/context-control-boundary'/)
})

test('the footer promises no policy document that does not exist', () => {
  const start = footer.indexOf('const trustLinks')
  const trustBlock = footer.slice(start, footer.indexOf('] as const', start))
  assert.doesNotMatch(trustBlock, /privacy|terms|dpa|sub-?processor|soc\s*2/i)
})

/* ------------------------------------------------------------ boundaries -- */

test('neither page claims a certification, attestation, or partnership', () => {
  const forbidden = /\b(SOC ?2|ISO ?27001|HIPAA compliant|GDPR compliant|certified|accredited)\b/i
  for (const [name, source] of [
    ['security page', securityPage],
    ['boundary page', boundaryPage],
  ] as const) {
    const hits = source.match(forbidden)
    assert.equal(hits, null, `${name} asserts an unheld status: ${hits?.[0]}`)
  }
  assert.match(securityPage, /holds no security certification/i)
})

test('both pages own the paper boundary used by the shared visual system', () => {
  for (const source of [securityPage, boundaryPage]) {
    assert.match(source, /evidence-page/)
  }
})
