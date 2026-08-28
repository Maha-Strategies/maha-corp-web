import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'

import { getAllArchivedBriefSlugs, getArchivedBriefBySlug } from '../lib/briefs-data.ts'
import {
  INTELLIGENCE_SEMANTICS,
  knownStatuses,
  semanticForStatus,
} from '../app/intelligence/status-semantics.ts'

const subtree = new URL('../app/intelligence/', import.meta.url).pathname
const moduleCss = readFileSync(join(subtree, 'intelligence-cyber-light.module.css'), 'utf8')
const layout = readFileSync(join(subtree, 'layout.tsx'), 'utf8')

function subtreeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return subtreeFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

const sources = subtreeFiles(subtree).map((path) => ({
  file: relative(subtree, path),
  source: readFileSync(path, 'utf8'),
}))

/* ---------------------------------------------------------------- routes -- */

test('every intelligence route is covered by the cyber-light layout', () => {
  const slugs = getAllArchivedBriefSlugs()
  assert.ok(slugs.length >= 40, `expected the full brief corpus, saw ${slugs.length}`)

  // One landing page plus one page per brief slug, all under the single layout.
  const routes = ['/intelligence', ...slugs.map((slug) => `/intelligence/briefs/${slug}`)]
  assert.equal(new Set(routes).size, routes.length, 'duplicate intelligence route')

  const pages = sources.filter(({ file }) => file.endsWith('page.tsx')).map(({ file }) => file)
  assert.deepEqual(pages.sort(), ['briefs/[slug]/page.tsx', 'page.tsx'])
})

test('the subtree layout owns the cyber-light scope markers', () => {
  assert.match(layout, /data-visual-system="cyber-light"/)
  assert.match(layout, /data-visual-scope="intelligence"/)
  assert.match(layout, /intelligence-cyber-light\.module\.css/)
})

test('every intelligence component styles itself from the scoped module', () => {
  for (const { file, source } of sources) {
    if (file.endsWith('status-semantics.ts')) continue
    assert.match(
      source,
      /intelligence-cyber-light\.module\.css/,
      `${file} does not import the scoped stylesheet`,
    )
  }
})

/* ------------------------------------------------- no dark full surfaces -- */

