'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import type { BirthReport } from '@/lib/birth-report'
import { computeBirthReport, type BirthActionState } from '@/app/knowledge/birth/actions'
import s from './astrology.module.css'
import BirthplaceFields from './BirthplaceFields'
import GeneralReading from './GeneralReading'
import ChartChat from './ChartChat'
import ExecutivePaywall from './ExecutivePaywall'
import ExecutiveAccess, { useExecutive, chartInput, type Secondary } from './ExecutiveAccess'
import AspectsAndYogas, { type Strategy } from './AspectsAndYogas'
import TransitOverlay, { type Transit } from './TransitOverlay'
import CorporateSynastry, { type Synastry } from './CorporateSynastry'
import type { OrbitalCheckIn } from '@/lib/orbital-mind'

const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']
const glyphs = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓']
type Demo = { strategic: Strategy; transit: Transit; synastry: Synastry }
const tabs = ['Chart', 'Aspects & Yogas', 'Transits', 'Corporate Synastry', 'Reading', 'Ask AI', 'Sources'] as const
function position(degrees: number, radius: number) {
  const radians = (degrees - 90) * Math.PI / 180
  return { x: Number((220 + Math.cos(radians) * radius).toFixed(3)), y: Number((220 + Math.sin(radians) * radius).toFixed(3)) }
}
function day(iso: string) { return iso.slice(0, 10) }

function ChartWheel({ report, divisional }: { report: BirthReport; divisional: boolean }) {
  const points = divisional
    ? [{ name: 'Ascendant', ...report.foundation.d9.ascendant }, ...report.foundation.d9.placements]
    : [report.natalChart.ascendant, ...report.natalChart.placements].map(p => ({ name: p.name, ...p.sidereal }))
  return <svg viewBox="0 0 440 440" role="img" aria-label={`${divisional ? 'D9 Navamsa' : 'D1 birth'} chart wheel. Exact placements appear in the table below.`} className={s.wheel}>
    <circle cx="220" cy="220" r="208" fill="none" stroke="#b6a281" strokeWidth="1" />
    <circle cx="220" cy="220" r="169" fill="none" stroke="#c9c2b7" />
    <circle cx="220" cy="220" r="100" fill="none" stroke="#d9d2c8" />
    {signs.map((sign, i) => {
      const outer = position(i * 30, 208), inner = position(i * 30, 100), label = position(i * 30 + 15, 188)
      return <g key={sign}><line x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} stroke="#d0c8bd" /><text x={label.x} y={label.y + 6} textAnchor="middle" fontSize="23" fill="#625442"><title>{sign}</title>{`${glyphs[i]}︎`}</text></g>
    })}
    {points.map((p, i) => {
      const loc = position(p.longitude, 113 + (i % 3) * 19)
      return <g key={p.name}><title>{`${p.name}: ${p.sign} ${p.degreeInSign.toFixed(2)}°`}</title><circle cx={loc.x} cy={loc.y} r="12" fill="#f7f3ec" stroke="#947957" /><text x={loc.x} y={loc.y + 3} textAnchor="middle" fill="#443827" fontSize="9" fontWeight="600">{p.name === 'Ascendant' ? 'As' : p.name.slice(0, 2)}</text></g>
    })}
    <text x="220" y="205" textAnchor="middle" fill="#947957" fontSize="10" letterSpacing="3">{divisional ? 'NAVAMSA' : 'BIRTH CHART'}</text>
    <text x="220" y="235" textAnchor="middle" fill="#332f2a" fontSize="32" fontFamily="Georgia">{divisional ? 'D9' : 'D1'}</text>
    <text x="220" y="259" textAnchor="middle" fill="#746b60" fontSize="10">Lahiri sidereal</text>
  </svg>
}

export default function AstrologyApp({ sample, timeZones, demo, launchPricing }: { sample: BirthReport; timeZones: string[]; demo: Demo; launchPricing: boolean }) {
  const [session, setSession] = useState(0)
  return <Workspace key={session} sample={sample} timeZones={timeZones} demo={demo} launchPricing={launchPricing} reset={() => setSession(value => value + 1)} />
}

