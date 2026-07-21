'use client'

import { useEffect, useRef, useState } from 'react'

const MAX_BATCH = 20
const MIN_CHARS = 12
const STORAGE_PREFIX = 'maha_receipt_run:'

// Client-side image rules. Original file capped at 10 MB; every image is
// re-encoded to JPEG on a canvas (which strips EXIF/GPS metadata) and shrunk to
// stay under the 8 MB upload cap before it ever leaves the browser.
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 2000

type RunResultRow = { index: number; source?: 'image' | 'text'; feasible: boolean; confidence?: number; note?: string; merchant?: string | null; rowCount?: number }
type RunResult = { delivered: boolean; refunded?: boolean; note?: string; csv?: string; receiptCount?: number; rowCount?: number; results: RunResultRow[] }
type PendingImage = { id: string; name: string; previewUrl: string; blob: Blob }

type Phase = 'compose' | 'redirecting' | 'running' | 'done' | 'refunded' | 'cancelled' | 'missing' | 'error'

function storageKey(checkoutId: string) {
  return `${STORAGE_PREFIX}${checkoutId}`
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Encode failed.'))), 'image/jpeg', quality))
}

// Decode, bake in EXIF orientation, downscale, and re-encode to JPEG. Re-encoding
// on the canvas discards all original metadata (EXIF, GPS). Never uploads the
// original bytes.
async function reencodeToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) { bitmap.close(); throw new Error('This browser cannot process images.') }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  let quality = 0.82
  let blob = await canvasToJpeg(canvas, quality)
  while (blob.size > MAX_UPLOAD_BYTES && quality > 0.4) {
    quality -= 0.15
    blob = await canvasToJpeg(canvas, quality)
  }
  return blob
}

