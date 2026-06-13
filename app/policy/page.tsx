import React from 'react';
import Link from 'next/link';

const SITE_URL = 'https://www.mahastrategies.com';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Policy & Statecraft | Maha Strategies Think Tank',
  description:
    'Maha Strategies\u2019 policy doctrine: a long-horizon framework for biological capital, ecological statecraft, and municipal sovereignty, with five proposed legislative platforms for national renewal.',
  alternates: { canonical: '/policy' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/policy`,
    siteName: 'Maha Strategies',
    title: 'Policy & Statecraft | Maha Strategies Think Tank',
    description:
      'A long-horizon policy doctrine: biological capital, ecological statecraft, the enclave strategy, and five proposed legislative platforms.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Maha Strategies \u2014 Policy & Statecraft' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Policy & Statecraft | Maha Strategies Think Tank',
    description:
      'A long-horizon policy doctrine: biological capital, ecological statecraft, and five proposed legislative platforms.',
    images: ['/og-master.png'],
  },
};

const legislativeSeeds = [
  {
    id: 'nutrient-density-standard',
    title: 'I. The Nutrient Density Standard',
    href: '/policy/nutrient-density-standard/paying-for-nutrition',
    summary:
      'Abolishing subsidies for empty, extractive calories and replacing them with a Nutrient Density Bonus.',
    body: [
      'U.S. agricultural subsidies historically concentrate on a small set of commodity crops\u2014corn, soy, wheat\u2014whose downstream products dominate the processed-food supply. Maha Strategies position is that this subsidy structure optimizes for caloric yield and shelf stability rather than nutritional return, and that the public health cost of that trade-off is not currently priced into agricultural policy.',
      'We propose redirecting subsidy weight toward a Nutrient Density Bonus: payments indexed to the measurable nutritional content of what is grown, rather than raw tonnage. The intent is to transition the agricultural sector from an extractive model toward a restorative, regenerative supply chain over a roughly ten-year horizon, treating soil and crop quality as long-term national assets rather than annual commodities.',
      'This is a directional argument, not a costed bill. The mechanism design\u2014how density is measured, audited, and rewarded without creating new perverse incentives\u2014is the hard part, and is where we believe serious policy work should concentrate.',
    ],
  },
  {
    id: 'chemical-reciprocity-act',
    title: 'II. The Chemical Reciprocity Act',
    summary:
      'Closing the gap between U.S. additive self-certification and stricter peer-nation standards.',
    body: [
      'Under the U.S. "Generally Recognized as Safe" (GRAS) pathway, manufacturers can self-affirm the safety of certain food additives, in some cases without formal pre-market FDA review. Several other jurisdictions\u2014notably the European Union\u2014apply more restrictive or precautionary standards to specific additives and pesticides that remain permitted in the United States.',
      'We propose a reciprocity mechanism: where a peer regulator (the EU, Japan, or Canada) has restricted a food additive, pesticide, or industrial chemical, that restriction would trigger an automatic provisional review\u2014and, pending that review, a precautionary hold in the U.S. The principle is to shift the default from corporate self-certification toward the precautionary standard already operating among comparable economies.',
      'We state this as Maha Strategies policy position. The specific divergences between U.S. and peer-nation chemical regulation are real but vary case by case; any implementation would require a documented, substance-by-substance basis rather than a blanket import of another list.',
    ],
  },
  {
    id: 'algorithmic-transparency',
    title: 'III. Algorithmic Transparency & Cognitive Liberty',
    summary:
      'Treating deceptive interface design as an unfair trade practice.',
    body: [
      'Maha Strategies argues for a codified right to a mind free from engineered, predatory manipulation. The same behavioral mechanics we document in our intelligence briefs\u2014variable reward loops, infinite scroll, engagement-maximizing defaults\u2014are deployed at population scale, and we contend their cumulative cost to attention and executive function is a public harm, not merely a private choice.',
      'The proposal is to classify demonstrably deceptive interface design as an unfair trade practice under existing consumer-protection frameworks, and to explore taxation indexed to documented harm metrics. The analogy we use is a "cognitive Kessler Syndrome": a tipping point past which the shared attentional environment becomes so saturated with extraction that collective focus degrades for everyone.',
      'We are explicit that "documented harm" is the crux: any such regime stands or falls on rigorous, contestable measurement rather than on aesthetic objections to particular designs.',
    ],
  },
  {
    id: 'soil-restoration-corps',
    title: 'IV. The National Soil Restoration Corps',
    summary:
      'A civilian service corps for ecological repair, funded by redirected subsidies.',
    body: [
      'We propose a civilian service corps dedicated to ecological repair\u2014reforestation, watershed restoration, and topsoil regeneration\u2014modeled in spirit on large-scale civilian conservation programs. Funding would come from redirecting a portion of fossil-fuel and commodity-crop subsidies toward restorative land work.',
      'The dual thesis is that the same program can heal degraded land and build human resilience: physical, outdoor, purpose-driven work as both ecological infrastructure and a counter to the metabolic and attentional decline we describe elsewhere in our doctrine. We present this as a vision for how restorative labor and national service could be structured, not as a budgeted appropriation.',
    ],
  },
  {
    id: 'community-sovereignty-compact',
    title: 'V. The Community Sovereignty Compact',
    summary:
      'Protecting local jurisdictions right to set higher standards than the national floor.',
    body: [
      'A recurring obstacle to local health and environmental standards is preemption: higher levels of government, or industry litigation, overriding stricter municipal rules. Maha Strategies position is that local jurisdictions should have explicit, durable protection to set environmental, health, and attentional standards above the national floor.',
      'We frame the national baseline as exactly that\u2014a floor, not a ceiling. Where a town, county, or school board chooses to exceed it, that choice should be insulated from corporate preemption challenges. This connects to our broader "enclave strategy": change driven upward from coordinated local jurisdictions rather than waiting on captured federal apparatus.',
    ],
  },
];

export default function PolicyNode() {
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Policy & Statecraft: The Maha Strategies Doctrine',
    description:
      'A long-horizon policy doctrine covering biological capital, ecological statecraft, municipal sovereignty, and five proposed legislative platforms for national renewal.',
    author: { '@type': 'Organization', name: 'Maha Strategies LLC', url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'Maha Strategies LLC',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/policy` },
  };

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] selection:bg-indigo-500 selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />

      <div className="max-w-4xl w-full mx-auto px-6 sm:px-12 space-y-20 pb-24 pt-16">

        {/* HEADER */}
        <header className="space-y-6 border-b border-gray-800 pb-12">
          <div className="font-mono text-xs text-indigo-400 font-semibold tracking-widest uppercase">
            [ Maha Strategies: Think Tank &amp; Applied Research ]
          </div>
          <h1 className="font-sans text-4xl sm:text-6xl font-bold tracking-tight text-white leading-tight">
            Policy &amp; Statecraft
          </h1>
          <p className="font-serif text-xl text-gray-400 leading-relaxed max-w-2xl">
            The Saturnian Vision: moving from defense of the individual stronghold to the architectural design of a sovereign civilization.
          </p>
          <p className="font-serif text-base text-gray-500 leading-relaxed max-w-2xl">
            This page sets out Maha Strategies\u2019 policy doctrine and proposals. It presents arguments and positions, not legislative text or settled law.
          </p>
        </header>

        {/* THE SATURNIAN CORRECTIVE */}
        <section className="space-y-6">
          <h2 className="font-sans text-xl font-bold tracking-widest uppercase text-white border-l-2 border-indigo-500 pl-4">
            The Saturnian Corrective
          </h2>
          <div className="pl-4 space-y-6 text-gray-300 font-serif text-lg leading-relaxed">
            <p>
              For roughly a century, much of Western policy has operated under what we call a Jupiterian program as the default good: more output, more comfort, more growth. That program eliminated real historical scarcities. Maha Strategies' argument is that it also produced a structural trap, in which institutions optimize for short-horizon yield and engagement at the expense of long-horizon systemic health.
            </p>
            <p>
              We propose the Saturnian principle as the corrective: the archetype of structure, limits, and deep time. The governing question shifts from "what does this quarter's growth look like?" to "will this architecture still stand in five hundred years?" In this framing, statecraft is not the management of competing political interests but the design of conditions under which human beings can durably flourish.
            </p>
          </div>
        </section>

        {/* ECOLOGICAL STATECRAFT */}
        <section className="space-y-6 bg-gray-900/30 p-8 rounded-lg border border-gray-800">
          <h2 className="font-sans text-xl font-bold tracking-widest uppercase text-white border-l-2 border-green-500 pl-4">
            Ecological Statecraft &amp; Biological Capital
          </h2>
          <div className="pl-4 space-y-6 text-gray-300 font-serif text-lg leading-relaxed">
            <p>
              We propose a metric for national interest we call <strong>Biological Capital</strong>: the aggregate metabolic and cognitive health of a population, treated as a strategic asset. Our position is that a nation whose citizens experience declining metabolic baselines and cognitive endurance is not strong but fragile, regardless of its measured wealth.
            </p>
            <p>
              The proposed constitutional filter for law, subsidy, and regulation is a single long-horizon question: <em>does this increase or decrease the net vitality of the ecosystem and the citizenry a hundred years from now?</em> We frame this as extending the established public-trust principle\u2014the idea that certain commons are held by the state in trust for the public\u2014to what we term the Metabolic Commons.
            </p>
          </div>
        </section>

        {/* ENCLAVE STRATEGY */}
        <section className="space-y-6">
          <h2 className="font-sans text-xl font-bold tracking-widest uppercase text-white border-l-2 border-indigo-500 pl-4">
            Asymmetric Statecraft: The Enclave Strategy
          </h2>
          <div className="pl-4 space-y-6 text-gray-300 font-serif text-lg leading-relaxed">
            <p>
              Our working assumption is that federal regulatory bodies are, in important areas, subject to industry capture\u2014and that expecting a captured regulator to constrain its own constituency is not a strategy. Maha Strategies advocates instead for what we call the <strong>Zone of Exception</strong>.
            </p>
            <p>
              The focus shifts from the executive order to the municipal ordinance. By establishing jurisdictions\u2014a school board, a county, a town\u2014where the rules of extraction are locally overridden, a Municipal Firewall is built from the bottom up. When enough local jurisdictions coordinate their purchasing and standards, the argument goes, they can command sufficient market power to force supply-chain corrections without a single federal vote.
            </p>
          </div>
        </section>

        {/* LEGISLATIVE ARCHITECTURE */}
        <section className="space-y-8">
          <header className="space-y-2">
            <h2 className="font-sans text-xl font-bold tracking-widest uppercase text-white border-l-2 border-indigo-500 pl-4">
              Legislative Architecture: Five Platform Seeds
            </h2>
            <p className="font-serif text-gray-400 pl-4 text-lg">
              Five proposed platforms for national reconstruction, presented as directional policy arguments.
            </p>
          </header>

          <div className="space-y-10 pl-4">
            {legislativeSeeds.map((seed) => (
              <article key={seed.id} id={seed.id} className="bg-[#0a0a0c] border border-gray-800 p-6 sm:p-8 rounded scroll-mt-24">
                <h3 className="font-sans text-2xl font-bold text-white mb-2">
                  {seed.href ? (
                    <Link href={seed.href} className="hover:text-indigo-400 transition-colors">
                      {seed.title}
                    </Link>
                  ) : (
                    seed.title
                  )}
                </h3>
                <p className="font-mono text-xs text-indigo-400 uppercase tracking-widest mb-5">{seed.summary}</p>
                <div className="space-y-4 font-serif text-gray-300 text-lg leading-relaxed">
                  {seed.body.map((para, i) => <p key={i}>{para}</p>)}
                </div>
                {seed.href && (
                  <p className="mt-5">
                    <Link href={seed.href} className="font-mono text-sm text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest">
                      Read the working paper &#8599;
                    </Link>
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* FERMI FILTER */}
        <section className="space-y-6 border-t border-gray-800 pt-12">
          <h2 className="font-sans text-xl font-bold tracking-widest uppercase text-white border-l-2 border-indigo-500 pl-4">
            The Fermi Filter &amp; Civilizational Trajectory
          </h2>
          <div className="pl-4 space-y-6 text-gray-300 font-serif text-lg leading-relaxed">
            <p className="font-mono text-[11px] text-gray-600 tracking-widest uppercase">
              The following is explicitly speculative\u2014a framing device for our long-horizon thesis, not an empirical claim.
            </p>
            <p>
              One way we frame the stakes: the Great Filter that may prevent civilizations from becoming durable and interstellar might not be nuclear war or resource exhaustion, but metabolic and cognitive decline\u2014a civilization growing too comfortable to sustain the demands of its own ambitions. We offer this as a thought experiment that motivates the doctrine, not as a testable prediction.
            </p>
            <p>
              The figure we return to is the Nurturing Warrior: a configuration combining care and capacity, which we argue generates the surplus a society needs to endure hard transitions. The project, in that framing, is not only to restore a nation but to build the conditions from which it could eventually reach further.
            </p>
            <p className="font-mono text-indigo-400 text-sm font-bold uppercase tracking-widest pt-4">
              Stop consuming. Start shining. Hold your orbit.
            </p>
          </div>
        </section>

        {/* INTERNAL LINKS */}
        <section className="border-t border-gray-800 pt-12">
          <p className="font-serif text-gray-400 text-lg mb-4">
            This doctrine draws on the analysis in our intelligence briefs and protocols.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/intelligence" className="inline-block px-4 py-2 border border-gray-700 hover:border-gray-400 text-sm font-mono transition-colors text-gray-200 uppercase tracking-widest">
              Intelligence Briefs &#8599;
            </Link>
            <Link href="/protocols" className="inline-block px-4 py-2 border border-gray-700 hover:border-gray-400 text-sm font-mono transition-colors text-gray-200 uppercase tracking-widest">
              Protocols &#8599;
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}
