'use client'
import { useSyncExternalStore, useState } from 'react'
import { atlasTopics } from '@/lib/unfinished-atlas'
import { Icon } from './Visuals'
import s from './atlas.module.css'
const KEY = 'unfinished-atlas:collection:v1'
const EVENT = 'unfinished-atlas:collection-changed'
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(EVENT, callback)
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(EVENT, callback) }
}
function snapshot() { try { return window.localStorage.getItem(KEY) || '[]' } catch { return '[]' } }
export function parseCollection(raw: string): string[] {
  try { const data: unknown = JSON.parse(raw); return Array.isArray(data) ? [...new Set(data.filter((value): value is string => typeof value === 'string' && atlasTopics.some(topic => topic.slug === value)))] : [] } catch { return [] }
}
export function useCollection() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => '[]')
  return parseCollection(raw)
}
export function SaveButton({ slug, expanded = false }: { slug: string; expanded?: boolean }) {
  const saved = useCollection().includes(slug)
  const [error, setError] = useState(false)
  function toggle() {
    try {
      const current = parseCollection(snapshot())
      window.localStorage.setItem(KEY, JSON.stringify(current.includes(slug) ? current.filter(id => id !== slug) : [...current, slug]))
      window.dispatchEvent(new Event(EVENT)); setError(false)
    } catch { setError(true) }
  }
  return <><button type="button" className={expanded ? s.secondary : s.save} aria-label={`${saved ? 'Unsave' : 'Save'} topic`} aria-pressed={saved} onClick={toggle}><Icon name="save" size={16} />{expanded && (saved ? 'Saved to collection' : 'Save to collection')}</button>{error && <span role="alert" className={s.toast}>Your browser could not save this topic.</span>}</>
}
