'use client'

import { FormEvent, useMemo, useState, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'book-mcp-access-purchase'
const RESTORING = 'restoring'
const books = [['the-imagined-life', 'The Imagined Life'], ['the-orbital-mind', 'The Orbital Mind'], ['the-synthetic-self', 'The Synthetic Self'], ['the-unfinished-species', 'The Unfinished Species']] as const
let revealed: string | null | undefined
function readOnce() { if (revealed === undefined) { revealed = sessionStorage.getItem(STORAGE_KEY); sessionStorage.removeItem(STORAGE_KEY) } return revealed }
const subscribe = () => () => {}

export default function BookAccessCheckout({ purchaseState }: { purchaseState?: string }) {
  const [email, setEmail] = useState(''), [bookId, setBookId] = useState<string>(books[0][0]), [loading, setLoading] = useState(false), [error, setError] = useState('')
  const stored = useSyncExternalStore(subscribe, purchaseState === 'success' ? readOnce : () => null, () => purchaseState === 'success' ? RESTORING : null)
  const purchase = useMemo(() => { if (!stored || stored === RESTORING) return null; try { return JSON.parse(stored) as { credential: string; expiresAt: string } } catch { return null } }, [stored])
  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      const response = await fetch('/api/books/public-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, bookId, clientRequestId: crypto.randomUUID() }) })
      const data = await response.json() as { checkoutUrl?: string; credential?: string; expiresAt?: string; error?: { message?: string } }
      if (!response.ok || !data.checkoutUrl || !data.credential || !data.expiresAt) throw new Error(data.error?.message ?? 'Checkout could not start.')
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ credential: data.credential, expiresAt: data.expiresAt })); window.location.assign(data.checkoutUrl)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Checkout could not start.'); setLoading(false) }
  }
  if (purchaseState === 'success') return <section className="mt-10 border border-emerald-800 bg-emerald-950/20 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">[ Payment received ]</p>{stored === RESTORING ? <p className="mt-4 text-sm text-zinc-400">Retrieving secure credential…</p> : purchase ? <Token credential={purchase.credential} expiresAt={purchase.expiresAt} /> : <p role="alert" className="mt-4 border-2 border-red-500 p-4 text-sm text-red-100">This browser no longer holds the one-time credential. It cannot be recovered; contact support with your receipt for a replacement.</p>}</section>
  return <form onSubmit={checkout} className="mt-10 border border-zinc-700 bg-zinc-950 p-6"><label className="grid gap-2 text-sm">Book<select value={bookId} onChange={(event) => setBookId(event.target.value)} className="border border-zinc-600 bg-black p-3 text-white">{books.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label><label className="mt-4 grid gap-2 text-sm">Receipt email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="border border-zinc-600 bg-black p-3 text-white" /></label><p className="mt-4 text-xs leading-relaxed text-zinc-500">Stripe displays the current price before payment. Your credential is shown once after payment and must be saved before closing this window.</p>{purchaseState === 'cancelled' && <p className="mt-3 text-sm text-amber-200">Checkout was cancelled. No credential was activated.</p>}{error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}<button disabled={loading} className="mt-5 w-full bg-white px-5 py-4 font-mono text-xs font-bold uppercase tracking-widest text-black disabled:bg-zinc-500">{loading ? 'Opening secure checkout…' : 'Purchase MCP access'}</button></form>
}

function Token({ credential, expiresAt }: { credential: string; expiresAt: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() { try { await navigator.clipboard.writeText(credential); setCopied(true) } catch { setCopied(false) } }
  return <div className="mt-5"><div role="alert" className="border-2 border-red-500 bg-red-950/40 p-4 text-sm text-red-100"><strong>Save this credential immediately.</strong> It is displayed once and cannot be recovered after this window closes.</div><code className="mt-4 block select-all break-all border border-zinc-700 bg-black p-4 text-white">{credential}</code><button type="button" onClick={copy} className="mt-4 bg-white px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-black">{copied ? 'Copied!' : 'Copy API Access Token'}</button><p className="mt-3 text-xs text-zinc-500">Activates after Stripe confirms payment. Expires {new Date(expiresAt).toLocaleDateString()}.</p></div>
}
