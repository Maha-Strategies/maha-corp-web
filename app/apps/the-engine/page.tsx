import type { Metadata } from 'next'
import Link from 'next/link'

const pageUrl = 'https://www.mahastrategies.com/apps/the-engine'
const googlePlayUrl = 'https://play.google.com/store/apps/details?id=com.theimaginedlife.engine'

export const metadata: Metadata = {
  title: 'The Dream Engine | Read, Practice, Archive',
  description: 'The Dream Engine brings The Imagined Life together with a private practice for attention, reflection, and ordinary action.',
  alternates: { canonical: pageUrl },
  openGraph: {
    title: 'The Dream Engine | Read, Practice, Archive',
    description: 'A private practice for attention, reflection, and ordinary action.',
    url: pageUrl,
    type: 'website',
  },
}

const appJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'MobileApplication',
  name: 'The Dream Engine',
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'iOS, Android',
  url: pageUrl,
  installUrl: googlePlayUrl,
  publisher: { '@type': 'Organization', name: 'Maha Strategies LLC', url: 'https://www.mahastrategies.com' },
  description: 'A companion app to The Imagined Life, combining the complete book with a private practice for attention, reflection, and action.',
}

export default function TheDreamEnginePage() {
  return (
    <main className="min-h-screen bg-[#0c0b10] px-6 py-20 text-zinc-300 sm:py-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd).replace(/</g, '\\u003c') }} />
      <article className="mx-auto max-w-4xl">
        <p className="font-mono text-[10px] uppercase tracking-widest text-amber-200">[ The Imagined Life · companion app ]</p>
        <h1 className="mt-5 max-w-4xl text-4xl font-light leading-tight tracking-tight text-white sm:text-6xl">Read the book.<br /><span className="text-amber-200">Then use its small instrument.</span></h1>
        <p className="mt-7 max-w-3xl text-xl leading-relaxed text-zinc-300">The Dream Engine brings the complete text of <em>The Imagined Life: Living Inside a Dreaming Brain</em> together with a deliberately modest, private practice for attention, reflection, and action.</p>

        <section className="mt-12 flex flex-wrap gap-4" aria-label="The Dream Engine links">
          <a href={googlePlayUrl} target="_blank" rel="noreferrer" className="border border-amber-300 bg-amber-200 px-5 py-3 text-sm font-medium text-black transition hover:bg-amber-100">Get it on Google Play ↗</a>
          <a href="mailto:mayone@mahastrategies.com?subject=The%20Dream%20Engine%20iOS%20release%20updates" className="border border-zinc-700 px-5 py-3 text-sm text-zinc-200 transition hover:border-amber-300 hover:text-amber-100">Get iOS release updates</a>
          <Link href="/apps/the-engine/privacy" className="border border-zinc-700 px-5 py-3 text-sm text-zinc-200 transition hover:border-amber-300 hover:text-amber-100">Read the privacy policy</Link>
        </section>
        <p className="mt-5 text-sm text-zinc-500">Now available on Google Play. App Store release is in preparation.</p>

        <section className="mt-14 border border-amber-900/40 bg-amber-950/10 p-7 sm:p-9">
          <p className="max-w-3xl text-2xl font-light leading-relaxed text-amber-50">“Imagination is not magic. It changes the dreamer, and the dreamer changes what happens next.”</p>
        </section>

        <section className="mt-16">
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-200">[ A private practice ]</p>
          <h2 className="mt-4 text-3xl font-light text-white">Three moves. No mystical shortcuts.</h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-zinc-400">The practice is designed to be small enough to return to: hold something near attention, notice what remains, and choose one ordinary next action.</p>
          <div className="mt-8 grid gap-px overflow-hidden border border-zinc-800 bg-zinc-800 md:grid-cols-3">
            <div className="bg-[#100e14] p-7"><p className="font-mono text-xs text-amber-200">01</p><h3 className="mt-3 text-xl text-white">Seed</h3><p className="mt-3 text-sm leading-relaxed text-zinc-400">Choose a question, image, conversation, fear, or unfinished problem to carry near attention.</p></div>
            <div className="bg-[#100e14] p-7"><p className="font-mono text-xs text-amber-200">02</p><h3 className="mt-3 text-xl text-white">Trace</h3><p className="mt-3 text-sm leading-relaxed text-zinc-400">Record fragments from the night before the day explains them away. A feeling counts. Nothing counts, too.</p></div>
            <div className="bg-[#100e14] p-7"><p className="font-mono text-xs text-amber-200">03</p><h3 className="mt-3 text-xl text-white">Action</h3><p className="mt-3 text-sm leading-relaxed text-zinc-400">Ask what one concrete action makes the imagined thing slightly more actual, then do the work after.</p></div>
          </div>
        </section>

        <section className="mt-16 grid gap-10 border-t border-zinc-800 pt-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl text-white">Your archive belongs to you</h2>
            <p className="mt-5 leading-relaxed text-zinc-400">There are no ads, social feeds, or dream-decoding claims. Entries, bookmarks, reader settings, and reading position stay in local device storage. You choose whether to export your work.</p>
            <Link href="/apps/the-engine/privacy" className="mt-5 inline-block text-amber-200 underline">Privacy details</Link>
          </div>
          <div>
            <h2 className="text-2xl text-white">A book about the dreaming brain</h2>
            <p className="mt-5 leading-relaxed text-zinc-400">The Dream Engine is the companion to <em>The Imagined Life</em>: a space to read, practice, and keep a private record of the questions that continue after the page ends.</p>
            <Link href="/books/the-imagined-life" className="mt-5 inline-block text-amber-200 underline">Read about The Imagined Life</Link>
          </div>
        </section>
      </article>
    </main>
  )
}
