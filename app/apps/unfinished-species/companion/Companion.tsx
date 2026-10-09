'use client'
import Link from 'next/link'
import { useState, useRef, type FormEvent } from 'react'
import { ATLAS_PATH } from '@/lib/unfinished-atlas'
import type { CompanionResult } from '@/lib/unfinished-atlas-companion'
import { Icon } from '../Visuals'
import s from '../atlas.module.css'
const prompts = ['What can AI actually do with proteins?', 'Does epigenetics mean we can rewrite our DNA?', 'How close are we to a virtual cell?', 'What does biological sovereignty mean?']
export default function Companion({ aiEnabled, topic }: { aiEnabled:boolean; topic?:{ slug:string; subtitle:string } }) {
  const [question,setQuestion] = useState(topic ? 'What is possible with ' + topic.subtitle.toLowerCase() + '?' : '')
  const [activeTopic,setActiveTopic] = useState(topic)
  const [mode,setMode] = useState<'source-guide' | 'ai'>('source-guide')
  const [consent,setConsent] = useState(false)
  const [result,setResult] = useState<CompanionResult | null>(null)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [asked,setAsked] = useState('')
  const controller = useRef<AbortController | null>(null)
  const input = useRef<HTMLTextAreaElement | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setResult(null); setAsked(question.trim())
    const abort = new AbortController(); controller.current = abort
    const timeout = setTimeout(() => abort.abort(),40000)
    try {
      const response = await fetch('/api/unfinished-species/companion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,mode,consent,...(activeTopic ? {topic:activeTopic.slug} : {})}),signal:abort.signal})
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'The companion could not answer.')
      setResult(data)
    } catch (failure) { setError(failure instanceof Error && failure.name === 'AbortError' ? 'The request was cancelled or timed out. You can try again.' : failure instanceof Error ? failure.message : 'The request could not be completed.') }
    finally { clearTimeout(timeout); controller.current = null; setBusy(false) }
  }
  return <>
    <div className={s.promptGrid}>{prompts.map(prompt => <button disabled={busy} key={prompt} onClick={() => {setQuestion(prompt); setActiveTopic(undefined); input.current?.focus()}}>{prompt} ↗</button>)}</div>
    <div className={s.filters}><div className={s.segments} aria-label="Companion mode"><button disabled={busy} aria-pressed={mode === 'source-guide'} onClick={() => setMode('source-guide')}>Source guide</button><button disabled={busy || !aiEnabled} aria-pressed={mode === 'ai'} onClick={() => setMode('ai')}>AI answer {aiEnabled ? '' : '· not configured'}</button></div>{activeTopic && <button className={s.secondary} disabled={busy} onClick={() => setActiveTopic(undefined)} aria-label="Clear topic context">{activeTopic.subtitle} ×</button>}</div>
    {mode === 'ai' && <label className={s.consent}><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />I agree to send my question and retrieved book/brief context to Anthropic for an AI answer. Please avoid personal health or confidential information.</label>}
    <form className={s.questionForm} onSubmit={submit}><label className={s.eyebrow} htmlFor="atlas-question">YOUR QUESTION</label><textarea ref={input} id="atlas-question" placeholder="What would you like to understand?" maxLength={1500} required disabled={busy} value={question} onChange={event => setQuestion(event.target.value)} /><div className={s.formFoot}><small>{question.length}/1,500 · {mode === 'ai' ? 'AI-generated · check cited sources' : 'Retrieves the book and curated topic briefs'}</small><div className={s.actions} style={{marginTop:0}}>{busy && <button type="button" className={s.secondary} onClick={() => controller.current?.abort()}>Cancel</button>}<button className={s.primary} disabled={busy || !question.trim() || (mode === 'ai' && !consent)}>{busy ? 'Finding the evidence…' : mode === 'ai' ? 'Ask the companion' : 'Find sources'}<Icon name="arrow" size={16} /></button></div></div></form>
    {error && <p role="alert" className={s.error}>{error}</p>}
    <div role="status" aria-live="polite" className={s.toast}>{busy ? 'Request in progress.' : result ? 'Your source-grounded response is ready below.' : ''}</div>
    {result && <section aria-label="Companion response"><div className={s.sectionHeader}><h2>{result.mode === 'ai-generated' ? 'A sourced AI answer' : 'A guide to the evidence'}</h2><span className={s.eyebrow}>{result.mode === 'ai-generated' ? 'AI-generated · verify claims' : 'Retrieved material · not AI-generated'}</span></div><div className={s.panel}><p className={s.eyebrow}>YOU ASKED</p><h3>{asked}</h3><p className={s.answer}>{result.answer}</p>{result.topics.map(item => <Link key={item.slug} className={s.asideLink} href={ATLAS_PATH + '/topics/' + item.slug}>Explore: {item.title} ↗</Link>)}</div><div className={s.panel}><p className={s.eyebrow}>RETRIEVED SOURCES &amp; BOOK PASSAGES</p>{result.sources.map(source => <div key={source.number}><a className={s.source} href={source.url} target={source.url.startsWith('/') ? undefined : '_blank'} rel={source.url.startsWith('/') ? undefined : 'noreferrer'}>[{source.number}] {source.title} ↗<small>{source.kind}</small></a>{source.excerpt && <blockquote className={s.excerpt}>{source.excerpt}</blockquote>}</div>)}</div></section>}
    <p className={s.bottomNote}>The source guide matches words in your question to curated briefs and manuscript passages. It may miss relevant material. It does not browse the web. Questions and responses are not saved by this app; AI provider processing policies apply when you choose AI mode. Saved topics use this browser’s local storage.</p>
  </>
}
