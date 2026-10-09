'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { BIRTH_PLACES, birthPlaceKey, findBirthPlace } from '@/lib/birth-places'
import type { PlaceSearchResult } from '@/lib/place-search'
import s from './astrology.module.css'

export default function BirthplaceFields({ timeZones }: { timeZones: string[] }) {
  const id = useId()
  const [query, setQuery] = useState('Colombo, Sri Lanka')
  const [label, setLabel] = useState('Colombo, Sri Lanka')
  const [latitude, setLatitude] = useState('6.9271')
  const [longitude, setLongitude] = useState('79.8612')
  const [zone, setZone] = useState('Asia/Colombo')
  const [results, setResults] = useState<PlaceSearchResult[]>([])
  const [status, setStatus] = useState<'idle' | 'searching' | 'results' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const generation = useRef(0)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => { controller.current?.abort() }, [])

  function cancelSearch() {
    generation.current += 1
    controller.current?.abort()
    setResults([])
    setStatus('idle')
    setMessage('')
  }
  function selectPlace(place: Pick<PlaceSearchResult, 'label' | 'latitude' | 'longitude' | 'timeZone'>, queryText = place.label) {
    cancelSearch()
    setQuery(queryText); setLabel(place.label)
    setLatitude(String(place.latitude)); setLongitude(String(place.longitude)); setZone(place.timeZone)
    setMessage(`Selected ${place.label}. Coordinates and time zone filled in.`)
  }
  function editQuery(value: string) {
    cancelSearch()
    setQuery(value)
    const local = findBirthPlace(value)
    if (local) {
      selectPlace({ label: birthPlaceKey(local), latitude: local.latitude, longitude: local.longitude, timeZone: local.timeZone }, value)
    } else {
      // Editing the city must not retain coordinates belonging to the old city.
      setLabel(''); setLatitude(''); setLongitude(''); setZone('')
    }
  }
  async function search() {
    cancelSearch()
    if (query.trim().length < 2) { setStatus('error'); setMessage('Enter at least two characters of a city or birthplace.'); return }
    const requestId = generation.current
    const abort = new AbortController()
    controller.current = abort
    setStatus('searching'); setMessage('Searching worldwide…')
    try {
      const response = await fetch('/api/geocoding/places', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }), signal: abort.signal,
      })
      const payload = await response.json()
      if (requestId !== generation.current) return
      if (!response.ok || !Array.isArray(payload.results)) throw new Error('search_failed')
      const found: PlaceSearchResult[] = payload.results
      setResults(found); setStatus(found.length ? 'results' : 'error')
      setMessage(found.length ? 'Choose the correct region and country below.' : 'No matching place found. Try the city name, or enter coordinates and a time zone manually.')
    } catch {
      if (requestId !== generation.current) return
      setStatus('error'); setMessage('Place search is temporarily unavailable. Use an instant city shortcut or enter coordinates and a time zone manually.')
    }
  }
  function manualEdit() {
    cancelSearch(); setLabel(''); setMessage('Using manually entered coordinates and time zone.')
  }
  return <div className={s.birthplace}>
    <label htmlFor={`${id}-query`}>Birthplace</label>
    <div className={s.placeSearch}>
      <input id={`${id}-query`} value={query} onChange={e => editQuery(e.target.value)} list={`${id}-cities`} placeholder="City, region or country" maxLength={120} autoComplete="off" aria-describedby={`${id}-help`} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void search() } }} />
      <button type="button" onClick={() => void search()} disabled={status === 'searching'}>{status === 'searching' ? 'Searching…' : 'Find'}</button>
    </div>
    <datalist id={`${id}-cities`}>{BIRTH_PLACES.map(place => <option key={birthPlaceKey(place)} value={birthPlaceKey(place)} />)}</datalist>
    <p id={`${id}-help`} className={s.placeHelp}>Choose an instant city shortcut or search worldwide. Find sends only the place text to Open-Meteo / GeoNames.</p>
    <p role="status" className={status === 'error' ? s.placeError : s.placeStatus}>{message}</p>
    {results.length > 0 && <ul className={s.placeResults} aria-label="Matching birthplaces">{results.map(place => <li key={place.id}><button type="button" onClick={() => selectPlace(place)}><strong>{place.label}</strong><small>{place.latitude.toFixed(4)}°, {place.longitude.toFixed(4)}° · {place.timeZone}</small></button></li>)}</ul>}
    <input type="hidden" name="placeLabel" value={label} />
    <div className={s.fieldPair}><label>Latitude<input name="latitude" type="number" value={latitude} onChange={e => { manualEdit(); setLatitude(e.target.value) }} step="any" min="-90" max="90" required /></label><label>Longitude<input name="longitude" type="number" value={longitude} onChange={e => { manualEdit(); setLongitude(e.target.value) }} step="any" min="-180" max="180" required /></label></div>
    <label htmlFor={`${id}-zone`}>Birth time zone<input id={`${id}-zone`} name="timeZone" value={zone} onChange={e => { manualEdit(); setZone(e.target.value) }} list={`${id}-zones`} required maxLength={100} spellCheck={false} autoComplete="off" aria-describedby={`${id}-zone-help`} /></label>
    <small id={`${id}-zone-help`}>Select an IANA time zone. Historical offsets and daylight saving use the birth date.</small>
    <datalist id={`${id}-zones`}>{timeZones.map(value => <option key={value} value={value} />)}</datalist>
    <p className={s.placeHelp}>City coordinates represent the settlement, not an exact hospital or address. You can adjust them above.</p>
    <a className={s.attribution} href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noreferrer">Location data: Open-Meteo / GeoNames ↗</a>
  </div>
}
