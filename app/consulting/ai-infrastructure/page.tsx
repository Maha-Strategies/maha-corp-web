import type { Metadata } from 'next'
import ResearchBriefServicePage from '@/components/ResearchBriefServicePage'

export const metadata: Metadata = {
  title: 'AI Infrastructure & Edge AI Research | Maha Strategies',
  description: 'A fixed-scope, evidence-tagged research brief for investors and strategy teams evaluating AI infrastructure, on-device AI, inference economics, and deployment risk.',
  alternates: { canonical: '/consulting/ai-infrastructure' },
}

export default function AiInfrastructurePage() {
  return <ResearchBriefServicePage
    eyebrow="[ Verified Research Brief // AI Infrastructure & Edge AI ]"
    title="Separate an AI infrastructure thesis from its assumptions."
    summary="For teams assessing AI compute demand, edge deployment, model economics, vendor claims, and the hardware constraints that shape adoption."
    event="cta_ai_infrastructure_brief"
    questions={[
      'Does the proposed AI deployment require cloud scale, on-device inference, or a hybrid architecture?',
      'Which performance, cost, energy, or IP claims can survive an investment or operating review?',
      'Where do semiconductor availability, inference economics, and deployment friction change the timeline?',
    ]}
    outcomes={[
      'A decision brief that turns a technical story into explicit commercial and operational assumptions.',
      'A structured comparison of the credible options, constraints, and open questions.',
      'Evidence tags that make it clear which claims are sourced, verified, illustrative, or unresolved.',
    ]}
  />
}
