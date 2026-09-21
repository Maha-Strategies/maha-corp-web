import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { POLICY_METHODS } from '@/lib/policy-expansion-map'
import { PolicyMethodReader } from '@/components/policy/PolicyExpansionReader'

type Props = { params: Promise<{ slug: string }> }
export const dynamicParams = false

/**
 * The methodology pages carry no position. They state how the briefs were
 * prepared, what was not reviewed, and Maha's own commercial interest. Every
 * published brief links to `sources-and-evidence` from its nav, so these
 * publish alongside the briefs rather than behind them: a published page whose
 * "how this was prepared" link 404s is worse than no link at all.
 */
export function generateStaticParams() {
  return POLICY_METHODS.map(m => ({ slug: m.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const m = POLICY_METHODS.find(x => x.slug === slug)
  if (!m) notFound()
  return {
    title: `${m.title} | Policy method`,
    description: 'How these options briefs are prepared, what was not reviewed, and the interests to weigh when reading them.',
    alternates: { canonical: `https://www.mahastrategies.com/policy/methodology/${m.slug}` },
  }
}

export default async function Page({ params }: Props) {
  const slug = (await params).slug
  if (!POLICY_METHODS.some(m => m.slug === slug)) notFound()
  return <PolicyMethodReader slug={slug} />
}
