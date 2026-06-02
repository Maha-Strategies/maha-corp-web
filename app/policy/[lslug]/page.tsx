import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// The fully populated Chapter 11 Article Database
const policyArticles: Record<string, { title: string; date: string; content: React.ReactNode }> = {
  "nutrient-density-standard": {
    title: "I. The Nutrient Density Standard",
    date: "2026-06-02",
    content: (
      <>
        <p>We abolish the subsidy of empty calories. For fifty years, the USDA has cut cheques based on bushels of commodity corn and soy — raw material that flows primarily into high-fructose corn syrup, industrial seed oils, and ethanol rather than into nourishment. The Farm Bill has been the single most consequential piece of anti-health legislation in American history, and it passes every five years with bipartisan support because the lobbying infrastructure behind it is the most powerful in Washington.</p>
        
        <p>We replace yield-based subsidies with nutrient density bonuses. The farmer who heals the soil, produces food with measurable mineral density, and maintains the ecological health of the land becomes the most valued player in the rural economy. The monoculture operation that exhausts the topsoil and produces caloric volume with negligible nutritional content receives no government support.</p>
        
        <p>The transition strategy avoids the shock of abrupt removal. We introduce a Nutrient Density Bonus as a rider in the next Farm Bill cycle, allocate ten percent of crop insurance funding to Regenerative Transition Grants, and over a ten-year window dial the incentive structure from extraction to restoration as the regenerative market develops the capacity to absorb the transition.</p>
      </>
    )
  },
  "chemical-reciprocity-act": {
    title: "II. The Chemical Reciprocity Act",
    date: "2026-06-02",
    content: (
      <>
        <p>We end the practice of treating American citizens as the test population for chemicals that our peer nations have already evaluated and rejected. This act mandates an automatic provisional ban on any food additive, pesticide, pharmaceutical, or industrial chemical currently restricted by the European Union, Japan, or Canada — our closest allies, operating under comparable scientific standards but different regulatory philosophies.</p>
        
        <p>The United States operates under the GRAS loophole: Generally Recognised As Safe, a self-certification standard that allows food companies to declare their own ingredients safe without independent verification. Europe operates under the Precautionary Principle: prove it is safe before you sell it to children. The result is a divergence: the same company, the same product, two formulations: clean for Europe because the law requires it, and toxic for America because the law permits it.</p>

        <p>The Chemical Reciprocity Act closes this gap by forcing the American standard up to the level our allies have already reached.</p>
      </>
    )
  },
  "algorithmic-transparency-act": {
    title: "III. Algorithmic Transparency and Cognitive Liberty",
    date: "2026-06-02",
    content: (
      <>
        <p>We codify the right to a mind free from predatory manipulation. User attention is designated a protected resource. Deceptive interface design — infinite scroll, autoplay, variable reward schedules calibrated to maximise time-on-device at the expense of user wellbeing — is classified as an unfair trade practice and prohibited. Ranking algorithms used by platforms serving users under eighteen are subject to audit by a designated Digital EPA with the authority to require modification.</p>
        
        <p>The tax structure mirrors the environmental model. We tax platforms on their documented harm metrics — addiction rates, adolescent depression correlations, self-reported wellbeing declines among heavy users — with the same regulatory logic we apply to industrial polluters. The exhaust of the attention economy is cognitive fragmentation and mass attentional disability. We treat it with the same seriousness as industrial exhaust.</p>

        <p>The attention economy is producing a Kessler Syndrome of the Mind. No single notification, video, or algorithmic recommendation is individually catastrophic. The aggregate density of low-signal digital stimulation is creating the conditions under which no sustained, high-order thinking can achieve escape velocity. The Algorithmic Transparency and Cognitive Liberty Act is the legislation designed to reduce the orbital density before the cascade becomes irreversible.</p>
      </>
    )
  },
  "soil-restoration-corps": {
    title: "IV. The National Soil Restoration Corps",
    date: "2026-06-02",
    content: (
      <>
        <p>We authorise the mobilisation of one million young Americans into a civilian service corps dedicated to ecological repair: reforestation of public and degraded private land, wetland restoration along watersheds, topsoil regeneration in the agricultural heartland where industrial farming has depleted the carbon and microbial life that makes food nutritious.</p>
        
        <p>The cost is approximately $50 billion annually — roughly six percent of the current defense budget. The funding mechanism is a direct subsidy reallocation: we currently spend approximately $20 billion annually supporting fossil fuel extraction and $30 billion supporting the commodity crop production that drives metabolic disease. We stop paying to poison the earth and redirect those funds to healing it.</p>
        
        <p>The Corps serves a dual purpose. It heals the ecological debts that compound across generations. And it forges a generation of young Americans who have worked with their hands in the physical world, who have experienced genuine physical difficulty in service of something larger than themselves, and who have built the specific neural and physiological resilience that only genuine challenge produces. The soil restoration and the human restoration happen simultaneously.</p>
      </>
    )
  },
  "community-sovereignty-compact": {
    title: "V. The Community Sovereignty Compact",
    date: "2026-06-02",
    content: (
      <>
        <p>We enshrine Local Preemption as a federal right. Municipalities gain the explicit constitutional protection to set environmental and health standards higher than the national floor — and to maintain those standards against corporate challenges.</p>
        
        <p>If a town votes to ban glyphosate on public land, or to remove industrial fluoride from the municipal water supply, or to establish a phone-free zone in its schools, the corporations whose products are affected cannot invoke state preemption law to overturn the will of the people who live there.</p>
        
        <p>The legal principle is simple: the people who breathe the air and drink the water have standing to govern the air and the water. This is the ultimate protection for the Enclave Strategy, ensuring that the Strongholds we build cannot be legislated out of existence by captured centralized regulatory bodies.</p>
      </>
    )
  }
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PolicyArticle({ params }: PageProps) {
  const resolvedParams = await params;
  const article = policyArticles[resolvedParams.slug];

  if (!article) return notFound();

  return (
    <div className="max-w-3xl w-full mx-auto space-y-12 selection:bg-gray-700 pb-16 pt-12">
      
      {/* NOTE: If you use the layout.tsx file above, you can remove this <nav> 
        block to prevent double-navigation bars. 
      */}
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
  );
}