function Workspace({ sample, timeZones, demo, launchPricing, reset }: { sample: BirthReport; timeZones: string[]; demo: Demo; launchPricing: boolean; reset: () => void }) {
  const [state, action, pending] = useActionState<BirthActionState, FormData>(
    async (_previous, data) => computeBirthReport({ status: 'idle' }, data), { status: 'idle' },
  )
  const access = useExecutive()
  const [vaultReport, setVaultReport] = useState<BirthReport | null>(null)
  const [secondary, setSecondary] = useState<Secondary>()
  const [transitInstant, setTransitInstant] = useState<string>()
  const [tab, setTab] = useState<typeof tabs[number]>('Chart')
  const [orbitalRequest, setOrbitalRequest] = useState<{ id: number; checkIn: OrbitalCheckIn } | null>(null)
  const [divisional, setDivisional] = useState(false)
  const [birthDate, setBirthDate] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [uncertainty, setUncertainty] = useState('0')
  const [reference, setReference] = useState(sample.timing.referenceInstantUtc.slice(0,10))
  const report = vaultReport ?? (state.status === 'ok' ? state.report : sample)
  const isSample = !vaultReport && state.status !== 'ok'
  const advancedAccess = Boolean(access.entitlement?.advancedTools || access.entitlement?.isSubscriber)
  const moon = report.natalChart.placements.find(p => p.name === 'Moon')!
  const sun = report.natalChart.placements.find(p => p.name === 'Sun')!
  const timing = report.timing.vimshottari
  function download() {
    const blob = new Blob([JSON.stringify({ example: isSample, ...report }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = isSample ? 'maha-sample-chart.json' : 'maha-birth-chart.json'
    anchor.click(); URL.revokeObjectURL(url)
  }
  return <main className={s.app}>
    <header className={s.header}>
      <Link href="/astrology" className={s.brand}><span aria-hidden="true">✳</span><span>orbital <i>alignment</i><small>MAHA JYOTISHA · BY MAHA STRATEGIES</small></span></Link>
      <Link href="/knowledge/astrology/reading-guide">A guide to your reading ↗</Link>
    </header>
    <div className={s.intro}><p className={s.eyebrow}>STRATEGIC EPISTEMIC JYOTIṢA</p><h1>Your sky, <em>with structure.</em></h1><p>Inspect astronomical geometry, relational dynamics and timing conventions. Compare personal and entity charts, trace the sources, and turn reflection into deliberate experiments.</p></div>
    <div className={s.layout}>
      <aside className={s.sidebar}>
        <div className={s.sectionTitle}><span className={s.eyebrow}>01 / YOUR BEGINNING</span><h2>Start with a moment.</h2><p>Use the local time and place recorded at birth.</p></div>
        <form action={action} onSubmit={() => { setVaultReport(null); setSecondary(undefined); setTransitInstant(undefined) }}>
          <fieldset disabled={pending} className={s.fields}>
            <label>Birth date<input type="date" name="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} min="1800-01-01" max="2100-12-31" required /></label>
            <div className={s.fieldPair}><label>Birth time<input type="time" name="time" value={birthTime} onChange={e => setBirthTime(e.target.value)} required /></label><label>Uncertainty (± min)<input type="number" name="birthTimeUncertaintyMinutes" value={uncertainty} onChange={e => setUncertainty(e.target.value)} min="0" max="120" step="1" required /></label></div>
            <BirthplaceFields timeZones={timeZones} />
            <label>Explore timing on<input type="date" value={reference} onChange={e => setReference(e.target.value)} min="1800-01-01" max="2100-12-31" required /><small>Timing uses 12:00 UTC on this date.</small></label>
            <input type="hidden" name="timingInstantUtc" value={`${reference}T12:00`} />
            <button type="submit" className={s.primary}>{pending ? 'Calculating your chart…' : 'Explore my chart'} <span aria-hidden="true">↗</span></button>
          </fieldset>
          {state.status === 'error' && <p role="alert" className={s.error}>{state.message} The displayed chart is the labeled example.</p>}
          <p className={s.privacy}>Birth details are submitted privately to Maha for calculation. Calculating does not save your chart. Vault saves and dossier purchases store an encrypted copy only with your consent.</p>
        </form>
        <button className={s.sampleButton} disabled={pending} onClick={reset}>Clear details & explore the example →</button>
        <div className={s.note}><span aria-hidden="true">✧</span><h3>Precision matters.</h3><p>Unsure of your birth time? Add a ± range. Maha shows sampled alternatives and withholds personal reflection when the interval has not been proved stable.</p></div>
      </aside>
      <section className={s.workspace} aria-label="Chart explorer" aria-busy={pending}>
        <div className={s.reportHeader}><div><p className={s.eyebrow}>{isSample ? 'EXAMPLE / FICTIONAL BIRTH DETAILS' : 'YOUR CALCULATED CHART'}</p><h2>{isSample ? 'A chart to get acquainted.' : 'Your chart, ready to explore.'}</h2><p>{day(report.instantUtc)} · {isSample ? 'Colombo · 12:00 local' : `${report.latitudeDegrees.toFixed(4)}°, ${report.longitudeDegrees.toFixed(4)}° · ${report.utcOffset}`}</p></div><button onClick={download} disabled={pending} className={s.download}>Download JSON ↓</button></div>
        <ExecutiveAccess onSignOut={reset} launchPricing={launchPricing} access={access} report={report} example={isSample} secondary={secondary} onOpen={(r, second) => { setVaultReport(r); setSecondary(second); setTransitInstant(undefined); setTab('Chart') }} />
        <nav className={s.tabs} aria-label="Explore your report">{tabs.map(name => <button key={name} aria-pressed={tab === name} className={tab === name ? s.activeTab : ''} onClick={() => setTab(name)}>{name}</button>)}</nav>
        <div aria-live="polite" className={s.content}>
          {tab === 'Chart' && <>
            <div className={s.chartGrid}><div><div className={s.switch}><button aria-pressed={!divisional} onClick={() => setDivisional(false)}>D1 · Birth chart</button><button aria-pressed={divisional} onClick={() => setDivisional(true)}>D9 · Navamsa</button></div><ChartWheel report={report} divisional={divisional} /><p className={s.caption}>{divisional ? report.foundation.d9.boundary : 'Nominal positions in the Lahiri sidereal zodiac. Whole-sign houses; mean lunar nodes.'}</p></div>
              <div className={s.highlights}><p className={s.eyebrow}>THE STARTING POINTS</p>{[['Ascendant', report.natalChart.ascendant.sidereal.sign, 'The sign rising at your birth moment.'], ['Moon', moon.sidereal.sign, `${moon.nakshatra.name} · pada ${moon.nakshatra.pada}`], ['Sun', sun.sidereal.sign, `House ${sun.wholeSignHouse} · ${sun.sidereal.degreeInSign.toFixed(2)}°`]].map(([label, value, detail]) => <article key={label}><p>{label}</p><h3>{value}</h3><small>{detail}</small></article>)}<p className={s.caption}>These summaries describe D1. Switch to D9 to inspect its separate mapping and placements.</p></div></div>
            <div className={s.tableWrap}><table><caption>{divisional ? 'D9 Navamsa placements' : 'D1 birth placements'}</caption><thead><tr><th>Point</th><th>Sign</th><th>Degree</th><th>House</th></tr></thead><tbody>{(divisional ? [{ name: 'Ascendant', ...report.foundation.d9.ascendant, house: 1 }, ...report.foundation.d9.placements] : [report.natalChart.ascendant, ...report.natalChart.placements].map(p => ({ name: p.name, sign: p.sidereal.sign, degreeInSign: p.sidereal.degreeInSign, house: p.wholeSignHouse }))).map(p => <tr key={p.name}><th scope="row">{p.name}</th><td>{p.sign}</td><td>{p.degreeInSign.toFixed(2)}°</td><td>{p.house}</td></tr>)}</tbody></table></div>
            <details className={s.disclosure}><summary>Panchanga · calculation proof</summary><pre className={s.proof}>{JSON.stringify(report.panchanga, null, 2)}</pre></details>
            <details className={s.disclosure}><summary>Birth-time sensitivity · ±{report.foundation.sensitivity.uncertaintyMinutes} minutes</summary><p>{report.foundation.sensitivity.explanation}</p><p>{report.foundation.sensitivity.samples.length} sampled instants · {report.foundation.sensitivity.alternatives.length} observed chart configurations.</p>{report.foundation.sensitivity.alternatives.map((a, i) => <p key={i}>{a.offsetMinutes >= 0 ? '+' : ''}{a.offsetMinutes.toFixed(2)} min: D1 {a.d1Ascendant} · D9 {a.d9Ascendant}</p>)}</details>
          </>}
          {['Aspects & Yogas','Transits','Corporate Synastry'].includes(tab) && !advancedAccess && <ExecutivePaywall launchPricing={launchPricing} />}
          {tab === 'Aspects & Yogas' && <AspectsAndYogas key={report.foundation.receiptDigest} example={isSample} data={isSample ? demo.strategic : undefined} load={async () => (await access.request({ operation: 'aspects', chart: chartInput(report) })).strategic as Strategy} />}
          {tab === 'Corporate Synastry' && <CorporateSynastry key={report.foundation.receiptDigest} report={report} timeZones={timeZones} request={access.request} example={isSample} demo={demo.synastry} onSecondary={setSecondary} />}
          {tab === 'Transits' && <TransitOverlay key={report.foundation.receiptDigest} report={report} example={isSample} demo={demo.transit} request={access.request} onDate={setTransitInstant} />}
          <div hidden={tab !== 'Reading'}><GeneralReading key={report.reading.receiptDigest} report={report} onAskOrbital={checkIn => { setOrbitalRequest(previous => ({ id: (previous?.id ?? 0) + 1, checkIn })); setTab('Ask AI') }} /></div>
          <div hidden={tab !== 'Ask AI'}><ChartChat key={`${report.reading.receiptDigest}-${isSample}-${orbitalRequest?.id ?? 0}`} report={report} example={isSample} initialOrbital={orbitalRequest?.checkIn} accountKey={access.accountKey} secondary={secondary} transitInstantUtc={transitInstant} /></div>
          {tab === 'Transits' && <div className={s.reading}><p className={s.eyebrow}>A MAP OF PERIODS</p><h3>{timing.activeMahadasha.lord} <em> / {timing.activeAntardasha.lord}</em></h3><p>Nominal Vimshottari periods at {day(report.timing.referenceInstantUtc)}, 12:00 UTC. These dates describe a timing convention; they do not predict events.</p><div className={s.periodCards}><article><small>MAJOR PERIOD</small><h4>{timing.activeMahadasha.lord}</h4><p>{day(timing.activeMahadasha.startUtc)} → {day(timing.activeMahadasha.endUtc)}</p></article><article><small>SUB-PERIOD</small><h4>{timing.activeAntardasha.lord}</h4><p>{day(timing.activeAntardasha.startUtc)} → {day(timing.activeAntardasha.endUtc)}</p></article></div><h4>Next transition</h4><p>{timing.nextTransition.lord} · {timing.nextTransition.level} · {day(timing.nextTransition.atUtc)}</p><h4>Looking ahead</h4>{report.foundation.upcoming.map(snapshot => <article key={snapshot.daysAfterReference}><span className={s.tag}>+{snapshot.daysAfterReference} days · {day(snapshot.instantUtc)}</span><h4>Position snapshot</h4>{snapshot.placements.map(p => <p key={p.name}>{p.name} · {p.sign} {p.degreeInSign.toFixed(2)}° · nominal D1 house {p.nominalD1House}</p>)}<small>{snapshot.interpretation}</small></article>)}<details className={s.disclosure}><summary>Timing conventions and uncertainty</summary>{report.timing.methodology.map(item => <p key={item}>{item}</p>)}{report.foundation.sensitivity.periodAlternatives.map((p, i) => <p key={i}>{p.offsetMinutes} min: {p.mahadasha.lord} / {p.antardasha.lord}; next transition {day(p.nextTransition.atUtc)}</p>)}</details></div>}
          {tab === 'Sources' && <div className={s.reading}><p className={s.eyebrow}>BEHIND THE READING</p><h3>Nothing without context.</h3><article><h4>The Orbital Mind</h4><p>The check-in lenses use Mayone Maha Rajan’s book and companion theoretical paper. Practical exercises are Maha adaptations; the framework is not a validated assessment or a rule derived from your chart.</p><Link href="/astrology/orbital-mind">Book sections, source summaries & evidence boundaries ↗</Link></article><p>{report.reading.educational.reviewBasis}</p><article><h4>Calculation profile</h4>{Object.entries(report.foundation.conventions).map(([key, value]) => <p key={key}><strong>{key}:</strong> {value}</p>)}<p>Engine: {report.natalChart.version}</p></article><article><h4>Receipt</h4><p>Included in your JSON download for inspection and reproducibility.</p><code className={s.digest}>{report.foundation.receiptDigest}</code></article><article><h4>Coverage and withheld rules</h4><p>{report.reading.empiricalStatus}</p>{report.reading.withheld.map((rule, i) => <details key={`${rule.ruleId}-${i}`}><summary>{rule.ruleId} · {rule.reason}</summary><p>{rule.explanation}</p></details>)}</article><Link href="/knowledge/astrology">Explore Maha’s astrology knowledge library ↗</Link></div>}
        </div>
        <footer className={s.reportFooter}><span aria-hidden="true">✧</span> Calculated sky positions. Sourced tradition. Your own perspective.</footer>
      </section>
    </div>
  </main>
}
