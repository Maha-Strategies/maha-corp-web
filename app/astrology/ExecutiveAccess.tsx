'use client'
import { useEffect, useRef, useState } from 'react'
import type { BirthReport } from '@/lib/birth-report'
import type { AstrologyChartInput } from '@/lib/astrology-input'
import type { UserAstrologyEntitlement } from '@/lib/astrology-entitlements'
import s from './astrology.module.css'
export type Secondary = { report: BirthReport; kind: 'corporate' | 'partner'; label: string }
export function chartInput(report: BirthReport): AstrologyChartInput { return { instantUtc: report.instantUtc, latitudeDegrees: report.latitudeDegrees, longitudeDegrees: report.longitudeDegrees, uncertaintyMinutes: report.foundation.sensitivity.uncertaintyMinutes, referenceInstantUtc: report.timing.referenceInstantUtc } }
export type PlatformRequest = (body: Record<string, unknown>, useEmailSession?: boolean) => Promise<Record<string, unknown>>
export function useExecutive() {
  const [signedIn, setSignedIn] = useState(false)
  const [accountKey, setAccountKey] = useState(''), [entitlement, setEntitlement] = useState<UserAstrologyEntitlement | null>(null)
  const request: PlatformRequest = async (body, useEmailSession = false) => {
    const response = await fetch('/api/astrology/platform', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(!useEmailSession && accountKey.trim() ? { Authorization: `Bearer ${accountKey.trim()}` } : {}) }, body: JSON.stringify(body) })
    if (response.headers.get('content-type')?.includes('application/pdf') && response.ok) {
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a'); link.href = url; link.download = 'maha-executive-dossier.pdf'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return { downloaded: true }
    }
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'The request could not be completed.')
    return data
  }
  return { accountKey, setAccountKey, signedIn, setSignedIn, entitlement, setEntitlement, request }
}
export default function ExecutiveAccess({ access, report, example, secondary, onOpen, launchPricing, onSignOut }: { access: ReturnType<typeof useExecutive>; report: BirthReport; example: boolean; secondary?: Secondary; onOpen: (report: BirthReport, secondary?: Secondary) => void; launchPricing: boolean; onSignOut: () => void }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [consent, setConsent] = useState(false), [label, setLabel] = useState('My chart')
  const [email, setEmail] = useState(''), [code, setCode] = useState(''), [challenge, setChallenge] = useState('')
  const panel = useRef<HTMLDetailsElement>(null)
  const [entries, setEntries] = useState<{ chartDigest: string; label: string; kind: string }[]>([])
  useEffect(() => {
    let active = true
    void fetch('/api/astrology/auth', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'status'})}).then(r=>r.json()).then(data=> { if(active && data.signedIn){access.setSignedIn(true);void connect(true).catch(()=> { if(active)setMessage('Signed in. Refresh your vault to restore access.') })} }).catch(()=>{})
    const open=()=>{if(panel.current){panel.current.open=true;panel.current.scrollIntoView({behavior:'smooth',block:'start'})}}
    window.addEventListener('maha-executive-open',open)
    return ()=>{active=false;window.removeEventListener('maha-executive-open',open)}
    // Restore once on mount; subsequent refreshes are explicit account actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  async function auth(operation: 'request' | 'verify' | 'logout') {
    const response=await fetch('/api/astrology/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,...(operation==='logout'?{}:{email,...(operation==='verify'?{challenge,code}:{})})})})
    const data=await response.json();if(!response.ok)throw new Error(data.error || 'Sign-in could not complete.')
    if(operation==='request'){setChallenge(data.challenge);setCode('');setMessage(data.message)}
    else if(operation==='verify'){access.setSignedIn(true);access.setAccountKey('');setCode('');setChallenge('');await connect(true)}
    else{access.setSignedIn(false);access.setAccountKey('');access.setEntitlement(null);setEntries([]);setEmail('');setCode('');setChallenge('');setMessage('Signed out.');onSignOut()}
  }
  async function run(work: () => Promise<void>) { setBusy(true); setMessage(''); try { await work() } catch (e) { setMessage(e instanceof Error ? e.message : 'Please retry.') } finally { setBusy(false) } }
  const bundle = { chart: chartInput(report), ...(secondary ? { secondary: { kind: secondary.kind, label: secondary.label, chart: chartInput(secondary.report) } } : {}), consentToStore: consent || undefined, label }
  async function refresh() { const data = await access.request({ operation: 'entitlement' }); access.setEntitlement(data.entitlement as UserAstrologyEntitlement) }
  async function connect(useEmailSession = false) {
    const sessionId = new URL(window.location.href).searchParams.get('checkout_session')
    const data = await access.request(sessionId ? { operation: 'recover', sessionId } : { operation: 'entitlement' }, useEmailSession); access.setEntitlement(data.entitlement as UserAstrologyEntitlement)
    if (sessionId) { const url = new URL(window.location.href); url.searchParams.delete('checkout_session'); window.history.replaceState(null, '', url) }
    const list = await access.request({ operation: 'list' }, useEmailSession); setEntries(list.entries as typeof entries); setMessage('Account connected. Access is verified on each request.')
  }
  async function redirect(body: Record<string, unknown>, host: string) { const data = await access.request(body); const url = new URL(String(data.url)); if (url.protocol !== 'https:' || url.hostname !== host) throw new Error('Invalid billing destination.'); window.location.assign(url.toString()) }
  const e = access.entitlement
  return <section className={s.accountPanel} aria-label="Executive account and vault"><details ref={panel}><summary>Executive access & private chart vault {e ? `· ${e.aiQueryCredits} AI credits` : ''}</summary>
    <p>One free consultation per Maha account. Executive includes live tools, 100 AI queries and one dossier per UTC calendar month. A dossier purchase includes a permanent report and chart, a 30-day platform pass and 20 AI queries during the pass.</p>
    {!access.signedIn && <form onSubmit={event=>{event.preventDefault();void run(()=>auth(challenge?'verify':'request'))}}><label>Email address<input type="email" autoComplete="email" required value={email} disabled={Boolean(challenge)||busy} onChange={event=>setEmail(event.target.value)} /></label>{challenge && <label>Six-digit sign-in code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,''))} required /></label>}<button className={s.download} disabled={busy}>{challenge?'Verify & open my vault':'Email me a sign-in code'}</button>{challenge && <button type="button" className={s.download} disabled={busy} onClick={()=>{setChallenge('');setCode('');setMessage('')}}>Change email / request a new code</button>}<p className={s.privacy}>Use the same email on future visits to restore your chart vault. Codes expire in 10 minutes. Your email is used for account access and checkout, and is not shared with the AI.</p></form>}
    {access.signedIn && <p>Signed in with email. <button className={s.download} disabled={busy} onClick={()=>void run(()=>auth('logout'))}>Sign out</button></p>}
    <details><summary>Advanced: existing API-key account</summary><form onSubmit={event => { event.preventDefault(); void run(() => connect()) }}><label>Maha account API key<input type="password" autoComplete="off" value={access.accountKey} onChange={event => { access.setAccountKey(event.target.value); access.setEntitlement(null); setEntries([]) }} required /></label><p className={s.privacy}>Existing API-key purchases remain in that account. Email sign-in creates a separate account; vaults are not automatically merged.</p><button className={s.download} disabled={busy || !access.accountKey.trim()}>Connect API-key account</button></form></details>
    {e && <p>Plan: {e.subscriptionTier.replaceAll('_', ' ')} · {e.aiQueryCredits} AI queries remaining · {e.dossierCredits} included dossiers remaining{e.passExpiresAt ? ` · Pass ends ${e.passExpiresAt.slice(0, 10)}` : ''}</p>}
    <div className={s.priceCards}>{[{ product: 'dossier', price: launchPricing ? '$49 launch' : '$79', title: 'Executive dossier', detail: 'Permanent PDF + chart · 30-day pass · 20 AI queries' }, { product: 'executive_monthly', price: launchPricing ? '$29 / month launch' : '$39 / month', title: 'Executive monthly', detail: 'Live tools · 100 AI queries/month · 1 dossier/month' }, { product: 'executive_annual', price: launchPricing ? '$199 / year launch' : '$299 / year', title: 'Executive annual', detail: 'Same monthly allowances · unlimited saved charts' }].map(p => <article key={p.product}><h4>{p.title}</h4><strong>{p.price}</strong><p>{p.detail}</p><button className={s.download} disabled={busy || !e?.checkoutConfigured || (p.product === 'dossier' ? example || !consent : e.isSubscriber)} onClick={() => void run(() => redirect({ operation: 'checkout', product: p.product, requestId: crypto.randomUUID(), ...(p.product === 'dossier' ? bundle : {}) }, 'checkout.stripe.com'))}>{p.product === 'dossier' ? 'Purchase this dossier' : 'Subscribe'}</button></article>)}</div>
    {!e?.checkoutConfigured && <p className={s.caption}>Sign in to check checkout availability. Billing requires dedicated Stripe prices and private vault encryption.</p>}
    <label>Vault label<input value={label} maxLength={80} onChange={event => setLabel(event.target.value)} /></label>
    <label className={s.chartToggle}><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> I consent to storing these birth inputs and any second chart in my private encrypted vault. Labels and purchase records are account metadata.</label>
    <div className={s.chatSuggestions}><button disabled={busy || example || !consent || !e?.isSubscriber} onClick={() => void run(async () => { await access.request({ operation: 'save', ...bundle }); const list = await access.request({ operation: 'list' }); setEntries(list.entries as typeof entries); setMessage('Chart saved.') })}>Save chart</button><button disabled={busy || example || !consent || !e?.isSubscriber} onClick={() => void run(async () => { await access.request({ operation: 'pdf', ...bundle }); await refresh(); const list = await access.request({ operation: 'list' }); setEntries(list.entries as typeof entries) })}>Generate included dossier</button><button disabled={busy || !e} onClick={() => void run(async () => { await refresh(); const list = await access.request({ operation: 'list' }); setEntries(list.entries as typeof entries) })}>Refresh vault</button><button disabled={busy || !e} onClick={() => void run(() => redirect({ operation: 'portal' }, 'billing.stripe.com'))}>Manage billing</button></div>
    {entries.map(entry => <article key={entry.chartDigest}><strong>{entry.label}</strong> · {entry.kind} <button className={s.download} disabled={busy} onClick={() => void run(async () => { const data = await access.request({ operation: 'open', digest: entry.chartDigest }); onOpen(data.report as BirthReport, data.secondary as Secondary | undefined); setMessage('Vault chart opened.') })}>Open chart</button>{entry.kind === 'dossier' && <button className={s.download} disabled={busy} onClick={() => void run(async () => { await access.request({ operation: 'pdf', digest: entry.chartDigest }) })}>Download PDF</button>}</article>)}
    {busy && <p role="status">Preparing your request…</p>}{message && <p role="status">{message}</p>}
  </details></section>
}
