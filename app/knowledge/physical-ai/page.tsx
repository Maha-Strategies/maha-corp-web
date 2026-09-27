import KnowledgeHub from '@/components/knowledge/KnowledgeHub'
import type { Metadata } from 'next'
import Link from 'next/link'

import { MAHA_ORGANIZATION_ID, MAHA_SITE_URL } from '@/lib/entity'
import {
  PHYSICAL_AI_ARTICLES,
  PHYSICAL_AI_PATH,
  PHYSICAL_AI_RELEASE_DATE,
  PHYSICAL_AI_SOURCES,
} from '@/lib/physical-ai-knowledge'

const title = 'Physical AI: learned systems that act | Maha Strategies'
const description =
  'What physical AI means, how world models, vision-language-action policies and demonstration learning actually work, and what their reported results establish. Sixteen sourced explanations and a runnable perception–action fixture.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: PHYSICAL_AI_PATH },
  openGraph: { title, description, url: `${MAHA_SITE_URL}${PHYSICAL_AI_PATH}`, type: 'website', siteName: 'Maha Strategies' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${MAHA_SITE_URL}${PHYSICAL_AI_PATH}#collection`,
  url: `${MAHA_SITE_URL}${PHYSICAL_AI_PATH}`,
  name: 'Physical AI: learned systems that act',
  description,
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  dateModified: PHYSICAL_AI_RELEASE_DATE,
  hasPart: PHYSICAL_AI_ARTICLES.map((article) => ({
    '@type': 'Article',
    '@id': `${MAHA_SITE_URL}${PHYSICAL_AI_PATH}/${article.slug}`,
    headline: article.title,
    description: article.answer,
  })),
}


const groups = [["foundations","Embodied foundations",["what-physical-ai-means","perception-action-loops","world-models","state-estimation-and-filtering"]],["learning","Learning and demonstrations",["vision-language-action-models","learning-from-demonstration","simulation-and-domain-randomization","foundation-model-fine-tuning","teleoperation-interfaces"]],["control","Control and uncertainty",["planning-and-feedback-control","uncertainty-and-distribution-shift","runtime-monitoring-and-fallback","reward-specification"]],["evaluation","Evaluation and evidence",["benchmark-validity","data-provenance-and-permissions","evaluation-fixture-example"]]]
export default function Hub() {
 const card = (slug: string) => { const a = PHYSICAL_AI_ARTICLES.find(a => a.slug === slug)!; return { href: `${PHYSICAL_AI_PATH}/${slug}`, title: a.title, description: a.answer, label: 'Source-linked explanation' } }
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} /><KnowledgeHub title="Physical AI" breadcrumb="Physical AI" eyebrow="Evidence and evaluation" introduction="Understand learned systems that act: their models, training, control loops and evaluation boundaries." boundary="Published results belong to their authors and evaluation conditions. Maha has not replicated these studies, operates no robot and endorses no vendor." groups={groups.map(([id, title, slugs]) => ({ id: id as string, title: title as string, description: 'Explore the questions, methods and boundaries below.', cards: (slugs as string[]).map(card) }))} featured={["what-physical-ai-means","world-models","evaluation-fixture-example"].map(card)} related={[["/knowledge/robotics","Robotics"],["/knowledge/nanotechnology","Nanotechnology"],["/knowledge/mathematics","Mathematics"]].map(([href, title]) => ({ href, title, description: 'Continue into this connected knowledge domain.' }))}>
        <section className="mt-12" aria-labelledby="run-it">
          <h2 id="run-it" className="evidence-section-title text-xl">Run the fixture yourself</h2>
          <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">
            A deterministic one-dimensional perception–action loop with observation noise, actuation delay, a monitor and an
            intervention path. It reports autonomous success, assisted success, failure or abort — and splits monitor firings into
            those an injected disturbance explains and those it does not.
          </p>
          <pre className="mt-5 overflow-x-auto border border-[var(--border-default)] p-4 text-sm">
{`node --experimental-strip-types scripts/physical-ai-loop.ts run --actuationDelaySteps 3
node --experimental-strip-types scripts/physical-ai-loop.ts counterexamples`}
          </pre>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
            It is a simulation with no physics, contact, hardware or people. See{' '}
            <Link className="evidence-link" href={`${PHYSICAL_AI_PATH}/evaluation-fixture-example`}>what the fixture is not</Link>.
          </p>
        </section>

        <section className="mt-12" aria-labelledby="elsewhere">
          <h2 id="elsewhere" className="evidence-section-title text-xl">Related sections</h2>
          <ul className="mt-4 list-none space-y-2 p-0">
            <li><Link className="evidence-link" href="/knowledge/robotics">Robotics evidence and evaluation</Link> — hardware, evidence intake, safety and the 40-page evaluation corpus.</li>
            <li><Link className="evidence-link" href="/knowledge/neuromorphic-biocomputing">Neuromorphic and biocomputing</Link> — event-driven sensing and in-memory computing for embodied systems.</li>
            <li><Link className="evidence-link" href="/knowledge/nanotechnology">Nanotechnology</Link> — the same evidence discipline applied to materials claims.</li>
            <li><Link className="evidence-link" href="/knowledge/mathematics">Mathematics knowledge system</Link> — the formal layer under estimation and control.</li>
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="sources">
          <h2 id="sources" className="evidence-section-title text-xl">Sources read for this section</h2>
          <ul className="mt-4 list-none space-y-4 p-0">
            {Object.values(PHYSICAL_AI_SOURCES).map((source) => (
              <li key={source.url}>
                <a className="evidence-link" href={source.url} target="_blank" rel="noreferrer noopener">{source.title} ↗</a>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">Read at: {source.locator} · inspected {source.inspected}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm leading-relaxed text-[var(--text-muted)]">
            Every performance figure on these pages is the original authors’ own reported result on their own evaluation, attributed
            as such. Maha has replicated none of them, operates no robot, and endorses no system or vendor.
          </p>
        </section>

</KnowledgeHub></>
}
