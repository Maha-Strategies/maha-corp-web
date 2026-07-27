import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'

// Chapter 11 Article Database — directional policy arguments, hedged register.
const policyArticles: Record<
  string,
  { title: string; date: string; summary: string; content: React.ReactNode }
> = {
  "nutrient-density-standard": {
    title: "I. The Nutrient Density Standard",
    date: "2026-06-02",
    summary:
      "A proposal to redirect agricultural subsidy weight from volumetric yield toward the measured nutritional content of harvested crops.",
    content: (
      <>
        <p>Our position is that U.S. agricultural subsidies optimize for caloric yield and shelf stability rather than nutritional return. For decades, commodity support has concentrated on a narrow set of crops—corn, soy, wheat—whose downstream products dominate the processed-food supply. We argue that the public-health cost of that trade-off is not currently priced into agricultural policy, and that the subsidy structure consequently rewards volume over nutritional quality.</p>

        <p>We propose redirecting subsidy weight toward a Nutrient Density Bonus: payments indexed to the measurable nutritional content of what is grown, rather than raw tonnage. The intent is to make soil and crop quality long-term assets rather than annual commodities. We state this as a directional argument, not a costed bill. The mechanism design—how density is measured, audited, and rewarded without creating new perverse incentives—is the hard part, and is where we believe serious policy work should concentrate.</p>

        <p>Any transition would need to avoid the shock of abrupt removal. One approach worth study is to introduce the bonus as a rider in a future Farm Bill cycle, allocate a defined share of existing support toward regenerative transition grants, and shift the incentive structure over a roughly ten-year horizon as the regenerative market develops the capacity to absorb it. The specific allocations and timelines are matters for detailed mechanism design rather than settled prescriptions.</p>

        <p className="pt-2">
          <Link
            href="/policy/nutrient-density-standard/paying-for-nutrition"
            className="font-mono text-sm text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"
          >
            Read the working paper &#8599;
          </Link>
        </p>
      </>
    ),
  },
  "chemical-reciprocity-act": {
    title: "II. The Chemical Reciprocity Act",
    date: "2026-06-02",
    summary:
      "A proposed reciprocity mechanism that would trigger provisional U.S. review when a peer regulator restricts a food additive, pesticide, or industrial chemical.",
    content: (
      <>
        <p>Under the U.S. "Generally Recognized as Safe" (GRAS) pathway, manufacturers can self-affirm the safety of certain food additives, in some cases without formal pre-market FDA review. Several other jurisdictions—notably the European Union—apply more restrictive or precautionary standards to specific additives and pesticides that remain permitted in the United States. We frame this as a difference in regulatory philosophy, not a blanket claim that one food supply is uniformly safe and another uniformly unsafe.</p>

        <p>We propose a reciprocity mechanism: where a peer regulator (the EU, Japan, or Canada) has restricted a food additive, pesticide, or industrial chemical, that restriction would trigger an automatic provisional review—and, pending that review, a precautionary hold in the U.S. The principle is to shift the default from corporate self-certification toward the precautionary standard already operating among comparable economies.</p>

        <p>We state this as a Maha Strategies policy position. The specific divergences between U.S. and peer-nation chemical regulation are real but vary case by case; any implementation would require a documented, substance-by-substance basis rather than a blanket import of another jurisdiction's list.</p>
      </>
    ),
  },
  "algorithmic-transparency-act": {
    title: "III. Algorithmic Transparency and Cognitive Liberty",
    date: "2026-06-02",
    summary:
      "A proposal to classify demonstrably deceptive interface design as an unfair trade practice and to explore taxation indexed to documented harm.",
    content: (
      <>
        <p>We argue for a codified right to a mind free from engineered, predatory manipulation. The behavioral mechanics documented in our intelligence briefs—variable reward loops, infinite scroll, autoplay, engagement-maximizing defaults—are deployed at population scale, and we contend their cumulative cost to attention and executive function is a plausible public harm, not merely a private choice. We treat the strength of that harm claim as contingent on measurement rather than assumed.</p>

        <p>The proposal is to classify demonstrably deceptive interface design as an unfair trade practice under existing consumer-protection frameworks, to subject ranking algorithms serving minors to audit, and to explore taxation indexed to documented harm metrics. We are explicit that "documented harm" is the crux: any such regime stands or falls on rigorous, contestable measurement rather than on aesthetic objections to particular designs.</p>

        <p>The analogy we use is a "cognitive Kessler Syndrome": a hypothesized tipping point past which the shared attentional environment becomes so saturated with extraction that collective focus degrades for everyone. We offer this as a framing device that motivates the proposal, not as an established empirical finding.</p>
      </>
    ),
  },
  "soil-restoration-corps": {
    title: "IV. The National Soil Restoration Corps",
    date: "2026-06-02",
    summary:
      "A proposed civilian service corps for ecological repair, funded by redirecting a portion of existing fossil-fuel and commodity-crop support.",
    content: (
      <>
        <p>We propose a civilian service corps dedicated to ecological repair—reforestation, watershed and wetland restoration, and topsoil regeneration in agricultural regions where intensive management has depleted soil carbon and microbial life. The program is modeled in spirit on large-scale civilian conservation programs of the twentieth century.</p>

        <p>The proposed funding mechanism is a redirection of existing subsidies rather than new net spending. Federal support for fossil-fuel production and for commodity-crop programs each runs into the tens of billions of dollars annually, though published estimates vary widely depending on whether one counts direct outlays, tax provisions, or unpriced externalities. Rather than assert a precise figure, we argue directionally: a portion of the public money currently directed toward extraction could instead fund restorative land work. The exact scale, offsets, and budgetary accounting are matters for a costed proposal, which this is not.</p>

        <p>The dual thesis is that the same program can heal degraded land and build human resilience: physical, outdoor, purpose-driven work as both ecological infrastructure and a counter to the metabolic and attentional decline we describe elsewhere in our doctrine. We present this as a vision for how restorative labor and national service could be structured, not as a budgeted appropriation.</p>
      </>
    ),
  },
  "community-sovereignty-compact": {
    title: "V. The Community Sovereignty Compact",
    date: "2026-06-02",
    summary:
      "A proposal to give local jurisdictions explicit, durable protection to set environmental and health standards above the national floor.",
    content: (
      <>
        <p>A recurring obstacle to local health and environmental standards is preemption: higher levels of government, or industry litigation, overriding stricter municipal rules. Our position is that local jurisdictions should have explicit, durable protection to set environmental, health, and attentional standards above the national floor.</p>

        <p>Where a town chooses to restrict a particular pesticide on public land, to alter its municipal water treatment, or to establish phone-free zones in its schools, we argue that choice should be insulated from corporate preemption challenges. We frame the national baseline as exactly that—a floor, not a ceiling.</p>

        <p>The underlying principle is that the people who breathe the air and drink the water have standing to govern the air and the water. This connects to our broader enclave strategy: change driven upward from coordinated local jurisdictions rather than waiting on federal apparatus. We present it as a directional argument; the constitutional and statutory questions around preemption are genuinely contested and would require careful legal design.</p>
      </>
    ),
  },
};

