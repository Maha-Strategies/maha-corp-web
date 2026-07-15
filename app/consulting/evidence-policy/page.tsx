import type { Metadata } from 'next'
import ResearchBriefServicePage from '@/components/ResearchBriefServicePage'

export const metadata: Metadata = {
  title: 'Evidence & Policy Research Briefs | Maha Strategies',
  description: 'A fixed-scope, evidence-tagged research brief for teams assessing contested claims, policy exposure, regulatory context, and decision-critical evidence.',
  alternates: { canonical: '/consulting/evidence-policy' },
}

export default function EvidencePolicyPage() {
  return <ResearchBriefServicePage
    eyebrow="[ Verified Research Brief // Evidence & Policy ]"
    title="Turn a contested claim into a decision-ready evidence record."
    summary="For investors and strategy teams when a market thesis depends on a policy, regulatory, scientific, or competitor claim that needs closer scrutiny."
    event="cta_evidence_policy_brief"
    questions={[
      'What does the available evidence actually support—and where does it stop?',
      'Which regulatory, policy, or market assumptions belong in the decision record?',
      'How should competing claims be ranked when the cost of getting one wrong is material?',
    ]}
    outcomes={[
      'A fixed-scope synthesis written for a decision-maker rather than a general audience.',
      'A visible claim trail that identifies evidence, inference, illustration, and unresolved uncertainty.',
      'A concise decision frame that helps reviewers challenge the right assumptions early.',
    ]}
  />
}
