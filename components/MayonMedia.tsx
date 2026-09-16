'use client'

import Image from 'next/image'
import { useState } from 'react'

import { trackConversion } from '@/components/ConversionTracker'
import { MAYON_EVENTS, MAYON_TRAILER } from '@/lib/mayon-hub'

/**
 * An outbound link that records an aggregate CTA click.
 *
 * TrackedLink covers internal routes through next/link. The Mayon hub's most
 * important destinations are external — the browser experience and the two
 * stores — so this is the same idea for a plain anchor. Navigation is a normal
 * href: if the event never fires, or JavaScript never runs, the link still
 * works, because the click handler never cancels the browser's own navigation.
 */
export function TrackedExternalLink({
  event,
  href,
  className,
  children,
  ...rest
}: { event: string; href: string; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'children'>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={className}
      onClick={() => trackConversion(event)}
      {...rest}
    >
      {children}
    </a>
  )
}

/**
 * The 2.0 concept film, loaded only when someone asks for it.
 *
 * Nothing from YouTube is fetched on first render: the poster is a local image
 * and the iframe is created on click. The concept label sits outside this
 * component, above the poster, so it is readable before and after play and
 * does not depend on the player loading.
 */
export function MayonTrailer() {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <div className="aspect-video overflow-hidden border border-[var(--border-default)] bg-black">
        <iframe
          className="h-full w-full"
          src={`${MAYON_TRAILER.embedUrl}?autoplay=1&rel=0`}
          title={`${MAYON_TRAILER.title} — concept film`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      className="group relative block aspect-video w-full overflow-hidden border border-[var(--border-default)] bg-black text-left"
      onClick={() => { trackConversion(MAYON_EVENTS.trailer); setPlaying(true) }}
      aria-label={`Play the concept film: ${MAYON_TRAILER.title}`}
    >
      <Image
        src={MAYON_TRAILER.poster}
        alt="Closing title of the Mayon 2.0 concept film: The Living Mountain, over generated artwork of the volcano at dusk."
        fill
        sizes="(min-width: 1024px) 800px, 100vw"
        className="object-cover transition duration-300 group-hover:scale-[1.01] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <span className="absolute inset-0 bg-black/20 transition group-hover:bg-black/30" aria-hidden="true" />
      <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/75 text-2xl text-white shadow-xl transition group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100" aria-hidden="true">
        <span className="ml-1">▶</span>
      </span>
      <span className="absolute bottom-3 right-3 bg-black/80 px-2 py-1 font-mono text-[10px] tracking-widest text-white">{MAYON_TRAILER.durationLabel}</span>
    </button>
  )
}
