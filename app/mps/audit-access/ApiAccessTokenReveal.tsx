'use client'

import { useEffect, useRef, useState } from 'react'

// Renders the one-time plaintext API access token. The token arrives via props,
// lives only in component memory, and must never be persisted or logged here.
export default function ApiAccessTokenReveal({ credential, creditQuantity, expiresAt }: {
  credential: string
  creditQuantity: number
  expiresAt: string
}) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (revertTimer.current) clearTimeout(revertTimer.current)
  }, [])

  async function copyApiAccessToken() {
    if (revertTimer.current) clearTimeout(revertTimer.current)
    try {
      await navigator.clipboard.writeText(credential)
      setCopyStatus('copied')
      revertTimer.current = setTimeout(() => setCopyStatus('idle'), 2000)
    } catch {
      setCopyStatus('failed')
    }
  }

  return <>
    <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">Your MPS-only API access token includes {creditQuantity} audit {creditQuantity === 1 ? 'credit' : 'credits'}.</p>
    <div role="alert" className="mt-6 border-2 border-[var(--status-unverified)] bg-[var(--surface-raised)] p-5 text-[var(--status-unverified)]">
      <p className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--status-unverified)]">Save this token immediately</p>
      <p className="mt-3 text-sm font-semibold leading-relaxed">For security reasons, this is the only time it will be displayed. It cannot be recovered if you close or refresh this page. Store it in your password manager or secret manager now.</p>
    </div>
    <div className="evidence-card mt-6" data-nosnippet>
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">API Access Token</p>
      <code aria-label="API access token" className="mt-3 block select-all break-all border border-[var(--border-default)] bg-[var(--surface-raised)] p-4 text-sm leading-relaxed text-[var(--text-primary)]">{credential}</code>
      <button type="button" onClick={copyApiAccessToken} aria-live="polite" className={`mt-4 inline-flex w-full items-center justify-center gap-2 px-5 py-4 font-mono text-xs font-bold uppercase tracking-widest text-[var(--surface-paper)] sm:w-auto ${copyStatus === 'copied' ? 'bg-[var(--status-verified)]' : 'bg-[var(--surface-raised)] hover:bg-[var(--surface-subtle)]'}`}>
        {copyStatus === 'copied' ? <>
          <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="m2.5 8.5 3.5 3.5 7.5-8" /></svg>
          Copied!
        </> : <>
          <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current stroke-[1.5]"><rect x="5" y="5" width="9" height="9" rx="1" /><path d="M11 5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2" /></svg>
          Copy API Access Token
        </>}
      </button>
      {copyStatus === 'failed' && <p role="alert" className="mt-3 text-xs text-[var(--status-unverified)]">Automatic copy failed. Select the visible token above and copy it manually.</p>}
    </div>
    <p className="mt-4 text-xs text-[var(--text-muted)]">Stripe may take a few seconds to activate the credential. It expires {new Date(expiresAt).toLocaleDateString()}.</p>
  </>
}
