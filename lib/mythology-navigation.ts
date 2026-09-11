import { federationPagesForHost, type PublishedFederationPage } from '@/lib/federation-publication'

export const MYTHOLOGY_PATH = '/knowledge/religion/mythology'
const ARTICLE_PATTERN = /^\/knowledge\/religion\/mythology\/([^/]+)\/([^/]+)\/([^/]+)$/

export type MythologySubject = {
  topic: string
  label: string
  pages: readonly PublishedFederationPage[]
}

export type MythologyTradition = {
  tradition: string
  label: string
  path: string
  subjects: readonly MythologySubject[]
  pageCount: number
}

function label(value: string) {
  return value.split('-').map((part) => part === 'and' ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ')
}

export function mythologyTraditions(): readonly MythologyTradition[] {
  const groups = new Map<string, Map<string, PublishedFederationPage[]>>()
  for (const page of federationPagesForHost('www.mahastrategies.com')) {
    const match = page.path.match(ARTICLE_PATTERN)
    if (!match) continue
    const [, tradition, topic] = match
    const subjects = groups.get(tradition) ?? new Map<string, PublishedFederationPage[]>()
    subjects.set(topic, [...(subjects.get(topic) ?? []), page])
    groups.set(tradition, subjects)
  }
  return [...groups.entries()].map(([tradition, subjects]) => {
    const entries = [...subjects.entries()].map(([topic, subjectPages]) => ({
      topic,
      label: label(topic),
      pages: subjectPages.sort((a, b) => a.path.localeCompare(b.path)),
    })).sort((a, b) => a.label.localeCompare(b.label))
    return { tradition, label: label(tradition), path: `${MYTHOLOGY_PATH}/${tradition}`, subjects: entries, pageCount: entries.reduce((sum, subject) => sum + subject.pages.length, 0) }
  }).sort((a, b) => a.label.localeCompare(b.label))
}

export function mythologyTradition(tradition: string) {
  return mythologyTraditions().find((entry) => entry.tradition === tradition) ?? null
}

export function mythologySubjectSiblings(path: string): readonly PublishedFederationPage[] {
  const match = path.match(ARTICLE_PATTERN)
  if (!match) return []
  const [, tradition, topic] = match
  return mythologyTradition(tradition)?.subjects.find((subject) => subject.topic === topic)?.pages ?? []
}
