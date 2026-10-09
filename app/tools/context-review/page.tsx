import Link from 'next/link'
import type { Metadata } from 'next'
import ReviewWorkbench from './ReviewWorkbench'

export const metadata: Metadata = {
  title: 'Context Review | Maha Strategies',
  description: 'Compare a reduced context pack with caller-declared required evidence. Inspect source-specific retention checks and export a report.',
  alternates: { canonical: '/tools/context-review' },
}
export default function Page() {
  return <main className="evidence-page"><div className="evidence-container">
    <header className="evidence-section"><Link href="/tools">← Tools</Link><p className="evidence-kicker mt-6">[ Context Review ]</p><h1 className="evidence-title">Save tokens. Check what survives.</h1><p className="evidence-lede mt-6">Select a smaller context pack and check the evidence you say it must retain.</p><p className="evidence-copy mt-4">This deterministic review does not call an AI model, charge a wallet, or prove answer correctness. Use the local workbench for optional analysis with your ChatGPT plan; commercial website sign-in is not enabled here.</p></header>
    <section className="evidence-section"><ReviewWorkbench /></section>
    <section className="evidence-section evidence-copy"><h2 className="evidence-section-title">Use from an agent</h2><p className="mt-4">The Context Review MCP endpoint accepts only explicitly supplied sanitized text. It does not access company accounts, fetch URLs, or sell services.</p><code className="block break-all mt-4">https://www.mahastrategies.com/api/mcp/context-review</code>
      <ol className="mt-5 list-decimal space-y-3 pl-6"><li>Add the HTTPS endpoint as a remote Streamable HTTP MCP connector in a compatible client. No Maha account or API key is required.</li><li>Discover and call <code>review_context_retention</code>. Supply a task, documents with stable IDs and text, a token budget between 64 and 16,000, and <code>sanitized: true</code> only after removing restricted data.</li><li>Declare <code>expectedEvidence</code> as source IDs paired with exact, case-sensitive excerpts. Inspect each retention status; an empty list means completeness was not tested.</li><li>Review the selected context and limitations. The tool does not prove document authority, semantic completeness, downstream prompt delivery or answer correctness.</li></ol>
      <p className="mt-4">For a synthetic first test, use the original SLA and amendment shown above, ask which rebate applies, and require excerpt “25%” from source “amendment-3”. The retained excerpt is a text-selection result, not a legal conclusion. Input is limited to 64 KiB and eight sources.</p>
      <p className="mt-4"><Link href="/tools/context-review/privacy">Data handling</Link> · <Link href="/tools/context-review/terms">Usage boundaries</Link> · <a href="mailto:mayone@mahastrategies.com">Support</a></p></section>
  </div></main>
}
