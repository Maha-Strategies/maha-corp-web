'use client'

import { useActionState, useEffect, useState } from 'react'

import type { CorporateReport, EventTimeConfidence } from '@/lib/corporate-report'
import type { NatalChartPoint } from '@/lib/natal-chart'
import type { PlaceSearchResult } from '@/lib/place-search'
import { groupTimeZones, timeZoneLabel } from '@/lib/time-zones'

import { computeCorporateReport, type CorporateActionState } from './actions'

const FIELD = 'w-full border border-zinc-700 bg-black px-3 py-2 font-mono text-sm text-zinc-200 focus:border-violet-500 focus:outline-none'
const LABEL = 'font-mono text-[10px] uppercase tracking-widest text-zinc-500'
const TIME_ZONE_GROUPS = groupTimeZones()

const CONFIDENCE_DEFAULTS: Record<EventTimeConfidence, number> = {
  'recorded-instant': 0,
  'recorded-minute': 1,
  'recorded-hour': 30,
  'official-date-only': 720,
  estimated: 60,
}

function zodiacDegree(point: NatalChartPoint): string {
  const degrees = Math.floor(point.sidereal.degreeInSign)
  const minutes = Math.floor((point.sidereal.degreeInSign - degrees) * 60)
  return `${point.sidereal.sign} ${degrees}°${String(minutes).padStart(2, '0')}′`
}

