'use client'

import { useEffect, useState } from 'react'

type TableOfContentsItem = {
  id: string
  label: string
}

type ArticleTableOfContentsProps = {
  contentId: string
}

function toAnchorId(text: string, usedIds: Set<string>) {
  const base = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'section'

  let id = base
  let suffix = 2

  while (usedIds.has(id) || document.getElementById(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }

  usedIds.add(id)
  return id
}

export default function ArticleTableOfContents({ contentId }: ArticleTableOfContentsProps) {
  const [items, setItems] = useState<TableOfContentsItem[]>([])

  useEffect(() => {
    const content = document.getElementById(contentId)
    if (!content) return

    const usedIds = new Set<string>()
    const headings = Array.from(content.querySelectorAll<HTMLElement>('h2'))
    const nextItems = headings.map((heading) => {
      const label = heading.textContent?.trim() ?? ''
      const id = heading.id || toAnchorId(label, usedIds)
      heading.id = id
      return { id, label }
    }).filter((item) => item.label)

    const frame = window.requestAnimationFrame(() => setItems(nextItems))
    return () => window.cancelAnimationFrame(frame)
  }, [contentId])

  if (items.length < 2) return null

  return (
    <nav aria-label="On this page" className="mb-12 border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
      <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-4">[ On this page ]</p>
      <ol className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {items.map((item, index) => (
          <li key={item.id} className="flex gap-3 text-sm leading-relaxed">
            <span className="font-mono text-zinc-500" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <a href={`#${item.id}`} className="text-zinc-300 hover:text-white transition-colors">
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
