import { Fragment } from 'react'
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^\s)]+\))/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link && /^(https:\/\/|\/(?!\/))/.test(link[2])) return <a key={i} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>
    return <Fragment key={i}>{part}</Fragment>
  })
}
/** Text-only Markdown subset; React escapes HTML and unsafe link protocols. */
export default function MarkdownAnswer({ text }: { text: string }) {
  const lines = text.split('\n'), blocks = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    if (line.startsWith('```')) { const code = []; while (++i < lines.length && !lines[i].startsWith('```')) code.push(lines[i]); blocks.push(<pre key={i}><code>{code.join('\n')}</code></pre>); continue }
    const h = line.match(/^(#{1,3})\s+(.+)$/)
    if (h) { blocks.push(h[1].length < 3 ? <h4 key={i}>{inline(h[2])}</h4> : <h5 key={i}>{inline(h[2])}</h5>); continue }
    if (line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? '')) {
      const cells = (v: string) => v.trim().replace(/^\||\|$/g, '').split('|').map(v => v.trim())
      const headers = cells(line), rows = []; i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(cells(lines[i])); i++ } i--
      blocks.push(<div className="markdown-table" key={i}><table><thead><tr>{headers.map((h, k) => <th key={k}>{inline(h)}</th>)}</tr></thead><tbody>{rows.map((row, r) => <tr key={r}>{row.map((c, k) => <td key={k}>{inline(c)}</td>)}</tr>)}</tbody></table></div>); continue
    }
    if (/^\s*(?:[-*]|\d+\.)\s+/.test(line)) { const ordered = /^\s*\d+\./.test(line), items = []; while (i < lines.length && /^\s*(?:[-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*(?:[-*]|\d+\.)\s+/, '')); i--; const children = items.map((item, k) => <li key={k}>{inline(item)}</li>); blocks.push(ordered ? <ol key={i}>{children}</ol> : <ul key={i}>{children}</ul>); continue }
    blocks.push(<p key={i}>{inline(line)}</p>)
  }
  return <div>{blocks}</div>
}
