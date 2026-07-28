import type { ReactNode } from 'react'
import { parseMarkdownBlocks } from '@/lib/content'

type BookManuscriptProps = {
  markdown: string
  skipFirstH1?: boolean
  demoteH1?: boolean
}

function inlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>
    return part
  })
}

export default function BookManuscript({ markdown, skipFirstH1 = false, demoteH1 = false }: BookManuscriptProps) {
  return (
    <div className="prose prose-invert prose-lg max-w-none prose-p:text-zinc-300 prose-p:leading-[1.85] prose-p:mb-7 prose-strong:text-white prose-em:text-zinc-300 prose-li:text-zinc-300 prose-li:leading-relaxed">
      {parseMarkdownBlocks(markdown, { skipFirstH1 }).map((block, index) => {
        if (block.type === 'hr') return <hr key={index} className="my-12 border-zinc-800" />
        if (block.type === 'list') return <ul key={index}>{block.items.map((item) => <li key={item}>{inlineMarkdown(item)}</li>)}</ul>
        if (block.type === 'paragraph') {
          if (block.text === '&nbsp;') return null
          return <p key={index}>{inlineMarkdown(block.text)}</p>
        }
        const content = inlineMarkdown(block.text)
        if (block.level === 1) return demoteH1 ? <h2 key={index}>{content}</h2> : <h1 key={index}>{content}</h1>
        if (block.level === 2) return <h2 key={index}>{content}</h2>
        if (block.level === 3) return <h3 key={index}>{content}</h3>
        if (block.level === 4) return <h4 key={index}>{content}</h4>
        return <h5 key={index}>{content}</h5>
      })}
    </div>
  )
}
