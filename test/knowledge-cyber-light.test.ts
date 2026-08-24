import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const layout = readFileSync(new URL('../app/knowledge/layout.tsx', import.meta.url), 'utf8')
const stylesheet = readFileSync(
  new URL('../app/knowledge/knowledge-cyber-light.module.css', import.meta.url),
  'utf8',
)
const intelligenceStylesheet = readFileSync(
  new URL('../app/intelligence/intelligence-cyber-light.module.css', import.meta.url),
  'utf8',
)
const knowledgeIndex = readFileSync(new URL('../app/knowledge/page.tsx', import.meta.url), 'utf8')

function pageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return pageFiles(path)
    return entry.name === 'page.tsx' ? [path] : []
  })
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.name.endsWith('.tsx') ? [path] : []
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

test('all Knowledge pages inherit one bounded cyber-light layout', () => {
  const routes = pageFiles(new URL('../app/knowledge', import.meta.url).pathname)
  assert.equal(routes.length, 44)
  assert.match(layout, /data-visual-system="cyber-light"/)
  assert.match(layout, /data-visual-scope="knowledge"/)
  assert.match(layout, /knowledge-cyber-light\.module\.css/)
})

test('Knowledge copy and semantic labels meet readable contrast on light surfaces', () => {
  const paper = '#e9edf3'
  const surfaces = new Map([
    ['ink', '#13211c'],
    ['copy', '#34463f'],
    ['muted', '#4d6158'],
    ['cyan', '#0b6675'],
    ['blue', '#235fa4'],
    ['green', '#176b4d'],
    ['violet', '#6746a8'],
    ['amber', '#865600'],
    ['red', '#9b3b34'],
  ])

  for (const [name, color] of surfaces) {
    assert.ok(contrast(color, paper) >= 4.5, `${name} fell below WCAG AA contrast`)
    assert.match(stylesheet, new RegExp(`--knowledge-cyber-${name}: ${color};`))
  }
})

test('Knowledge keeps dark surfaces bounded to machine-readable panels', () => {
  const legacyDarkTokens = sourceFiles(new URL('../app/knowledge', import.meta.url).pathname)
    .flatMap((path) => readFileSync(path, 'utf8').match(/bg-(?:black(?:\/\d+)?|\[#0[\da-f]{5}\])/gi) ?? [])

  assert.ok(legacyDarkTokens.length > 0, 'expected the guard to exercise legacy dark utilities')
  assert.match(stylesheet, /\[class\^='bg-\[#0'/)
  assert.match(stylesheet, /\[class\^='bg-black'/)
  assert.match(stylesheet, /:global\(pre\)/)
  assert.match(stylesheet, /\.knowledge-machine-panel/)
  assert.match(stylesheet, /color: #edf8f4 !important;/)
  assert.match(stylesheet, /background: #13211c !important;/)
  assert.ok(
    stylesheet.indexOf(":global([class^='bg-black'])") < stylesheet.indexOf(':global(.knowledge-machine-panel)'),
    'intentional machine panels must override the legacy dark-background remap',
  )
  assert.doesNotMatch(layout, /intelligence|operator|admin/)
})

test('Knowledge retains its cyber grid and respects reduced motion', () => {
  assert.match(stylesheet, /40px 40px, 40px 40px;/)
  assert.match(stylesheet, /28px 28px, 28px 28px;/)
  assert.match(stylesheet, /\.root::after/)
  assert.match(stylesheet, /\.spectrumRule/)
  assert.match(stylesheet, /\.domainGrid > a::before/)
  assert.match(stylesheet, /@media \(prefers-reduced-motion: reduce\)/)
})

test('Knowledge index shares Intelligence geometry and adds a bounded spectrum', () => {
  for (const contract of [
    /max-width: 80rem;/,
    /40px 40px/,
    /box-shadow: 4px 4px 0/,
    /transform: translate\(-1px, -1px\)/,
  ]) {
    assert.match(intelligenceStylesheet, contract)
    assert.match(stylesheet, contract)
  }
  assert.match(knowledgeIndex, /styles\.indexTitle/)
  assert.match(knowledgeIndex, /styles\.domainGrid/)
  assert.match(knowledgeIndex, /styles\.spectrumRule/)
  assert.match(stylesheet, /var\(--knowledge-cyber-cyan\)[\s\S]*var\(--knowledge-cyber-green\)/)
})
