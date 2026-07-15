import Link from 'next/link'
import { TrackedLink } from '@/components/ConversionTracker'

type ServicePageProps = {
  eyebrow: string
  title: string
  summary: string
  questions: string[]
  outcomes: string[]
  event: string
}

export default function ResearchBriefServicePage({
  eyebrow,
  title,
  summary,
  questions,
  outcomes,
  event,
}: ServicePageProps) {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300">
      <div className="max-w-4xl mx-auto px-6 py-20 sm:py-28">
        <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-4">{eyebrow}</p>
        <h1 className="text-4xl sm:text-5xl font-light text-white leading-tight max-w-3xl mb-6">{title}</h1>
        <p className="text-xl text-zinc-400 font-light leading-relaxed max-w-3xl mb-10">{summary}</p>

        <div className="flex flex-col sm:flex-row gap-4 mb-20">
          <TrackedLink
            href="/contact"
            event={event}
            className="inline-block bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-7 py-4 hover:bg-zinc-200 transition-colors text-center"
          >
            Commission a Brief — $2,500 ↗
          </TrackedLink>
          <Link href="/consulting#sample" className="inline-block border border-zinc-600 text-zinc-200 font-mono font-bold text-xs tracking-widest uppercase px-7 py-4 hover:border-white hover:text-white transition-colors text-center">
            See a Tagged Page ↓
          </Link>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-zinc-800 pt-10 mb-20">
          <div>
            <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-4">[ Questions we can scope ]</p>
            <ul className="space-y-4">
              {questions.map((question) => <li key={question} className="border-l border-zinc-700 pl-4 text-zinc-400 leading-relaxed">{question}</li>)}
            </ul>
          </div>
          <div>
            <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-4">[ What you receive ]</p>
            <ul className="space-y-4">
              {outcomes.map((outcome) => <li key={outcome} className="border-l border-zinc-700 pl-4 text-zinc-400 leading-relaxed">{outcome}</li>)}
            </ul>
          </div>
        </section>

        <section className="border border-indigo-900/50 bg-indigo-950/20 p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1 bg-indigo-500" />
          <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-4">[ Fixed-scope engagement ]</p>
          <h2 className="text-2xl text-white font-light mb-4">One decision. One defensible record.</h2>
          <p className="text-zinc-400 leading-relaxed max-w-2xl mb-7">
            A Verified Research Brief is a 10–15 page decision document, delivered in 10 business days. Each substantive claim is marked as sourced, verified, illustrative, or unverified, with linked evidence where applicable.
          </p>
          <p className="font-mono text-[10px] text-zinc-500 tracking-widest uppercase mb-7">$2,500 · 10 business days · one revision round · response within two business days</p>
          <TrackedLink href="/contact" event={`${event}_bottom`} className="inline-block bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-7 py-4 hover:bg-zinc-200 transition-colors">
            Start with your decision ↗
          </TrackedLink>
        </section>
      </div>
    </main>
  )
}
