'use client'

import Image from 'next/image'
import { useState } from 'react'

const VIDEO_ID = 'zDNs0Ndwx3Y'

export function YouTubeLiteEmbed() {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <div className="aspect-video overflow-hidden bg-black">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`}
          title="Maha Strategies investor and partner demonstration"
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
      className="group relative block aspect-video w-full overflow-hidden bg-black text-left"
      onClick={() => setPlaying(true)}
      aria-label="Play the Maha Strategies investor and partner demonstration"
    >
      <Image
        src="/demo/evidence-layer-thumbnail.png"
        alt="Maha Strategies: the evidence layer for autonomous systems"
        fill
        priority
        sizes="(min-width: 1024px) 1024px, 100vw"
        className="object-cover transition duration-300 group-hover:scale-[1.01]"
      />
      <span className="absolute inset-0 bg-black/10 transition group-hover:bg-black/20" aria-hidden="true" />
      <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/75 text-2xl text-[#fff] shadow-xl transition group-hover:scale-105 group-hover:bg-black" aria-hidden="true">
        <span className="ml-1">▶</span>
      </span>
      <span className="absolute bottom-4 right-4 bg-black/80 px-2 py-1 font-mono text-[10px] tracking-widest text-[#fff]">05:58</span>
    </button>
  )
}
