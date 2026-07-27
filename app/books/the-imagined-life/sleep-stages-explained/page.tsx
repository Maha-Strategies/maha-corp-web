import Link from 'next/link'
import type { Metadata } from 'next'
import ArticleTableOfContents from '@/components/ArticleTableOfContents'
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'

const SITE_URL = 'https://www.mahastrategies.com'
const URL = `${SITE_URL}/books/the-imagined-life/sleep-stages-explained`

export const metadata: Metadata = {
  title: 'NREM Sleep Stages Explained: N1, N2, N3, REM, and Dreaming',
  description:
    'What NREM sleep means, how N1, N2, N3 and REM differ, what stage people dream in, and how sleep cycles change through the night.',
  alternates: { canonical: '/books/the-imagined-life/sleep-stages-explained' },
  openGraph: {
    type: 'article',
    url: URL,
    title: 'NREM Sleep Stages Explained: N1, N2, N3, REM, and Dreaming',
    description:
      'A plain-English guide to NREM sleep, N1, N2, N3, REM sleep, dreaming, and sleep cycles.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Sleep Stages Explained — Maha Strategies' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NREM Sleep Stages Explained: N1, N2, N3, REM, and Dreaming',
    description: 'A plain-English guide to NREM sleep, REM sleep, cycles, and dreaming.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const sources = [
  {
    title: 'How Sleep Works: Sleep Phases and Stages',
    authors: 'National Heart, Lung, and Blood Institute, NIH',
    href: 'https://www.nhlbi.nih.gov/health/sleep/stages-of-sleep',
    note: 'A public-health overview of non-REM stages, REM sleep, and nightly sleep cycles.',
  },
  {
    title: 'How Sleep Works: Your Sleep/Wake Cycle',
    authors: 'National Heart, Lung, and Blood Institute, NIH',
    href: 'https://www.nhlbi.nih.gov/health/sleep/sleep-wake-cycle',
    note: 'Explains circadian clocks, light cues, and the biological pressure for sleep.',
  },
  {
    title: 'Understanding Sleep',
    authors: 'National Institute of Neurological Disorders and Stroke, NIH',
    href: 'https://www.ninds.nih.gov/sites/default/files/2025-05/understanding-sleep.pdf',
    note: 'A detailed federal guide to sleep-stage features and the differences between REM and non-REM sleep.',
  },
  {
    title: 'The Neural Correlates of Dreaming',
    authors: 'Siclari et al. (2017)',
    href: 'https://pubmed.ncbi.nlm.nih.gov/28394322/',
    note: 'A sleep-laboratory study showing that dream reports can occur in both REM and non-REM sleep.',
  },
  {
    title: 'Sleep Deprivation and Deficiency: Diagnosis',
    authors: 'National Heart, Lung, and Blood Institute, NIH',
    href: 'https://www.nhlbi.nih.gov/health/sleep-deprivation/diagnosis-treatment',
    note: 'Guidance on when persistent sleep concerns or daytime sleepiness merit discussion with a healthcare professional.',
  },
]

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'NREM Sleep Stages Explained: N1, N2, N3, REM, and Dreaming',
  description:
    'A plain-English guide to sleep stages: REM and non-REM sleep, N1, N2, N3, sleep cycles, dreaming, circadian timing, and when to discuss sleep symptoms with a clinician.',
  url: URL,
  mainEntityOfPage: URL,
  isPartOf: { '@id': `${SITE_URL}/books/the-imagined-life#book` },
  author: { '@type': 'Person', name: 'Mayone Maha Rajan' },
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  datePublished: '2026-07-16',
  dateModified: '2026-07-22',
  isAccessibleForFree: true,
  inLanguage: 'en',
  articleSection: 'Sleep explainer',
  about: [
    { '@type': 'Thing', name: 'Sleep stages' },
    { '@type': 'Thing', name: 'Rapid eye movement sleep' },
    { '@type': 'Thing', name: 'Dreaming' },
  ],
  citation: sources.map((source) => source.href),
}

