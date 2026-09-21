import type { Metadata } from 'next'

import { PolicyExpansionEntrance } from '@/components/policy/PolicyExpansionReader'

/**
 * The options library has its own entrance rather than replacing `/policy`.
 *
 * The prototype swapped the doctrine page for this one in development, and
 * that swap is a real editorial decision — it would remove published doctrine
 * and five attributed proposals from a live URL. That decision belongs to the
 * owner, not to the change that publishes the briefs, so `/policy` is left
 * exactly as it is and links here instead. Nothing published is deleted by
 * shipping this.
 */

const title = 'Policy questions: an options library | Maha Strategies'
const description =
  'Eight options briefs on housing, healthcare, food, federal spending, schools, energy, AI and jobs, and AI accountability. Each compares mechanisms, costs, authority and objections without selecting one. None is an approved Maha position.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: 'https://www.mahastrategies.com/policy/questions' },
  openGraph: { title, description, type: 'website', url: 'https://www.mahastrategies.com/policy/questions', siteName: 'Maha Strategies' },
}

export default function PolicyQuestionsPage() {
  return <PolicyExpansionEntrance />
}
