'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ComponentProps, MouseEventHandler } from 'react'

import { validExperimentId } from '@/lib/conversion-measurement'

type TrackedLinkProps = ComponentProps<typeof Link> & {
  event: string
}

type ConversionContext = { experimentId: string | null; sourcePath: string }

function conversionType(event: string): 'cta_click' | 'inquiry_submitted' | null {
  if (event === 'contact_form_success') return 'inquiry_submitted'
  return event.startsWith('cta_') ? 'cta_click' : null
}

export function browserConversionContext(): ConversionContext {
  if (typeof window === 'undefined') return { experimentId: null, sourcePath: '/' }
  const experimentId = new URLSearchParams(window.location.search).get('exp')
  return { experimentId: validExperimentId(experimentId) ? experimentId : null, sourcePath: window.location.pathname }
}

export function trackConversion(event: string) {
  const eventType = conversionType(event)
  if (!eventType || typeof window === 'undefined' || typeof crypto.randomUUID !== 'function') return
  const context = browserConversionContext()
  // A short-lived, first-party, cookie-free event. It does not read or create
  // persistent storage or identify a visitor. Browser signals are unverified.
  void fetch('/api/conversion-events', {
    method: 'POST', credentials: 'omit', keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: `conv_${crypto.randomUUID()}`, eventName: event, eventType, ...context }),
  }).catch(() => undefined)
}

export function TrackedLink({ event, href, onClick, ...props }: TrackedLinkProps) {
  const [attributedHref, setAttributedHref] = useState(href)
  useEffect(() => {
    const { experimentId } = browserConversionContext()
    if (!experimentId || typeof href !== 'string') return
    try {
      const destination = new URL(href, window.location.origin)
      if (destination.origin !== window.location.origin) return
      destination.searchParams.set('exp', experimentId)
      setAttributedHref(`${destination.pathname}${destination.search}${destination.hash}`)
    } catch { /* Leave an unusual href unchanged. */ }
  }, [href])
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (click) => {
    trackConversion(event)
    onClick?.(click)
  }
  return <Link href={attributedHref} onClick={handleClick} {...props} />
}
