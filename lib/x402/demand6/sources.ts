import { createHash } from 'node:crypto'
import type { PublicRead } from './public-fetch.ts'
export const textHash = (text: string) => 'sha256:' + createHash('sha256').update(text, 'utf8').digest('hex')
/** Own public writing only. Adding outside sources requires a documented reuse basis. */
export const DEMAND6_SOURCE_REGISTRY = [
  { url: 'https://www.mahastrategies.com/tools/context-review', rightsBasis: 'Maha-owned public text; short excerpt reuse authorized by the publisher.' },
  { url: 'https://www.mahastrategies.com/research/mcp', rightsBasis: 'Maha-owned public text; short excerpt reuse authorized by the publisher.' },
  { url: 'https://www.mahastrategies.com/developers', rightsBasis: 'Maha-owned public text; short excerpt reuse authorized by the publisher.' },
] as const
export type SourceRegistration = { url: string; rightsBasis: string }
export function extractedPublicText(response: PublicRead): string {
  if (response.status !== 200) throw new Error('public_source_unavailable')
  const type = response.headers['content-type']?.split(';')[0].toLowerCase()
  if (!['text/plain', 'text/html', 'text/markdown'].includes(type ?? '')) throw new Error('public_source_type_unsupported')
  let body = response.body
  if (type === 'text/html') {
    // This is a versioned text extraction, not DOM visibility or browser execution.
    body = body.replace(/<!--[\s\S]*?-->/g, ' ')
    for (const tag of ['head', 'script', 'style', 'template', 'noscript', 'nav', 'header', 'footer', 'form', 'textarea', 'pre', 'code', 'button', 'select']) {
      body = body.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), ' ')
      if (new RegExp(`<${tag}\\b`, 'i').test(body)) throw new Error('public_source_markup_unsupported')
    }
    body = body.replace(/<\/?(?:p|h[1-6]|li|section|article|main|div)\b[^>]*>/gi, '\n')
      .replace(/<[^>]*>/g, ' ').replace(/&#(x[0-9a-f]+|\d+);/gi, (_all, code: string) => {
      const point = code[0].toLowerCase() === 'x' ? Number.parseInt(code.slice(1), 16) : Number(code)
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : ' '
    }).replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_all, code: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[code]!))
  }
  const text = body.split(/\r?\n/).map(line => line.replace(/\s+/gu, ' ').trim()).filter(Boolean).join('\n')
  if (!text || Array.from(text).length > 60000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new Error('public_source_text_unsupported')
  return text
}
export function quoteLocations(sourceId: string, text: string, quote: string) {
  const locators = [], chars = Array.from(text), needle = Array.from(quote)
  let count = 0
  for (let start = 0; start + needle.length <= chars.length; start++) {
    if (needle.every((ch, i) => chars[start + i] === ch)) {
      count++
      if (locators.length < 8) locators.push({ sourceId, quote, startCodePoint: start, endCodePoint: start + needle.length, quoteHash: textHash(quote) })
    }
  }
  return { count, locators }
}
export type AcquiredSource = { sourceId: string; text: string; metadata: { sourceId: string; url: string; retrievedAt: string;
  rawBytesHash: string; extractedTextHash: string; extraction: 'maha-public-text/1.0'; rightsBasis: string } }
const stop = new Set(['what', 'does', 'do', 'the', 'a', 'an', 'and', 'of', 'for', 'to', 'is', 'are', 'in', 'how', 'with', 'can'])
const words = (text: string) => [...new Set(text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [])].filter(word => !stop.has(word))
const escape = (text: string) => text.replace(/[\\`*_{}\[\]<>!#|]/g, '\\$&')
export function extractiveBrief(question: string, sources: AcquiredSource[]) {
  const query = words(question)
  const candidates = sources.flatMap(source => {
    const text = source.text, chunks = text.match(/[^.!?\n]+[.!?]?/gu) ?? [], result = []
    let from = 0
    for (const chunk of chunks) {
      const clean = chunk.trim(), at = text.indexOf(clean, from)
      from = at + clean.length
      // At most 25 words per excerpt and two excerpts per source. No entire article redistribution.
      const quote = Array.from(clean.split(/\s+/).slice(0, 25).join(' ')).slice(0, 300).join('').trim()
      if (!quote || at < 0 || quote.split(/\s+/).length < 6) continue
      const score = words(quote).filter(word => query.includes(word)).length
      if (score) result.push({ score, sourceId: source.sourceId, quote, startCodePoint: Array.from(text.slice(0, at)).length,
        endCodePoint: Array.from(text.slice(0, at + quote.length)).length, quoteHash: textHash(quote) })
    }
    return result.sort((a, b) => b.score - a.score || a.startCodePoint - b.startCodePoint).slice(0, 2)
  }).sort((a, b) => b.score - a.score || a.sourceId.localeCompare(b.sourceId)).slice(0, 6)
  const citations = candidates.map(row => ({ sourceId: row.sourceId, quote: row.quote, startCodePoint: row.startCodePoint, endCodePoint: row.endCodePoint, quoteHash: row.quoteHash }))
  const unknowns = ['Extractive evidence only; the question may require facts absent from these sources.',
    'No semantic contradiction detection or independent factual verification was performed.']
  if (!citations.length) unknowns.unshift('No query-overlapping excerpt was found; no answer has been invented.')
  const lines = citations.map(citation => {
    const source = sources.find(source => source.sourceId === citation.sourceId)!
    return `> ${escape(citation.quote)}\n\n[${escape(citation.sourceId)}](${source.metadata.url}) · code points ${citation.startCodePoint}–${citation.endCodePoint}`
  })
  return { question, mode: 'extractive' as const, briefMarkdown: `## ${escape(question)}\n\n${lines.length ? lines.join('\n\n') : 'Insufficient evidence in the retrieved text.'}\n\n### Unknowns\n\n${unknowns.map(item => `- ${item}`).join('\n')}`,
    sources: sources.map(source => source.metadata), citations, unknowns, modelCalls: 0 as const, semanticContradictionDetectionPerformed: false as const, factualSupportVerified: false as const }
}
