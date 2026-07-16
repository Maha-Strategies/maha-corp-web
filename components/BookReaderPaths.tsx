import Link from 'next/link'

type BookReaderPathsProps = {
  guideHref: string
  guideTitle: string
  guideDescription: string
  essayHref: string
  essayTitle: string
}

export default function BookReaderPaths({
  guideHref,
  guideTitle,
  guideDescription,
  essayHref,
  essayTitle,
}: BookReaderPathsProps) {
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2">
      <Link
        href={guideHref}
        className="group border border-indigo-800/70 bg-indigo-950/30 p-5 hover:border-indigo-300 transition-colors"
      >
        <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-3">[ New reader? Start here ]</p>
        <h3 className="text-base text-white group-hover:text-indigo-200 transition-colors mb-2">{guideTitle} ↗</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">{guideDescription}</p>
      </Link>
      <Link
        href={essayHref}
        className="group border border-zinc-800 p-5 hover:border-zinc-500 hover:bg-zinc-900/30 transition-colors"
      >
        <p className="font-mono text-xs text-zinc-400 tracking-widest uppercase mb-3">[ Opening essay ]</p>
        <h3 className="text-base text-zinc-100 group-hover:text-white transition-colors mb-2">{essayTitle} ↗</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">A short introduction to the question that sets the book in motion.</p>
      </Link>
    </div>
  )
}
