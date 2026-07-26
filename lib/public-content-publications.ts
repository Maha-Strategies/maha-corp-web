import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'

export type PublicContentPublication = {
  slug: string; title: string; summary: string; direct_answer: string; method: string; limitations: string; artifact_url: string; artifact_label: string; editorial_reviewer: string; evidence: Array<{ url: string; title: string; note?: string }>; published_at: string; updated_at: string
}

export type PublicContentPublicationIndexEntry = Pick<PublicContentPublication, 'slug' | 'title' | 'summary' | 'editorial_reviewer' | 'published_at' | 'updated_at'>

/** Public index entries only. Private drafts, withheld handoffs, and withdrawn
 * releases are deliberately absent from this query. */
export async function getPublicContentPublications(limit = 100): Promise<PublicContentPublicationIndexEntry[]> {
  const ledger = createAgentInquiryLedger()
  if (!ledger) return []
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500)
  const { data, error } = await ledger
    .from('content_publications')
    .select('slug,title,summary,editorial_reviewer,published_at,updated_at')
    .is('unpublished_at', null)
    .order('published_at', { ascending: false })
    .limit(safeLimit)
  return error || !data ? [] : data as PublicContentPublicationIndexEntry[]
}

export async function getPublicContentPublication(slug: string): Promise<PublicContentPublication | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null
  const ledger = createAgentInquiryLedger()
  if (!ledger) return null
  const { data, error } = await ledger.from('content_publications').select('public_id,slug,title,summary,direct_answer,method,limitations,artifact_url,artifact_label,editorial_reviewer,evidence,published_at,updated_at').eq('slug', slug).is('unpublished_at', null).maybeSingle()
  if (error || !data || !Array.isArray(data.evidence)) return null
  const { data: amendment } = await ledger.from('content_publication_source_amendments').select('evidence,amended_at').eq('publication_id', data.public_id).order('revision', { ascending: false }).limit(1).maybeSingle()
  return { ...data, evidence: amendment?.evidence && Array.isArray(amendment.evidence) ? amendment.evidence : data.evidence, updated_at: amendment?.amended_at ?? data.updated_at } as PublicContentPublication
}

export async function getPublicContentPublicationSitemapRows() {
  const ledger = createAgentInquiryLedger()
  if (!ledger) return []
  const { data, error } = await ledger.from('content_publications').select('slug,title,summary,published_at,updated_at').is('unpublished_at', null).order('published_at', { ascending: false }).limit(500)
  return error || !data ? [] : data
}
