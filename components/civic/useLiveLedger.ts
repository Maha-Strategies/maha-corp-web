'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { feedTail, mergeLedgerPage, type LedgerFeed } from '@/lib/civic/ledger-feed'

export function useLiveLedger() {
  const [data, setData] = useState<LedgerFeed | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const current = useRef<LedgerFeed | null>(null), pending = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    if (pending.current) return
    const controller = new AbortController(); pending.current = controller; setBusy(true)
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(`/api/civic/ledger?after=${feedTail(current.current).sequence}`, { cache: 'no-store', signal: controller.signal })
      const page = await response.json()
      if (!response.ok) throw new Error(page.error || 'Ledger refresh failed.')
      const merged = mergeLedgerPage(current.current, page)
      if (!controller.signal.aborted) { current.current = merged; setData(merged); setError(''); setLastChecked(new Date().toISOString()) }
    } catch (failure) {
      if (pending.current === controller) setError(controller.signal.aborted ? 'Ledger refresh timed out. Loaded records may be stale.' : failure instanceof Error ? failure.message : 'Ledger refresh failed.')
    } finally { clearTimeout(timeout); if (pending.current === controller) { pending.current = null; setBusy(false) } }
  }, [])
  useEffect(() => {
    void refresh()
    const tick = setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 15000)
    const visible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', visible)
    return () => { clearInterval(tick); document.removeEventListener('visibilitychange', visible); const controller = pending.current; pending.current = null; controller?.abort() }
  }, [refresh])
  return { data, busy, error, lastChecked, refresh }
}
