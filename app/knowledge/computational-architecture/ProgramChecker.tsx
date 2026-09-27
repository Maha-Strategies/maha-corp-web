'use client'
import { useState } from 'react'
import { checkProgram, SYNTHETIC_PROGRAM } from '@/lib/architecture-program'
export default function ProgramChecker() {
  const [input, setInput] = useState(JSON.stringify(SYNTHETIC_PROGRAM, null, 2))
  const [result, setResult] = useState<ReturnType<typeof checkProgram> | null>(null)
  const [error, setError] = useState('')
  return <section aria-labelledby="program-tool" className="space-y-4 rounded border border-zinc-500 p-5">
    <h2 id="program-tool" className="text-2xl font-semibold">Try the synthetic program checker</h2>
    <p>Use anonymous floor IDs. Calculation happens in this browser; this tool does not save or submit your input. Do not paste confidential project information.</p>
    <form onSubmit={event => { event.preventDefault(); try { if (input.length > 50000) throw new Error('Input is too large.'); setResult(checkProgram(JSON.parse(input))); setError('') } catch (e) { setResult(null); setError(e instanceof Error ? e.message : 'Invalid input') } }} className="space-y-4">
      <label htmlFor="program-input" className="block font-semibold">Program JSON (m2 or ft2)</label>
      <p id="program-help">Each row needs a unique id, a positive gross area and an assignableRatio between 0 and 1. All floors use the same unit.</p>
      <textarea id="program-input" aria-describedby="program-help" spellCheck={false} rows={12} maxLength={50000} value={input} onChange={event => { setInput(event.target.value); setResult(null); setError('') }} className="w-full rounded border border-zinc-500 bg-transparent p-3 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-4" />
      <button className="rounded border border-zinc-500 px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4" type="submit">Check program</button>
    </form>
    {error && <p role="alert">{error}</p>}
    <div aria-live="polite">{result && <><h3 className="text-xl font-semibold">Arithmetic result</h3><p>Gross: {result.totals.gross.toLocaleString('en-US')} {result.inputs.unit}; assignable: {result.totals.assignable.toLocaleString('en-US')} {result.inputs.unit}; residual support: {result.totals.support.toLocaleString('en-US')} {result.inputs.unit}.</p><p>Consistent under the declared formulas—not a design approval.</p><details className="mt-4"><summary className="cursor-pointer">Inspect reproducible evidence package</summary><pre tabIndex={0} aria-label="Program evidence JSON" className="mt-3 max-w-full overflow-auto whitespace-pre-wrap break-all text-sm">{JSON.stringify(result, null, 2)}</pre></details></>}</div>
  </section>
}
