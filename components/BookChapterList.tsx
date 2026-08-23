import Link from 'next/link'

type BookPart = {
  number: string
  title: string
  subtitle: string
  chapters: string[]
}

type BookChapterListProps = {
  parts: BookPart[]
  availableChapter?: {
    title: string
    href: string
  }
  availableChapters?: Record<string, string>
}

export default function BookChapterList({ parts, availableChapter, availableChapters = {} }: BookChapterListProps) {
  return (
    <ol className="border-t border-[var(--border-default)]">
      {parts.map((part) => (
        <li key={part.number} className="grid grid-cols-[3rem_1fr] gap-4 sm:gap-7 border-b border-[var(--border-default)] py-7">
          <span className="font-mono text-xs text-[var(--text-muted)] tracking-widest pt-1">{part.number}</span>
          <div>
            <h3 className="text-lg text-[var(--text-primary)] mb-1">{part.title}</h3>
            <p className="font-mono text-xs text-[var(--status-sourced)] tracking-widest uppercase mb-4">{part.subtitle}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-3 text-sm leading-relaxed">
              {part.chapters.map((chapter) => {
                const href = availableChapters[chapter] ?? (chapter === availableChapter?.title ? availableChapter.href : undefined)
                return href ? (
                <Link
                  key={chapter}
                  href={href}
                  className="inline-flex items-center gap-2 text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <span>{chapter}</span>
                  <span className="border border-indigo-700 px-2 py-0.5 font-mono text-xs text-[var(--status-sourced)] tracking-wider uppercase">Available</span>
                </Link>
                ) : (
                <span key={chapter} className="text-[var(--text-secondary)]">
                  {chapter} <span className="font-mono text-xs text-[var(--text-muted)] tracking-wide uppercase">Forthcoming</span>
                </span>
                )
              })}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
