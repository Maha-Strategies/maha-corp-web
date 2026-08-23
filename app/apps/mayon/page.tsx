import type { Metadata } from 'next'
import Link from 'next/link'
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'
import { APP_STORE_LINKS } from '@/lib/app-store-links'

const pageUrl = 'https://www.mahastrategies.com/apps/mayon'

export const metadata: Metadata = {
  title: 'Explore Mayon Volcano in 3D | Free Educational App',
  description: 'Explore Mayon Volcano at true scale: a free interactive field trip for classrooms and curious visitors, with history, hazards, places, and source-linked context.',
  alternates: { canonical: pageUrl },
  openGraph: {
    title: 'Explore Mayon Volcano in 3D | Free Educational App',
    description: 'A free interactive field trip through Mayon Volcano, its history, landscape, and volcanology.',
    url: pageUrl,
    type: 'website',
  },
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is Mayon a live warning or forecasting service?',
      acceptedAnswer: { '@type': 'Answer', text: 'No. Mayon is an educational visualization. It must not be used for alert levels, evacuation decisions, route planning, or emergency information. Follow PHIVOLCS and local authorities for current activity and instructions.' },
    },
    {
      '@type': 'Question',
      name: 'Are Mayon’s subsurface and hazard visuals direct observations?',
      acceptedAnswer: { '@type': 'Answer', text: 'No. Interior forms and hazard overlays are clearly bounded explanatory reconstructions. They are based on volcanic science and terrain context, but they are not direct images of the subsurface or live hazard assessments.' },
    },
    {
      '@type': 'Question',
      name: 'Is Mayon free to use?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes. Mayon is a free educational demonstration. The public interactive does not require an account.' },
    },
  ],
}

const appJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Mayon',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Web, iOS, Android',
  isAccessibleForFree: true,
  url: APP_STORE_LINKS.mayon.web,
  sameAs: [pageUrl, APP_STORE_LINKS.mayon.ios, APP_STORE_LINKS.mayon.android],
  installUrl: [APP_STORE_LINKS.mayon.ios, APP_STORE_LINKS.mayon.android],
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  description: 'A free educational interactive for exploring Mayon Volcano, its landscape, eruption history, and volcanology concepts.',
}