test('no intelligence surface reintroduces a dark full-page ground', () => {
  // The subtree has no code, terminal, or machine-output block, so the
  // narrow dark-panel exemption does not apply to anything here.
  const darkGround = /min-h-screen|bg-\[#0[0-9a-f]{5}\]|bg-black|bg-neutral-9|bg-zinc-9|bg-gray-9|prose-invert/
  const offenders = sources
    .filter(({ source }) => darkGround.test(source))
    .map(({ file }) => file)
  assert.deepEqual(offenders, [], 'dark full-page surface found in /intelligence')
})

test('the scoped ground is a pale surface, not a dark one', () => {
  const surface = moduleCss.match(/--intel-surface:\s*(#[0-9a-f]{6})/i)?.[1]
  const raised = moduleCss.match(/--intel-raised:\s*(#[0-9a-f]{6})/i)?.[1]
  for (const value of [surface, raised]) {
    assert.ok(value, 'missing intelligence ground token')
    assert.ok(luminance(value!) > 0.7, `${value} is not a pale surface`)
  }
})

test('intelligence files carry no raw palette utilities or hex colours', () => {
  const raw =
    /\b(?:bg|text|border|ring|divide|from|to|via)-(?:white|black|zinc|slate|gray|neutral|stone|amber|indigo|emerald|green|red|rose|cyan|blue|purple|violet|teal|sky)(?:-\d{2,3})?\b|\[#[0-9a-fA-F]{3,8}\]/
  const offenders = sources
    .filter(({ file }) => file !== 'status-semantics.ts')
    .filter(({ source }) => raw.test(source))
    .map(({ file }) => file)
  assert.deepEqual(offenders, [])
})

/* ------------------------------------------------------------- semantics -- */

test('every brief status maps onto one of the five semantic states', () => {
  for (const status of knownStatuses()) {
    assert.ok(
      INTELLIGENCE_SEMANTICS.includes(semanticForStatus(status)),
      `${status} produced a non-semantic state`,
    )
  }
  // Unknown statuses must be a caution, never a claim of verification.
  assert.equal(semanticForStatus('a status nobody defined'), 'boundary')
})

test('every status in the live brief corpus is explicitly classified', () => {
  // Guards the real data, not just the table: an unmapped status would fall
  // back to `boundary` and quietly mis-label a brief (this caught
  // "CRITICAL PRIORITY", which only appears in the corpus).
  const declared = new Set(knownStatuses().map((status) => status.toUpperCase()))
  const unmapped = getAllArchivedBriefSlugs()
    .map((slug) => getArchivedBriefBySlug(slug)!.status)
    .filter((status) => !declared.has(status.trim().toUpperCase()))
  assert.deepEqual([...new Set(unmapped)], [], 'brief statuses missing an explicit semantic')
})

test('the five semantic states each have a chip and an indicator', () => {
  for (const semantic of INTELLIGENCE_SEMANTICS) {
    const suffix = semantic[0].toUpperCase() + semantic.slice(1)
    assert.match(moduleCss, new RegExp(`\\.chip${suffix}\\b`), `missing chip for ${semantic}`)
    assert.match(moduleCss, new RegExp(`\\.indicator${suffix}\\b`), `missing dot for ${semantic}`)
    assert.match(moduleCss, new RegExp(`--intel-${semantic}:`), `missing token for ${semantic}`)
  }
})

/* -------------------------------------------------------------- contrast -- */

function luminance(hex: string): number {
  const channels = hex.replace('#', '').match(/[a-f\d]{2}/gi)!.map((v) => Number.parseInt(v, 16) / 255)
  return channels
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
}

function contrast(foreground: string, background: string): number {
  const hi = Math.max(luminance(foreground), luminance(background))
  const lo = Math.min(luminance(foreground), luminance(background))
  return (hi + 0.05) / (lo + 0.05)
}

/** Composite an `rgb(r g b / a%)` tint over an opaque background. */
function composite(tint: string, background: string): string {
  const [r, g, b, a] = tint.match(/[\d.]+/g)!.map(Number)
  const base = background.replace('#', '').match(/[a-f\d]{2}/gi)!.map((v) => Number.parseInt(v, 16))
  const alpha = a / 100
  return (
    '#' +
    [r, g, b]
      .map((channel, i) => Math.round(channel * alpha + base[i] * (1 - alpha)))
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')
  )
}

function token(name: string): string {
  const value = moduleCss.match(new RegExp(`--intel-${name}:\\s*([^;]+);`))?.[1].trim()
  assert.ok(value, `missing --intel-${name}`)
  return value!
}

test('body text tiers stay readable on the intelligence ground', () => {
  const surface = token('surface')
  const raised = token('raised')
  for (const [name, color] of [
    ['primary', '#1a2420'],
    ['secondary', '#3a453f'],
    ['muted', '#5a6660'],
  ] as const) {
    assert.ok(contrast(color, surface) >= 4.5, `${name} text failed on the surface`)
    assert.ok(contrast(color, raised) >= 4.5, `${name} text failed on a raised panel`)
  }
})

test('each pale semantic panel carries a readable dark foreground', () => {
  const raised = token('raised')
  for (const semantic of INTELLIGENCE_SEMANTICS) {
    const foreground = token(semantic)
    const tinted = composite(token(`${semantic}-tint`), raised)
    const ratio = contrast(foreground, tinted)
    assert.ok(
      ratio >= 4.5,
      `${semantic} label is ${ratio.toFixed(2)}:1 on its own tint, below WCAG AA`,
    )
    // Body copy inside a semantic panel stays ordinary dark text, not the status hue.
    assert.ok(contrast('#3a453f', tinted) >= 4.5, `${semantic} panel copy is unreadable`)
  }
})

test('the shared scoped stylesheet cannot leak outside its owning subtree', () => {
  // Global class adapters are allowed only when explicitly anchored below the
  // CSS-module root emitted by one of the participating nested layouts.
  const unscopedGlobals = moduleCss
    .split('\n')
    .filter((line) => line.includes(':global') && !line.trimStart().startsWith('.root :global'))
  assert.deepEqual(unscopedGlobals, [], 'a global adapter escapes the cyber-light root')
  assert.doesNotMatch(moduleCss, /^\s*(html|body)\b/m, 'module styles a document-level element')
})

test('interactive affordances keep a visible focus ring', () => {
  assert.match(moduleCss, /:focus-visible\s*\{[^}]*outline:/)
  assert.doesNotMatch(moduleCss, /outline:\s*none/)
})

test('motion is bounded and disabled under prefers-reduced-motion', () => {
  assert.match(moduleCss, /@media \(prefers-reduced-motion: reduce\)/)
  for (const duration of moduleCss.match(/\d+ms/g) ?? []) {
    assert.ok(Number.parseInt(duration, 10) <= 150, `${duration} exceeds the 150ms ceiling`)
  }
})
