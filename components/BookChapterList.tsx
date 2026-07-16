import Link from 'next/link'

type BookPart = {
  number: string
  title: string
  subtitle: string
  chapters: string[]
}

type BookChapterListProps = {
  parts: BookPart[]
  availableChapter: {
    title: string
    href: string
  }
}

export default function BookChapterList({ parts, availableChapter }: BookChapterListProps) {
  return (
    <ol className="border-t border-zinc-800">
      {parts.map((part) => (
        <li key={part.number} className="grid grid-cols-[3rem_1fr] gap-4 sm:gap-7 border-b border-zinc-800 py-7">
          <span className="font-mono text-xs text-zinc-500 tracking-widest pt-1">{part.number}</span>
          <div>
            <h3 className="text-lg text-zinc-100 mb-1">{part.title}</h3>
            <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-4">{part.subtitle}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-3 text-sm leading-relaxed">
              {part.chapters.map((chapter) => chapter === availableChapter.title ? (
                <Link
                  key={chapter}
                  href={availableChapter.href}
                  className="inline-flex items-center gap-2 text-zinc-100 hover:text-white transition-colors"
                >
                  <span>{chapter}</span>
                  <span className="border border-indigo-700 px-2 py-0.5 font-mono text-xs text-indigo-200 tracking-wider uppercase">Available</span>
                </Link>
              ) : (
                <span key={chapter} className="text-zinc-400">
                  {chapter} <span className="font-mono text-xs text-zinc-500 tracking-wide uppercase">Forthcoming</span>
                </span>
              ))}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
