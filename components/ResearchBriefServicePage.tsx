import Link from 'next/link'
import { TrackedLink } from '@/components/ConversionTracker'

type ServicePageProps = {
  eyebrow: string
  title: string
  summary: string
  questions: string[]
  outcomes: string[]
  event: string
}

export default function ResearchBriefServicePage({
  eyebrow,
  title,
  summary,
  questions,
  outcomes,
  event,
}: ServicePageProps) {
  return (
    <main className="evidence-page">
      <div className="evidence-container evidence-container--narrow">
        <p className="evidence-kicker">{eyebrow}</p>
        <h1 className="evidence-title">{title}</h1>
        <p className="evidence-lede">{summary}</p>

        <div className="mt-9 flex flex-wrap gap-3">
          <TrackedLink
            href="/contact"
            event={event}
            className="evidence-action evidence-action--primary"
          >
            Commission a Brief — $2,500 ↗
          </TrackedLink>
          <Link href="/consulting#sample" className="evidence-action evidence-action--secondary">
            See a Tagged Page ↓
          </Link>
        </div>

        <section className="evidence-section">
          <p className="evidence-kicker">Decision scope</p>
          <h2 className="evidence-section-title mt-4">Questions we can scope · what you receive.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="evidence-card">
              <p className="evidence-kicker">Questions to validate</p>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                {questions.map((question) => (
                  <li key={question} className="border-l border-[var(--border-default)] pl-4 text-[var(--text-secondary)]">
                    {question}
                  </li>
                ))}
              </ul>
            </article>
            <article className="evidence-card">
              <p className="evidence-kicker">Expected outcomes</p>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                {outcomes.map((outcome) => (
                  <li key={outcome} className="border-l border-[var(--border-default)] pl-4 text-[var(--text-secondary)]">
                    {outcome}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="evidence-section">
          <div className="evidence-inset">
            <p className="evidence-kicker">Fixed-scope engagement</p>
            <h2 className="evidence-section-title mt-4">One decision. One defensible record.</h2>
            <p className="evidence-copy mt-4 max-w-2xl">
              A Verified Research Brief is a 10–15 page decision document, delivered in 10 business days. Each substantive claim is marked as sourced, verified, illustrative, or unverified, with linked evidence where applicable.
            </p>
            <p className="evidence-kicker mt-4">$2,500 · 10 business days · one revision round · response within two business days</p>
            <TrackedLink href="/contact" event={`${event}_bottom`} className="evidence-action evidence-action--primary mt-6">
              Start with your decision ↗
            </TrackedLink>
          </div>
        </section>
      </div>
    </main>
  )
}
