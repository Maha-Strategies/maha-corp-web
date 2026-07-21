export type ContentEvidenceMetadata = {
  url?: unknown
  title?: unknown
  note?: unknown
  publishedOn?: unknown
  sourceType?: unknown
}

const PLACEHOLDER_TITLE = /^(source\s*(one|two|three|four|five|\d+)|untitled|tbd)$/i
const PLACEHOLDER_NOTE = /^(what this source establishes for the reader\.?|a (second|third|fourth|fifth),? independent source of evidence\.?)$/i

function text(value: unknown) { return typeof value === 'string' ? value.trim() : '' }

export function sourceMetadataWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return ['The evidence package is not a source list.']
  const warnings: string[] = []
  value.forEach((raw, index) => {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as ContentEvidenceMetadata : {}
    const title = text(source.title)
    const note = text(source.note)
    const url = text(source.url)
    if (!/^https:\/\//.test(url)) warnings.push(`Source ${index + 1} needs a valid HTTPS URL.`)
    if (title.length < 8 || PLACEHOLDER_TITLE.test(title)) warnings.push(`Source ${index + 1} needs its actual publication title.`)
    if (note.length < 30 || PLACEHOLDER_NOTE.test(note)) warnings.push(`Source ${index + 1} needs a specific note explaining what it supports.`)
  })
  return warnings
}

export function sourceMetadataComplete(value: unknown) {
  return sourceMetadataWarnings(value).length === 0
}
