import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Maha Provenance Standard (MPS) v0.1',
  description:
    'A claim-level tagging standard for AI-assisted nonfiction. Makes the epistemic status of every substantive claim explicit, auditable, and machine-readable.',
}

const TAGS = [
  {
    name: 'VERIFIED',
    surface: 'evidence-status-surface--verified',
    def: 'Confirmed by the author against a primary source, direct computation, or first-hand observation.',
    test: 'Did a human check the primary source or reproduce the result?',
  },
  {
    name: 'SOURCED',
    surface: 'evidence-status-surface--sourced',
    def: 'Attributed to an identified, citable secondary source the author has read but not independently verified.',
    test: 'Can the reader follow a citation to a real, identified document?',
  },
  {
    name: 'BOUNDARY',
    surface: 'evidence-status-surface--boundary',
    def: "Accurately reports the limits of knowledge: open questions, untested conjectures, or contested findings where uncertainty is part of the claim.",
    test: 'Is the claim honest about what is not known?',
  },
  {
    name: 'ILLUSTRATIVE',
    surface: 'evidence-status-surface--illustrative',
    def: 'Analogy, thought experiment, composite example, or structural metaphor. Explanatory only; not a claim about the world.',
    test: 'Would the argument survive if this detail were false?',
  },
  {
    name: 'UNVERIFIED',
    surface: 'evidence-status-surface--unverified',
    def: 'Asserted without confirmation: recalled from memory, AI-generated and unchecked, or awaiting verification.',
    test: 'Is this claim still owed work before acting on it?',
  },
] as const

const RULES = [
  'No untagged substantive claims in a compliant document.',
  'UNVERIFIED is a workflow state, not a shipping state. Production documents should carry zero UNVERIFIED tags or justify each remaining one.',
  'Quotations and statistics are never ILLUSTRATIVE. A real-seeming number or quote must be VERIFIED or SOURCED, or removed.',
  'AI-suggested citations are UNVERIFIED until a human opens the source. Citation existence, authorship, and content must all be confirmed for promotion to SOURCED.',
  'Speculative frameworks presented as context take BOUNDARY; derived mappings drawn from them take ILLUSTRATIVE.',
  'Tags describe status, not confidence. A tag records what checking was done, not how sure the author feels.',
] as const

const SCHEMA = `{
  "mps_version": "0.1",
  "document": "string (title or URI)",
  "audited": "ISO-8601 date",
  "claims": [
    {
      "id": "c001",
      "excerpt": "verbatim claim text",
      "tag": "VERIFIED | SOURCED | BOUNDARY | ILLUSTRATIVE | UNVERIFIED",
      "rationale": "why this tag",
      "source": "citation or null",
      "action": "none | verify | cite | reword | remove"
    }
  ],
  "summary": { "counts_by_tag": {}, "compliance": "pass | conditional | fail" }
}`

