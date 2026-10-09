import type { Metadata } from 'next'
import Link from 'next/link'
import CivicDashboard from '@/components/civic/CivicDashboard'
import CivicFinanceNotice from '@/components/civic/CivicFinanceNotice'
import { INITIAL_POLICY_GRAPH, simulatePolicy } from '@/lib/civic/policy-graph'

export const metadata: Metadata = {
  title: 'Civic Intelligence Lab | Maha Strategies',
  description: 'Inspect policy assumptions, legislative sources, public receipt integrity and spending review leads, and share AI safety concerns.',
  alternates: { canonical: '/civic' },
  robots: { index: false, follow: true },
}

const syntheticSpending = JSON.stringify([
  { id: 'demo-award-1', agency: 'Example agency', contractor: 'Example contractor A', program: 'Example software program', fiscalYear: 2026, amountUsdCents: '1200000000', budgetUsdCents: '1500000000', competition: 'noncompetitive', source: { citation: 'Synthetic fixture — not a public award', url: 'https://www.mahastrategies.com/civic#spending' } },
  { id: 'demo-award-2', agency: 'Example agency', contractor: 'Example contractor A', program: 'Example software program', fiscalYear: 2026, amountUsdCents: '400000000', budgetUsdCents: '1500000000', competition: 'competitive', source: { citation: 'Synthetic fixture — not a public award', url: 'https://www.mahastrategies.com/civic#spending' } },
  { id: 'demo-award-3', agency: 'Example agency', contractor: 'Example contractor B', program: 'Example software program', fiscalYear: 2026, amountUsdCents: '200000000', budgetUsdCents: '1500000000', competition: 'competitive', source: { citation: 'Synthetic fixture — not a public award', url: 'https://www.mahastrategies.com/civic#spending' } },
], null, 2)

export default function CivicPage() {
  return <main className="evidence-page"><div className="evidence-container">
    <Link href="/tools" className="evidence-kicker">← Tools &amp; research</Link>
    <header className="mt-12 max-w-4xl">
      <p className="evidence-kicker">Civic intelligence / Foundation 2026</p>
      <h1 className="evidence-title evidence-title--product">Public questions.<br />Inspectable evidence.</h1>
      <p className="evidence-lede mt-7">Explore a policy’s assumptions, follow its sources, and inspect the records behind public decisions.</p>
      <p className="evidence-copy mt-5">This research foundation contains one illustrative procurement proposal. Its figures are supplied assumptions. Evidence gaps and tradeoffs stay visible throughout.</p>
    </header>
    <CivicFinanceNotice />
    <CivicDashboard graph={INITIAL_POLICY_GRAPH} initialSimulation={simulatePolicy({ policyId: INITIAL_POLICY_GRAPH.nodes[0].id, adoptionRate: 1 })} syntheticSpending={syntheticSpending} />
  </div></main>
}
