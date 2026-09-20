import type { Metadata } from 'next'
import Link from 'next/link'

import {
  CALDERA_CLARIFICATIONS,
  CALDERA_NOT_ESTABLISHED,
  CALDERA_OPEN_QUESTIONS,
  CALDERA_PATH,
  CALDERA_PREPARED,
  CALDERA_SCALE,
  CALDERA_STATUS_LABEL,
  CALDERA_STRATA,
} from '@/lib/caldera-concept'

const title = 'The Caldera: a concept for a future headquarters | Maha Strategies'
const description =
  'A concept vision for a Maha Strategies headquarters on the New York waterfront, with a public library and gallery at its base and an observatory at its crown. No site, funding, approvals or schedule are established, and this page says which parts are aspiration and which are not established at all.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: CALDERA_PATH },
  openGraph: { title, description, type: 'website', url: CALDERA_PATH, siteName: 'Maha Strategies' },
}

const gsf = (value: number) => `${value.toLocaleString('en-US')} gross sq ft`

export default function CalderaPage() {
  return (
    <main className="evidence-page">
      <article className="evidence-container evidence-container--narrow">
        <nav aria-label="Breadcrumb" className="text-sm">
          <Link className="evidence-link" href="/">Maha Strategies</Link>
          <span aria-hidden="true"> / </span>The Caldera
        </nav>

        <header className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-boundary)]">
            [ {CALDERA_STATUS_LABEL} ]
          </p>
          <h1 className="mt-4 text-4xl font-light leading-tight tracking-tight text-[var(--text-primary)] sm:text-5xl">
            The Caldera
          </h1>
          <p className="mt-6 text-xl leading-relaxed text-[var(--text-secondary)]">
            A long-term idea for a permanent home for Maha Strategies on the New York City waterfront: research and
            engineering above, a public library and gallery at street level, a planted garden and an observatory at the
            crown. Its architectural reference is Mount Mayon — a broad base, a disciplined rising form, a luminous
            interior and a recessed summit.
          </p>
          <p className="mt-5 leading-relaxed text-[var(--text-secondary)]">
            That reference is an architectural ambition. It is not a claim about how the building would perform, and
            nothing on this page has been designed, costed, approved or sited. Maha Strategies is in its first year with
            minimal revenue. This is documentation prepared for a decision the company has not yet been in a position to
            take.
          </p>
        </header>

        <section className="mt-12 border border-[var(--border-strong)] p-6" aria-labelledby="not-established">
          <h2 id="not-established" className="text-lg text-[var(--text-primary)]">What is not established</h2>
          <ul className="mt-4 list-none space-y-2 p-0">
            {CALDERA_NOT_ESTABLISHED.map((item) => (
              <li key={item} className="text-sm leading-relaxed text-[var(--text-secondary)]">{item}</li>
            ))}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="strata">
          <h2 id="strata" className="evidence-section-title text-xl">Four strata</h2>
          <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">
            The concept organises the building into four bands. The floor numbers reproduce the founder’s sketch; they
            are not an approved space schedule, and each band carries a list of things a future architect would have to
            settle before any of it could be sized.
          </p>
          <ul className="mt-6 list-none space-y-6 p-0">
            {CALDERA_STRATA.map((stratum) => (
              <li key={stratum.name} className="border-l border-[var(--border-strong)] pl-4">
                <h3 className="text-lg text-[var(--text-primary)]">
                  {stratum.name}{' '}
                  <span className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)]">{stratum.concept}</span>
                </h3>
                <p className="mt-2 leading-relaxed text-[var(--text-secondary)]">{stratum.intent}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                  Reserved for future design: {stratum.reserved}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="scale">
          <h2 id="scale" className="evidence-section-title text-xl">The scale study, and what it is worth</h2>
          <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">
            One authored model allocates {gsf(CALDERA_SCALE.aboveGradeGsf)} above grade, of which{' '}
            {gsf(CALDERA_SCALE.publicStrataGsf)} sits in the public strata, plus {gsf(CALDERA_SCALE.optionalBelowGradeGsf)}{' '}
            of optional below-grade support. Roughly {CALDERA_SCALE.lotSearchFilterAcres} acres is the initial filter for
            a lot search under that model’s own footprint assumptions.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">{CALDERA_SCALE.caveat}</p>
          <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">
            Twenty-six floors cannot establish a size or a price. Net usable area still has to be reconciled with
            circulation, lifts, stairs, structure, plant, services and atrium voids before a gross area exists at all,
            and zoning floor area is calculated separately again.
          </p>
        </section>

        <section className="mt-12" aria-labelledby="words">
          <h2 id="words" className="evidence-section-title text-xl">Words that sound like claims</h2>
          <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">
            The source material uses several terms that would be misread as commitments or findings. They are set
            straight here rather than dropped, because the correction is the useful part.
          </p>
          <dl className="mt-6 space-y-5">
            {CALDERA_CLARIFICATIONS.map((item) => (
              <div key={item.term}>
                <dt className="text-[var(--text-primary)]">{item.term}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{item.reading}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12" aria-labelledby="questions">
          <h2 id="questions" className="evidence-section-title text-xl">What a professional would have to answer</h2>
          <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">
            These are proposed studies, not engineering findings. Nobody has been commissioned to carry any of them out.
          </p>
          <ul className="mt-4 list-none space-y-3 p-0">
            {CALDERA_OPEN_QUESTIONS.map((question) => (
              <li key={question} className="border-l border-[var(--border-default)] pl-4 leading-relaxed text-[var(--text-secondary)]">
                {question}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="public">
          <h2 id="public" className="evidence-section-title text-xl">The public part</h2>
          <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">
            The library, reading rooms, exhibition and education spaces are the part of this concept worth discussing
            with anyone outside the company, and the part with the most unanswered questions attached: opening hours,
            accessibility, security, governance, waterfront access obligations, and the standing operating subsidy that
            would be needed to keep a public floor open at all.
          </p>
          <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">
            The concept promises no jobs, no tax benefit and no neighbourhood outcome. None of those has been studied,
            and a building that has no site cannot promise anything to a neighbourhood that has not been identified.
          </p>
        </section>

        <p className="mt-12 border-t border-[var(--border-default)] pt-6 text-sm leading-relaxed text-[var(--text-muted)]">
          {CALDERA_STATUS_LABEL} Prepared {CALDERA_PREPARED} from internal concept documentation and published here as a
          statement of intent. It is not an offering of securities, a financing commitment, a land-use application, a
          technical certification, or a solicitation. If and when the company funds a bounded feasibility study, the
          findings of that study — not this page — would be what changes.
        </p>
      </article>
    </main>
  )
}
