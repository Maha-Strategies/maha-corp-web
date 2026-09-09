import { MAYON_CONNECTIONS, MAYON_MODERN_BRIDGES, MAYON_SOURCES } from '../mayon-knowledge.ts'
import { MAYON_PUBLIC_REGISTRY, MAYON_PUBLIC_REGISTRY_DIGEST } from '../mayon-topics.ts'
import { TIRUVAYMOLI_ATLAS_TOPICS, TIRUVAYMOLI_ATLAS_PUBLIC_REGISTRY, TIRUVAYMOLI_ATLAS_REGISTRY_DIGEST, TIRUVAYMOLI_ATLAS_QUALITY, TIRUVAYMOLI_ATLAS_SOURCES, tiruvaymoliAtlasTopicPath } from '../tiruvaymoli-passage-atlas.ts'
import { TAMIL_SOURCE_ATLAS_PUBLIC_REGISTRY, TAMIL_SOURCE_ATLAS_REGISTRY_DIGEST, TAMIL_SOURCE_ATLAS_QUALITY, getTamilSourceAtlasTopic, tamilSourceAtlasTopicPath } from '../tamil-source-atlas.ts'
import { provenanceDigest } from '../evidence-dossier/digest.ts'

type Row = Record<string, unknown>
const pins = {
  'divine-name-disambiguation': [MAYON_PUBLIC_REGISTRY, MAYON_PUBLIC_REGISTRY_DIGEST],
  'edition-verse-resolution': [TIRUVAYMOLI_ATLAS_PUBLIC_REGISTRY, TIRUVAYMOLI_ATLAS_REGISTRY_DIGEST],
  'reception-lineage-retrieval': [TAMIL_SOURCE_ATLAS_PUBLIC_REGISTRY, TAMIL_SOURCE_ATLAS_REGISTRY_DIGEST],
} as const
const sources = [...MAYON_SOURCES, ...TIRUVAYMOLI_ATLAS_SOURCES]
function source(id: string, locator?: string) {
  const s = sources.find(s => s.id === id)
  // No commercial reuse of the NC TextGrid representation, no bibliographic-only source.
  if (!s || !s.contentInspected || /\bNC\b|non-commercial/i.test(s.rightsBasis)) throw new Error('unsupported-rights-or-depth')
  return { sourceId: s.id, url: s.url, locator: locator ?? s.inspectedLocator, frame: s.frame, rightsBasis: s.rightsBasis, boundary: s.boundary }
}
const aliases: Record<string, string> = { tirumal: 'Tirumāl', 'tirumāl': 'Tirumāl', 'திருமால்': 'Tirumāl', vishnu: 'Vishnu', krishna: 'Krishna', 'balarama': 'Balarama / Vāliyoṉ' }
export function religionProduct(id: keyof typeof pins, input: Row): Row {
  const [registry, registryDigest] = pins[id]
  if (input.expectedRegistryDigest !== registryDigest || provenanceDigest(registry) !== registryDigest) throw new Error('registry-pin-refused')
  if (id === 'divine-name-disambiguation') {
    const name = (input.name as string).normalize('NFC').trim().toLowerCase()
    if (!name) throw new Error('empty-name')
    if (['mayon', 'māyōṉ', 'மாயோன்'].includes(name)) {
      const deity = { entity: 'Māyōṉ (Tamil literary-religious figure)', relationship: 'source-scoped-subject', boundary: 'This identifies a research subject, not every similarly spelled name or a universal equation with another god.', evidence: [source('yamashita-1995-mayon-tirumal')] }
      const volcano = { entity: 'Mayon Volcano (Philippines)', relationship: 'namesake-disambiguation', boundary: MAYON_MODERN_BRIDGES.find(b => b.relationship === 'namesake-disambiguation')!.boundary, evidence: [] }
      return { state: name === 'mayon' ? 'ambiguous' : 'matched', registryDigest, candidates: name === 'mayon' ? [deity, volcano] : [deity], universalIdentityEstablished: false }
    }
    const connection = MAYON_CONNECTIONS.find(c => c.name === aliases[name])
    const candidates = connection ? [{ entity: connection.name, relationship: connection.relationship, boundary: connection.boundary, evidence: connection.sourceIds.map(id => source(id)) }] : []
    return { state: candidates.length ? 'matched' : 'not-in-supported-index', registryDigest, candidates, universalIdentityEstablished: false }
  }
  if (id === 'edition-verse-resolution') {
    const matches = TIRUVAYMOLI_ATLAS_TOPICS.filter(t => { const [lo, hi] = t.range.split('–').map(Number); return (input.pasuram as number) >= lo && (input.pasuram as number) <= hi })
    if (matches.length > 1 || matches.some(t => !TIRUVAYMOLI_ATLAS_QUALITY.find(q => q.topicSlug === t.slug)?.eligible)) throw new Error('ambiguous-or-unreviewed-range')
    return { state: matches.length ? 'resolved' : 'not-in-inspected-atlas', registryDigest, editionId: input.editionId, matches: matches.map(t => ({ slug: t.slug, range: t.range, canonicalUrl: `https://www.mahastrategies.com${tiruvaymoliAtlasTopicPath(t)}`, locator: `Project Madurai/Hart printed pāsuram ${input.pasuram}; complete unit ${t.range}` })), verseContentReturned: false }
  }
  const topic = getTamilSourceAtlasTopic(input.slug as string)
  if (!topic || topic.category !== 'reception-lineage' || !TAMIL_SOURCE_ATLAS_QUALITY.find(q => q.topicSlug === topic.slug)?.eligible) throw new Error('unsupported-reception-topic')
  return { registryDigest, canonicalUrl: `https://www.mahastrategies.com${tamilSourceAtlasTopicPath(topic)}`, title: topic.title, finding: topic.directAnswer,
    evidence: topic.evidence.map(e => source(e.sourceId, e.locator)), limitations: [...topic.limitations], relationship: 'attributed-reception-comparison', uninterruptedTransmissionProven: false }
}
