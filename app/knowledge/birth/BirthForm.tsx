'use client'

import Link from 'next/link'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'

import { BIRTH_PLACES, birthPlaceKey, findBirthPlace } from '@/lib/birth-places'
import type { BirthReport, RenderedTraditionReport } from '@/lib/birth-report'
import type { HistoricalMilestoneInput, MilestoneSourceKind, MilestoneType } from '@/lib/historical-calibration'
import type { NatalChartPoint } from '@/lib/natal-chart'
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

interface MilestoneDraft {
  eventId: string
  title: string
  occurredAtUtc: string
  uncertaintyMinutes: string
  type: MilestoneType
  sourceKind: MilestoneSourceKind
  sourceReference: string
  includeMetric: boolean
  metricId: string
  metricName: string
  metricValue: string
  metricTarget: string
  metricUnit: string
  metricDirection: 'higher-is-better' | 'lower-is-better'
  metricDataSourceId: string
}

const MILESTONE_TYPE_OPTIONS: { value: MilestoneType; label: string }[] = [
  { value: 'client-work', label: 'Client work' }, { value: 'revenue', label: 'Revenue' },
  { value: 'company-formation', label: 'Company formation' }, { value: 'creative-work', label: 'Creative work' },
  { value: 'product-release', label: 'Product release' }, { value: 'audience-growth', label: 'Audience growth' },
  { value: 'other', label: 'Other' },
]

const SOURCE_OPTIONS: { value: MilestoneSourceKind; label: string }[] = [
  { value: 'platform-record', label: 'Platform record' }, { value: 'bank-record', label: 'Bank record' },
  { value: 'government-record', label: 'Government filing' }, { value: 'file-metadata', label: 'File metadata' },
  { value: 'analytics-record', label: 'Analytics record' }, { value: 'contemporaneous-note', label: 'Contemporaneous note' },
  { value: 'recollection', label: 'Recollection' },
]

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

function zodiacDegree(point: NatalChartPoint, frame: 'sidereal' | 'tropical'): string {
  const position = point[frame]
  const degrees = Math.floor(position.degreeInSign)
  const minutes = Math.floor((position.degreeInSign - degrees) * 60)
  return `${position.sign} ${degrees}°${String(minutes).padStart(2, '0')}′`
}

function motionLabel(point: NatalChartPoint): string {
  if (point.motion === 'not-applicable') return '—'
  if (point.motion === 'retrograde') return 'Retrograde'
  if (point.motion === 'stationary') return 'Stationary'
  return 'Direct'
}

function compactDegrees(value: number): string {
  return `${value.toFixed(2)}°`
}

function utcDate(value: string): string {
  return value.slice(0, 10)
}