export default function MpsPage() {
  return (
    <main className="evidence-page">
      <div className="evidence-container">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3 text-[var(--text-muted)]">
            <span>MAHA PROVENANCE STANDARD</span>
            <span>MPS/0.1 · SPECIFICATION</span>
          </p>
          <h1 className="evidence-title evidence-title--product mt-4">The Maha Provenance Standard</h1>
          <p className="evidence-kicker mt-3">v0.1 · draft for public comment</p>
          <p className="evidence-lede mt-7">
            MPS is a claim-level tagging standard for AI-assisted nonfiction. It makes the epistemic status of every substantive claim explicit, auditable, and machine-readable.
          </p>
          <p className="evidence-copy mt-5">
            In AI-assisted writing, fluent and confident prose can hide unsupported statements. MPS is designed so reviewers can quickly see exactly what was checked, and what remains open.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/audit" className="evidence-action evidence-action--secondary">Run a free preflight ↗</Link>
            <Link href="/mps/preflight" className="evidence-action evidence-action--primary">Run a private preflight · $49 ↗</Link>
            <Link href="/mps/audit-access" className="evidence-action evidence-action--secondary">Purchase API audit access ↗</Link>
          </div>
        </header>

        <section className="evidence-section" aria-labelledby="scope-heading">
          <p className="evidence-kicker">1 · SCOPE</p>
          <h2 id="scope-heading" className="evidence-section-title mt-4">What kinds of claims does MPS apply to?</h2>
          <p className="evidence-copy mt-5">
            Substantive factual claims: statements of fact, attribution, quantity, causation, or expert consensus that a reader might reasonably rely on.
          </p>
          <p className="evidence-copy mt-4">
            It does not apply to pure opinion or rhetorical style, and it does not replace ordinary editorial judgment.
          </p>
        </section>

        <section className="evidence-section" aria-labelledby="tags-heading">
          <p className="evidence-kicker">2 · THE FIVE TAGS</p>
          <h2 id="tags-heading" className="evidence-section-title mt-4">Every substantive claim receives one status tag.</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TAGS.map((tag) => (
              <article key={tag.name} className={`evidence-status-surface ${tag.surface}`}>
                <p className="evidence-status-label">{tag.name}</p>
                <p className="evidence-card-title mt-3">{tag.name}</p>
                <p className="evidence-copy mt-4">{tag.def}</p>
                <p className="evidence-copy mt-4 text-[var(--text-primary)]">Validation check: {tag.test}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="rules-heading">
          <p className="evidence-kicker">3 · DISCIPLINE RULES</p>
          <h2 id="rules-heading" className="evidence-section-title mt-4">Required behavior for compliant documents.</h2>
          <ol className="evidence-card mt-7 space-y-3 not list-inside marker:text-[var(--text-primary)]">
            {RULES.map((rule, idx) => (
              <li key={rule} className="evidence-copy">
                <span className="font-mono text-xs text-[var(--text-muted)]">{String(idx + 1).padStart(2, '0')}.</span>{' '}
                {rule}
              </li>
            ))}
          </ol>
        </section>

        <section className="evidence-section" aria-labelledby="schema-heading">
          <p className="evidence-kicker">4 · MACHINE-READABLE MODEL</p>
          <h2 id="schema-heading" className="evidence-section-title mt-4">Structured schema for audits and tooling.</h2>
          <p className="evidence-copy mt-5">
            <strong>Inline form:</strong> trailing tags in human-readable text (for quick authoring).
            <br />
            <strong>Structured form:</strong> MPS records exported by tools and auditors.
          </p>
          <pre className="evidence-code mt-6 overflow-x-auto p-5">{SCHEMA}</pre>
          <p className="evidence-copy mt-5">
            Sites can declare a provenance regime in metadata or policy as <span className="font-mono">provenance-standard: MPS/0.1</span>.
          </p>
          <p className="evidence-copy mt-4">
            New to the standard? Start with <Link href="/mps/what-is-mps" className="evidence-link">the concise explainer</Link> and then try{' '}
            <Link href="/audit" className="evidence-link">a public preflight</Link>.
          </p>
        </section>

        <section className="evidence-section" aria-labelledby="compliance-heading">
          <p className="evidence-kicker">5 · COMPLIANCE LEVELS</p>
          <h2 id="compliance-heading" className="evidence-section-title mt-4">How to classify the maturity of an output.</h2>
          <div className="evidence-card mt-7">
            <p className="evidence-card-copy"><strong>MPS-Declared</strong> — document states it follows MPS and tags substantive claims.</p>
            <p className="evidence-card-copy mt-3"><strong>MPS-Audited</strong> — independent party generated a structured audit record.</p>
            <p className="evidence-card-copy mt-3"><strong>MPS-Certified</strong> (reserved) — audited, with all UNVERIFIED tags resolved and a published trail.</p>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="adoption-heading">
          <p className="evidence-kicker">6 · ADOPTION</p>
          <h2 id="adoption-heading" className="evidence-section-title mt-4">Maha conducts audits and supports adoption.</h2>
          <p className="evidence-copy mt-5">
            If you want MPS support for a publication or product, reach out at{' '}
            <a className="evidence-link" href="mailto:mayone@mahastrategies.com">mayone@mahastrategies.com</a>.
          </p>
          <p className="evidence-copy mt-4">
            Also reviewed: <a className="evidence-link" href="https://mps.mahastrategies.com/v1/records" target="_blank" rel="noreferrer">MPS Registry</a> and{' '}
            <Link href="/mps/audit-access" className="evidence-link">Private Audit Access</Link>.
          </p>
          <p className="evidence-copy mt-4">
            Need private review: <Link href="/mps/preflight" className="evidence-link">MPS Preflight</Link>.
          </p>
        </section>

        <section className="evidence-section" aria-labelledby="links-heading">
          <p className="evidence-kicker">7 · LINKS</p>
          <div className="mt-5 flex flex-wrap gap-4">
            <a className="evidence-link" href="https://research.mahastrategies.com" target="_blank" rel="noreferrer">Research portal ↗</a>
            <a className="evidence-link" href="https://doi.org/10.5281/zenodo.21241308" target="_blank" rel="noreferrer">DOI reference ↗</a>
            <Link className="evidence-link" href="/mps/learn">MPS learning center ↗</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
