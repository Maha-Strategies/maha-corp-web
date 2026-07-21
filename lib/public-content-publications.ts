import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'

export type PublicContentPublication = {
  slug: string; title: string; summary: string; direct_answer: string; method: string; limitations: string; artifact_url: string; artifact_label: string; editorial_reviewer: string; evidence: Array<{ url: string; title: string; note?: string }>; published_at: string
}

export async function getPublicContentPublication(slug: string): Promise<PublicContentPublication | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null
  const ledger = createAgentInquiryLedger()
  if (!ledger) return null
  const { data, error } = await ledger.from('content_publications').select('slug,title,summary,direct_answer,method,limitations,artifact_url,artifact_label,editorial_reviewer,evidence,published_at').eq('slug', slug).is('unpublished_at', null).maybeSingle()
  if (error || !data || !Array.isArray(data.evidence)) return null
  return data as PublicContentPublication
}

export async function getPublicContentPublicationSitemapRows() {
  const ledger = createAgentInquiryLedger()
  if (!ledger) return []
  const { data, error } = await ledger.from('content_publications').select('slug,title,summary,published_at,updated_at').is('unpublished_at', null).order('published_at', { ascending: false }).limit(500)
  return error || !data ? [] : data
}
