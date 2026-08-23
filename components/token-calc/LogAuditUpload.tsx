'use client'

import { FormEvent, useMemo, useRef, useState } from 'react'

const MAX_AUDIT_BYTES = 10 * 1024 * 1024
const INPUT_COST_PER_MILLION = 2.5
const COMPRESSION_FACTOR = 0.45
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

type AuditResult = { requestCount: number; tokens: number; rawMonthlySpend: number; compressedMonthlySpend: number; monthlySavings: number; pilotRoi: number }

function textFromContent(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((part) => typeof part === 'object' && part !== null && typeof (part as Record<string, unknown>).text === 'string' ? (part as Record<string, unknown>).text : '').filter(Boolean).join('\n')
  return ''
}

function promptText(value: unknown, found: Set<string>, seen: Set<object>) {
  if (!value || typeof value !== 'object') return
  if (seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) { value.forEach((entry) => promptText(entry, found, seen)); return }
  const object = value as Record<string, unknown>
  if (Array.isArray(object.messages)) {
    const transcript = object.messages.map((message) => {
      if (!message || typeof message !== 'object') return ''
      const record = message as Record<string, unknown>
      return textFromContent(record.content)
    }).filter(Boolean).join('\n')
    if (transcript) found.add(transcript)
  }
  for (const [key, child] of Object.entries(object)) {
    if (key === 'messages') continue
    if ((key === 'prompt' || key === 'input' || key === 'content') && typeof child === 'string' && child.trim()) found.add(child)
    if (typeof child === 'object' && child !== null) promptText(child, found, seen)
  }
}

function parseLog(fileText: string, name: string): string[] {
  const parsed = name.toLowerCase().endsWith('.jsonl')
    ? fileText.split(/\r?\n/).filter(Boolean).map((line, index) => { try { return JSON.parse(line) } catch { throw new Error(`Line ${index + 1} is not valid JSON.`) } })
    : [JSON.parse(fileText)]
  const found = new Set<string>()
  parsed.forEach((entry) => promptText(entry, found, new Set<object>()))
  return [...found]
}

