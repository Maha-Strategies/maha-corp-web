import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

import { MayonTrailer, TrackedExternalLink } from '@/components/MayonMedia'
import { MAHA_ORGANIZATION_ID, MAHA_SITE_URL } from '@/lib/entity'
import {
  MAYON_AVAILABILITY,
  MAYON_EVENTS,
  MAYON_FACTS,
  MAYON_HUB_PATH,
  MAYON_HUB_REVIEWED,
  MAYON_HUB_URL,
  MAYON_LINKS,
  MAYON_QUESTIONS,
  MAYON_ROADMAP,
  MAYON_SCREENSHOTS,
  MAYON_SOURCES,
  MAYON_TRAILER,
} from '@/lib/mayon-hub'

const title = 'Mayon Volcano: Explore the Mountain in 3D | Maha Strategies'
const description =
  'Discover the landscape, history, and hidden workings of Mayon Volcano in Bicol, Philippines. Explore an interactive 3D experience, investigate the evidence beneath the surface, and follow the next chapter of the Mayon Volcano app.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: MAYON_HUB_PATH },
  openGraph: {
    title,
    description,
    url: MAYON_HUB_URL,
    siteName: 'Maha Strategies',
    type: 'website',
    images: [{ url: '/mayon/og-mayon.jpg', width: 1200, height: 630, alt: 'Mayon Volcano — Beneath the Perfect Cone' }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/mayon/og-mayon.jpg'] },
}

/**
 * Structured data for what the page actually shows.
 *
 * Three nodes, no more: the page itself, the application it is about, and the
 * concept film embedded in it. The volcano is named as the subject of the page
 * and kept distinct from the software — one is a mountain in Albay, the other
 * is a program about it. Every VideoObject field below was read from the
 * published video, not assumed.
 */
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${MAYON_HUB_URL}#webpage`,
      url: MAYON_HUB_URL,
      name: 'Mayon Volcano — Beneath the Perfect Cone',
      description,
      isPartOf: { '@id': `${MAHA_SITE_URL}/#website` },
      publisher: { '@id': MAHA_ORGANIZATION_ID },
      about: {
        '@type': 'Place',
        name: 'Mayon Volcano',
        description: 'An active stratovolcano in Albay province, Bicol Region, Philippines.',
        address: { '@type': 'PostalAddress', addressRegion: 'Albay, Bicol Region', addressCountry: 'PH' },
      },
      dateModified: MAYON_HUB_REVIEWED,
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://mayonrajan.com/#application',
      name: 'Mayon Volcano',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web, Android, iOS',
      isAccessibleForFree: true,
      url: MAYON_LINKS.browser,
      installUrl: [MAYON_LINKS.android, MAYON_LINKS.ios],
      publisher: { '@id': MAHA_ORGANIZATION_ID },
      description:
        'A free educational 3D experience for exploring Mayon Volcano: its terrain at true scale, its eruption history, a conceptual descent through its interior, and the evidence behind each explanation.',
    },
    {
      '@type': 'VideoObject',
      name: MAYON_TRAILER.title,
      description: 'A one-minute concept film for a proposed version 2.0 of the Mayon Volcano app, using generated artwork rather than recorded app footage.',
      thumbnailUrl: `${MAHA_SITE_URL}${MAYON_TRAILER.poster}`,
      uploadDate: MAYON_TRAILER.uploadDate,
      duration: 'PT1M',
      embedUrl: MAYON_TRAILER.embedUrl,
      contentUrl: MAYON_TRAILER.watchUrl,
      publisher: { '@id': MAHA_ORGANIZATION_ID },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Maha Strategies', item: MAHA_SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Mayon Volcano', item: MAYON_HUB_URL },
      ],
    },
  ],
}

const sectionTitle = 'evidence-section-title text-2xl sm:text-3xl'
const kicker = 'font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]'

