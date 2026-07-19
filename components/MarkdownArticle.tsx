import { Fragment, type ReactNode } from 'react'

import type { MarkdownBlock } from '@/lib/content'

// Inline parser: **bold** and *italic* → <strong>/<em>. Rendered as React nodes,
// so all literal text is escaped by React — no dangerouslySetInnerHTML, no XSS.
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>)
    if (match[1] !== undefined) nodes.push(<strong key={key++} className="font-semibold text-zinc-200">{match[1]}</strong>)
    else nodes.push(<em key={key++}>{match[2]}</em>)
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < text.length) nodes.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>)
  return nodes
}

// Renders parsed book blocks as semantic, indexable HTML in the site's theme.
export default function MarkdownArticle({ blocks }: { blocks: MarkdownBlock[] }) {
  return (
    <div className="mt-14 max-w-3xl">
      {blocks.map((block, index) => {
        if (block.type === 'hr') {
          return <hr key={index} className="my-12 border-zinc-800" />
        }
        if (block.type === 'list') {
          return (
            <ul key={index} className="my-6 list-disc space-y-2 pl-6 text-base sm:text-lg text-zinc-400 leading-relaxed">
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
            </ul>
          )
        }
        if (block.type === 'heading') {
          const content = renderInline(block.text)
          if (block.level <= 1) return <h1 key={index} className="mt-16 mb-5 text-3xl sm:text-4xl font-light leading-tight text-white">{content}</h1>
          if (block.level === 2) return <h2 key={index} className="mt-12 mb-3 text-2xl sm:text-3xl font-light text-white">{content}</h2>
          if (block.level === 3) return <h3 key={index} className="mt-10 mb-2 text-xl font-medium text-zinc-200">{content}</h3>
          return <h4 key={index} className="mt-8 mb-2 text-lg font-medium text-zinc-300">{content}</h4>
        }
        return <p key={index} className="mb-6 text-base sm:text-lg text-zinc-400 leading-relaxed">{renderInline(block.text)}</p>
      })}
    </div>
  )
}