export default function SleepStagesExplainedPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <article className="max-w-3xl mx-auto px-6 py-20 sm:py-28">
        <Link href="/books/the-imagined-life" className="inline-block font-mono text-xs text-indigo-300 hover:text-white tracking-widest uppercase transition-colors mb-12">
          ← The Imagined Life
        </Link>

        <header className="border-b border-zinc-800 pb-10 mb-12">
          <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-5">[ Plain-English sleep guide ]</p>
          <h1 className="text-4xl sm:text-5xl font-light text-white leading-[1.1] tracking-tight mb-6">NREM sleep stages explained: N1, N2, N3, REM, and dreaming</h1>
          <p className="text-xl text-zinc-300 font-light leading-relaxed">
            Sleep is not one uniform state. Across the night, the brain and body move repeatedly through non-REM and REM sleep, each identified by characteristic patterns in sleep studies. The stages are measurable; the full purpose of dreaming is still an open scientific question.
          </p>
          <p className="mt-7 font-mono text-xs text-zinc-500 tracking-widest uppercase">Mayone Maha Rajan · The Imagined Life</p>
        </header>

        <ArticleTableOfContents contentId="article-content" />
        <div id="article-content" data-article-content className="prose prose-invert prose-lg max-w-none prose-p:text-zinc-300 prose-p:leading-[1.85] prose-p:mb-7 prose-strong:text-white prose-a:text-indigo-300 prose-a:no-underline hover:prose-a:text-white prose-li:text-zinc-300 prose-li:leading-relaxed">
          <h2>Short answer</h2>
          <p>
            <strong>NREM sleep</strong> means non-rapid eye movement sleep. It has three stages: N1, N2, and N3. A typical night alternates between NREM and rapid eye movement (REM) sleep in cycles that commonly last about 80 to 100 minutes. The exact timing and amount of each stage vary by person, age, night, and circumstance. <a href={sources[0].href}>[1]</a>
          </p>
          <p>
            Sleep stages are classifications made from signals measured in sleep studies, including brain activity and eye movements. They are a useful map of a night’s physiology, not a scorecard of personal worth or a diagnosis from a single night of data.
          </p>

          <h2>What does NREM sleep mean?</h2>
          <p>
            NREM is short for <strong>non-rapid eye movement</strong> sleep. It includes the transition into sleep (N1), established sleep (N2), and deep or slow-wave sleep (N3). In a sleep study, these stages are classified from measured brain activity rather than from how rested someone feels the next morning. <a href={sources[0].href}>[1]</a>
          </p>

          <h2>NREM sleep stages: N1, N2, and N3</h2>
          <h3>N1: the transition into sleep</h3>
          <p>
            N1 is the shift from wakefulness into sleep. It is usually brief. Breathing, heartbeat, eye movements, and brain-wave patterns begin to slow, and it is easy to wake. This is the threshold rather than a destination: the body is no longer fully awake, but has not yet moved into deeper non-REM sleep.
          </p>
          <h3>N2: established sleep</h3>
          <p>
            N2 is a lighter stage of sleep in which the sleeper is clearly asleep. Physiological activity continues to slow, and sleep researchers identify N2 using distinctive short bursts and patterns in brain activity. People typically spend a substantial share of the night in this stage. <a href={sources[2].href}>[3]</a>
          </p>
          <h3>N3: deep or slow-wave sleep</h3>
          <p>
            N3 is commonly called deep sleep or slow-wave sleep because of the pattern seen in brain recordings. It is more prominent earlier in the night, and waking from it can be difficult. The amount of slow-wave sleep changes across the lifespan, which is one reason a fixed “ideal” chart cannot describe every person. <a href={sources[0].href}>[1]</a>
          </p>

          <h2>REM vs. NREM sleep</h2>
          <p>
            The simplest distinction is that NREM sleep includes N1, N2, and N3, while REM is a separate phase. During REM sleep, the eyes move rapidly beneath closed lids and measured brain activity becomes more wake-like. Dreaming commonly occurs in REM sleep. At the same time, the large muscles of the arms and legs normally become temporarily relaxed or limp, a state called muscle atonia that helps prevent most people from acting out dreams. REM sleep tends to occupy more of the later part of the night. <a href={sources[0].href}>[1]</a>
          </p>
          <p>
            REM is not “better” sleep and non-REM is not empty sleep. They are different, recurring physiological states. Both belong to a normal night’s architecture, and both are studied as part of healthy sleep.
          </p>

          <table>
            <thead><tr><th>Stage</th><th>Where it fits</th><th>Plain-English description</th></tr></thead>
            <tbody>
              <tr><td>N1</td><td>NREM</td><td>The brief transition between wakefulness and sleep.</td></tr>
              <tr><td>N2</td><td>NREM</td><td>Established sleep; a person is clearly asleep.</td></tr>
              <tr><td>N3</td><td>NREM</td><td>Deep or slow-wave sleep, often more prominent earlier in the night.</td></tr>
              <tr><td>REM</td><td>REM</td><td>Brain activity is more wake-like; vivid dreaming is common and muscles normally become limp.</td></tr>
            </tbody>
          </table>

          <h2>Sleep cycles change across the night</h2>
          <p>
            You do not descend through the stages once and remain there until morning. You cycle through them repeatedly. Deep non-REM sleep is generally more concentrated in the earlier part of the night, while REM periods tend to lengthen later on. Brief awakenings between cycles can occur and may not be remembered. <a href={sources[0].href}>[1]</a>
          </p>
          <p>
            This repeating pattern is influenced by more than a clock on the wall. Circadian clocks help coordinate when the body is prepared for sleep and wakefulness, and light, darkness, caffeine, schedules, and time awake can all affect the system. <a href={sources[1].href}>[2]</a>
          </p>

          <h2>What stage of sleep do you dream in?</h2>
          <p>
            Dreaming commonly happens during REM sleep, and REM dreams are often vivid. But dreams are not exclusive to REM: dream reports can also occur after non-REM sleep. That is why researchers distinguish the physiology of a sleep stage from the experience of dreaming itself. A 2017 high-density EEG study found neural patterns associated with reports of dreaming in both REM and non-REM sleep. <a href={sources[3].href}>[4]</a>
          </p>
          <p>
            What science has not settled is a single universal answer to “why do we dream?” The existence, timing, and correlates of dreams can be studied. Their full function—and whether every dream has a hidden message or purpose—is not established by sleep-stage data.
          </p>

          <h2>When to discuss sleep with a clinician</h2>
          <p>
            This guide cannot diagnose a sleep disorder. Speak with a healthcare professional if sleep problems are persistent or are affecting daily life—for example, if you often feel very sleepy during the day, do not wake refreshed, have trouble sleeping over time, or are told that you snore loudly, gasp, or stop breathing during sleep. A clinician can assess the pattern and decide whether testing is appropriate. <a href={sources[4].href}>[5]</a>
          </p>

          <h2>Where The Imagined Life begins</h2>
          <p>
            <em>The Imagined Life</em> begins with this measurable architecture: non-REM stages, REM sleep, cycling, and the fact that dream experience is related to—but not identical with—REM sleep. The book then asks a larger question about imagination: how internally generated possibilities influence waking attention, action, and a life.
          </p>
          <p>
            That larger argument is interpretive. It does not claim that dreams predict the future, supply a universal symbolic code, or replace medical care. Sleep science provides the ground; the book’s account of the “faculty of the possible” begins where that ground ends.
          </p>

          <h2>Frequently asked questions</h2>
          <h3>What is N1 sleep?</h3>
          <p>N1 is the first NREM stage: the usually brief transition from wakefulness into sleep. It is easy to wake from N1. <a href={sources[0].href}>[1]</a></p>
          <h3>What is N2 sleep?</h3>
          <p>N2 is an NREM stage in which a person is clearly asleep. Sleep researchers identify it using characteristic patterns in measured brain activity. <a href={sources[0].href}>[1]</a></p>
          <h3>What is N3 sleep?</h3>
          <p>N3 is deep or slow-wave NREM sleep. It is often more prominent earlier in the night, and waking from it can be difficult. <a href={sources[0].href}>[1]</a></p>
          <h3>How many stages of sleep are there?</h3>
          <p>The current commonly used framework has three NREM stages—N1, N2, and N3—plus REM sleep as a separate phase. <a href={sources[0].href}>[1]</a></p>
          <h3>Do people dream every night?</h3>
          <p>
            Dream recall varies. People may report dreams after both REM and non-REM sleep, but not remembering a dream does not establish that no mental experience occurred.
          </p>
          <h3>Are sleep cycles exactly 90 minutes?</h3>
          <p>
            No. Sleep cycles are often described as roughly 90 minutes, but the NHLBI gives a typical range of 80 to 100 minutes, and real nights vary. <a href={sources[0].href}>[1]</a>
          </p>
          <h3>Does every dream have a meaning?</h3>
          <p>
            Sleep research does not establish a universal dream dictionary or show that every dream carries a hidden message. A dream may be personally meaningful to a dreamer without functioning as a clinical diagnosis or a prediction.
          </p>
        </div>

        <section className="mt-16 pt-8 border-t border-zinc-800">
          <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-5">[ Sources ]</p>
          <ol className="space-y-5">
            {sources.map((source, index) => (
              <li key={source.href} className="grid grid-cols-[1.5rem_1fr] gap-4 text-sm leading-relaxed">
                <span className="font-mono text-zinc-600">{index + 1}</span>
                <div>
                  <a href={source.href} className="text-zinc-200 hover:text-white transition-colors">{source.title}</a>
                  <span className="text-zinc-500"> · {source.authors}</span>
                  <p className="text-zinc-500 mt-1">{source.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <footer className="mt-16 pt-8 border-t border-zinc-800">
          <p className="font-mono text-xs text-zinc-500 tracking-widest uppercase mb-4">[ Continue reading ]</p>
          <div className="flex flex-col gap-3">
            <Link href="/books/the-imagined-life/read/what-happens-when-you-sleep" className="text-zinc-300 hover:text-white transition-colors">Read Chapter 1: What Happens When You Sleep ↗</Link>
            <Link href="/books/the-imagined-life" className="text-zinc-300 hover:text-white transition-colors">Return to The Imagined Life ↗</Link>
          </div>
        </footer>
      </article>
    </main>
  )
}
