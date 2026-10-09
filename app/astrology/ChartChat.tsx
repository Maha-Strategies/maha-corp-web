'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { BirthReport } from '@/lib/birth-report'
import MarkdownAnswer from './MarkdownAnswer'
import ComputationTrace from './ComputationTrace'
import type { ComputationRecord } from '@/lib/astrology-computation'
import { chartInput, type Secondary } from './ExecutiveAccess'
import type { ChatSource } from '@/lib/astrology-chat'
import s from './astrology.module.css'
import { ORBITAL_LENSES, type OrbitalCheckIn, type OrbitalLensId } from '@/lib/orbital-mind'

type ChatMessage = { role: 'user' | 'assistant'; content: string; sources?: ChatSource[]; computations?: ComputationRecord[] }
const suggestions = ['Analyze Jupiter’s transit through my natal houses. What planning questions does it suggest, and what evidence should guide action?', 'Which classical yoga screens match my chart, and what conditions or source reviews remain incomplete?', 'Compare my chart with the supplied corporate inception chart. Explain the structural overlaps and their interpretive limits.', 'Turn the current period and transit geometry into a reversible operational experiment with a stop rule.']

export default function ChartChat({ report, example, initialOrbital, accountKey, secondary, transitInstantUtc }: { report: BirthReport; example: boolean; initialOrbital?: OrbitalCheckIn; accountKey: string; secondary?: Secondary; transitInstantUtc?: string }) {
  const id = useId()
  const [engine, setEngine] = useState<'companion' | 'computation' | 'gemini'>('gemini')
  const [openAiConsent, setOpenAiConsent] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState(initialOrbital ? 'Help me explore both needs in this Orbital Mind lens and choose a manageable next step.' : '')
  const [orbitalMode, setOrbitalMode] = useState(Boolean(initialOrbital))
  const [lensId, setLensId] = useState<OrbitalLensId | null>(initialOrbital?.lensId ?? null)
  const [notes, setNotes] = useState(initialOrbital ? { situation: initialOrbital.situation, outcome: initialOrbital.outcome } : { situation: '', outcome: '' })
  const [includeAdvanced, setIncludeAdvanced] = useState(false)
  const [includeChart, setIncludeChart] = useState(!initialOrbital)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const input = useRef<HTMLTextAreaElement | null>(null)
  const latest = useRef<HTMLDivElement | null>(null)
  useEffect(() => () => { controller.current?.abort() }, [])
  useEffect(() => { if (messages.length) latest.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [messages.length])

  function clear() {
    generation.current += 1; controller.current?.abort()
    setMessages([]); setBusy(false); setError(''); setQuestion(''); setNotes({ situation: '', outcome: '' })
    input.current?.focus()
  }
  async function ask() {
    const text = question.trim()
    if (!text || busy || (engine !== 'companion' && !openAiConsent)) return
    const requestId = ++generation.current
    const abort = new AbortController()
    controller.current = abort
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/astrology/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(accountKey.trim() ? { Authorization: `Bearer ${accountKey.trim()}` } : {}) }, signal: abort.signal,
        body: JSON.stringify({
          question: text, example, engine, consentToGoogle: engine === 'gemini' && openAiConsent, consentToOpenAi: engine === 'computation' && openAiConsent,
          ...(includeChart && includeAdvanced && secondary ? { secondary: { kind: secondary.kind, label: secondary.label, chart: chartInput(secondary.report) } } : {}),
          ...(includeChart && includeAdvanced && transitInstantUtc ? { transitInstantUtc } : {}),
          orbital: orbitalMode ? { lensId, ...notes } : null,
          history: messages.slice(-6).map(message => ({ role: message.role, content: message.content.slice(0, 2000) })),
          chart: includeChart ? { instantUtc: report.instantUtc, latitudeDegrees: report.latitudeDegrees, longitudeDegrees: report.longitudeDegrees,
            uncertaintyMinutes: report.foundation.sensitivity.uncertaintyMinutes, referenceInstantUtc: report.timing.referenceInstantUtc } : null,
        }),
      })
      const payload = await response.json()
      if (requestId !== generation.current) return
      if (!response.ok) { setError(typeof payload.error === 'string' ? payload.error : 'The assistant could not answer. Please try again.'); return }
      if (typeof payload.answer !== 'string' || !payload.answer.trim()) throw new Error('invalid_answer')
      setMessages(previous => [...previous, { role: 'user', content: text }, { role: 'assistant', content: payload.answer, sources: payload.sources, computations: payload.computations }])
      setQuestion('')
    } catch {
      if (requestId === generation.current) setError('The assistant could not connect. Your question is still here; please try again.')
    } finally { if (requestId === generation.current) setBusy(false) }
  }

  return <section className={`${s.reading} ${s.chat}`} aria-label="AI chart companion">
    <p className={s.eyebrow}>A CONVERSATION, AT YOUR PACE</p>
    <div className={s.chatHeading}><h3>Ask what’s on your mind.</h3><button type="button" className={s.download} onClick={clear}>Clear chat</button></div>
    <p>Ask about a placement, explore a reading, or bring a broader question. You can follow up and ask for a simpler explanation.</p>
    <label className={s.companionMode}>AI connection<select value={engine} disabled={busy} onChange={event => { setEngine(event.target.value as 'companion' | 'computation' | 'gemini'); setOpenAiConsent(false); setMessages([]); setError('') }}><option value="gemini">Gemini 3.8 Flash</option><option value="companion">Claude companion</option><option value="computation">OpenAI computation</option></select></label>
    {engine === 'computation' && <p>Ask for chart calculations or arithmetic in natural language. Executed tools return a visible computation record. Selected transit and comparison calculations retain Executive access requirements.</p>}
    {example && includeChart && <p className={s.chatContext}>You’re exploring the fictional example chart. Calculate your own chart to ask about your personal placements.</p>}
    <label htmlFor={`${id}-mode`} className={s.companionMode}>Conversation lens<select aria-label="Conversation lens" id={`${id}-mode`} value={orbitalMode ? 'orbital' : 'general'} disabled={busy} onChange={event => { setOrbitalMode(event.target.value === 'orbital'); setMessages([]); setError(''); setIncludeChart(false) }}><option value="general">Chart & general questions</option><option value="orbital">The Orbital Mind</option></select></label>
    {orbitalMode && <div className={s.chatContext}><p>Explore interacting needs through the book’s reflection framework. Your selected experience guides the lens; the chart does not diagnose it.</p><label htmlFor={`${id}-lens`} className={s.companionMode}>Orbital lens<select aria-label="Orbital lens" id={`${id}-lens`} value={lensId ?? ''} disabled={busy} onChange={event => { setLensId((event.target.value || null) as OrbitalLensId | null); setMessages([]); setError('') }}><option value="">Let my question guide the source selection</option>{ORBITAL_LENSES.map(lens => <option value={lens.id} key={lens.id}>{lens.functions}</option>)}</select></label>
    {(notes.situation || notes.outcome) && <details open><summary>Check-in notes to share</summary>{notes.situation && <p>Situation: {notes.situation}</p>}{notes.outcome && <p>What happened: {notes.outcome}</p>}<button type="button" disabled={busy} className={s.focusButton} onClick={() => { setNotes({ situation: '', outcome: '' }); setMessages([]) }}>Remove notes from chat</button></details>}</div>}
    {messages.length === 0 && <div className={s.chatSuggestions} aria-label="Suggested questions">{(orbitalMode ? ['Explain the five Orbital Mind lenses.', 'Help me turn this tension into a small experiment.', 'How can I review what happened without judging myself?'] : suggestions).map(text => <button type="button" key={text} disabled={busy} onClick={() => { setQuestion(text); if (!orbitalMode) { setIncludeChart(true); if (secondary || transitInstantUtc) setIncludeAdvanced(true) }; input.current?.focus() }}>{text}</button>)}</div>}
    <div className={s.chatMessages} role="log" aria-label="Conversation">
      {messages.map((message, index) => <article key={index} className={message.role === 'user' ? s.userMessage : s.aiMessage}>
        <small>{message.role === 'user' ? 'YOU' : 'MAHA · AI GENERATED'}</small>
        {message.role === 'assistant' ? <MarkdownAnswer text={message.content} /> : <p>{message.content}</p>}
        <ComputationTrace records={message.computations} />
        {message.sources && message.sources.length > 0 && <details><summary>Sources referenced</summary>{message.sources.map(source => <p key={source.number}><a href={source.url} target="_blank" rel="noreferrer">[{source.number}] {source.title} ↗</a> · {source.locator}</p>)}</details>}
      </article>)}
      <div ref={latest} />
    </div>
    <form onSubmit={event => { event.preventDefault(); void ask() }} className={s.chatForm}>
      <label htmlFor={`${id}-question`}>Your question</label>
      <textarea id={`${id}-question`} ref={input} value={question} onChange={event => setQuestion(event.target.value)} maxLength={1500} rows={4} disabled={busy} placeholder="Ask about your chart, a life question, or something you’d like to understand…" required />
      <label className={s.chartToggle}><input type="checkbox" checked={includeChart} disabled={busy} onChange={event => { setIncludeChart(event.target.checked); setMessages([]); setError('') }} /> Include {example ? 'example' : 'my'} chart facts</label>
      {engine !== 'companion' && <label className={s.chartToggle}><input type="checkbox" checked={openAiConsent} disabled={busy} onChange={event => setOpenAiConsent(event.target.checked)} /> I agree to send this question, recent conversation and selected chart context to Maha and {engine === 'gemini' ? 'Google (Gemini)' : 'OpenAI'} for explanation.</label>}
      <p className={s.privacy}>Sending shares your question, recent messages and optional chart facts and any displayed check-in notes with {engine === 'gemini' ? 'Google (Gemini)' : engine === 'computation' ? 'OpenAI' : 'Claude'}. Maha does not save this conversation. AI-generated explanations can be mistaken.</p>
      {(secondary || transitInstantUtc) && <label className={s.chartToggle}><input type="checkbox" checked={includeAdvanced} disabled={busy || !includeChart} onChange={e => { setIncludeAdvanced(e.target.checked); setMessages([]) }} /> Include the compared second chart and selected transit date (Executive access required)</label>}
      <p className={s.privacy}>Sign in with your email above. One free query per account; Executive includes 100 per UTC calendar month. A dossier pass includes 20 queries during its 30 days.</p>
      <p className={s.privacy}>AI replies use a paid API. Usage is billed to the app’s selected provider account. Computation can require multiple API calls, bounded by the server; each follow-up consumes a consultation.</p>
      <div className={s.chatSend}><small>{question.length} / 1500</small><button type="submit" disabled={busy || !question.trim() || (engine !== 'companion' && !openAiConsent)} className={s.primary}>{busy ? 'Thinking…' : 'Ask AI'} <span aria-hidden="true">↗</span></button></div>
      {busy && <p role="status" className={s.placeStatus}>Preparing an answer…</p>}
      {error && <p role="alert" className={s.error}>{error}</p>}
    </form>
  </section>
}