function estimateTokens(value: string) { return Math.ceil(value.length / (/^\s*[{[]/.test(value) ? 3.5 : 4)) }

export function LogAuditUpload() {
  const input = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<AuditResult | null>(null)
  const [error, setError] = useState('')
  const [months, setMonths] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const auditContext = useMemo(() => result ? `${number.format(result.tokens)} estimated input tokens/month; ${money.format(result.monthlySavings)} projected monthly savings.` : '', [result])

  async function audit(file: File) {
    setError(''); setResult(null); setSubmitted(false)
    if (!/\.(jsonl|json)$/i.test(file.name)) { setError('Choose a .jsonl or .json request-log export.'); return }
    if (file.size > MAX_AUDIT_BYTES) { setError('For responsive local analysis, limit a log file to 10 MB.'); return }
    try {
      const prompts = parseLog(await file.text(), file.name)
      if (!prompts.length) throw new Error('No prompt messages were found. Expected messages[], prompt, input, or content fields.')
      const tokens = prompts.reduce((total, prompt) => total + estimateTokens(prompt), 0)
      const rawMonthlySpend = (tokens / Math.max(1, months)) / 1_000_000 * INPUT_COST_PER_MILLION
      const compressedMonthlySpend = rawMonthlySpend * COMPRESSION_FACTOR
      const monthlySavings = rawMonthlySpend - compressedMonthlySpend
      const pilotRoi = ((monthlySavings * 12 - 5_000) / 5_000) * 100
      setResult({ requestCount: prompts.length, tokens: Math.round(tokens / Math.max(1, months)), rawMonthlySpend, compressedMonthlySpend, monthlySavings, pilotRoi })
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'This file could not be read as a JSON request export.') }
  }

  function chooseFile() { input.current?.click() }
  function drop(event: React.DragEvent<HTMLButtonElement>) { event.preventDefault(); const file = event.dataTransfer.files.item(0); if (file) void audit(file) }
  function submitPilot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // This modal deliberately captures only the opted-in commercial contact
    // details locally. The user chooses whether to transmit them through email.
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const monthlySpend = String(form.get('monthlySpend') ?? '').trim()
    if (!email || !monthlySpend) return
    const subject = encodeURIComponent('Maha $5,000 Enterprise Pilot Key')
    const body = encodeURIComponent(`Company email: ${email}\nMonthly token spend: ${monthlySpend}\nAudit summary: ${auditContext}\n\nPlease contact me about an enterprise pilot key.`)
    window.location.href = `mailto:enterprise@mahastrategies.com?subject=${subject}&body=${body}`
    setSubmitted(true)
  }

  return <section className="mt-8 border border-indigo-900/70 bg-indigo-950/10 p-6" aria-labelledby="log-audit-heading">
    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">Enterprise ROI auditor / browser-local</p>
    <h2 id="log-audit-heading" className="mt-3 text-2xl font-light text-[var(--text-primary)]">Audit a request-log export without uploading it.</h2>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">Drop an OpenAI-style JSONL export or LangChain/LangSmith JSON trace. Parsing and estimates stay in this browser. Select how many months the file represents to normalize the dashboard.</p>
    <div className="mt-5 flex flex-wrap items-end gap-4"><label className="text-sm text-[var(--text-secondary)]">Months represented<input type="number" min="1" max="120" value={months} onChange={(event) => setMonths(Math.max(1, Math.min(120, Number(event.target.value) || 1)))} className="ml-3 w-20 border border-[var(--border-strong)] bg-[var(--surface-paper)] px-2 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-300" /></label></div>
    <input ref={input} className="sr-only" type="file" accept=".jsonl,.json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void audit(file) }} />
    <button type="button" onClick={chooseFile} onDragOver={(event) => event.preventDefault()} onDrop={drop} className="mt-6 flex min-h-32 w-full items-center justify-center border border-dashed border-indigo-700 bg-[var(--surface-subtle)] px-5 text-center text-sm text-[var(--status-sourced)] hover:border-indigo-300">Drop .jsonl / .json here, or choose a local file</button>
    {error && <p className="mt-4 text-sm text-[var(--status-unverified)]">{error}</p>}
    {result && <div className="mt-7"><p className="text-xs text-[var(--text-muted)]">{number.format(result.requestCount)} request records · {number.format(result.tokens)} estimated input tokens/month · illustrative GPT-4o-style input rate</p><div className="mt-4 grid gap-3 md:grid-cols-3"><article className="border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4"><p className="font-mono text-[10px] uppercase text-[var(--text-muted)]">Raw historical spend</p><p className="mt-2 text-2xl text-[var(--text-primary)]">{money.format(result.rawMonthlySpend)} <span className="text-sm text-[var(--text-muted)]">/ mo</span></p></article><article className="border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4"><p className="font-mono text-[10px] uppercase text-[var(--text-muted)]">Compressed spend with Maha</p><p className="mt-2 text-2xl text-[var(--status-verified)]">{money.format(result.compressedMonthlySpend)} <span className="text-sm text-[var(--text-muted)]">/ mo</span></p></article><article className="border border-emerald-900 bg-[var(--surface-verified)] p-4"><p className="font-mono text-[10px] uppercase text-[var(--status-verified)]">Net savings & ROI</p><p className="mt-2 text-xl text-[var(--text-primary)]">Saved {money.format(result.monthlySavings)} / mo</p><p className="mt-1 text-xs text-[var(--status-verified)]">{result.pilotRoi.toFixed(0)}% first-year ROI on a $5k pilot</p></article></div><p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">Planning estimate only: a 55% input-token reduction scenario. Validate task quality, output-token spend, provider pricing, and log period before committing budget.</p><button type="button" onClick={() => setModalOpen(true)} className="mt-6 bg-indigo-300 px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-black hover:bg-indigo-200">Claim your $5,000 guaranteed enterprise pilot key →</button></div>}
    {modalOpen && <div role="dialog" aria-modal="true" aria-label="Enterprise pilot inquiry" className="mt-6 border border-indigo-500 bg-[var(--surface-paper)] p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="text-lg text-[var(--text-primary)]">Enterprise pilot inquiry</h3><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Your audit file stays local. Submit only the contact details below through your email client.</p></div><button type="button" onClick={() => setModalOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]" aria-label="Close">×</button></div>{submitted ? <p className="mt-5 text-sm text-[var(--status-verified)]">Your email client was opened with the inquiry details. Send it when ready.</p> : <form onSubmit={submitPilot} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm text-[var(--text-secondary)]">Company email<input name="email" type="email" required className="mt-2 w-full border border-[var(--border-strong)] bg-[var(--surface-paper)] px-3 py-2 text-[var(--text-primary)] outline-none focus:border-indigo-300" /></label><label className="text-sm text-[var(--text-secondary)]">Monthly token spend<input name="monthlySpend" required defaultValue={result ? money.format(result.rawMonthlySpend) : ''} className="mt-2 w-full border border-[var(--border-strong)] bg-[var(--surface-paper)] px-3 py-2 text-[var(--text-primary)] outline-none focus:border-indigo-300" /></label><button className="bg-indigo-300 px-4 py-3 font-mono text-xs font-bold uppercase tracking-widest text-black sm:col-span-2">Prepare opted-in inquiry →</button></form>}</div>}
  </section>
}
