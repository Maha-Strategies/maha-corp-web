'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Refresh the saved view only; visitors never trigger chain scans. */
export function SettlementAutoRefresh() {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') router.refresh() }
    const timer = window.setInterval(refresh, 5 * 60 * 1000)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [router])
  return null
}
