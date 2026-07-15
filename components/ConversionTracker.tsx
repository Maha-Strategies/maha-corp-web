'use client'

import Link from 'next/link'
import type { ComponentProps, MouseEvent } from 'react'

type TrackedLinkProps = ComponentProps<typeof Link> & {
  event: string
}

export function trackConversion(event: string) {
  const body = JSON.stringify({
    agent: 'web-conversion',
    endpoint: event,
    payload_size: '0 bytes',
    status: 'queued',
  })

  void fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined)
}

export function TrackedLink({ event, onClick, ...props }: TrackedLinkProps) {
  const handleClick = (clickEvent: MouseEvent<HTMLAnchorElement>) => {
    trackConversion(event)
    onClick?.(clickEvent)
  }

  return <Link {...props} onClick={handleClick} />
}
