import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8')
const globals = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const toggle = readFileSync(new URL('../components/ThemeToggle.tsx', import.meta.url), 'utf8')
const boundary = readFileSync(new URL('../components/RouteThemeBoundary.tsx', import.meta.url), 'utf8')
const navbar = readFileSync(new URL('../components/Navbar.tsx', import.meta.url), 'utf8')
const footer = readFileSync(new URL('../components/SiteFooter.tsx', import.meta.url), 'utf8')

function rgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  assert.equal(normalized.length, 6)
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16)) as [number, number, number]
}

function luminance(hex: string): number {
  const values = rgb(hex).map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((left, right) => right - left)
  return (lighter + 0.05) / (darker + 0.05)
}

function token(block: string, name: string): string {
  const match = block.match(new RegExp(`${name}:\\s*(#[\\da-f]{6})`, 'i'))
  assert.ok(match, `missing ${name}`)
  return match[1]
}

test('the root chooses a color mode before paint and exposes the route boundary', () => {
  assert.match(layout, /data-color-scheme="light"/)
  assert.match(layout, /suppressHydrationWarning/)
  assert.match(layout, /localStorage\.getItem\('maha-color-scheme'\)/)
  assert.match(layout, /prefers-color-scheme: dark/)
  assert.match(layout, /<RouteThemeBoundary>/)
  assert.match(boundary, /data-site-surface=\{surface\}/)
  assert.match(boundary, /pathname === '\/audit' \? 'fixed-paper' : 'switchable'/)
})

test('the toggle persists only light or dark and stays accessible', () => {
  assert.match(toggle, /export type ColorScheme = 'light' \| 'dark'/)
  assert.match(toggle, /localStorage\.setItem\(COLOR_SCHEME_STORAGE_KEY, next\)/)
  assert.match(toggle, /aria-label=\{`Switch to \$\{next\} mode`\}/)
  assert.match(toggle, /aria-pressed=\{scheme === 'dark'\}/)
  assert.match(toggle, /maha-color-scheme-change/)
})

test('dark mode text tokens meet WCAG AA on both core surfaces', () => {
  const dark = globals.match(/:root\[data-color-scheme='dark'\]\s*\{([\s\S]*?)\n\}/)?.[1]
  assert.ok(dark)

  for (const text of ['--text-primary', '--text-secondary', '--text-muted']) {
    for (const surface of ['--surface-paper', '--surface-raised']) {
      assert.ok(
        contrast(token(dark, text), token(dark, surface)) >= 4.5,
        `${text} must remain readable on ${surface}`,
      )
    }
  }
})

test('light-mode semantic labels remain readable at small text sizes', () => {
  const light = globals.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1]
  assert.ok(light)
  for (const status of ['--status-verified', '--status-sourced', '--status-boundary', '--status-illustrative', '--status-unverified']) {
    assert.ok(contrast(token(light, status), token(light, '--surface-paper')) >= 4.5, `${status} fell below AA`)
  }
})

test('every visual family has an explicit dark-mode contract', () => {
  for (const scope of ['apps', 'books', 'docs', 'knowledge', 'intelligence']) {
    assert.match(globals, new RegExp(`data-visual-scope='${scope}'`))
  }
  assert.match(globals, /data-site-surface='operator'/)
  assert.match(globals, /data-site-surface='paper'/)
})

test('the global header and footer remain the fixed paper frame in either mode', () => {
  assert.match(navbar, /<nav data-theme="paper"/)
  assert.match(footer, /<footer data-theme="paper"/)
  assert.doesNotMatch(navbar, /siteThemeForPath|usePathname/)
  assert.doesNotMatch(footer, /siteThemeForPath|usePathname/)
  assert.match(globals, /--chrome-text:\s*#1a2420/)
  assert.doesNotMatch(globals, /data-color-scheme='dark'\]\s+\.site-chrome/)
})

test('the auditor remains a fixed paper instrument while other routes switch', () => {
  assert.match(globals, /data-color-mode='fixed-paper'/)
  assert.match(globals, /color-scheme:\s*light/)
})