function ChartSummary({ report }: { report: BirthReport }) {
  const chart = report.natalChart
  const moon = chart.placements.find((point) => point.name === 'Moon')!
  const sun = chart.placements.find((point) => point.name === 'Sun')!
  const order = ['Ascendant', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']
  const points = [chart.ascendant, ...chart.placements].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))

  return (
    <>
      <section className="mt-8 border border-violet-800/50 bg-violet-950/10 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={LABEL}>Your chart map</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Lahiri sidereal · whole-sign houses</h2>
          </div>
          <span className="border border-emerald-600/40 bg-emerald-500/10 px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-emerald-300">Computed chart facts</span>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">This is the stable natal baseline used for later timing comparisons. It tells you where each point falls under the declared chart conventions; it does not by itself establish what those placements mean or predict.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ['Ascendant', zodiacDegree(chart.ascendant, 'sidereal'), `${chart.ascendant.nakshatra.name} · pāda ${chart.ascendant.nakshatra.pada}`],
            ['Moon', zodiacDegree(moon, 'sidereal'), `House ${moon.wholeSignHouse} · ${moon.nakshatra.name} ${moon.nakshatra.pada}`],
            ['Sun', zodiacDegree(sun, 'sidereal'), `House ${sun.wholeSignHouse} · ${sun.nakshatra.name} ${sun.nakshatra.pada}`],
          ].map(([label, value, detail]) => (
            <div key={label} className="border border-zinc-800 bg-black/40 p-4">
              <p className={LABEL}>{label}</p>
              <p className="mt-2 text-xl text-white">{value}</p>
              <p className="mt-1 font-mono text-[10px] text-zinc-500">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 border border-zinc-800 bg-zinc-950/60 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-2xl font-semibold text-white">Complete placement table</h2>
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Mean node · astronomy-engine 2.1.19</p>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="border-b border-zinc-700 font-mono text-[9px] uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="px-3 py-3">Point</th>
                <th className="px-3 py-3">Lahiri sidereal</th>
                <th className="px-3 py-3">House</th>
                <th className="px-3 py-3">Nakṣatra</th>
                <th className="px-3 py-3">Pāda</th>
                <th className="px-3 py-3">Tropical comparison</th>
                <th className="px-3 py-3">Motion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {points.map((point) => (
                <tr key={point.name} className="text-sm text-zinc-300">
                  <th className="px-3 py-3 font-medium text-white">{point.name}</th>
                  <td className="px-3 py-3 font-mono text-xs text-violet-200">{zodiacDegree(point, 'sidereal')}</td>
                  <td className="px-3 py-3">{point.wholeSignHouse}</td>
                  <td className="px-3 py-3">{point.nakshatra.name}</td>
                  <td className="px-3 py-3">{point.nakshatra.pada}</td>
                  <td className="px-3 py-3 font-mono text-xs text-zinc-500">{zodiacDegree(point, 'tropical')}</td>
                  <td className={`px-3 py-3 text-xs ${point.motion === 'retrograde' ? 'text-amber-300' : 'text-zinc-500'}`}>{motionLabel(point)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <details className="mt-5 border-t border-zinc-800 pt-4">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-zinc-400">Calculation choices and boundaries</summary>
          <ul className="mt-3 space-y-2">
            {chart.methodology.map((item) => <li key={item} className="border-l border-zinc-800 pl-3 text-xs leading-5 text-zinc-500">{item}</li>)}
          </ul>
          <p className="mt-3 font-mono text-[10px] text-zinc-600">Ayanāṁśa {chart.ayanamsa.degrees.toFixed(6)}° · {chart.version}</p>
        </details>
      </section>
    </>
  )
}

function ChartStructure({ report }: { report: BirthReport }) {
  const chart = report.natalChart
  const firstHouse = chart.houses[0]
  const occupiedHouses = chart.houses.filter((house) => house.occupants.length > 0)
  const concentrations = occupiedHouses.filter((house) => house.occupants.length > 1)

  return (
    <section className="mt-6 border border-cyan-900/60 bg-cyan-950/10 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={LABEL}>Natal structure</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Relationships in the chart</h2>
        </div>
        <span className="border border-cyan-600/40 bg-cyan-500/10 px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-cyan-300">Computed geometry + declared conventions</span>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">These statements describe how the chart is connected. Angular separation is geometry; aspect orbs, whole-sign houses, and traditional sign rulers are declared astrological conventions. No personality or outcome meaning is inferred here.</p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <article className="border border-zinc-800 bg-black/30 p-4">
          <p className={LABEL}>Ascendant ruler</p>
          <p className="mt-2 text-lg text-white">{firstHouse.ruler} in house {firstHouse.rulerHouse}</p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">{chart.ascendant.sidereal.sign} rises, so the traditional ruler is {firstHouse.ruler}; it is placed in {firstHouse.rulerSign}.</p>
        </article>
        <article className="border border-zinc-800 bg-black/30 p-4">
          <p className={LABEL}>Nodal axis</p>
          <p className="mt-2 text-lg text-white">Houses {chart.nodalAxis.rahu.house}–{chart.nodalAxis.ketu.house}</p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">Rahu in {chart.nodalAxis.rahu.sign}; Ketu in {chart.nodalAxis.ketu.sign}. Separation {compactDegrees(chart.nodalAxis.separationDegrees)} by construction.</p>
        </article>
        <article className="border border-zinc-800 bg-black/30 p-4">
          <p className={LABEL}>Concentrations</p>
          <p className="mt-2 text-lg text-white">{concentrations.length || 'None'}</p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">{concentrations.length > 0
            ? concentrations.map((house) => `House ${house.number}: ${house.occupants.join(' + ')}`).join(' · ')
            : 'No whole-sign house contains more than one computed point.'}</p>
        </article>
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-xl font-semibold text-white">Angular relationships</h3>
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Sorted by tightest orb</p>
        </div>
        {chart.aspects.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {chart.aspects.map((aspect) => (
              <div key={`${aspect.first}-${aspect.second}-${aspect.name}`} className="flex items-baseline justify-between gap-4 border border-zinc-800 bg-black/30 px-4 py-3">
                <p className="text-sm text-zinc-200"><span className="text-white">{aspect.first}</span> {aspect.name} <span className="text-white">{aspect.second}</span></p>
                <p className="shrink-0 font-mono text-[10px] text-cyan-300">orb {compactDegrees(aspect.orbDegrees)}</p>
              </div>
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-zinc-500">No relationship falls inside the declared aspect orbs.</p>}
      </div>

      <details className="mt-8 border-t border-zinc-800 pt-5">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-zinc-400">All twelve house rulers and occupants</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[650px] border-collapse text-left">
            <thead className="border-b border-zinc-700 font-mono text-[9px] uppercase tracking-widest text-zinc-500">
              <tr><th className="px-3 py-3">House</th><th className="px-3 py-3">Sign</th><th className="px-3 py-3">Traditional ruler</th><th className="px-3 py-3">Ruler placement</th><th className="px-3 py-3">Occupants</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {chart.houses.map((house) => (
                <tr key={house.number} className="text-sm text-zinc-300">
                  <th className="px-3 py-3 text-white">{house.number}</th>
                  <td className="px-3 py-3">{house.sign}</td>
                  <td className="px-3 py-3 text-violet-200">{house.ruler}</td>
                  <td className="px-3 py-3">{house.rulerSign} · house {house.rulerHouse}</td>
                  <td className="px-3 py-3 text-zinc-500">{house.occupants.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

function TimingSection({ report }: { report: BirthReport }) {
  const timing = report.timing
  const dasha = timing.vimshottari
  const activeMaha = dasha.activeMahadasha
  const activeAntar = dasha.activeAntardasha
  const slowPoints = new Set(['Jupiter', 'Saturn', 'Rahu', 'Ketu'])
  const highlightedTransits = timing.transits.placements.filter((entry) => slowPoints.has(entry.point))

  return (
    <section className="mt-6 border border-amber-900/60 bg-amber-950/10 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={LABEL}>Timing framework</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Daśā periods and current transits</h2>
        </div>
        <span className="border border-amber-600/40 bg-amber-500/10 px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-amber-300">Declared Vedic convention + computed geometry</span>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">For the explicit reference moment <span className="font-mono text-zinc-200">{timing.referenceInstantUtc}</span>, this layer identifies the periods and cross-chart geometry that a later source-bound compiler may evaluate. It does not predict an event or assign a meaning to a planet.</p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <article className="border border-zinc-800 bg-black/30 p-4">
          <p className={LABEL}>Active mahādaśā</p>
          <p className="mt-2 text-2xl text-white">{activeMaha.lord}</p>
          <p className="mt-2 font-mono text-[10px] text-zinc-500">{utcDate(activeMaha.startUtc)} → {utcDate(activeMaha.endUtc)}</p>
        </article>
        <article className="border border-zinc-800 bg-black/30 p-4">
          <p className={LABEL}>Active antardaśā</p>
          <p className="mt-2 text-2xl text-white">{activeMaha.lord} / {activeAntar.lord}</p>
          <p className="mt-2 font-mono text-[10px] text-zinc-500">{utcDate(activeAntar.startUtc)} → {utcDate(activeAntar.endUtc)}</p>
        </article>
        <article className="border border-zinc-800 bg-black/30 p-4">
          <p className={LABEL}>Next period change</p>
          <p className="mt-2 text-2xl text-white">{dasha.nextTransition.lord}</p>
          <p className="mt-2 font-mono text-[10px] text-zinc-500">{dasha.nextTransition.level} · {utcDate(dasha.nextTransition.atUtc)}</p>
        </article>
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-xl font-semibold text-white">Major-period timeline</h3>
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Natal Moon: {dasha.moonNakshatra.name} · opening lord {dasha.startingLord}</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {dasha.mahadashas.map((entry) => (
            <div key={`${entry.lord}-${entry.startUtc}`} className={`border px-4 py-3 ${entry.activeAtReference ? 'border-amber-500/70 bg-amber-500/10' : 'border-zinc-800 bg-black/30'}`}>
              <div className="flex items-baseline justify-between gap-3">
                <p className={entry.activeAtReference ? 'text-amber-200' : 'text-zinc-300'}>{entry.lord}</p>
                <p className="font-mono text-[9px] text-zinc-600">{entry.nominalYears}y</p>
              </div>
              <p className="mt-1 font-mono text-[9px] text-zinc-600">{utcDate(entry.startUtc)} → {utcDate(entry.endUtc)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-xl font-semibold text-white">Slow-point transit houses</h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {highlightedTransits.map((entry) => (
              <div key={entry.point} className="border border-zinc-800 bg-black/30 px-4 py-3">
                <p className="text-sm text-white">{entry.point} in natal house {entry.natalWholeSignHouse}</p>
                <p className="mt-1 font-mono text-[10px] text-zinc-600">{entry.siderealSign} {entry.degreeInSign.toFixed(2)}° · {entry.motion}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-xl font-semibold text-white">Tight transit contacts</h3>
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">2° maximum orb</p>
          </div>
          {timing.transits.contacts.length > 0 ? (
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
              {timing.transits.contacts.map((contact) => (
                <div key={`${contact.transitPoint}-${contact.natalPoint}-${contact.aspect}`} className="flex items-baseline justify-between gap-4 border border-zinc-800 bg-black/30 px-4 py-3">
                  <p className="text-sm text-zinc-300"><span className="text-white">Transit {contact.transitPoint}</span> {contact.aspect} natal <span className="text-white">{contact.natalPoint}</span></p>
                  <p className="shrink-0 font-mono text-[10px] text-amber-300">{compactDegrees(contact.orbDegrees)}</p>
                </div>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-zinc-500">No contact falls inside the declared 2° geometric profile.</p>}
        </div>
      </div>

      <details className="mt-8 border-t border-zinc-800 pt-5">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-zinc-400">Timing methods, source references, and disagreement surface</summary>
        <ul className="mt-4 space-y-2">
          {timing.methodology.map((item) => <li key={item} className="border-l border-zinc-800 pl-3 text-xs leading-5 text-zinc-500">{item}</li>)}
        </ul>
        {dasha.sourceReferences.map((source) => (
          <p key={source.locator} className="mt-4 text-xs leading-5 text-zinc-500">
            <a href={source.url} target="_blank" rel="noreferrer" className="text-amber-300 underline underline-offset-4 hover:text-white">{source.title}</a> · {source.locator}. {source.note}
          </p>
        ))}
        <p className="mt-4 border-l border-rose-700/60 pl-3 text-xs leading-5 text-zinc-500"><span className="text-rose-400">Boundary:</span> Daśā periods and transit geometry are inspectable classifications under stated conventions, not evidence that astrology forecasts real outcomes.</p>
        <p className="mt-3 font-mono text-[10px] text-zinc-600">Natal Moon nakṣatra stay {dasha.birthNakshatraIngressUtc} → {dasha.birthNakshatraEgressUtc} · {dasha.balanceMethod}</p>
        <p className="mt-3 font-mono text-[10px] text-zinc-600">{timing.version} · year length {dasha.yearLengthDays} days · balance at birth {dasha.balanceAtBirthYears.toFixed(4)} years</p>
      </details>
    </section>
  )
}

function HistoricalCalibrationSection({ report }: { report: BirthReport }) {
  const calibration = report.historicalCalibration
  if (!calibration) return null
  return (
    <section className="mt-6 border border-emerald-900/60 bg-emerald-950/10 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={LABEL}>Historical calibration</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Repeated celestial correspondences</h2>
        </div>
        <span className="border border-amber-600/40 bg-amber-500/10 px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-amber-300">Exploratory · hypothesis generation only</span>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">Each milestone was independently recomputed at its timestamp. The engine retains features stable across the declared uncertainty window, then reports only features repeated across at least two selected events.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <article className="border border-zinc-800 bg-black/30 p-4"><p className={LABEL}>Milestones compiled</p><p className="mt-2 text-2xl text-white">{calibration.milestones.length}</p></article>
        <article className="border border-zinc-800 bg-black/30 p-4"><p className={LABEL}>Repeated features</p><p className="mt-2 text-2xl text-white">{calibration.correspondences.length}</p></article>
        <article className="border border-zinc-800 bg-black/30 p-4"><p className={LABEL}>Test candidates</p><p className="mt-2 text-2xl text-white">{calibration.prospectiveCandidates.length}</p></article>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-semibold text-white">Milestone state vectors</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {calibration.milestones.map((milestone) => (
            <article key={milestone.eventId} className="border border-zinc-800 bg-black/30 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-white">{milestone.title}</h4><span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">{milestone.type}</span></div>
              <p className="mt-2 font-mono text-[10px] text-zinc-500">{milestone.occurredAtUtc} · ±{milestone.uncertaintyMinutes / 2} min</p>
              <p className="mt-3 text-sm text-emerald-200">{milestone.activeMahadasha} / {milestone.activeAntardasha}</p>
              <p className="mt-2 text-xs leading-5 text-zinc-400">{milestone.slowTransitHouses.map((entry) => `${entry.point}: H${entry.house} ${entry.sign}`).join(' · ')}</p>
              <p className="mt-3 text-xs leading-5 text-zinc-500">{milestone.stableFeatures.length} stable features{milestone.unstableFeatures.length ? ` · ${milestone.unstableFeatures.length} withheld as time-sensitive` : ''}</p>
              {milestone.metric && <p className="mt-2 text-xs text-zinc-400">{milestone.metric.name}: {milestone.metric.value} {milestone.metric.unit} vs {milestone.metric.target} target · <span className={milestone.metric.metTarget ? 'text-emerald-300' : 'text-amber-300'}>{milestone.metric.metTarget ? 'met' : 'not met'}</span></p>}
              <p className="mt-3 font-mono text-[9px] text-zinc-600">{milestone.sourceKind} · {milestone.sourceReference} · {milestone.stateVectorSha256}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-xl font-semibold text-white">Observed recurrences</h3>
          <div className="mt-4 space-y-2">
            {calibration.correspondences.length ? calibration.correspondences.map((entry) => (
              <article key={entry.feature.key} className="border border-zinc-800 bg-black/30 p-4">
                <p className="text-sm text-white">{entry.feature.label}</p>
                <p className="mt-1 font-mono text-[10px] text-emerald-300">{entry.occurrences}/{calibration.milestones.length} selected milestones</p>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{entry.eventTitles.join(' · ')}</p>
              </article>
            )) : <p className="text-sm leading-6 text-zinc-500">No stable feature repeats yet. Add more independently evidenced milestones; the engine will not force a pattern.</p>}
          </div>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white">Prospective tests to register</h3>
          <div className="mt-4 space-y-2">
            {calibration.prospectiveCandidates.length ? calibration.prospectiveCandidates.map((candidate) => (
              <article key={candidate.candidateId} className="border border-zinc-800 bg-black/30 p-4">
                <p className="text-sm leading-6 text-zinc-300">{candidate.statementTemplate}</p>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-amber-300">Unregistered · minimum n={candidate.minimumProspectiveObservations}</p>
              </article>
            )) : <p className="text-sm leading-6 text-zinc-500">A test candidate appears only after a feature recurs. It still must be pre-registered before future outcomes are known.</p>}
          </div>
        </div>
      </div>

      <details className="mt-8 border-t border-zinc-800 pt-5">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-zinc-400">Methods, limitations, and reproducibility</summary>
        <p className="mt-4 border-l border-amber-700/60 pl-3 text-xs leading-5 text-zinc-400">{calibration.boundary}</p>
        <ul className="mt-4 space-y-2">{calibration.methodology.map((item) => <li key={item} className="border-l border-zinc-800 pl-3 text-xs leading-5 text-zinc-500">{item}</li>)}</ul>
        <p className="mt-4 break-all font-mono text-[9px] text-zinc-600">Input {calibration.inputSha256} · bundle {calibration.bundleSha256} · {calibration.version}</p>
      </details>
    </section>
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

      <ChartSummary report={report} />
      <ChartStructure report={report} />
      <TimingSection report={report} />
      <HistoricalCalibrationSection report={report} />

      <section className="mt-10 border border-zinc-800 bg-zinc-950/40 p-5">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Understand this report</h2>
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <Link href="/knowledge/astrology/vimshottari-dasha" className="border border-zinc-700 px-3 py-2 hover:border-violet-500 hover:text-white">Vimśottarī daśā method</Link>
          <Link href="/knowledge/astrology/lahiri-ayanamsa" className="border border-zinc-700 px-3 py-2 hover:border-violet-500 hover:text-white">Lahiri calculation</Link>
          <Link href="/knowledge/astrology/jupiter-transits" className="border border-zinc-700 px-3 py-2 hover:border-violet-500 hover:text-white">Jupiter transit method</Link>
          <Link href="/knowledge/astrology/timing" className="border border-zinc-700 px-3 py-2 hover:border-violet-500 hover:text-white">All timing references</Link>
          <Link href="/knowledge/astrology/tropical-vs-sidereal" className="border border-zinc-700 px-3 py-2 hover:border-violet-500 hover:text-white">Tropical vs. sidereal</Link>
          <Link href="/knowledge/astrology/tropical-vs-sidereal/comparisons" className="border border-zinc-700 px-3 py-2 hover:border-amber-500 hover:text-white">Frame disagreements</Link>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-2xl font-semibold text-white">Birth pañcāṅga</h2>
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Sun–Moon calendrical geometry</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Limb label="Janma nakṣatra" value={p.nakshatra.name} detail={`${p.nakshatra.index}/27 · ${(p.nakshatra.fraction * 100).toFixed(1)}% elapsed`} uncertain={p.nakshatra.nearBoundary} />
        <Limb label="Tithi" value={p.tithi.name} detail={`${p.tithi.paksha} · ${p.tithi.absoluteIndex}/30`} uncertain={p.tithi.nearBoundary} />
        <Limb label="Yoga" value={p.yoga.name} detail={`${p.yoga.index}/27`} uncertain={p.yoga.nearBoundary} />
        <Limb label="Karaṇa" value={p.karana.name} detail={`${p.karana.index}/60`} uncertain={p.karana.nearBoundary} />
        <Limb label="Vāra" value={p.vara.name} detail="sunrise to sunrise" uncertain={false} />
        </div>
      </section>

      <section className="mt-10 border-t border-zinc-800 pt-8">
        <h2 className="text-2xl font-semibold text-white">Source-bound tradition notes</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">Only rules tied to a named tradition and transcribed passage appear below. These are historical or contemporary interpretive claims—not additional chart facts and not empirically validated predictions.</p>
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
  const [timingInstantUtc, setTimingInstantUtc] = useState(() => new Date().toISOString().slice(0, 16))
  const [timeZone, setTimeZone] = useState('UTC')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [elevation, setElevation] = useState('')
  const [placeLabel, setPlaceLabel] = useState('')
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([])
  const [placeStatus, setPlaceStatus] = useState<'idle' | 'searching' | 'results' | 'error'>('idle')
  const [placeMessage, setPlaceMessage] = useState('')
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([])
  const placeRequestId = useRef(0)

  const zoneGroups = useMemo(() => groupTimeZones(), [])
  const coordinatesReady = Number.isFinite(Number(latitude)) && latitude !== '' && Number.isFinite(Number(longitude)) && longitude !== ''
  const canSubmit = date !== '' && time !== '' && timingInstantUtc !== '' && coordinatesReady && timeZone !== ''
  const serializedMilestones = useMemo(() => JSON.stringify(milestones.map((milestone): HistoricalMilestoneInput => ({
    eventId: milestone.eventId,
    title: milestone.title,
    occurredAtUtc: `${milestone.occurredAtUtc}:00.000Z`,
    uncertaintyMinutes: Number(milestone.uncertaintyMinutes),
    type: milestone.type,
    sourceKind: milestone.sourceKind,
    sourceReference: milestone.sourceReference,
    ...(milestone.includeMetric ? { metric: {
      metricId: milestone.metricId,
      name: milestone.metricName,
      value: Number(milestone.metricValue),
      target: Number(milestone.metricTarget),
      unit: milestone.metricUnit,
      direction: milestone.metricDirection,
      dataSourceId: milestone.metricDataSourceId,
    } } : {}),
  }))), [milestones])

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

  function addMilestone() {
    if (milestones.length >= 12) return
    setMilestones((current) => [...current, {
      eventId: `evt_${crypto.randomUUID().replaceAll('-', '')}`,
      title: '', occurredAtUtc: '', uncertaintyMinutes: '0', type: 'revenue',
      sourceKind: 'platform-record', sourceReference: '', includeMetric: false,
      metricId: '', metricName: '', metricValue: '', metricTarget: '', metricUnit: '',
      metricDirection: 'higher-is-better', metricDataSourceId: '',
    }])
  }

  function updateMilestone(eventId: string, patch: Partial<MilestoneDraft>) {
    setMilestones((current) => current.map((milestone) => milestone.eventId === eventId ? { ...milestone, ...patch } : milestone))
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

          <label className="flex flex-col gap-2 sm:col-span-2">
            <span className={LABEL}>Timing moment (UTC)</span>
            <input suppressHydrationWarning required type="datetime-local" name="timingInstantUtc" value={timingInstantUtc} onInput={(event) => setTimingInstantUtc(event.currentTarget.value)} className={FIELD} />
            <span className="text-xs leading-5 text-zinc-600">Defaults to now. Change it to inspect a past milestone or future timing window; the submitted value is interpreted explicitly as UTC.</span>
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

        <details className="mt-5 border border-emerald-900/60 bg-emerald-950/10 p-4">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-emerald-300">Historical calibration ({milestones.length} milestones)</summary>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <p className="max-w-3xl text-xs leading-5 text-zinc-500">Optional. Add dated, independently evidenced milestones to discover repeated daśā and slow-transit states. Times are UTC; uncertainty prevents false precision. Entries are sent by POST for this calculation and are not stored.</p>
            <button type="button" onClick={addMilestone} disabled={milestones.length >= 12} className="shrink-0 border border-emerald-600 px-4 py-2 font-mono text-[9px] uppercase tracking-widest text-emerald-300 hover:bg-emerald-500 hover:text-black disabled:opacity-40">Add milestone</button>
          </div>

          <div className="mt-5 space-y-4">
            {milestones.map((milestone, index) => (
              <fieldset key={milestone.eventId} className="border border-zinc-800 bg-black/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <legend className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Milestone {index + 1}</legend>
                  <button type="button" onClick={() => setMilestones((current) => current.filter((entry) => entry.eventId !== milestone.eventId))} className="font-mono text-[9px] uppercase tracking-widest text-rose-400 hover:text-white">Remove</button>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 sm:col-span-2"><span className={LABEL}>What happened</span><input required value={milestone.title} onInput={(event) => updateMilestone(milestone.eventId, { title: event.currentTarget.value })} placeholder="First paid client milestone" className={FIELD} /></label>
                  <label className="flex flex-col gap-2"><span className={LABEL}>When (UTC)</span><input required type="datetime-local" value={milestone.occurredAtUtc} onInput={(event) => updateMilestone(milestone.eventId, { occurredAtUtc: event.currentTarget.value })} className={FIELD} /></label>
                  <label className="flex flex-col gap-2"><span className={LABEL}>Time precision</span><select value={milestone.uncertaintyMinutes} onChange={(event) => updateMilestone(milestone.eventId, { uncertaintyMinutes: event.target.value })} className={FIELD}><option value="0">Exact minute</option><option value="60">Approximate hour</option><option value="1440">Date known (±12 hours)</option><option value="10080">Week known (±3.5 days)</option></select></label>
                  <label className="flex flex-col gap-2"><span className={LABEL}>Milestone type</span><select value={milestone.type} onChange={(event) => updateMilestone(milestone.eventId, { type: event.target.value as MilestoneType })} className={FIELD}>{MILESTONE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label className="flex flex-col gap-2"><span className={LABEL}>Evidence class</span><select value={milestone.sourceKind} onChange={(event) => updateMilestone(milestone.eventId, { sourceKind: event.target.value as MilestoneSourceKind })} className={FIELD}>{SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label className="flex flex-col gap-2 sm:col-span-2"><span className={LABEL}>Evidence reference</span><input required value={milestone.sourceReference} onInput={(event) => updateMilestone(milestone.eventId, { sourceReference: event.currentTarget.value })} placeholder="Record ID, statement period, or bounded file locator—never document contents" className={FIELD} /></label>
                </div>

                <label className="mt-4 flex items-center gap-3 text-xs text-zinc-400"><input type="checkbox" checked={milestone.includeMetric} onChange={(event) => updateMilestone(milestone.eventId, { includeMetric: event.target.checked })} className="accent-emerald-500" /> Attach an objective outcome metric</label>
                {milestone.includeMetric && <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="flex flex-col gap-2"><span className={LABEL}>Metric ID</span><input required pattern="[a-z][a-z0-9_-]{2,63}" value={milestone.metricId} onInput={(event) => updateMilestone(milestone.eventId, { metricId: event.currentTarget.value })} placeholder="monthly_revenue" className={FIELD} /></label>
                  <label className="flex flex-col gap-2"><span className={LABEL}>Metric name</span><input required value={milestone.metricName} onInput={(event) => updateMilestone(milestone.eventId, { metricName: event.currentTarget.value })} placeholder="Monthly revenue" className={FIELD} /></label>
                  <label className="flex flex-col gap-2"><span className={LABEL}>Unit</span><input required value={milestone.metricUnit} onInput={(event) => updateMilestone(milestone.eventId, { metricUnit: event.currentTarget.value })} placeholder="USD" className={FIELD} /></label>
                  <label className="flex flex-col gap-2"><span className={LABEL}>Observed value</span><input required type="number" step="any" value={milestone.metricValue} onInput={(event) => updateMilestone(milestone.eventId, { metricValue: event.currentTarget.value })} className={FIELD} /></label>
                  <label className="flex flex-col gap-2"><span className={LABEL}>Target</span><input required type="number" step="any" value={milestone.metricTarget} onInput={(event) => updateMilestone(milestone.eventId, { metricTarget: event.currentTarget.value })} className={FIELD} /></label>
                  <label className="flex flex-col gap-2"><span className={LABEL}>Direction</span><select value={milestone.metricDirection} onChange={(event) => updateMilestone(milestone.eventId, { metricDirection: event.target.value as MilestoneDraft['metricDirection'] })} className={FIELD}><option value="higher-is-better">Higher is better</option><option value="lower-is-better">Lower is better</option></select></label>
                  <label className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3"><span className={LABEL}>Metric system of record</span><input required value={milestone.metricDataSourceId} onInput={(event) => updateMilestone(milestone.eventId, { metricDataSourceId: event.currentTarget.value })} placeholder="Platform dashboard or ledger ID" className={FIELD} /></label>
                </div>}
              </fieldset>
            ))}
            {milestones.length === 0 && <p className="border border-dashed border-zinc-800 p-4 text-xs leading-5 text-zinc-600">No milestones added. The ordinary chart and timing report will still compute.</p>}
          </div>
        </details>

        <input type="hidden" name="elevation" value={elevation} />
        <input type="hidden" name="historicalMilestones" value={serializedMilestones} />

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
