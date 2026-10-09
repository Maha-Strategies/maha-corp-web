import type { Metadata } from 'next'
import Link from 'next/link'

import WorkflowAdvisor from './WorkflowAdvisor'

export const metadata: Metadata = {
  title: 'Workflow Advisor | Maha Strategies',
  description: 'Choose a bounded Maha offer, inspect its request contract, and prepare pre-payment checks without authorizing a purchase.',
  alternates: { canonical: '/tools/workflow-advisor' },
}

export default function WorkflowAdvisorPage() {
  const aiAvailable = process.env.WORKFLOW_ADVISOR_AI_ENABLED === 'true'
    && Boolean(process.env.OPENAI_API_KEY && process.env.WORKFLOW_ADVISOR_ACCESS_TOKEN)
  return <main className="evidence-page"><div className="evidence-container">
    <Link href="/tools" className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)]">← Tools &amp; API</Link>
    <header className="mt-12 max-w-4xl">
      <p className="evidence-kicker">[ Workflow Advisor · advisory only ]</p>
      <h1 className="evidence-title evidence-title--product mt-5">Find the right bounded workflow.</h1>
      <p className="evidence-lede mt-7">State the outcome and constraints. The advisor checks Maha’s published offer policy, then shows a request example and the checks needed before payment.</p>
      <p className="evidence-copy mt-5">It does not sign, spend, call a paid endpoint, or certify that a result is correct. Published prices are indicative; the live 402 challenge is authoritative.</p>
    </header>
    <WorkflowAdvisor aiAvailable={aiAvailable} />
  </div></main>
}
