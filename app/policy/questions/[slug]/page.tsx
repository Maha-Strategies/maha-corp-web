import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { POLICY_DRAFTS, policyDraft } from '@/lib/policy-expansion-drafts'
import { POLICY_DRAFT_ROBOTS, policyDraftPublished, policyDraftVisible } from '@/lib/policy-expansion-types'
import { PolicyAnswerReader } from '@/components/policy/PolicyExpansionReader'

type Props = { params: Promise<{ slug: string }> }
export const dynamicParams = false

export function generateStaticParams() {
  return POLICY_DRAFTS.filter(d => policyDraftVisible(d, process.env.NODE_ENV)).map(d => ({ slug: d.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = policyDraft((await params).slug)
  if (!d || !policyDraftVisible(d, process.env.NODE_ENV)) notFound()
  const published = policyDraftPublished(d)
  return {
    title: published ? `${d.question} | Policy options brief` : `${d.question} | Policy review draft`,
    description: published
      ? 'An options brief comparing mechanisms, costs, authority and objections. Not an approved Maha position.'
      : 'An unapproved options brief with evidence, costs, authority and explicit limits.',
    // A published options brief is indexable; a draft still awaiting an
    // evidence refresh is not, and is only reachable in development anyway.
    ...(published ? {} : { robots: POLICY_DRAFT_ROBOTS }),
    alternates: { canonical: `https://www.mahastrategies.com/policy/questions/${d.slug}` },
  }
}

export default async function Page({ params }: Props) {
  const d = policyDraft((await params).slug)
  if (!d || !policyDraftVisible(d, process.env.NODE_ENV)) notFound()
  return <PolicyAnswerReader draft={d} />
}
