import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/briefs-data'

const path = '/knowledge/astrology/reading-guide'
const title = 'How to Read Your Vedic D1/D9 Birth Chart Report'
const description = 'A worked synthetic example explains D1 and Navamsa D9 placements, dasha periods, source-linked reflections and birth-time uncertainty in Maha’s free report.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL), title, description,
  alternates: { canonical: path }, robots: { index: true, follow: true },
  openGraph: { type: 'article', title, description, url: `${SITE_URL}${path}` },
}

export default function ReadingGuide() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'TechArticle', headline: title,
    description, url: `${SITE_URL}${path}`,
    author: { '@type': 'Organization', name: 'Maha Strategies', url: SITE_URL },
  }
  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article className="mx-auto max-w-3xl space-y-10 text-base leading-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-3 text-sm text-violet-300">
          <Link href="/knowledge">Knowledge</Link><span>/</span><Link href="/knowledge/astrology">Astrology</Link><span>/ Reading guide</span>
        </nav>
        <header>
          <h1 className="text-4xl font-semibold leading-tight text-white">{title}</h1>
          <p className="mt-6">Maha’s free birth chart report calculates planetary positions and shows how a small, named Jyotiṣa source vocabulary can be used for reflection. You can inspect the calculation factors and source behind each explanation. A calculated placement, a historical teaching and a modern question are different things; the report labels them separately.</p>
          <p className="mt-4 text-sm">Prepared by Maha Strategies with automated internal source and implementation review. Not practitioner- or expert-reviewed; predictive validity is not established.</p>
          <Link href="/knowledge/birth" className="mt-6 inline-block border border-violet-400 px-5 py-3 text-violet-200 focus-visible:outline">Generate a free report →</Link>
        </header>
        <section>
          <h2 className="text-2xl font-semibold text-white">What to enter, and what you receive</h2>
          <p>Enter the calendar date, local birth time and place. Confirm the historical time zone and coordinates, especially if using manual location details. The timing moment is explicitly UTC and determines which periods and transit snapshots are displayed. If the time is approximate, enter a plus-or-minus uncertainty range rather than treating it as exact.</p>
          <p className="mt-4">The output includes a Lahiri sidereal D1 chart with whole-sign houses and mean lunar nodes, a Navamsa D9 mapping, Vimśottarī major and subperiods, and upcoming position snapshots. It also offers bounded relationship and work reflections. The basic reader requires no account or payment and is subject to shared capacity limits.</p>
          <p className="mt-4">Different conventions can produce different charts. Compare the <Link href="/knowledge/astrology/lahiri-ayanamsa" className="text-violet-300 underline">Lahiri method</Link> and <Link href="/knowledge/astrology/tropical-vs-sidereal" className="text-violet-300 underline">tropical versus sidereal frames</Link> before treating a disagreement between services as an arithmetic error.</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-white">Worked example: a synthetic chart, not a person</h2>
          <p>For 1 January 2000 at 12:00 UTC, latitude 0° and longitude 0°, the tested reader gives a Pisces D1 ascendant and Sagittarius D9 ascendant under its stated conventions. These coordinates are a synthetic fixture, not anyone’s birth details or evidence that predictions work.</p>
          <ol className="mt-4 list-decimal space-y-3 pl-6">
            <li><strong>Calculated structure:</strong> the seventh whole-sign house is Virgo. Its traditional ruler, Mercury, is in Sagittarius in D1 and Gemini in D9.</li>
            <li><strong>Textual basis:</strong> Iyer’s edition associates the seventh house with wife, with generosity and respect in the translator’s table; its planetary vocabulary associates Mercury with speech. This is historical, gendered vocabulary—not a conclusion about the visitor’s relationship.</li>
            <li><strong>Modern reflection:</strong> Maha turns that vocabulary into a question about what needs clearer communication. The question is our adaptation, not a prediction quoted from the text.</li>
            <li><strong>Limit:</strong> none of these steps identifies a spouse, predicts a wedding date or demonstrates that someone will marry. D9 placement does not automatically activate a D1 house rule.</li>
          </ol>
          <p className="mt-4">The same fixture’s tenth D1 house is Sagittarius, ruled by Jupiter. A knowledge-oriented work reflection can sit beside the Mercury communication prompt without the software declaring which priority should govern your life. Practical decisions require information about your actual circumstances.</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-white">How to check an interpretation</h2>
          <p>Open “Inspect calculated factors, source and limits” below a note. It lists the chart involved, the house and ruler where relevant, the edition and exact locator, source scope, rights and exceptions. Technical digests identify the rule and output; they do not certify an interpretation as true.</p>
          <p className="mt-4">The educational profile uses Varāhamihira’s <a href="https://wellcomecollection.org/works/afmgm695" className="text-violet-300 underline">Bṛhat Jātaka, translated by N. Chidambaram Iyer, Foster Press, Madras, 1885</a>. Relevant locators are I.15 and note (a), printed pages 11–12 (PDF pages 52–53); II.1, printed page 14 (PDF page 55); and II.3, printed page 15 (PDF page 56). Wellcome marks this edition public domain. The node-naming passage supports identifying Rahu and Ketu, not claims about a foreign spouse or destiny.</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-white">What if the birth time is uncertain?</h2>
          <p>The reader samples alternative times and shows D1/D9 differences. Sampled agreement does not prove that every instant in an interval gives the same result. For a nonzero uncertainty range, the current educational profile therefore withholds personalized reflection and presents the nominal chart for study alongside alternatives. It does not choose a convenient time to obtain a preferred answer.</p>
          <p className="mt-4">Ambiguous or nonexistent local times around daylight-saving changes are refused rather than silently assigned an offset. Resolve the underlying time evidence before relying on a time-sensitive result.</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-white">Periods and transits are not event promises</h2>
          <p>The <Link href="/knowledge/astrology/vimshottari-dasha" className="text-violet-300 underline">Vimśottarī timeline</Link> names the period at your chosen reference instant. The educational layer uses the names to select study vocabulary; this is not a classical period-outcome rule. Upcoming transits are snapshots at 30 and 90 days, not a search for every ingress or a claim about an event window. Practitioner techniques and D9 marriage-outcome rules without reviewed support remain unavailable.</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-white">Privacy and appropriate use</h2>
          <p>The public guide and empty reader can be discovered in search; your generated report is not a public article. Birth details are submitted by POST, not in the URL. This feature does not save reports or birth details. Optional location lookup sends the place text to a geocoding service. Screenshots of a completed report may still reveal sensitive information.</p>
          <p className="mt-4">Use the report as an educational and reflective aid. It does not supply medical, financial or legal advice, determine personality, identify a future partner or guarantee events. A well-attributed tradition remains different from empirical evidence.</p>
          <Link href="/knowledge/birth" className="mt-5 inline-block text-violet-300 underline focus-visible:outline">Try the reader with your own details or the synthetic example</Link>
        </section>
      </article>
    </main>
  )
}
