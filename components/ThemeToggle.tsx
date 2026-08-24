'use client'

import { useSyncExternalStore } from 'react'

export const COLOR_SCHEME_STORAGE_KEY = 'maha-color-scheme'
export const COLOR_SCHEME_EVENT = 'maha-color-scheme-change'

export type ColorScheme = 'light' | 'dark'

function currentColorScheme(): ColorScheme {
  return document.documentElement.dataset.colorScheme === 'dark' ? 'dark' : 'light'
}

function applyColorScheme(next: ColorScheme) {
  document.documentElement.dataset.colorScheme = next
  document.documentElement.style.colorScheme = next
  window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, next)
  window.dispatchEvent(new CustomEvent<ColorScheme>(COLOR_SCHEME_EVENT, { detail: next }))
}

function subscribeColorScheme(notify: () => void) {
  window.addEventListener(COLOR_SCHEME_EVENT, notify)
  return () => window.removeEventListener(COLOR_SCHEME_EVENT, notify)
}

function serverColorScheme(): ColorScheme {
  return 'light'
}

export default function ThemeToggle({ mobile = false }: { mobile?: boolean }) {
  const scheme = useSyncExternalStore(subscribeColorScheme, currentColorScheme, serverColorScheme)

  const next = scheme === 'light' ? 'dark' : 'light'

  return (
    <button
      type="button"
      className={mobile ? 'theme-toggle theme-toggle--mobile' : 'theme-toggle'}
      aria-label={`Switch to ${next} mode`}
      aria-pressed={scheme === 'dark'}
      onClick={() => applyColorScheme(next)}
    >
      <span aria-hidden="true" className="theme-toggle__glyph">{scheme === 'light' ? '◐' : '◑'}</span>
      <span>{next} mode</span>
    </button>
  )
}