function Report({ report }: { report: CorporateReport }) {
  const chartPoints = [report.formationChart.ascendant, ...report.formationChart.placements]
  const focus = new Set(report.organizationFramework.eventFocusHouses)

  return (
    <div className="mt-10" aria-live="polite">
      <section className="border border-violet-700/50 bg-violet-950/10 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={LABEL}>Organization event record</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{report.organizationName}</h2>
            <p className="mt-2 text-sm text-violet-200">{report.formationEvent.label} · {report.eventLocation.label}</p>
          </div>
          <span className="border border-violet-500/50 px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-violet-300">{report.subjectType}</span>
        </div>

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className={LABEL}>Representative instant</dt><dd className="mt-1 text-white">{report.formationEvent.representativeInstantUtc}</dd></div>
          <div><dt className={LABEL}>Event-time confidence</dt><dd className="mt-1 text-white">{report.formationEvent.confidence} · ±{report.formationEvent.uncertaintyMinutes} min</dd></div>
          <div><dt className={LABEL}>Jurisdiction</dt><dd className="mt-1 text-white">{report.jurisdiction.countryCode}{report.jurisdiction.region ? ` · ${report.jurisdiction.region}` : ''}</dd></div>
          <div><dt className={LABEL}>Registration authority</dt><dd className="mt-1 text-white">{report.jurisdiction.registrationAuthority}</dd></div>
          <div><dt className={LABEL}>Location policy</dt><dd className="mt-1 text-white">{report.eventLocation.basis} · {report.eventLocation.policyStatus}</dd></div>
          <div><dt className={LABEL}>Evidence</dt><dd className="mt-1 text-white">{report.formationEvent.evidence.kind}</dd></div>
        </dl>
        <p className="mt-5 border-l border-zinc-700 pl-4 text-xs leading-6 text-zinc-400">{report.formationEvent.evidence.reference}</p>
        {report.formationEvent.evidence.attachment && (
          <p className="mt-3 break-all font-mono text-[10px] text-zinc-500">Attachment fingerprint: {report.formationEvent.evidence.attachment.filename} · {report.formationEvent.evidence.attachment.byteLength} bytes · {report.formationEvent.evidence.attachment.sha256}</p>
        )}
      </section>

      <section className={`mt-6 border p-6 ${report.timeSensitivity.organizationHouseApplicationsAllowed ? 'border-emerald-800/60 bg-emerald-950/10' : 'border-amber-700/60 bg-amber-950/10'}`}>
        <p className={LABEL}>Time-sensitivity audit</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{report.timeSensitivity.status.replaceAll('-', ' ')}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">{report.timeSensitivity.explanation}</p>
        <p className="mt-3 font-mono text-[10px] text-zinc-500">Window {report.formationEvent.possibleStartUtc} → {report.formationEvent.possibleEndUtc}</p>
        {report.timeSensitivity.panchangaLimbsChanged.length > 0 && <p className="mt-2 text-xs text-amber-300">Changed calendrical limbs: {report.timeSensitivity.panchangaLimbsChanged.join(', ')}</p>}
      </section>

      <section className="mt-6 border border-zinc-800 bg-zinc-950/60 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-2xl font-semibold text-white">Formation chart</h2>
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Lahiri sidereal · whole-sign · mean node</p>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">This table is the calculated geometry at the representative instant. It is not a business forecast.</p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead className="border-b border-zinc-700 font-mono text-[9px] uppercase tracking-widest text-zinc-500"><tr><th className="px-3 py-3">Point</th><th className="px-3 py-3">Sidereal position</th><th className="px-3 py-3">House</th><th className="px-3 py-3">Nakṣatra</th><th className="px-3 py-3">Motion</th></tr></thead>
            <tbody className="divide-y divide-zinc-900">
              {chartPoints.map((point) => <tr key={point.name} className="text-sm text-zinc-300"><th className="px-3 py-3 font-medium text-white">{point.name}</th><td className="px-3 py-3 font-mono text-xs text-violet-200">{zodiacDegree(point)}</td><td className="px-3 py-3">{point.wholeSignHouse}</td><td className="px-3 py-3">{point.nakshatra.name} · pāda {point.nakshatra.pada}</td><td className="px-3 py-3 text-xs text-zinc-500">{point.motion}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 border border-cyan-900/60 bg-cyan-950/10 p-6">
        <p className={LABEL}>Named Jyotiṣa convention · Maha synthesis</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Organization house framework</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">Version {report.organizationFramework.version}. Houses {report.organizationFramework.eventFocusHouses.join(', ')} are declared as the focus for this event type. This mapping is unvalidated and requires practitioner review.</p>
        {report.organizationFramework.houses.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {report.organizationFramework.houses.map((house) => (
              <article key={house.house} className={`border p-4 ${focus.has(house.house) ? 'border-cyan-600/60 bg-cyan-950/20' : 'border-zinc-800 bg-black/20'}`}>
                <p className={LABEL}>House {house.house}{focus.has(house.house) ? ' · event focus' : ''}</p>
                <p className="mt-2 text-sm text-white">{house.domain}</p>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{house.sign} · ruler {house.ruler} in house {house.rulerHouse} · occupants {house.occupants.join(', ') || 'none'}</p>
              </article>
            ))}
          </div>
        ) : <p className="mt-5 border border-amber-800/50 bg-black/20 p-4 text-sm leading-6 text-amber-200">House applications are withheld because the declared event-time window does not preserve stable geometry.</p>}
        <details className="mt-5 border-t border-cyan-900/50 pt-4">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-cyan-300">Declared organization significators</summary>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">{report.organizationFramework.significators.map((item) => <li key={item.point} className="border-l border-cyan-900/60 pl-3 text-xs leading-5 text-zinc-400"><strong className="text-zinc-200">{item.point}</strong> — {item.organizationalDomain}</li>)}</ul>
        </details>
        <p className="mt-5 border-l border-rose-800/60 pl-4 text-xs leading-6 text-zinc-500">{report.organizationFramework.boundary}</p>
      </section>

      <section className="mt-6 border border-amber-900/60 bg-amber-950/10 p-6">
        <p className={LABEL}>Source-bound interpretation</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{report.interpretation.status === 'withheld' ? 'Withheld by the compiler' : 'Compiled under the named tradition'}</h2>
        {report.interpretation.refusal ? <><p className="mt-3 text-sm leading-6 text-zinc-300">{report.interpretation.refusal.message}</p><ul className="mt-3 space-y-2">{report.interpretation.refusal.issues.map((issue) => <li key={issue} className="border-l border-amber-800/60 pl-3 text-xs leading-5 text-zinc-500">{issue}</li>)}</ul></> : report.interpretation.modules.map((module) => <article key={module.ruleId} className="mt-4 border border-zinc-800 p-4"><h3 className="text-white">{module.heading}</h3><p className="mt-2 text-sm leading-6 text-zinc-300">{module.paragraph}</p><p className="mt-3 text-xs leading-5 text-rose-300">{module.boundary}</p></article>)}
      </section>

      <section className="mt-6 border-l-2 border-rose-500 bg-rose-950/10 p-6">
        <h2 className="text-2xl font-semibold text-white">What this report refuses to infer</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">No valuation estimate, investment return, or guarantee of revenue, growth, survival, financing, or legal validity is produced.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">{report.refusals.map((item) => <li key={item} className="border-l border-rose-900/60 pl-3 text-sm leading-6 text-zinc-400">{item}</li>)}</ul>
      </section>

      <section className="mt-6 border-t border-zinc-800 pt-6 font-mono text-[10px] text-zinc-600">
        <p>Report {report.reportId}</p><p className="mt-1 break-all">Input {report.inputSha256}</p><p className="mt-1">Fact bundle {report.factBundleId}</p>
      </section>
    </div>
  )
}

export default function CorporateForm() {
  const [state, formAction, pending] = useActionState<CorporateActionState, FormData>(computeCorporateReport, { status: 'idle' })
  const [placeQuery, setPlaceQuery] = useState('')
  const [places, setPlaces] = useState<PlaceSearchResult[]>([])
  const [placeError, setPlaceError] = useState('')
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(null)
  const [confidence, setConfidence] = useState<EventTimeConfidence>('recorded-minute')
  const [uncertainty, setUncertainty] = useState(1)
  const [eventTime, setEventTime] = useState('')

  useEffect(() => {
    if (placeQuery.trim().length < 2 || selectedPlace?.label === placeQuery) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/geocoding/places', { method: 'POST', body: JSON.stringify({ query: placeQuery }), headers: { 'Content-Type': 'application/json' }, signal: controller.signal })
        const payload = await response.json() as { results?: PlaceSearchResult[]; error?: string }
        if (!response.ok) throw new Error(payload.error || 'Place search failed.')
        setPlaces(payload.results ?? []); setPlaceError(payload.results?.length ? '' : 'No matching place found. Try the town and region.')
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setPlaceError((error as Error).message)
      }
    }, 300)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [placeQuery, selectedPlace])

  function selectPlace(place: PlaceSearchResult) {
    setSelectedPlace(place); setPlaceQuery(place.label); setPlaces([]); setPlaceError('')
  }

  function changeConfidence(next: EventTimeConfidence) {
    setConfidence(next); setUncertainty(CONFIDENCE_DEFAULTS[next])
    if (next === 'official-date-only') setEventTime('12:00')
  }

  return (
    <>
      <form action={formAction} className="mt-8 space-y-6 border border-zinc-800 bg-zinc-950/60 p-6 sm:p-8">
        <section>
          <h2 className="text-xl font-semibold text-white">Formation event</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label><span className={LABEL}>Organization name</span><input required name="organizationName" className={`${FIELD} mt-2`} /></label>
            <label><span className={LABEL}>Formation event type</span><select required name="eventType" className={`${FIELD} mt-2`} defaultValue="filing-accepted"><option value="filing-submitted">Filing submitted</option><option value="filing-accepted">Filing accepted</option><option value="certificate-issued">Certificate issued</option><option value="first-commercial-transaction">First commercial transaction</option><option value="first-deployment">First deployment</option><option value="public-launch">Public launch</option><option value="merger-effective">Merger effective</option><option value="acquisition-close">Acquisition close</option><option value="other">Other documented event</option></select></label>
            <label><span className={LABEL}>Event date (local)</span><input required type="date" name="date" className={`${FIELD} mt-2`} /></label>
            <label><span className={LABEL}>Representative time (local, 24h)</span><input required type="time" name="time" value={eventTime} onChange={(event) => setEventTime(event.target.value)} readOnly={confidence === 'official-date-only'} className={`${FIELD} mt-2`} /><span className="mt-1 block text-[10px] leading-4 text-zinc-600">Date-only records use 12:00 with a ±12-hour window.</span></label>
            <label><span className={LABEL}>Event-time confidence</span><select name="timeConfidence" value={confidence} onChange={(event) => changeConfidence(event.target.value as EventTimeConfidence)} className={`${FIELD} mt-2`}><option value="recorded-instant">Recorded exact instant</option><option value="recorded-minute">Recorded to minute</option><option value="recorded-hour">Recorded within hour</option><option value="official-date-only">Official date only</option><option value="estimated">Estimated time</option></select></label>
            <label><span className={LABEL}>Uncertainty (± minutes)</span><input required type="number" min="0" max="43200" name="uncertaintyMinutes" value={uncertainty} onChange={(event) => setUncertainty(Number(event.target.value))} readOnly={confidence === 'recorded-instant'} className={`${FIELD} mt-2`} /></label>
          </div>
        </section>

        <section className="border-t border-zinc-800 pt-6">
          <h2 className="text-xl font-semibold text-white">Event location</h2>
          <p className="mt-2 text-xs leading-5 text-zinc-500">Search a city or town. Selecting it fills coordinates and the historical time-zone identifier.</p>
          <div className="relative mt-4">
            <label><span className={LABEL}>Find a place</span><input required autoComplete="off" value={placeQuery} onChange={(event) => { setPlaceQuery(event.target.value); setSelectedPlace(null); setPlaces([]); setPlaceError('') }} className={`${FIELD} mt-2`} placeholder="Colombo, Sri Lanka" /></label>
            {places.length > 0 && <ul className="absolute z-20 mt-1 w-full border border-zinc-700 bg-zinc-950 shadow-2xl">{places.map((place) => <li key={place.id}><button type="button" onClick={() => selectPlace(place)} className="w-full px-4 py-3 text-left text-sm text-zinc-200 hover:bg-violet-950 hover:text-white">{place.label}</button></li>)}</ul>}
            {placeError && <p className="mt-2 text-xs text-amber-300">{placeError}</p>}
          </div>
          <input type="hidden" name="placeLabel" value={selectedPlace?.label ?? ''} /><input type="hidden" name="latitude" value={selectedPlace?.latitude ?? ''} /><input type="hidden" name="longitude" value={selectedPlace?.longitude ?? ''} /><input type="hidden" name="elevation" value={selectedPlace?.elevationMeters ?? ''} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label><span className={LABEL}>Time zone</span><select required name="timeZone" value={selectedPlace?.timeZone ?? ''} onChange={() => undefined} className={`${FIELD} mt-2`}><option value="">Select a place first</option>{TIME_ZONE_GROUPS.map((group) => <optgroup key={group.region} label={group.region}>{group.zones.map((zone) => <option key={zone} value={zone}>{timeZoneLabel(zone)}</option>)}</optgroup>)}</select></label>
            <label><span className={LABEL}>Location basis</span><select name="locationBasis" className={`${FIELD} mt-2`} defaultValue="authority-location"><option value="authority-location">Registration authority location</option><option value="registered-office">Registered office</option><option value="operational-location">Operational location</option><option value="transaction-location">Transaction location</option><option value="deployment-region">Deployment region</option><option value="merger-closing-location">Merger closing location</option></select></label>
          </div>
          <label className="mt-4 block"><span className={LABEL}>Location rationale (required for a nonstandard basis)</span><textarea name="locationRationale" maxLength={500} className={`${FIELD} mt-2 min-h-20`} /></label>
        </section>

        <section className="border-t border-zinc-800 pt-6">
          <h2 className="text-xl font-semibold text-white">Jurisdiction</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label><span className={LABEL}>Country code (ISO 2-letter)</span><input required name="jurisdictionCountryCode" maxLength={2} className={`${FIELD} mt-2 uppercase`} placeholder="LK" /></label>
            <label><span className={LABEL}>Region / subdivision</span><input name="jurisdictionRegion" className={`${FIELD} mt-2`} /></label>
            <label><span className={LABEL}>Registration authority</span><input required name="registrationAuthority" className={`${FIELD} mt-2`} /></label>
            <label><span className={LABEL}>Entity identifier (optional)</span><input name="entityIdentifier" className={`${FIELD} mt-2`} /></label>
          </div>
        </section>

        <section className="border-t border-zinc-800 pt-6">
          <h2 className="text-xl font-semibold text-white">Evidence</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label><span className={LABEL}>Evidence type</span><select name="evidenceKind" defaultValue="government-record" className={`${FIELD} mt-2`}><option value="government-record">Government record</option><option value="bank-record">Bank record</option><option value="platform-record">Platform record</option><option value="deployment-record">Deployment record</option><option value="contract">Contract</option><option value="contemporaneous-record">Contemporaneous record</option><option value="other">Other</option></select></label>
            <label><span className={LABEL}>Evidence attachment (optional, max 5 MB)</span><input type="file" name="evidenceFile" className={`${FIELD} mt-2 file:mr-3 file:border-0 file:bg-zinc-800 file:px-3 file:py-1 file:text-zinc-200`} /></label>
          </div>
          <label className="mt-4 block"><span className={LABEL}>Evidence reference and locator</span><textarea required name="evidenceReference" maxLength={500} className={`${FIELD} mt-2 min-h-20`} placeholder="Record title, issuer, document date, page or transaction locator" /></label>
          <p className="mt-3 text-xs leading-5 text-zinc-500">The attachment is hashed in memory for provenance. Its contents are not stored; the result retains only filename, media type, byte count, and SHA-256 fingerprint.</p>
        </section>

        <button disabled={pending || !selectedPlace} type="submit" className="border border-violet-500 px-6 py-3 font-mono text-[10px] uppercase tracking-widest text-violet-300 hover:bg-violet-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-40">{pending ? 'Computing…' : 'Compute organization report'}</button>
        {state.status === 'error' && <p className="border-l border-rose-500 pl-4 text-sm text-rose-300">{state.message}</p>}
      </form>
      {state.status === 'ok' && <Report report={state.report} />}
    </>
  )
}