export function generateStaticParams() {
  return Object.keys(policyArticles).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = policyArticles[slug];

  if (!article) {
    return { title: "Directive Not Found | Maha Strategies" };
  }

  const url = `https://www.mahastrategies.com/policy/${slug}`;
  const cleanTitle = article.title.replace(/^[IVX]+\.\s*/, "");

  return {
    title: `${cleanTitle} | Policy & Statecraft | Maha Strategies`,
    description: article.summary,
    alternates: { canonical: url },
    openGraph: {
      title: `${cleanTitle} | Maha Strategies`,
      description: article.summary,
      url,
      siteName: "Maha Strategies",
      type: "article",
      publishedTime: article.date,
      images: [
        {
          url: "https://www.mahastrategies.com/og-master.png",
          width: 1200,
          height: 630,
          alt: "Maha Strategies — Policy & Statecraft",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${cleanTitle} | Maha Strategies`,
      description: article.summary,
      images: ["https://www.mahastrategies.com/og-master.png"],
    },
  };
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PolicyArticle({ params }: PageProps) {
  const resolvedParams = await params;
  const article = policyArticles[resolvedParams.slug];

  if (!article) return notFound();

  const cleanTitle = article.title.replace(/^[IVX]+\.\s*/, "");
  const articleUrl = `https://www.mahastrategies.com/policy/${resolvedParams.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: cleanTitle,
    description: article.summary,
    datePublished: article.date,
    url: articleUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
    author: { '@id': MAHA_ORGANIZATION_ID },
    publisher: { '@id': MAHA_ORGANIZATION_ID },
    isPartOf: {
      "@type": "CreativeWork",
      name: "Policy & Statecraft",
      url: "https://www.mahastrategies.com/policy",
    },
  };

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] selection:bg-indigo-500 selection:text-white">
      <div className="max-w-3xl w-full mx-auto px-6 sm:px-12 space-y-12 pb-16 pt-16">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

      <nav className="font-mono text-xs text-gray-500 tracking-widest uppercase mb-8 flex gap-2">
        <Link href="/policy" className="hover:text-indigo-400 transition-colors">
          POLICY INDEX
        </Link>
        <span>/</span>
        <span className="text-gray-400">DIRECTIVE</span>
      </nav>

      <header className="space-y-4 border-b border-gray-800 pb-8">
        <div className="font-mono text-xs text-indigo-500 font-semibold tracking-widest uppercase">
          [ FILED: {article.date} ]
        </div>
        <h1 className="font-sans text-4xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
          {article.title}
        </h1>
      </header>

      <article className="font-serif text-lg leading-relaxed text-gray-300 space-y-6">
        {article.content}
      </article>
      </div>
    </main>
  );
}
