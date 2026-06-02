import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Policy & Statecraft | Maha Strategies Think Tank',
  description: 'The architectural blueprints for the Maha Nation. Applied research and legislative directives for reclaiming biological capital and civilizational sovereignty.',
};

export default function PolicyNode() {
  const legislativeSeeds = [
    {
      title: "I. The Nutrient Density Standard",
      description: "Abolishing subsidies for empty, extractive calories (commodity corn/soy) and replacing them with a Nutrient Density Bonus. Transitioning the agricultural sector from an extractive model to a restorative, regenerative supply chain over a ten-year horizon.",
    },
    {
      title: "II. The Chemical Reciprocity Act",
      description: "Ending the GRAS loophole. Mandating an automatic provisional ban on any food additive, pesticide, or industrial chemical currently restricted by the European Union, Japan, or Canada, enforcing the Precautionary Principle over corporate self-certification.",
    },
    {
      title: "III. Algorithmic Transparency & Cognitive Liberty",
      description: "Codifying the right to a mind free from predatory manipulation. Classifying deceptive interface design (infinite scroll, variable reward loops) as an unfair trade practice and establishing taxation on documented harm metrics to prevent a cognitive Kessler Syndrome.",
    },
    {
      title: "IV. The National Soil Restoration Corps",
      description: "Mobilizing a civilian service corps dedicated to ecological repair. Redirecting fossil fuel and commodity crop subsidies to fund reforestation, watershed restoration, and topsoil regeneration, simultaneously healing the land and forging human resilience.",
    },
    {
      title: "V. The Community Sovereignty Compact",
      description: "Enshrining Local Preemption as a federal right. Granting municipalities the explicit constitutional protection to set environmental, health, and attentional standards higher than the national floor without facing corporate preemption challenges.",
    }
  ];

  return (
    <div className="max-w-4xl w-full mx-auto space-y-20 selection:bg-gray-700 pb-24 pt-12">
      
      {/* HEADER */}
      <header className="space-y-6 border-b border-gray-800 pb-12">
        <div className="font-mono text-xs text-indigo-500 font-semibold tracking-widest uppercase">
          [ MAHA STRATEGIES: THINK TANK & APPLIED RESEARCH ]
        </div>
        <h1 className="font-sans text-5xl sm:text-6xl font-bold tracking-tight text-white leading-tight">
          Policy & Statecraft
        </h1>
        <p className="font-serif text-2xl leading-relaxed text-gray-400 max-w-3xl">
          The Saturnian Vision: Moving from the defense of the individual Stronghold to the architectural design of a sovereign civilization.
        </p>
      </header>

      {/* THE SATURNIAN CORRECTIVE */}
      <section className="space-y-6">
        <h2 className="font-sans text-xl font-bold tracking-widest uppercase text-white border-l-2 border-indigo-500 pl-4">
          The Saturnian Corrective
        </h2>
        <div className="pl-4 space-y-6 text-gray-300 font-serif text-lg leading-relaxed">
          <p>
            For the last century, western civilization has operated under a Jupiterian program—unbridled expansion, more data, more comfort, more growth. While it eliminated historical scarcities, it has triggered a structural trap where agents optimize for yield and engagement at the expense of systemic health. 
          </p>
          <p>
            Maha Strategies introduces the Saturnian principle as the mandatory corrective: the archetype of structure, limits, and deep time. We do not ask about this quarter's GDP; we ask whether the architecture will stand for five hundred years. Statecraft is not the management of competing political interests, but the design of the conditions under which human beings can flourish.
          </p>
        </div>
      </section>

      {/* ECOLOGICAL STATECRAFT & BIOLOGICAL CAPITAL */}
      <section className="space-y-6 bg-gray-900/30 p-8 rounded-lg border border-gray-800">
        <h2 className="font-sans text-xl font-bold tracking-widest uppercase text-white border-l-2 border-green-500 pl-4">
          Ecological Statecraft
        </h2>
        <div className="pl-4 space-y-6 text-gray-300 font-serif text-lg leading-relaxed">
          <p>
            We propose a new metric for national interest: <strong>Biological Capital</strong>. A nation whose citizens suffer generational collapse in metabolic baselines and cognitive endurance is not strong—it is rich, fragile, and consuming itself. 
          </p>
          <p>
            Every law, subsidy, and regulation must pass a constitutional filter: <em>Does this increase or decrease the net vitality of the ecosystem and the citizenry one hundred years from now?</em> We are extending the Roman Public Trust Doctrine to the Metabolic Commons; the state cannot permit the poisoning of the population's biological integrity.
          </p>
        </div>
      </section>

      {/* ASYMMETRIC STATECRAFT: THE ENCLAVE STRATEGY */}
      <section className="space-y-6">
        <h2 className="font-sans text-xl font-bold tracking-widest uppercase text-white border-l-2 border-indigo-500 pl-4">
          Asymmetric Statecraft: The Enclave Strategy
        </h2>
        <div className="pl-4 space-y-6 text-gray-300 font-serif text-lg leading-relaxed">
          <p>
            Federal regulatory apparatuses are captured. Expecting them to regulate their own donors is not a strategy. Maha Strategies advocates for the <strong>Zone of Exception</strong>. 
          </p>
          <p>
            We shift focus from the Executive Order to the municipal ordinance. By carving out specific jurisdictions (the school board, the county, the town) where the laws of extraction no longer apply, we create the Municipal Firewall. When enough local jurisdictions coordinate—like the Cascadia Compact—they command enough purchasing power to force a supply chain correction without a single federal vote.
          </p>
        </div>
      </section>

      {/* LEGISLATIVE ARCHITECTURE 2036 */}
      <section className="space-y-8">
        <header className="space-y-2">
          <h2 className="font-sans text-xl font-bold tracking-widest uppercase text-white border-l-2 border-indigo-500 pl-4">
            Legislative Architecture: 2036
          </h2>
          <p className="font-serif text-gray-400 pl-4 text-lg">The Five Platform Seeds for national reconstruction.</p>
        </header>

        <div className="space-y-6 pl-4">
          {legislativeSeeds.map((seed, index) => (
            <div key={index} className="bg-[#0a0a0c] border border-gray-800 p-6 rounded hover:border-indigo-500 transition-colors">
              <h3 className="font-sans text-lg font-bold text-white mb-3">{seed.title}</h3>
              <p className="font-serif text-gray-400 leading-relaxed">{seed.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* THE FERMI FILTER */}
      <section className="space-y-6 border-t border-gray-800 pt-12">
        <h2 className="font-sans text-xl font-bold tracking-widest uppercase text-white border-l-2 border-indigo-500 pl-4">
          The Fermi Filter & Civilizational Trajectory
        </h2>
        <div className="pl-4 space-y-6 text-gray-300 font-serif text-lg leading-relaxed">
          <p>
            The Great Filter preventing civilizations from becoming interstellar is not nuclear war or resource exhaustion; it is metabolic and cognitive collapse. A high-technology civilization cannot endure the extreme demands of deep space if it falls asleep in the womb of its own engineered convenience.
          </p>
          <p>
            The Nurturing Warrior is the only biological configuration capable of generating the surplus capacity required to pass this filter. We are not just restoring a nation; we are building the launchpad. 
          </p>
          <p className="font-mono text-indigo-400 text-sm font-bold uppercase tracking-widest pt-4">
            Stop consuming. Start shining. Hold your orbit.
          </p>
        </div>
      </section>

    </div>
  );
}