export default function MayonHubPage() {
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <article className="evidence-container">
        {/* A. Hero */}
        <header className="max-w-4xl">
          <p className={kicker}>[ Free educational experience · Albay, Bicol, Philippines ]</p>
          <h1 className="mt-5 text-4xl font-light leading-tight tracking-tight text-[var(--text-primary)] sm:text-6xl">
            Mayon Volcano — <span className="text-[var(--status-sourced)]">Beneath the Perfect Cone</span>
          </h1>
          <p className="mt-7 text-xl leading-relaxed text-[var(--text-secondary)]">{description}</p>
        </header>

        <section aria-labelledby="open-it" className="mt-10">
          <h2 id="open-it" className="sr-only">Open the experience</h2>
          <div className="grid gap-px overflow-hidden border border-[var(--border-default)] bg-[var(--border-default)] sm:grid-cols-3">
            {Object.values(MAYON_AVAILABILITY).map((entry, index) => (
              <div key={entry.platform} className="flex flex-col bg-[var(--surface-raised)] p-6">
                <p className={kicker}>{entry.platform}</p>
                <p className="mt-3 text-lg text-[var(--text-primary)]">{entry.status}</p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">{entry.detail}</p>
                <TrackedExternalLink
                  event={entry.event}
                  href={entry.href}
                  className={`mt-6 inline-block px-4 py-3 text-center text-sm ${index === 0
                    ? 'bg-[var(--status-sourced)] font-medium text-[var(--background)]'
                    : 'border border-[var(--border-strong)] text-[var(--text-primary)] transition hover:border-[var(--status-sourced)] hover:text-[var(--status-sourced)]'}`}
                >
                  {index === 0 ? 'Open in your browser ↗' : `Open the ${entry.platform} listing ↗`}
                </TrackedExternalLink>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
            Version 1.5 is live in the browser. Store listings are checked by hand, so treat the version each store offers as whatever that store says today.
          </p>
        </section>

        <figure className="mt-12 grid gap-6 border border-[var(--border-default)] bg-[var(--surface-raised)] p-6 sm:grid-cols-[minmax(0,240px)_1fr] sm:items-center">
          <Image
            src={MAYON_SCREENSHOTS[0].src}
            alt={MAYON_SCREENSHOTS[0].alt}
            width={MAYON_SCREENSHOTS[0].width}
            height={MAYON_SCREENSHOTS[0].height}
            priority
            sizes="(min-width: 640px) 240px, 100vw"
            className="h-auto w-full max-w-[240px] border border-[var(--border-subtle)]"
          />
          <figcaption className="text-sm leading-relaxed text-[var(--text-secondary)]">
            <span className="text-[var(--text-primary)]">The mountain, rendered at true scale.</span> Elevation comes from NASA SRTM data, the imagery drape from Esri. Rotate it, move the sun across the day, walk the towns at its base, then go inside. Everything below is a frame from the working app, not an illustration of one.
          </figcaption>
        </figure>

        {/* B. Meet Mayon */}
        <section aria-labelledby="meet-mayon" className="mt-16 border-t border-[var(--border-default)] pt-12">
          <p className={kicker}>[ Meet Mayon ]</p>
          <h2 id="meet-mayon" className={`mt-4 ${sectionTitle}`}>A mountain people live with, not beside</h2>
          <div className="mt-6 max-w-3xl space-y-5 leading-relaxed text-[var(--text-secondary)]">
            <p>
              Mayon rises from the plain of Albay province in the Bicol Region of Luzon, with Legazpi City at its southern foot and farmland, barangays and the ruins of the old Cagsawa church around its base. It is the most active volcano in the Philippines: the record of its eruptions is long, and living within sight of it means living with evacuation routes, permanent danger zones and agricultural seasons shaped by the mountain.
            </p>
            <p>
              Its shape is the reason people recognise it from a photograph. A stratovolcano built by many eruptions of similar material from one central vent accumulates layers at similar angles all the way round, and Mayon has been rebuilt often enough that erosion never gets far. The cone is the record of that repetition.
            </p>
          </div>

          <dl className="mt-8 grid gap-px overflow-hidden border border-[var(--border-default)] bg-[var(--border-default)] sm:grid-cols-2 lg:grid-cols-4">
            {MAYON_FACTS.map((fact) => (
              <div key={fact.label} className="bg-[var(--surface-raised)] p-5">
                <dt className={kicker}>{fact.label}</dt>
                <dd className="mt-2 text-lg text-[var(--text-primary)]">{fact.value}</dd>
                <dd className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{fact.note}</dd>
                <dd className="mt-3 text-xs">
                  <a className="evidence-link" href={fact.href} target="_blank" rel="noreferrer noopener">{fact.sourceLabel} ↗</a>
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 border border-[var(--border-strong)] bg-[var(--surface-raised)] p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-boundary)]">[ Safety boundary ]</p>
            <p className="mt-3 leading-relaxed text-[var(--text-secondary)]">
              Neither this page nor the app is a monitoring, alert, forecast, evacuation or navigation service, and neither displays a current alert level. For Mayon&apos;s current condition and what to do about it, read{' '}
              <a className="evidence-link" href={MAYON_LINKS.phivolcs} target="_blank" rel="noreferrer noopener">PHIVOLCS ↗</a>{' '}and follow local authorities.
            </p>
          </div>
        </section>

        {/* C. Explore the actual app */}
        <section aria-labelledby="explore-the-app" className="mt-16 border-t border-[var(--border-default)] pt-12">
          <p className={kicker}>[ Inside the app ]</p>
          <h2 id="explore-the-app" className={`mt-4 ${sectionTitle}`}>What you actually do in it</h2>
          <p className="mt-5 max-w-3xl leading-relaxed text-[var(--text-secondary)]">
            Four ways in: <b className="font-medium text-[var(--text-primary)]">Explore</b> the surface, <b className="font-medium text-[var(--text-primary)]">Journey Inside</b> the conceptual interior, move <b className="font-medium text-[var(--text-primary)]">Through Time</b> across two centuries of eruptions, and <b className="font-medium text-[var(--text-primary)]">Discover</b> the guides, evidence register and teacher pack. These are frames from version 1.5, captured on 16 September 2026.
          </p>

          <ul className="mt-8 grid list-none gap-8 p-0 sm:grid-cols-2">
            {MAYON_SCREENSHOTS.map((shot) => (
              <li key={shot.src} className="flex flex-col border border-[var(--border-default)] bg-[var(--surface-raised)] p-5">
                <Image
                  src={shot.src}
                  alt={shot.alt}
                  width={shot.width}
                  height={shot.height}
                  sizes="(min-width: 1024px) 520px, (min-width: 640px) 45vw, 100vw"
                  className="h-auto w-full border border-[var(--border-subtle)]"
                />
                <h3 className="mt-5 text-lg text-[var(--text-primary)]">{shot.caption}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">{shot.action}</p>
                {shot.href ? (
                  <TrackedExternalLink event={MAYON_EVENTS.browser} href={shot.href} className="evidence-link mt-4 text-sm">
                    Open this in the browser ↗
                  </TrackedExternalLink>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {/* D. Version 1.5 */}
        <section aria-labelledby="version-15" className="mt-16 border-t border-[var(--border-default)] pt-12">
          <p className={kicker}>[ Version 1.5 · live in the browser ]</p>
          <h2 id="version-15" className={`mt-4 ${sectionTitle}`}>Beneath the Perfect Cone</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="border border-[var(--border-default)] p-6">
              <h3 className="text-lg text-[var(--text-primary)]">Journey Inside</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                A guided descent through four stations beneath the summit, from the vent to a crystal-rich region roughly 18–20 km down. The geometry is a conceptual model informed by published research, not a scan of the interior.
              </p>
              <TrackedExternalLink event={MAYON_EVENTS.browser} href={MAYON_LINKS.journeyStorage} className="evidence-link mt-4 inline-block text-sm">Start at the storage station ↗</TrackedExternalLink>
            </div>
            <div className="border border-[var(--border-default)] p-6">
              <h3 className="text-lg text-[var(--text-primary)]">Follow a Crystal</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                Reveal a crystal&apos;s growth zones one at a time and read the magnesium profile from core to rim — the reasoning volcanologists use to argue that new magma arrived before an eruption.
              </p>
              <TrackedExternalLink event={MAYON_EVENTS.browser} href={MAYON_LINKS.crystal} className="evidence-link mt-4 inline-block text-sm">Open the investigation ↗</TrackedExternalLink>
            </div>
            <div className="border border-[var(--border-default)] p-6">
              <h3 className="text-lg text-[var(--text-primary)]">How do we know?</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                Each station opens a panel that separates what was observed, what researchers infer, what the scene illustrates, and what remains uncertain — including two depth estimates that disagree.
              </p>
              <TrackedExternalLink event={MAYON_EVENTS.browser} href={MAYON_LINKS.journeyDeep} className="evidence-link mt-4 inline-block text-sm">See it at the deep station ↗</TrackedExternalLink>
            </div>
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)]">
            Prefer to read it?{' '}
            <a className="evidence-link" href={MAYON_LINKS.companion} target="_blank" rel="noreferrer noopener">Beneath the Perfect Cone ↗</a>{' '}
            is the written companion to the descent, and the{' '}
            <a className="evidence-link" href={MAYON_LINKS.updates} target="_blank" rel="noreferrer noopener">public change log ↗</a>{' '}
            records what changed in each release.
          </p>
        </section>

        {/* E. Understand the mountain */}
        <section aria-labelledby="questions" className="mt-16 border-t border-[var(--border-default)] pt-12">
          <p className={kicker}>[ Understand the mountain ]</p>
          <h2 id="questions" className={`mt-4 ${sectionTitle}`}>Six questions, answered</h2>
          <div className="mt-8 max-w-3xl space-y-8">
            {MAYON_QUESTIONS.map((entry) => (
              <div key={entry.id} id={entry.id}>
                <h3 className="text-lg text-[var(--text-primary)]">{entry.question}</h3>
                <p className="mt-3 leading-relaxed text-[var(--text-secondary)]">{entry.answer}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)]">
            The app&apos;s own library goes further: <a className="evidence-link" href={MAYON_LINKS.methods} target="_blank" rel="noreferrer noopener">methods and limits ↗</a>,{' '}
            <a className="evidence-link" href={MAYON_LINKS.sources} target="_blank" rel="noreferrer noopener">the source and evidence register ↗</a>, and the{' '}
            <Link className="evidence-link" href="/projects/mayon">project background on this site</Link>.
          </p>
        </section>

        {/* F. The Living Mountain */}
        <section aria-labelledby="living-mountain" className="mt-16 border-t border-[var(--border-default)] pt-12">
          <p className={kicker}>[ Version 2.0 · a proposal ]</p>
          <h2 id="living-mountain" className={`mt-4 ${sectionTitle}`}>The Living Mountain</h2>
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
            <div>
              <p className="border border-[var(--border-strong)] bg-[var(--surface-raised)] p-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                <b className="font-medium text-[var(--text-primary)]">This is a concept film.</b> Its imagery is generated artwork illustrating experiences we would like to build. It is not a recording of the app, and nothing in it is available today.
              </p>
              <div className="mt-5">
                <MayonTrailer />
              </div>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                One minute, no sound required to follow it.{' '}
                <TrackedExternalLink event={MAYON_EVENTS.trailer} href={MAYON_TRAILER.watchUrl} className="evidence-link">Watch on YouTube instead ↗</TrackedExternalLink>
              </p>
            </div>
            <div>
              <h3 className="text-lg text-[var(--text-primary)]">Where this could go</h3>
              <ul className="mt-4 list-none space-y-4 p-0">
                {MAYON_ROADMAP.map((item) => (
                  <li key={item.title} className="border-l border-[var(--border-strong)] pl-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-boundary)]">{item.status}</p>
                    <p className="mt-1 text-[var(--text-primary)]">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{item.detail}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm leading-relaxed text-[var(--text-muted)]">
                No dates are promised, and nothing here is a paid feature.{' '}
                <a className="evidence-link" href={MAYON_LINKS.thesis} target="_blank" rel="noreferrer noopener">The Volcanic Engine ↗</a>{' '}
                is optional reading: a working paper on volcanism and planetary systems, not peer reviewed, and not a validation of this model of Mayon.
              </p>
            </div>
          </div>
        </section>

        {/* G. Mayon as home */}
        <section aria-labelledby="mayon-as-home" className="mt-16 border-t border-[var(--border-default)] pt-12">
          <p className={kicker}>[ Mayon as home ]</p>
          <h2 id="mayon-as-home" className={`mt-4 ${sectionTitle}`}>If you live with this mountain, we would rather learn from you than guess</h2>
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div className="space-y-5 leading-relaxed text-[var(--text-secondary)]">
              <p>
                A terrain model and a set of papers can describe a volcano. They cannot describe what it is like to grow up under one: which view means home, what the older generation remembers, which words in Bikol carry meanings that a translation flattens, what a farmer watches for that no instrument reports.
              </p>
              <p>
                We would like to hear from residents of Albay and the wider Bicol Region, teachers, local historians, researchers, artists and cultural organisations — about everyday memory, local knowledge, language, history, and how people relate to the mountain.
              </p>
            </div>
            <div className="border border-[var(--border-default)] bg-[var(--surface-raised)] p-6">
              <h3 className="text-lg text-[var(--text-primary)]">How this would work</h3>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                <li>Nothing is used without asking. Any contribution is used only with your specific permission, with presentation and credit agreed first.</li>
                <li>We do not lift posts, photographs, usernames or stories from anywhere else and present them as testimonials.</li>
                <li>There is no partnership, commission or funded programme behind this — it is an open invitation, and we cannot promise a reply time.</li>
              </ul>
              <TrackedExternalLink event={MAYON_EVENTS.contribute} href={MAYON_LINKS.contact} className="evidence-action evidence-action--secondary mt-6 inline-block">
                Write to us about Mayon
              </TrackedExternalLink>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                Email reaches mayone@mahastrategies.com. It is not an emergency channel; for current volcanic activity, use PHIVOLCS.
              </p>
            </div>
          </div>
        </section>

        {/* H. For educators */}
        <section aria-labelledby="for-educators" className="mt-16 border-t border-[var(--border-default)] pt-12">
          <p className={kicker}>[ For educators ]</p>
          <h2 id="for-educators" className={`mt-4 ${sectionTitle}`}>Take the mountain into a classroom</h2>
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div>
              <p className="leading-relaxed text-[var(--text-secondary)]">
                The app&apos;s teacher hub holds a ready-made route through a 20–45 minute lesson, student prompts, a QR poster for a projector or corridor wall, and slides. It is free, needs no account, and runs on whatever browser the room already has.
              </p>
              <TrackedExternalLink event={MAYON_EVENTS.teachers} href={MAYON_LINKS.teachers} className="evidence-action evidence-action--primary mt-6 inline-block">
                Open the teacher hub ↗
              </TrackedExternalLink>
            </div>
            <div className="border border-[var(--border-default)] p-6 text-sm leading-relaxed text-[var(--text-secondary)]">
              <h3 className="text-lg text-[var(--text-primary)]">What is reviewed, and what is not</h3>
              <p className="mt-3">
                The terrain, imagery and eruption-history sources are listed claim by claim in the app&apos;s{' '}
                <a className="evidence-link" href={MAYON_LINKS.sources} target="_blank" rel="noreferrer noopener">evidence register ↗</a>. Parts of the wider learning library are explicitly an unreviewed seed curriculum, and say so on the page.
              </p>
              <p className="mt-3">
                Nothing here is endorsed by PHIVOLCS or approved against a national curriculum. Use it as a teaching aid, and treat the hazard scenes as discussion material rather than official guidance.
              </p>
            </div>
          </div>
        </section>

        {/* I. Sources and project identity */}
        <section aria-labelledby="sources" className="mt-16 border-t border-[var(--border-default)] pt-12">
          <p className={kicker}>[ Sources and corrections ]</p>
          <h2 id="sources" className={`mt-4 ${sectionTitle}`}>Where this comes from</h2>
          <ul className="mt-6 max-w-3xl list-none space-y-5 p-0">
            {MAYON_SOURCES.map((source) => (
              <li key={source.href}>
                <a className="evidence-link" href={source.href} target="_blank" rel="noreferrer noopener">{source.title} ↗</a>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{source.use}</p>
              </li>
            ))}
          </ul>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="text-sm leading-relaxed text-[var(--text-secondary)]">
              <h3 className="text-lg text-[var(--text-primary)]">The project</h3>
              <p className="mt-3">
                Mayon Volcano is published by Maha Strategies LLC and built by Mayone Maha Rajan. The interactive lives at{' '}
                <TrackedExternalLink event={MAYON_EVENTS.browser} href={MAYON_LINKS.browser} className="evidence-link">mayonrajan.com</TrackedExternalLink>; this page is its home on the company site.
              </p>
              <p className="mt-3">
                <Link className="evidence-link" href="/projects/mayon">Project background and methods</Link> ·{' '}
                <Link className="evidence-link" href="/apps/mayon/privacy">Privacy notice</Link>
              </p>
            </div>
            <div className="text-sm leading-relaxed text-[var(--text-secondary)]">
              <h3 className="text-lg text-[var(--text-primary)]">Corrections</h3>
              <p className="mt-3">
                If something here is wrong — a fact, a source, an accessibility problem, or a caption that misdescribes what the app does — write to{' '}
                <a className="evidence-link" href={MAYON_LINKS.contact}>mayone@mahastrategies.com</a> and it will be fixed or removed.
              </p>
              <p className="mt-3">Facts, statuses and links on this page last checked {MAYON_HUB_REVIEWED}.</p>
            </div>
          </div>

          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-[var(--text-muted)]">
            Looking for Māyōṉ in early Tamil literature? That is a different subject that happens to share a spelling. Read the{' '}
            <Link className="evidence-link" href="/knowledge/religion/mayon">source-bound Māyōṉ dossier</Link>. It has no historical, geographic or religious connection to the volcano.
          </p>
        </section>
      </article>
    </main>
  )
}
