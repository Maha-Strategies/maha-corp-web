'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'

import { BIRTH_PLACES, birthPlaceKey, findBirthPlace } from '@/lib/birth-places'
import type { BirthReport, RenderedTraditionReport } from '@/lib/birth-report'
import type { PlaceSearchResult } from '@/lib/place-search'
import { groupTimeZones, timeZoneLabel } from '@/lib/time-zones'

import { computeBirthReport, type BirthActionState } from './actions'

const REASON_LABEL: Record<string, string> = {
  'chart-type-mismatch': 'Belongs to a different chart type',
  'report-policy': 'Withheld by report policy',
  'requires-derivation': 'Needs a derivation not implemented',
  'condition-unsatisfied': 'Conditions not met in this chart',
  'limb-uncertain': 'Too near a division edge to assert',
  'panchanga-unavailable': 'No pañcāṅga derivable',
}

const FIELD = 'border border-zinc-700 bg-black px-3 py-2 font-mono text-sm text-zinc-200 focus:border-violet-500 focus:outline-none'
const LABEL = 'font-mono text-[10px] uppercase tracking-widest text-zinc-500'

function Limb({ label, value, detail, uncertain }: { label: string; value: string; detail: string; uncertain: boolean }) {
  return (
    <div className={`border p-4 ${uncertain ? 'border-amber-600/60 bg-amber-950/10' : 'border-zinc-800 bg-zinc-950/60'}`}>
      <p className={LABEL}>{label}</p>
      <p className="mt-2 text-lg text-white">{value}</p>
      <p className="mt-1 font-mono text-[10px] text-zinc-600">{detail}</p>
      {uncertain && <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-amber-400">Near a boundary — not asserted</p>}
    </div>
  )
}

function TraditionSection({ tradition }: { tradition: RenderedTraditionReport }) {
  return (
    <section className="mt-10 border border-zinc-800 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-2xl font-semibold text-white">{tradition.traditionName}</h3>
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{tradition.modules.length} applied · {tradition.withheld.length} withheld</p>
      </div>

      {tradition.refusal && (
        <div className="mt-4 border border-amber-900/60 bg-amber-950/10 p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Refused at stage: {tradition.refusal.stage}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{tradition.refusal.message}</p>
          {tradition.refusal.issues.map((issue) => <p key={issue} className="mt-2 border-l border-amber-800/50 pl-3 text-xs leading-5 text-zinc-400">{issue}</p>)}
        </div>
      )}

      {tradition.modules.map((entry) => (
        <article key={entry.id} className="mt-5 border-l-2 border-violet-700/60 pl-5">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-widest">
            <span className="border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-300">Unvalidated tradition</span>
            <span className="text-zinc-600">{entry.heading}</span>
            {entry.observedLimbs.map((limb) => <span key={limb} className="border border-emerald-600/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">{limb}</span>)}
          </div>
          <p className="mt-3 font-serif text-lg leading-8 text-zinc-200">{entry.paragraph}</p>
          {entry.passages.map((passage) => (
            <figure key={passage.id} className="mt-3">
              <blockquote className="font-serif text-base leading-7 text-zinc-400">&ldquo;{passage.excerpt}&rdquo;</blockquote>
              <figcaption className="mt-1 text-xs leading-5 text-zinc-600">
                {passage.locator} · {passage.sourceTitle}{passage.translator ? `, tr. ${passage.translator}` : ''}, {passage.editionYear}
              </figcaption>
              {passage.transcriptionNote && <p className="mt-2 border-l border-cyan-800/60 pl-3 text-xs leading-5 text-zinc-500"><span className="text-cyan-400">Transcription note:</span> {passage.transcriptionNote}</p>}
            </figure>
          ))}
          {entry.disagreements.map((disagreement) => (
            <p key={disagreement} className="mt-3 border-l border-amber-800/50 pl-3 text-xs leading-5 text-zinc-400"><span className="text-amber-400">Disagreement:</span> {disagreement}</p>
          ))}
          <p className="mt-3 border-l border-rose-700/60 pl-3 text-xs leading-5 text-zinc-500"><span className="text-rose-400">Boundary:</span> {entry.boundary}</p>
        </article>
      ))}

      {tradition.withheld.length > 0 && (
        <details className="mt-6 border border-zinc-800 bg-zinc-950/40 p-4">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-zinc-400">Withheld rules ({tradition.withheld.length})</summary>
          <ul className="mt-4 space-y-2">
            {tradition.withheld.map((item) => (
              <li key={item.ruleId} className="text-sm leading-6 text-zinc-400">
                <span className="font-mono text-[9px] uppercase tracking-widest text-amber-400">{REASON_LABEL[item.reason] ?? item.reason}</span>
                <span className="ml-2 font-mono text-[10px] text-zinc-600">{item.ruleId}</span>
                <p className="mt-1 text-zinc-500">{item.detail}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function Report({ report }: { report: BirthReport }) {
  const p = report.panchanga
  return (
    <div id="birth-report-result" className="mt-10" tabIndex={-1}>
      <section className="border border-zinc-800 bg-zinc-950/60 p-5 font-mono text-[11px] leading-6 text-zinc-500">
        <p><span className="text-zinc-600">Resolved instant</span> <span className="text-zinc-200">{report.instantUtc}</span> (offset {report.utcOffset}) · {report.placeLabel}</p>
        <p><span className="text-zinc-600">Ayanāṁśa</span> <span className="text-zinc-200">{p.ayanamsa.name} {p.ayanamsa.degrees.toFixed(6)}°</span> · <span className="text-zinc-600">Fact bundle</span> <span className="text-zinc-200">{report.factBundleId}</span></p>
        {report.fold === 'earlier-offset' && <p className="text-amber-400">That local time occurs twice on this date; the earlier occurrence was used.</p>}
        {report.nonexistentLocalTime && <p className="text-amber-400">That local time does not exist on this date — the clocks moved forward over it. The instant shown is the reading after the transition.</p>}
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Limb label="Janma nakṣatra" value={p.nakshatra.name} detail={`${p.nakshatra.index}/27 · ${(p.nakshatra.fraction * 100).toFixed(1)}% elapsed`} uncertain={p.nakshatra.nearBoundary} />
        <Limb label="Tithi" value={p.tithi.name} detail={`${p.tithi.paksha} · ${p.tithi.absoluteIndex}/30`} uncertain={p.tithi.nearBoundary} />
        <Limb label="Yoga" value={p.yoga.name} detail={`${p.yoga.index}/27`} uncertain={p.yoga.nearBoundary} />
        <Limb label="Karaṇa" value={p.karana.name} detail={`${p.karana.index}/60`} uncertain={p.karana.nearBoundary} />
        <Limb label="Vāra" value={p.vara.name} detail="sunrise to sunrise" uncertain={false} />
      </section>

      {report.traditions.map((tradition) => <TraditionSection key={tradition.traditionId} tradition={tradition} />)}
    </div>
  )
}

export default function BirthForm() {
  const [state, formAction, pending] = useActionState<BirthActionState, FormData>(computeBirthReport, { status: 'idle' })
  const resultRef = useRef<HTMLDivElement>(null)

  // Held in state rather than left to defaultValue, so a rejected submission
  // never wipes what was typed. The previous version reset the whole form.
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [timeZone, setTimeZone] = useState('UTC')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [elevation, setElevation] = useState('')
  const [placeLabel, setPlaceLabel] = useState('')
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([])
  const [placeStatus, setPlaceStatus] = useState<'idle' | 'searching' | 'results' | 'error'>('idle')
  const [placeMessage, setPlaceMessage] = useState('')
  const placeRequestId = useRef(0)

  const zoneGroups = useMemo(() => groupTimeZones(), [])
  const coordinatesReady = Number.isFinite(Number(latitude)) && latitude !== '' && Number.isFinite(Number(longitude)) && longitude !== ''
  const canSubmit = date !== '' && time !== '' && coordinatesReady && timeZone !== ''

  useEffect(() => {
    if (state.status !== 'ok') return
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    document.getElementById('birth-report-result')?.focus({ preventScroll: true })
  }, [state.status])

  function selectPlace(place: Pick<PlaceSearchResult, 'label' | 'latitude' | 'longitude' | 'elevationMeters' | 'timeZone'>) {
    setPlaceQuery(place.label)
    setLatitude(String(place.latitude))
    setLongitude(String(place.longitude))
    setElevation(place.elevationMeters === null ? '' : String(place.elevationMeters))
    setTimeZone(place.timeZone)
    setPlaceLabel(place.label)
    setPlaceResults([])
    setPlaceStatus('idle')
    setPlaceMessage('')
  }

  function updatePlaceQuery(value: string) {
    setPlaceQuery(value)
    setPlaceResults([])
    setPlaceStatus('idle')
    setPlaceMessage('')
    const place = findBirthPlace(value)
    if (place) {
      selectPlace({
        label: birthPlaceKey(place),
        latitude: place.latitude,
        longitude: place.longitude,
        elevationMeters: null,
        timeZone: place.timeZone,
      })
      return
    }
    // Never submit coordinates belonging to a previously selected city after
    // the user has edited its visible label.
    if (value !== placeLabel) {
      setLatitude('')
      setLongitude('')
      setElevation('')
      setTimeZone('UTC')
      setPlaceLabel('')
    }
  }

  async function findPlace() {
    const query = placeQuery.trim()
    if (query.length < 2) {
      setPlaceStatus('error')
      setPlaceMessage('Enter at least two characters of a city or birthplace.')
      return
    }

    const requestId = ++placeRequestId.current
    setPlaceStatus('searching')
    setPlaceMessage('Searching…')
    setPlaceResults([])
    try {
      const response = await fetch('/api/geocoding/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const payload: unknown = await response.json()
      if (requestId !== placeRequestId.current) return
      if (!response.ok || typeof payload !== 'object' || payload === null || !('results' in payload) || !Array.isArray(payload.results)) {
        throw new Error('search-failed')
      }
      const results = payload.results as PlaceSearchResult[]
      setPlaceResults(results)
      setPlaceStatus(results.length ? 'results' : 'error')
      setPlaceMessage(results.length ? 'Choose the correct match.' : 'No matching place was found. Try adding a region or country.')
    } catch {
      if (requestId !== placeRequestId.current) return
      setPlaceStatus('error')
      setPlaceMessage('Place search is temporarily unavailable. You can retry or use manual location details.')
    }
  }

  return (
    <>
      <form action={formAction} className="mt-8 border border-zinc-800 bg-zinc-950/60 p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="birth-place" className={LABEL}>Birth place</label>
            <span className="flex flex-col gap-2 sm:flex-row">
              <input
                id="birth-place"
                value={placeQuery}
                onInput={(event) => updatePlaceQuery(event.currentTarget.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void findPlace() } }}
                placeholder="City, region, or country"
                autoComplete="off"
                aria-describedby="birth-place-help"
                className={`${FIELD} min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={() => void findPlace()}
                disabled={placeStatus === 'searching' || placeQuery.trim().length < 2}
                className="border border-violet-500 px-5 py-2 font-mono text-[10px] uppercase tracking-widest text-violet-300 hover:bg-violet-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                {placeStatus === 'searching' ? 'Searching…' : 'Find location'}
              </button>
            </span>
            <span id="birth-place-help" className="text-xs leading-5 text-zinc-600">Search sends only the place text to Open-Meteo&apos;s GeoNames-backed service. Your birth date and time are not sent.</span>
            <div aria-live="polite">
              {placeMessage && <p className={`text-xs leading-5 ${placeStatus === 'error' ? 'text-amber-300' : 'text-zinc-400'}`}>{placeMessage}</p>}
              {placeResults.length > 0 && (
                <div className="grid gap-2" role="listbox" aria-label="Matching birth places">
                  {placeResults.map((place) => (
                    <button
                      key={place.id}
                      type="button"
                      role="option"
                      aria-selected="false"
                      onClick={() => selectPlace(place)}
                      className="border border-zinc-800 bg-black px-3 py-3 text-left hover:border-violet-600 hover:bg-violet-950/20"
                    >
                      <span className="block text-sm text-zinc-200">{place.label}</span>
                      <span className="mt-1 block font-mono text-[10px] text-zinc-600">{place.timeZone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {placeLabel && coordinatesReady && <span className="border-l border-emerald-700/60 pl-3 font-mono text-[10px] leading-5 text-emerald-300">{placeLabel} · {latitude}, {longitude} · {timeZone}</span>}
          </div>

          <label className="flex flex-col gap-2">
            <span className={LABEL}>Birth date</span>
            <input required type="date" name="date" value={date} onInput={(event) => setDate(event.currentTarget.value)} autoComplete="bday" className={FIELD} />
          </label>

          <label className="flex flex-col gap-2">
            <span className={LABEL}>Birth time (local, 24h)</span>
            <input required type="time" name="time" value={time} onInput={(event) => setTime(event.currentTarget.value)} className={FIELD} />
          </label>
        </div>

        <details className="mt-5 border border-zinc-800 bg-black/30 p-4">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-zinc-400">Manual location details</summary>
          <p className="mt-3 max-w-3xl text-xs leading-5 text-zinc-600">Use these fields when the city is not in the local place list. The time zone must describe the birth place, not where you live now.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-2 lg:col-span-3">
              <span className={LABEL}>Time zone at birth place</span>
              <select required name="timeZone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} className={FIELD}>
                {zoneGroups.map((group) => <optgroup key={group.region} label={group.region}>{group.zones.map((zone) => <option key={zone} value={zone}>{timeZoneLabel(zone)}</option>)}</optgroup>)}
              </select>
              <button type="button" onClick={() => { const detected = Intl.DateTimeFormat().resolvedOptions().timeZone; if (detected) setTimeZone(detected) }} className="self-start font-mono text-[10px] uppercase tracking-widest text-violet-400 underline underline-offset-4 hover:text-violet-300">Use my current zone</button>
            </label>
            <label className="flex flex-col gap-2">
              <span className={LABEL}>Latitude</span>
              <input required type="number" step="any" min={-90} max={90} name="latitude" value={latitude} onInput={(event) => setLatitude(event.currentTarget.value)} className={FIELD} />
            </label>
            <label className="flex flex-col gap-2">
              <span className={LABEL}>Longitude</span>
              <input required type="number" step="any" min={-180} max={180} name="longitude" value={longitude} onInput={(event) => setLongitude(event.currentTarget.value)} className={FIELD} />
            </label>
            <label className="flex flex-col gap-2">
              <span className={LABEL}>Place label</span>
              <input type="text" name="placeLabel" value={placeLabel} onInput={(event) => setPlaceLabel(event.currentTarget.value)} placeholder="City, country" className={FIELD} />
            </label>
          </div>
        </details>

        <input type="hidden" name="elevation" value={elevation} />

        <div className="mt-5">
          <button type="submit" disabled={pending || !canSubmit} className="border border-violet-500 px-6 py-3 font-mono text-[10px] uppercase tracking-widest text-violet-300 hover:bg-violet-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-40">
            {pending ? 'Computing…' : 'Compute report'}
          </button>
          <p className="mt-3 font-mono text-[10px] leading-5 text-zinc-600">
            Global place search + {BIRTH_PLACES.length} instant shortcuts · {zoneGroups.reduce((total, group) => total + group.zones.length, 0)} historical time zones · submitted by POST and not stored.
          </p>
        </div>
      </form>

      {state.status === 'error' && (
        <div className="mt-6 border border-amber-900/60 bg-amber-950/10 p-4">
          <p className="text-sm leading-6 text-amber-200">{state.message}</p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Your entries are kept — correct the field and submit again.</p>
        </div>
      )}
      <div ref={resultRef} aria-live="polite">{state.status === 'ok' && <Report report={state.report} />}</div>
    </>
  )
}
