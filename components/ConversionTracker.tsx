'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'

type TrackedLinkProps = ComponentProps<typeof Link> & {
  event: string
}

export function trackConversion(event: string) {
  // Intentionally disabled. Do not send conversion events until an authenticated
  // endpoint and its reviewed Supabase schema migration are both in place.
  void event
}

export function TrackedLink({ event, ...props }: TrackedLinkProps) {
  void event
  return <Link {...props} />
}
