import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'

const globals = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

function pageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return pageFiles(path)
    return entry.name === 'page.tsx' ? [path] : []
  })
}

function luminance(hex: string): number {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255)
  assert.equal(channels?.length, 3)
  return channels!.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
}

function contrast(foreground: string, background: string): number {
  const light = Math.max(luminance(foreground), luminance(background))
  const dark = Math.min(luminance(foreground), luminance(background))
  return (light + 0.05) / (dark + 0.05)
}

test('paper text tiers remain readable against the shared paper surface', () => {
  const paper = '#eef1ec'
  for (const [name, color] of [
    ['primary', '#1a2420'],
    ['secondary', '#3a453f'],
    ['muted', '#5a6660'],
  ] as const) {
    assert.ok(contrast(color, paper) >= 4.5, `${name} text fell below WCAG AA contrast`)
  }
})

test('the five semantic surfaces use readable copy and restrained status tints', () => {
  for (const status of ['verified', 'sourced', 'boundary', 'illustrative', 'unverified']) {
    assert.match(globals, new RegExp(`--surface-${status}:`))
    assert.match(globals, new RegExp(`\\.evidence-status-surface--${status}`))
  }
  assert.match(globals, /\.evidence-status-surface\s*\{[\s\S]*?color: var\(--text-primary\);/)
  assert.match(globals, /\.evidence-status-label\s*\{[\s\S]*?color: var\(--evidence-status-color\);/)
})

test('paper-theme pages cannot silently retain pale dark-theme text utilities', () => {
  const appRoot = new URL('../app', import.meta.url).pathname
  const excludedFamilies = /^(admin|dashboard|operations|knowledge|intelligence)\//
  const proseOverride = 'policy/nutrient-density-standard/paying-for-nutrition/page.tsx'
  const paleText = /text-(?:white|zinc-(?:200|300|400)|slate-(?:200|300|400)|gray-(?:100|200|300|400)|amber-(?:50|100|200))/
  const offenders: string[] = []

  for (const path of pageFiles(appRoot)) {
    const routeFile = relative(appRoot, path)
    if (excludedFamilies.test(routeFile)) continue
    const source = readFileSync(path, 'utf8')
    if (!paleText.test(source)) continue
    if (routeFile === proseOverride && source.includes('className="evidence-prose max-w-none"')) continue
    offenders.push(routeFile)
  }

  assert.deepEqual(offenders, [])
})

test('known converted surfaces use the shared readable vocabulary', () => {
  const engine = readFileSync(new URL('../app/apps/the-engine/page.tsx', import.meta.url), 'utf8')
  const citation = readFileSync(new URL('../components/CopyCitation.tsx', import.meta.url), 'utf8')
  assert.match(engine, /evidence-status-surface--illustrative/)
  assert.doesNotMatch(engine, /text-amber-50/)
  assert.match(citation, /evidence-action evidence-action--secondary/)
})
