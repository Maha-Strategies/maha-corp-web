import type { Metadata } from 'next'
import ResearchBriefServicePage from '@/components/ResearchBriefServicePage'

export const metadata: Metadata = {
  title: 'Semiconductor Supply-Chain Diligence | Maha Strategies',
  description: 'A fixed-scope, evidence-tagged research brief for investors and strategy teams evaluating foundry, packaging, regional manufacturing, and semiconductor supply-chain exposure.',
  alternates: { canonical: '/consulting/semiconductor-supply-chain' },
}

export default function SemiconductorSupplyChainPage() {
  return <ResearchBriefServicePage
    eyebrow="[ Verified Research Brief // Semiconductor Supply Chains ]"
    title="Map the semiconductor exposure before it reaches the investment memo."
    summary="For investors and corporate strategy teams evaluating foundry capacity, packaging, regional diversification, and supplier concentration."
    event="cta_semiconductor_brief"
    questions={[
      'Where does a supplier, foundry, OSAT, material, or equipment dependency create a real single point of failure?',
      'How credible is a China+1, U.S. reshoring, or Southeast Asia manufacturing thesis?',
      'Which claims about capacity, customer concentration, or technology readiness change the underwriting case?',
    ]}
    outcomes={[
      'A 10–15 page decision brief framed around the question and time horizon you specify.',
      'A concise stakeholder, supply-chain, and risk map with assumptions made explicit.',
      'Source-linked claims and visible uncertainty—not a polished narrative that hides the weak points.',
    ]}
  />
}
