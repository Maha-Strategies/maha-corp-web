import type { Metadata } from 'next'
import Link from 'next/link'

const pageUrl = 'https://www.mahastrategies.com/apps/the-engine/privacy'

export const metadata: Metadata = {
  title: 'The Engine Privacy Policy | Maha Strategies',
  description: 'Privacy policy for The Engine, the companion app to The Imagined Life.',
  alternates: { canonical: pageUrl },
}

export default function TheEnginePrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-indigo-500 selection:text-white sm:px-12">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="mb-10 block text-xs uppercase tracking-widest text-zinc-500 hover:text-white">
          ← Maha Strategies
        </Link>
        <p className="text-xs uppercase tracking-[0.22em] text-indigo-400">The Imagined Life companion app</p>
        <h1 className="mt-4 text-4xl font-light tracking-wide text-white sm:text-5xl">The Engine Privacy Policy</h1>
        <p className="mt-4 text-sm text-zinc-500">Effective date: 22 July 2026</p>

        <div className="prose prose-invert mt-12 max-w-none leading-relaxed text-zinc-300">
          <p>The Engine does not require an account and does not collect, transmit, sell, or share personal information. It contains no advertising SDK, analytics service, cloud database, or social feature.</p>
          <p>Practice entries, bookmarks, reader settings, and reading position are stored only in the app&apos;s local device storage. The app does not send that material to Maha Strategies. If you choose Share or Export, the destination and any resulting copy are governed by the service you choose. Device backups may also be governed by your device and backup-provider settings.</p>
          <p>Deleting an entry removes it from the app. Uninstalling The Engine removes its local archive from the device. Export any entries you want to retain before uninstalling.</p>
          <p>The app is a reflective practice and is not medical, mental-health, or sleep-treatment advice.</p>
          <h2>Contact</h2>
          <p>For privacy questions, contact <a href="mailto:mayone@mahastrategies.com">mayone@mahastrategies.com</a>.</p>
        </div>
      </article>
    </main>
  )
}