export default function ReceiptBatch() {
  const [receipts, setReceipts] = useState<string[]>([''])
  const [images, setImages] = useState<PendingImage[]>([])
  const [phase, setPhase] = useState<Phase>('compose')
  const [error, setError] = useState('')
  const [runResult, setRunResult] = useState<RunResult | null>(null)
  const startedRef = useRef(false)

  // On return from Stripe, run the batch we stashed in the browser before redirect.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const purchase = params.get('purchase')
    if (purchase === 'cancelled') { setPhase('cancelled'); return }
    if (purchase !== 'success') return
    if (startedRef.current) return
    startedRef.current = true

    const checkoutId = params.get('checkout')
    if (!checkoutId) { setPhase('error'); setError('This success link is missing its run reference.'); return }
    const key = storageKey(checkoutId)
    const stored = sessionStorage.getItem(key)
    if (!stored) { setPhase('missing'); return }
    let stashed: string[]
    try {
      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed) || parsed.some((r) => typeof r !== 'string')) throw new Error('bad')
      stashed = parsed
    } catch { setPhase('error'); setError('The stored receipts for this run were unreadable.'); return }

    void runBatch(checkoutId, stashed, key)
  }, [])

  async function runBatch(checkoutId: string, batch: string[], key: string, paymentRetries = 0) {
    setPhase('running'); setError('')
    try {
      const response = await fetch('/api/utilities/receipts/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checkoutId, receipts: batch }),
      })
      const data = await response.json() as RunResult & { error?: string }
      // Stripe can redirect before its signed webhook marks this checkout paid.
      // Keep the browser-held receipts and retry briefly; the run endpoint has
      // not claimed the single-use token while it returns 402.
      if (response.status === 402 && paymentRetries < 6) {
        window.setTimeout(() => { void runBatch(checkoutId, batch, key, paymentRetries + 1) }, 2_000)
        return
      }
      // Keep the stash on transient failures and on a still-unconfirmed payment
      // so a later reload can retry. A claimed-then-crashed run remains safe:
      // the server-side token is single-use and cannot double-charge.
      if (response.status < 500 && response.status !== 402) sessionStorage.removeItem(key)

      if (response.status === 422 && data.refunded) { setRunResult(data); setPhase('refunded'); return }
      if (!response.ok) {
        setError(response.status === 402 ? 'Stripe is still confirming payment. Wait a moment, then reload this page to retry.' : data.error ?? 'The batch run could not be completed.')
        setPhase('error'); return
      }
      setRunResult(data); setPhase('done')
    } catch {
      setError('Could not reach the batch runner. Reload this page to retry.')
      setPhase('error')
    }
  }

  // Upload each re-encoded image to its private, single-use signed URL. Images go
  // directly to storage — never through our API, sessionStorage, or the URL.
  // Returns the server-owned draft id the checkout is bound to.
  async function uploadImages(): Promise<string | undefined> {
    let draftId: string | undefined
    for (const image of images) {
      const prepared = await fetch('/api/utilities/receipts/uploads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, contentType: image.blob.type || 'image/jpeg', byteSize: image.blob.size }),
      })
      const data = await prepared.json() as { draftId?: string; uploadUrl?: string; error?: string }
      if (!prepared.ok || !data.draftId || !data.uploadUrl) throw new Error(data.error ?? 'An image upload could not be prepared.')
      draftId = data.draftId
      const put = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': image.blob.type || 'image/jpeg' }, body: image.blob })
      if (!put.ok) throw new Error('An image failed to upload. Try again.')
    }
    return draftId
  }

  async function payAndRun() {
    const cleaned = receipts.map((r) => r.trim()).filter((r) => r.length > 0)
    if (cleaned.some((r) => r.length < MIN_CHARS)) { setError(`Each pasted receipt needs ${MIN_CHARS}+ characters.`); return }
    if (cleaned.length === 0 && images.length === 0) { setError('Add at least one receipt — paste text or upload a photo.'); return }
    if (cleaned.length + images.length > MAX_BATCH) { setError(`A single run accepts at most ${MAX_BATCH} receipts across images and text.`); return }

    setPhase('redirecting'); setError('')
    try {
      const draftId = await uploadImages()
      const clientRequestId = crypto.randomUUID()
      const response = await fetch('/api/utilities/receipts/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utility: 'receipts-to-csv', clientRequestId, draftId }),
      })
      const data = await response.json() as { checkoutId?: string; checkoutUrl?: string; error?: { message?: string } }
      if (!response.ok || !data.checkoutId || !data.checkoutUrl) {
        setError(data.error?.message ?? 'Batch runs are not available right now.'); setPhase('compose'); return
      }
      // Hold only the TEXT receipts in this browser across the Stripe redirect —
      // images already live in private storage, bound to the checkout server-side.
      sessionStorage.setItem(storageKey(data.checkoutId), JSON.stringify(cleaned))
      window.location.href = data.checkoutUrl
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not start secure checkout. Try again.')
      setPhase('compose')
    }
  }

  function updateReceipt(index: number, value: string) {
    setReceipts((prev) => prev.map((r, i) => (i === index ? value : r)))
  }
  function addReceipt() {
    setReceipts((prev) => (prev.length >= MAX_BATCH ? prev : [...prev, '']))
  }
  function removeReceipt(index: number) {
    setReceipts((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const textReadyCount = receipts.map((r) => r.trim()).filter((r) => r.length >= MIN_CHARS).length

  async function addImageFiles(files: FileList | null) {
    if (!files?.length) return
    setError('')
    const room = MAX_BATCH - (textReadyCount + images.length)
    const accepted: PendingImage[] = []
    for (const file of Array.from(files)) {
      if (accepted.length >= room) { setError(`A single run accepts at most ${MAX_BATCH} receipts across images and text.`); break }
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) { setError('Only JPG, PNG, or WebP images are supported (HEIC and PDF are not).'); continue }
      if (file.size > MAX_ORIGINAL_BYTES) { setError('Each image must be 10 MB or smaller.'); continue }
      try {
        const blob = await reencodeToJpeg(file)
        accepted.push({ id: crypto.randomUUID(), name: file.name, previewUrl: URL.createObjectURL(blob), blob })
      } catch { setError('That image could not be processed. Try a different photo.') }
    }
    if (accepted.length) setImages((prev) => [...prev, ...accepted])
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((image) => image.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((image) => image.id !== id)
    })
  }

  function downloadCsv() {
    if (!runResult?.csv) return
    const blob = new Blob([runResult.csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'receipts-batch.csv'; anchor.click()
    URL.revokeObjectURL(url)
  }

  const totalReady = textReadyCount + images.length

  // ---- Return-trip states (after Stripe redirect) ----
  if (phase === 'running') {
    return (
      <BatchShell>
        <p className="font-mono text-sm text-emerald-300">Running your batch… converting receipts to CSV.</p>
        <p className="mt-2 text-sm text-zinc-500">This can take a few seconds per receipt. Please don&apos;t close the tab.</p>
      </BatchShell>
    )
  }
  if (phase === 'done' && runResult) {
    return (
      <BatchShell>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-widest text-emerald-300">
            {runResult.receiptCount} of {runResult.results.length} receipts parsed · {runResult.rowCount} rows
          </p>
          <button type="button" onClick={downloadCsv} className="bg-white px-5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-widest text-black hover:bg-zinc-200">
            Download batch CSV ↓
          </button>
        </div>
        <ul className="mt-5 space-y-2 text-sm">
          {runResult.results.map((row) => (
            <li key={row.index} className="flex items-start gap-3 border-b border-zinc-800/70 pb-2">
              <span className={`mt-0.5 font-mono text-[10px] uppercase tracking-widest ${row.feasible ? 'text-emerald-300' : 'text-amber-300'}`}>
                #{row.index + 1}{row.source ? ` ${row.source}` : ''} {row.feasible ? 'ok' : 'skipped'}
              </span>
              <span className="text-zinc-400">
                {row.feasible
                  ? `${row.merchant ?? 'unknown merchant'} · ${row.rowCount} rows · ${Math.round((row.confidence ?? 0) * 100)}% confidence`
                  : (row.note ?? 'Not a parseable receipt — excluded, not charged for.')}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs text-zinc-500">Receipts that couldn&apos;t be parsed were excluded from the CSV. You were only charged because at least one parsed.</p>
      </BatchShell>
    )
  }
  if (phase === 'refunded') {
    return (
      <BatchShell tone="amber">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-amber-300">Automatically refunded</p>
        <p className="mt-2 text-sm leading-relaxed text-amber-100">
          {runResult?.note ?? 'None of the submitted receipts could be parsed, so your payment was refunded in full.'} Refunds settle back to your card in a few business days.
        </p>
      </BatchShell>
    )
  }
  if (phase === 'cancelled') {
    return (
      <BatchShell tone="amber">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-amber-300">Checkout cancelled</p>
        <p className="mt-2 text-sm text-amber-100">No payment was taken. You can start a new batch below.</p>
        <button type="button" onClick={() => { setPhase('compose'); setError('') }} className="mt-4 bg-emerald-400 px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-widest text-black hover:bg-emerald-300">
          Start a new batch →
        </button>
      </BatchShell>
    )
  }
  if (phase === 'missing') {
    return (
      <BatchShell tone="amber">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-amber-300">Receipts not found in this browser</p>
        <p className="mt-2 text-sm leading-relaxed text-amber-100">
          Your payment went through, but the receipts for this run were held in the browser you started from and aren&apos;t here — likely a different device or a cleared session. If a run never completed, the charge is auto-refunded. Contact us if you need help.
        </p>
      </BatchShell>
    )
  }
  if (phase === 'error') {
    return (
      <BatchShell tone="amber">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-amber-300">Something went wrong</p>
        <p className="mt-2 text-sm text-amber-100">{error || 'The batch run could not be completed.'}</p>
      </BatchShell>
    )
  }

  // ---- Compose state ----
  return (
    <BatchShell>
      <p className="font-mono text-[11px] uppercase tracking-widest text-emerald-300">Paid batch · up to {MAX_BATCH} receipts</p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Upload receipt photos or paste text — mix both, up to {MAX_BATCH} total. You pay once on Stripe, then the batch
        runs and downloads as a single CSV. Receipts that aren&apos;t parseable are excluded — and if <em>none</em> parse,
        the payment is refunded automatically. You&apos;ll see the exact price on the secure Stripe checkout before paying.
      </p>

      {/* Image uploads */}
      <div className="mt-6">
        <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Receipt photos (JPG, PNG, WebP · up to 10 MB each)</label>
        <div className="mt-2">
          <input
            type="file" accept="image/jpeg,image/png,image/webp" multiple
            onChange={(event) => { void addImageFiles(event.target.files); event.target.value = '' }}
            disabled={totalReady >= MAX_BATCH}
            className="block w-full text-sm text-zinc-400 file:mr-4 file:border file:border-zinc-700 file:bg-zinc-900 file:px-4 file:py-2 file:font-mono file:text-[11px] file:uppercase file:tracking-widest file:text-zinc-200 hover:file:border-emerald-500 disabled:opacity-40"
          />
        </div>
        {images.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((image) => (
              <div key={image.id} className="group relative border border-zinc-800 bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.previewUrl} alt={image.name} className="h-24 w-full object-cover opacity-90" />
                <button
                  type="button" onClick={() => removeImage(image.id)}
                  className="absolute right-1 top-1 bg-black/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-zinc-300 hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {receipts.map((value, index) => (
          <div key={index}>
            <div className="mb-2 flex items-center justify-between">
              <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Receipt {index + 1}</label>
              {receipts.length > 1 && (
                <button type="button" onClick={() => removeReceipt(index)} className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 hover:text-red-300">
                  Remove
                </button>
              )}
            </div>
            <textarea
              value={value}
              onChange={(event) => updateReceipt(index, event.target.value)}
              rows={5}
              placeholder={'Paste receipt text…'}
              className="w-full border border-zinc-700 bg-black px-4 py-3 font-mono text-sm text-zinc-200 outline-none focus:border-emerald-500"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={addReceipt}
          disabled={receipts.length >= MAX_BATCH}
          className="border border-zinc-700 px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest text-zinc-300 hover:border-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Add another receipt
        </button>
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{images.length} photo{images.length === 1 ? '' : 's'} · {textReadyCount} text · {totalReady}/{MAX_BATCH} total</span>
      </div>

      <button
        type="button"
        onClick={payAndRun}
        disabled={phase === 'redirecting' || totalReady === 0}
        className="mt-6 bg-emerald-400 px-7 py-4 font-mono text-xs font-bold uppercase tracking-widest text-black hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-600"
      >
        {phase === 'redirecting' ? 'Preparing secure checkout…' : 'Pay & run batch →'}
      </button>

      <p className="mt-5 border-t border-zinc-800 pt-4 text-xs leading-relaxed text-zinc-500">
        Privacy: photos are stripped of metadata in your browser, uploaded to private, short-lived storage
        (auto-expiring within 24 hours), and used only to read your receipts. Source images are deleted right
        after your CSV is delivered or the payment is refunded. We never post public links or keep your photos.
      </p>

      {error && <p role="alert" className="mt-5 text-sm text-red-300">{error}</p>}
    </BatchShell>
  )
}

function BatchShell({ children, tone = 'emerald' }: { children: React.ReactNode; tone?: 'emerald' | 'amber' }) {
  const border = tone === 'amber' ? 'border-amber-700/60 bg-amber-950/20' : 'border-zinc-800 bg-zinc-950/40'
  return <div className={`mt-6 border ${border} p-5 sm:p-6`}>{children}</div>
}