export default function MayonDocumentationPage() {
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }} />
      <article className="evidence-container evidence-container--narrow">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Free interactive field trip · Mayon Volcano, Bicol ]</p>
        <h1 className="mt-5 max-w-4xl text-4xl font-light leading-tight tracking-tight text-[var(--text-primary)] sm:text-6xl">Stand before Mayon.<br /><span className="text-[var(--status-sourced)]">Then step inside the story.</span></h1>
        <p className="mt-7 max-w-3xl text-xl leading-relaxed text-[var(--text-secondary)]">Mayon is a free, true-scale volcano explorer that turns a remarkable landscape into a living lesson—through guided stories, historical places, explanatory interiors, and carefully framed hazard scenarios.</p>

        <section className="mt-12 flex flex-wrap gap-4" aria-label="Mayon links">
          <a href={APP_STORE_LINKS.mayon.ios} target="_blank" rel="noreferrer" className="border border-white bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200">Download on the App Store ↗</a>
          <a href={APP_STORE_LINKS.mayon.android} target="_blank" rel="noreferrer" className="border border-cyan-500 bg-cyan-400 px-5 py-3 text-sm font-medium text-black transition hover:bg-cyan-200">Get it on Google Play ↗</a>
          <a href={APP_STORE_LINKS.mayon.web} target="_blank" rel="noreferrer" className="border border-[var(--border-strong)] px-5 py-3 text-sm text-[var(--text-primary)] transition hover:border-cyan-500 hover:text-[var(--status-sourced)]">Open the web experience</a>
          <a href="https://mayonrajan.com/teachers/" target="_blank" rel="noreferrer" className="border border-[var(--border-strong)] px-5 py-3 text-sm text-[var(--text-primary)] transition hover:border-cyan-500 hover:text-[var(--status-sourced)]">Bring it to your classroom</a>
        </section>

        <section className="mt-14 grid gap-px overflow-hidden border border-[var(--border-default)] bg-zinc-800 sm:grid-cols-3">
          <div className="bg-[var(--surface-raised)] p-7"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">Explore</p><p className="mt-3 text-lg text-[var(--text-primary)]">Fly from rice fields to the summit.</p><p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">Read the cone at true scale and find the landscape around it.</p></div>
          <div className="bg-[var(--surface-raised)] p-7"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">Remember</p><p className="mt-3 text-lg text-[var(--text-primary)]">Follow the places that hold the history.</p><p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">Move between Cagsawa, Daraga, Legazpi, and Mayon&apos;s changing slopes.</p></div>
          <div className="bg-[var(--surface-raised)] p-7"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">Understand</p><p className="mt-3 text-lg text-[var(--text-primary)]">Learn to see evidence and uncertainty.</p><p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">Compare observations, reconstructions, and the limits of a public model.</p></div>
        </section>

        <section className="mt-14 border border-amber-900/50 bg-amber-950/10 p-7">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-boundary)]">[ Important safety boundary ]</p>
          <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">Mayon is not a live alert, monitoring, forecast, evacuation, navigation, or emergency-response system. Its hazard graphics are educational scenarios. For current volcanic activity and safety instructions, use PHIVOLCS and local authorities.</p>
        </section>

        <section className="mt-16">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Made for shared discovery ]</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-light text-[var(--text-primary)]">A launch point for the classroom, a museum screen, or an evening of curiosity.</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="border border-[var(--border-default)] p-6"><h3 className="text-lg text-[var(--text-primary)]">For educators</h3><p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">Start a 20–45 minute lesson with a ready-to-use route, student prompts, QR poster, and slides.</p><a href="https://mayonrajan.com/teachers/" target="_blank" rel="noreferrer" className="mt-5 inline-block text-sm text-[var(--status-sourced)] underline">Open the Teacher Launch Kit</a></div>
            <div className="border border-[var(--border-default)] p-6"><h3 className="text-lg text-[var(--text-primary)]">For Bicol and visitors</h3><p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">Reconnect familiar views, landmarks, and memory with the larger geologic landscape beneath them.</p><a href="https://mayonrajan.com" target="_blank" rel="noreferrer" className="mt-5 inline-block text-sm text-[var(--status-sourced)] underline">Begin the journey</a></div>
            <div className="border border-[var(--border-default)] p-6"><h3 className="text-lg text-[var(--text-primary)]">For volcano learners</h3><p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">Use an approachable model to discuss hazards, evidence, uncertainty, and the science of active volcanoes.</p><a href="https://mayonrajan.com/methods/" target="_blank" rel="noreferrer" className="mt-5 inline-block text-sm text-[var(--status-sourced)] underline">Review methods and sources</a></div>
          </div>
        </section>

        <section className="mt-16 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl text-[var(--text-primary)]">What the experience includes</h2>
            <ul className="mt-5 space-y-3 leading-relaxed text-[var(--text-secondary)]">
              <li>True-scale terrain and a navigable view of Mayon and its surrounding landscape.</li>
              <li>Guided stops for cone formation, the 1814 Cagsawa disaster, 2018 activity, Daraga, and nearby places.</li>
              <li>Illustrative lava, pyroclastic-density-current, ash, and lahar scenarios for discussion.</li>
              <li>An interior explainer that distinguishes what is observed, inferred, reconstructed, and unknown.</li>
              <li>Teacher materials for a short lesson, student worksheet, QR poster, and slide deck.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-2xl text-[var(--text-primary)]">How to use it in class</h2>
            <ol className="mt-5 space-y-3 leading-relaxed text-[var(--text-secondary)]">
              <li>1. Start with the main view and ask learners to identify the cone, towns, fields, and drainage paths.</li>
              <li>2. Use Story or Places mode to connect geology with Cagsawa, Daraga, Legazpi, and lived landscape.</li>
              <li>3. Turn on a hazard scenario and discuss both the process shown and what the visualization cannot establish.</li>
              <li>4. Use the source links and official agencies to distinguish a model from current public-safety information.</li>
            </ol>
          </div>
        </section>

        <section className="mt-16 border-t border-[var(--border-default)] pt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Methods and evidence ]</p>
          <h2 className="mt-4 text-2xl text-[var(--text-primary)]">What the visual model can—and cannot—say</h2>
          <div className="mt-6 space-y-5 leading-relaxed text-[var(--text-secondary)]">
            <p><b className="font-medium text-[var(--text-primary)]">Surface:</b> terrain and imagery are presented as an educational rendering at true scale. They are not a survey product or a substitute for field measurement.</p>
            <p><b className="font-medium text-[var(--text-primary)]">History:</b> short historical chapters simplify a complex eruption record so learners can begin to ask better questions. They do not recreate every event or impact.</p>
            <p><b className="font-medium text-[var(--text-primary)]">Interior:</b> chamber, dike, and hydrothermal forms are conceptual inferences, not direct subsurface imagery.</p>
            <p><b className="font-medium text-[var(--text-primary)]">Hazards:</b> corridors and routes are teaching overlays informed by terrain and documented hazard context. They are never location-specific advice or a forecast.</p>
          </div>
          <div className="mt-7 flex flex-wrap gap-4 text-sm">
            <a href="https://mayonrajan.com/methods/" target="_blank" rel="noreferrer" className="text-[var(--status-sourced)] underline">Mayon methods and sources</a>
            <a href="https://research.mahastrategies.com/papers/the-volcanic-engine-thesis" target="_blank" rel="noreferrer" className="text-[var(--status-sourced)] underline">Related volcanism working paper</a>
            <Link href="/projects/mayon" className="text-[var(--status-sourced)] underline">Maha Strategies project overview</Link>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-[var(--text-muted)]">The related working paper provides broad planetary-volcanism context; it does not validate the Mayon visual model or replace the project&apos;s own source record.</p>
        </section>

        <section className="mt-16 grid gap-10 border-t border-[var(--border-default)] pt-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl text-[var(--text-primary)]">Access and privacy</h2>
            <p className="mt-5 leading-relaxed text-[var(--text-secondary)]">The public interactive is free and does not require an account. The mobile app uses no advertising, in-app purchases, native analytics SDK, or push notifications. The companion website uses anonymous, cookie-free aggregate analytics.</p>
            <Link href="/apps/mayon/privacy" className="mt-5 inline-block text-[var(--status-sourced)] underline">Read the Mayon privacy policy</Link>
          </div>
          <div>
            <h2 className="text-2xl text-[var(--text-primary)]">Mobile app status</h2>
            <p className="mt-5 leading-relaxed text-[var(--text-secondary)]">Android and iOS versions are being prepared for store release. Until they are available, the complete interactive is accessible on the web. The mobile version uses the same educational and safety boundaries described here.</p>
          </div>
        </section>

        <section className="mt-16 border-t border-[var(--border-default)] pt-10">
          <h2 className="text-2xl text-[var(--text-primary)]">Questions and corrections</h2>
          <p className="mt-5 max-w-3xl leading-relaxed text-[var(--text-secondary)]">For a source correction, classroom feedback, accessibility request, or collaboration inquiry, contact <a href="mailto:mayone@mahastrategies.com" className="text-[var(--status-sourced)] underline">mayone@mahastrategies.com</a>. This address is not an emergency channel.</p>
          <p className="mt-8 text-sm text-[var(--text-muted)]">Last documentation review: 26 July 2026.</p>
        </section>
      </article>
    </main>
  )
}
