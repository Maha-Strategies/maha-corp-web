import { EPISTEMIC_RECORDS } from './epistemic-pilots.ts'
import {
  compileSubstantialPage,
  type CalculationApplicability,
  type CompiledSubstantialPage,
  type ComparisonApplicability,
} from './substantial-page-compiler.ts'
import type { SearchIntentContract } from './substantial-page.ts'

/**
 * Eight-record pilot for the substantial-page compiler, one per frontier domain.
 *
 * SELECTION DEVIATION, recorded deliberately. The sprint brief asked for
 * already-public canonical records. No record in any of the eight frontier
 * domains is public: `PUBLIC_EPISTEMIC_RECORDS` contains exactly two entries,
 * `transmon-qubit` and `prime-editing`, in quantum-systems and
 * synthetic-biology. All 240 frontier-domain records are `draft` with
 * `requestedPublicPromotion: false`. The eight named domains were kept and
 * draft canonical records were used, which is why every pilot artifact here is
 * internal, noindex and unrouted. No pilot is a bridge endpoint candidate and
 * no pilot is promoted.
 *
 * SOURCE ALIGNMENT. Two pilots cite a source narrower than the record's own
 * subject. That is a real defect in the corpus, not something editorial prose
 * may cover, so it is recorded per pilot and reported in the batch assessment
 * rather than written around.
 */

export const SUBSTANTIAL_PAGE_PILOT_VERSION = 'maha-substantial-page-pilot/0.1' as const

export type SourceAlignment = 'record-subject-supported' | 'source-narrower-than-record-subject'

/**
 * A pilot supplies prose and says nothing about claim ids. Each pilot record
 * carries exactly one claim, and `compilePilots` binds it, so a spec cannot
 * name a claim at all - let alone one the record does not have.
 */
export interface PilotEditorialSection {
  heading: string
  paragraphs: readonly string[]
}

export interface PilotSpec {
  slug: string
  domainSlug: string
  selectionRationale: string
  sourceAlignment: SourceAlignment
  sourceAlignmentNote: string
  searchIntent: SearchIntentContract
  editorial: {
    directAnswer: string
    sections: readonly PilotEditorialSection[]
    originalContribution: string
    additionalLimitations?: readonly string[]
  }
  comparison: ComparisonApplicability
  calculation: CalculationApplicability
}

const NO_TRAFFIC_CLAIM =
  'This contract describes what the page says and what it declines to say. It does not guarantee rankings, impressions, traffic, or any commercial outcome.'

/** Every pilot record carries exactly one claim, so the id is derived here. */
function claimIdFor(slug: string): string {
  const record = EPISTEMIC_RECORDS.find((entry) => entry.slug === slug)
  if (!record) throw new Error(`Pilot record ${slug} is not in the canonical graph.`)
  if (record.claims.length !== 1) throw new Error(`Pilot ${slug} has ${record.claims.length} claims; expected exactly one.`)
  return record.claims[0].id
}

const NOT_APPLICABLE_COMPARISON = (subject: string, reason: string): ComparisonApplicability => ({
  status: 'not-applicable',
  rationale: `A comparison table for ${subject} would need claims on both sides of an axis. ${reason} Presenting one cited source as a two-sided comparison would manufacture a contrast the evidence does not contain.`,
})

const NOT_APPLICABLE_CALCULATION = (reason: string): CalculationApplicability => ({
  status: 'not-applicable',
  rationale: `${reason} Adding an expression here would create unsupported precision: it would imply the record fixes quantities that its cited locator does not fix, and a reader could reproduce a number that no source stands behind.`,
})

export const PILOT_SPECS: readonly PilotSpec[] = [
  {
    slug: 'fusion-plasma-systems-magnetic-confinement',
    domainSlug: 'fusion-plasma-systems',
    selectionRationale:
      'Six declared graph edges, the most connected record in the domain, with a complete exact locator and a citation-with-paraphrase rights basis. A concept hub exercises tier-1 related-record selection end to end.',
    sourceAlignment: 'record-subject-supported',
    sourceAlignmentNote:
      'The ITER magnets documentation describes the coil systems that confine and shape the plasma, which is the record subject.',
    searchIntent: {
      primaryQuery: 'magnetic confinement fusion',
      readerQuestion: 'What does magnetic confinement actually mean in a tokamak, and what does documenting it not prove?',
      audience: 'Analysts and engineers reading fusion programme claims who need the boundary between design description and operating evidence.',
      readerOutcome:
        'The reader can state what the cited machine documentation establishes about confinement architecture, and can name the questions it leaves open about performance and cost.',
      supportingQuestions: [
        'Which coil systems are involved in confining and shaping a tokamak plasma?',
        'Does a documented magnet architecture demonstrate a working power plant?',
        'What is the difference between a design description and operating evidence?',
        'Why does this record avoid quoting a confinement time or gain figure?',
      ],
      queryVariants: [
        'what is magnetic confinement in fusion',
        'tokamak magnet systems explained',
        'magnetic confinement vs operating evidence',
      ],
      title: 'Magnetic confinement: what the ITER magnet record shows',
      description:
        'What the cited ITER magnet documentation establishes about confining and shaping a tokamak plasma, and the performance and cost questions it deliberately leaves open.',
      trafficNonClaim: NO_TRAFFIC_CLAIM,
    },
    editorial: {
      directAnswer:
        'Magnetic confinement is the use of shaped magnetic fields to hold a hot plasma away from material walls. The cited ITER documentation records the functions and architecture of the superconducting coil systems that do this: toroidal field, poloidal field, central solenoid and correction coils. It is a description of machine design, not a measurement of how well confinement performs.',
      sections: [
        {
          heading: 'What it is',
          paragraphs: [
            'Magnetic confinement describes an approach in which magnetic fields, rather than a solid vessel, hold a fusion plasma in position. The record is bounded to the machine architecture that implements this: the toroidal field coils, the poloidal field coils, the central solenoid and the correction coils, each with a distinct role in confining and shaping the plasma.',
            'The record is registered as a concept rather than a measurement. It fixes what the coil systems are for and how they are organised, and it deliberately does not pool figures from other devices or programmes, so nothing here should be read as a statement about fusion machines in general.',
          ],
        },
        {
          heading: 'How the cited evidence works',
          paragraphs: [
            'The evidence is documentation published by the ITER Organization covering the machine magnets, read at the sections on toroidal field, poloidal field, central solenoid and correction coils. It is an engineering description of a machine under construction, which is the appropriate kind of source for a claim about architecture and function.',
            'Because the source is design documentation rather than an experimental report, the evidence maturity is recorded as a single study and the claim kind as a theoretical model. The record uses original boundary language and a short paraphrase rather than reproducing any passage, figure or table from the source.',
          ],
        },
        {
          heading: 'What remains unresolved',
          paragraphs: [
            'A description of magnet architecture does not establish that the machine achieves any particular confinement quality, energy gain or availability. Those are operating results, and the cited source does not report them, so this record asserts no quantitative interval of any kind.',
            'Independent replication and cross-device transfer have not been compiled for this record. Anyone carrying a statement about ITER magnets across to another tokamak, a stellarator or a commercial design needs a separately scoped comparison, because operating conditions and coil technology differ between them.',
          ],
        },
      ],
      originalContribution:
        'The contribution is the separation itself: an explicit boundary between what published machine documentation establishes about confinement architecture and the operating and economic questions that fusion coverage routinely folds into the same sentence.',
    },
    comparison: NOT_APPLICABLE_COMPARISON(
      'magnetic confinement',
      'This record cites one machine documentation source and carries one claim, so there is no second cited configuration to compare against.',
    ),
    calculation: NOT_APPLICABLE_CALCULATION(
      'The record documents coil architecture and function; it fixes no quantity, and the cited locator reports no confinement time, field strength or gain figure to reproduce.',
    ),
  },
  {
    slug: 'advanced-materials-hexagonal-boron-nitride-dielectrics',
    domainSlug: 'advanced-materials',
    selectionRationale:
      'A mechanism-kind record with a complete locator and rights basis, chosen to exercise tier-2 and tier-3 related-record selection where only two bridge edges exist. It also surfaces a genuine source-alignment defect worth reporting.',
    sourceAlignment: 'source-narrower-than-record-subject',
    sourceAlignmentNote:
      'The record subject is hexagonal boron nitride as a dielectric, but the cited source is Novoselov et al. (2004), "Electric Field Effect in Atomically Thin Carbon Films", which reports transport in atomically thin carbon and does not establish anything about hBN. The claim resolves to its declared source, so the gate passes, but the source is narrower than the record subject and the page must not describe hBN properties the source never measured.',
    searchIntent: {
      primaryQuery: 'hexagonal boron nitride dielectric',
      readerQuestion: 'What does the cited evidence actually establish about hexagonal boron nitride as a dielectric?',
      audience: 'Materials researchers and technical readers checking whether a cited claim covers the material it names.',
      readerOutcome:
        'The reader can see exactly what the cited source measures, recognise that it concerns atomically thin carbon rather than boron nitride, and avoid carrying the citation further than it reaches.',
      supportingQuestions: [
        'What does the cited 2004 paper actually measure?',
        'Does this record establish a dielectric constant or breakdown field for hBN?',
        'Why is a citation that resolves still not sufficient support?',
        'What would be needed to bound an hBN dielectric claim properly?',
      ],
      queryVariants: [
        'hexagonal boron nitride dielectric evidence',
        'hbn dielectric citation check',
        'is hbn dielectric claim supported',
      ],
      title: 'Hexagonal boron nitride dielectrics: checking the source',
      description:
        'The cited source for this record reports transport in atomically thin carbon films, not boron nitride. What that means for any hBN dielectric claim resting on it.',
      trafficNonClaim: NO_TRAFFIC_CLAIM,
    },
    editorial: {
      directAnswer:
        'This record is registered as a mechanism covering hexagonal boron nitride used as a dielectric. Its single cited source, however, is the 2004 report of the electric field effect in atomically thin carbon films, which measures transport in carbon and not in boron nitride. The citation resolves, but it is narrower than the record subject, so no property of hBN should be quoted from this record.',
      sections: [
        {
          heading: 'What it is',
          paragraphs: [
            'Hexagonal boron nitride is a layered insulator commonly used as a gate dielectric and encapsulant beneath and above two-dimensional conductors. The record exists to hold that role as a distinct mechanism inside the advanced-materials graph rather than leaving it implicit in records about the conductors themselves.',
            'What the record does not do is fix any electrical property of the material. It carries a single claim, and that claim is bounded to the scope of its cited locator, which is where the difficulty in this particular record begins.',
          ],
        },
        {
          heading: 'How the cited evidence works',
          paragraphs: [
            'The cited source is Novoselov and colleagues in Science, 22 October 2004, read at the abstract, device preparation, transport measurements and figures one through three. That work reports electric-field effects and transport measurements in atomically thin carbon films, which is a claim about carbon.',
            'The claim on this record therefore resolves to a real, correctly identified, well-located source that does not address the record subject. This is a source-alignment defect rather than a broken citation: the identifier is right, the locator is exact, and the material under study is still the wrong one for a statement about boron nitride.',
          ],
        },
        {
          heading: 'What remains unresolved',
          paragraphs: [
            'Everything specific to boron nitride remains unresolved on this record. Dielectric constant, breakdown field, interface trap density and encapsulation quality are all absent from the cited source, so none of them can be quoted here, and the record asserts no quantitative interval.',
            'Closing the gap requires a source that measures hexagonal boron nitride directly, added with its own exact locator and rights basis. Until then the honest reading of this record is that it names a mechanism the graph needs and does not yet carry evidence for it.',
          ],
        },
      ],
      originalContribution:
        'The contribution is a worked example of a citation that passes every structural check while still failing the reader: correct identifier, exact locator, resolving claim, wrong material. Recording that explicitly is more useful than silently inheriting the mismatch.',
    },
    comparison: NOT_APPLICABLE_COMPARISON(
      'hexagonal boron nitride dielectrics',
      'The one cited source does not measure boron nitride at all, so there is no supported side of any axis, let alone two.',
    ),
    calculation: NOT_APPLICABLE_CALCULATION(
      'No dielectric quantity for boron nitride appears anywhere in the cited locator, so there is nothing to express, parameterise or reproduce.',
    ),
  },
  {
    slug: 'biomolecular-engineering-motif-scaffolding',
    domainSlug: 'biomolecular-engineering',
    selectionRationale:
      'A method-kind record with a complete locator and rights basis whose cited source directly addresses the method named. Chosen to contrast with the advanced-materials pilot, where alignment fails.',
    sourceAlignment: 'record-subject-supported',
    sourceAlignmentNote:
      'The RFdiffusion paper reports motif scaffolding explicitly among its tasks, and the locator names that section, so the source addresses the record subject.',
    searchIntent: {
      primaryQuery: 'motif scaffolding protein design',
      readerQuestion: 'What is motif scaffolding in protein design, and what did the cited study actually test?',
      audience: 'Readers assessing generative protein-design claims who need task-level results separated from general capability claims.',
      readerOutcome:
        'The reader can describe motif scaffolding as a design task and state precisely which outcomes the cited study reports and which it does not.',
      supportingQuestions: [
        'What problem does motif scaffolding solve in protein design?',
        'Which tasks did the cited study report results for?',
        'Does reported task success imply general folding or binding capability?',
        'What would establish therapeutic or safety claims instead?',
      ],
      queryVariants: [
        'what is motif scaffolding',
        'rfdiffusion motif scaffolding results',
        'protein design motif scaffolding evidence',
      ],
      title: 'Motif scaffolding: what the cited design study reports',
      description:
        'Motif scaffolding as a protein-design task, the experimental tests the cited RFdiffusion study reports for it, and the general capability claims it does not support.',
      trafficNonClaim: NO_TRAFFIC_CLAIM,
    },
    editorial: {
      directAnswer:
        'Motif scaffolding is the protein-design task of building a new structure around a functional motif that must be held in a specific geometry. The cited study reports diffusion-based generation and experimental tests for a set of specified design tasks including this one. Reported success on those tasks is a task-level result and is not a general claim about folding, binding or therapeutic function.',
      sections: [
        {
          heading: 'What it is',
          paragraphs: [
            'A functional motif is often a small arrangement of residues that must be presented in a particular geometry to work. Motif scaffolding is the task of generating a surrounding protein structure that holds that motif in place, which is harder than generating a plausible protein because the constraint is positional rather than merely structural.',
            'The record registers motif scaffolding as a method inside the biomolecular-engineering graph. Its scope is bounded to what the cited work reports for the named tasks, and it deliberately does not pool results from other design systems or later benchmarks.',
          ],
        },
        {
          heading: 'How the cited evidence works',
          paragraphs: [
            'The evidence is the RFdiffusion paper published in Nature on 11 July 2023, read at the abstract and at the unconditional generation, motif scaffolding, binder design, Methods and Extended Data sections. The study reports both generation and experimental testing, which is what allows a task-level claim rather than a purely computational one.',
            'The record treats this as a single study at the specified locator. Evidence maturity is recorded accordingly, and the record uses original boundary language with a short paraphrase rather than reproducing figures, tables or passages from the source.',
          ],
        },
        {
          heading: 'What remains unresolved',
          paragraphs: [
            'Success on reported design tasks does not establish universal folding, reliable binding, safety or therapeutic function. Those are separate outcomes requiring their own measurements, and the cited source does not report them, so this record carries no quantitative interval for any of them.',
            'Cross-system transfer is also unresolved. Results obtained with one generative model, one experimental pipeline and one set of targets do not carry to a different model or a different target class without a declared comparison contract stating what is being held constant.',
          ],
        },
      ],
      originalContribution:
        'The contribution is holding the line between a reported design-task result and the general capability language that surrounds generative protein design, using only what the cited study states about the tasks it actually ran.',
    },
    comparison: NOT_APPLICABLE_COMPARISON(
      'motif scaffolding',
      'The record cites one study and carries one claim, so a second design system would have to be introduced without a citation to fill the other column.',
    ),
    calculation: NOT_APPLICABLE_CALCULATION(
      'The record describes a design task and its reported testing, not a formula. Success rates in the source are task- and target-specific and are not parameters of any expression this record fixes.',
    ),
  },
  {
    slug: 'longevity-metabolism-lc3-turnover-assays',
    domainSlug: 'longevity-metabolism',
    selectionRationale:
      'A measurement-kind record whose cited source is a methodological guideline, which makes the static-versus-dynamic distinction unusually well supported. Complete locator and rights basis.',
    sourceAlignment: 'record-subject-supported',
    sourceAlignmentNote:
      'The autophagy assay guidelines address LC3 interpretation directly, and the locator names the LC3, SQSTM1/p62, lysosomal inhibition and flux sections.',
    searchIntent: {
      primaryQuery: 'LC3 turnover assay autophagy',
      readerQuestion: 'What does an LC3 turnover assay measure, and why is a single LC3 measurement not an autophagy rate?',
      audience: 'Researchers and technical readers interpreting autophagy assay results and claims built on them.',
      readerOutcome:
        'The reader can distinguish a static autophagosome measurement from a flux measurement and can say why neither establishes an organismal longevity outcome.',
      supportingQuestions: [
        'What is the difference between static LC3 levels and autophagic flux?',
        'Why is lysosomal inhibition used in these assays?',
        'Can a single marker establish an autophagy rate?',
        'Does an assay result support a longevity claim?',
      ],
      queryVariants: [
        'lc3 turnover assay explained',
        'autophagic flux vs static lc3',
        'how to interpret lc3 western blot',
      ],
      title: 'LC3 turnover assays: static levels versus real flux',
      description:
        'What LC3 turnover assays measure, why lysosomal inhibition is needed to read flux rather than a snapshot, and why no single marker establishes an autophagy rate.',
      trafficNonClaim: NO_TRAFFIC_CLAIM,
    },
    editorial: {
      directAnswer:
        'An LC3 turnover assay compares LC3 signal with and without lysosomal degradation blocked, so that the difference reflects material moving through the pathway rather than the amount present at one moment. The cited guidelines distinguish static autophagosome measurements from dynamic flux and set assay-specific interpretation limits. No single marker establishes an autophagy rate.',
      sections: [
        {
          heading: 'What it is',
          paragraphs: [
            'LC3 is used as a marker associated with autophagosomes, and a single measurement of it tells you how much is present at the moment of sampling. That quantity can rise either because more autophagosomes are being formed or because they are being cleared more slowly, which are opposite biological situations with the same readout.',
            'A turnover assay addresses this by measuring under two conditions, one with lysosomal degradation blocked. The record is registered as a measurement and is bounded to the interpretation guidance in its cited locator rather than to any particular experimental result.',
          ],
        },
        {
          heading: 'How the cited evidence works',
          paragraphs: [
            'The evidence is the community guidelines for the use and interpretation of assays for monitoring autophagy, published in Autophagy on 1 April 2012, read at the assay interpretation sections covering LC3, SQSTM1/p62, lysosomal inhibition and autophagic flux. Guidelines are the appropriate source class for a claim about how a measurement should be read.',
            'Because the record cites interpretation guidance rather than an experimental series, the claim is recorded as an observation at single-study maturity, and no cross-source quantitative interval is asserted. The record paraphrases and does not reproduce the source text.',
          ],
        },
        {
          heading: 'What remains unresolved',
          paragraphs: [
            'The assay does not by itself establish an autophagy rate, an organismal benefit or a longevity outcome. Those require separate measurements with their own scope, and the guidelines are explicit that assay-specific limits apply, so this record asserts nothing about lifespan or healthspan.',
            'Comparability across systems is also unresolved. Cell type, blockade agent, exposure time and antibody all shift what the readout means, so carrying a result between protocols needs a declared comparison rather than an assumption that the assay behaves identically.',
          ],
        },
      ],
      originalContribution:
        'The contribution is making the static-versus-flux distinction the headline rather than a caveat, and attaching the prohibition on longevity inference directly to the measurement record where such inferences are usually introduced.',
    },
    comparison: NOT_APPLICABLE_COMPARISON(
      'LC3 turnover assays',
      'The within-assay contrast between blocked and unblocked conditions is part of the method itself, not a comparison between two separately cited subjects, and only one source is cited.',
    ),
    calculation: NOT_APPLICABLE_CALCULATION(
      'Turnover is read as a difference between conditions whose normalisation depends on the blot, antibody and cell system used. The cited guidance fixes no expression, so writing one would imply a standard formula the source does not provide.',
    ),
  },
  {
    slug: 'neurotechnology-bci-spike-sorting-boundaries',
    domainSlug: 'neurotechnology-bci',
    selectionRationale:
      'A comparison-kind record, included so the pilot set covers that record kind. Complete locator and rights basis, and it surfaces a second source-alignment defect that the gate cannot see.',
    sourceAlignment: 'source-narrower-than-record-subject',
    sourceAlignmentNote:
      'The record subject is the boundary of spike sorting, but the cited source is the Neuropixels probe paper, which reports probe architecture, recording sites, channel selection and noise. Probe capability constrains what sorting can achieve but is not a study of sorting algorithms or their error rates, so the source is narrower than the record subject.',
    searchIntent: {
      primaryQuery: 'spike sorting limitations',
      readerQuestion: 'What are the boundaries of spike sorting, and does the cited probe evidence establish unit identity?',
      audience: 'Neuroscience and BCI readers evaluating single-unit claims made from high-density recordings.',
      readerOutcome:
        'The reader can state that probe capability and sorting accuracy are different questions, and can see that the cited source addresses the former.',
      supportingQuestions: [
        'What does spike sorting attempt to do?',
        'Does high channel count guarantee correct unit identity?',
        'What does the cited probe paper actually report?',
        'Why is chronic stability a separate question?',
      ],
      queryVariants: [
        'spike sorting accuracy limits',
        'neuropixels unit identity',
        'high density recording sorting boundaries',
      ],
      title: 'Spike sorting boundaries: probe capability is not identity',
      description:
        'Why high-density probe capability does not establish correct spike sorting or stable unit identity, and what the cited Neuropixels source does and does not report.',
      trafficNonClaim: NO_TRAFFIC_CLAIM,
    },
    editorial: {
      directAnswer:
        'Spike sorting assigns recorded voltage events to putative individual neurons. The cited source reports the Neuropixels silicon-probe architecture and specified high-density recordings, which establishes recording capability rather than sorting correctness. Probe capability does not establish perfect unit identity, chronic stability or clinical suitability, and this record should not be read as evidence about sorting algorithms.',
      sections: [
        {
          heading: 'What it is',
          paragraphs: [
            'A dense extracellular probe records voltage at many sites, and a single neuron typically appears on several of them. Spike sorting is the inference step that groups those events into units that are treated as individual neurons for the rest of the analysis, which means every downstream single-unit claim inherits its assumptions.',
            'The record is registered as a comparison and exists to hold the boundary of that inference. It is bounded to the scope of its cited locator, and it does not pool results across sorting algorithms, laboratories or preparations.',
          ],
        },
        {
          heading: 'How the cited evidence works',
          paragraphs: [
            'The evidence is the fully integrated silicon probes paper published in Nature on 8 November 2017, read at the probe architecture, recording sites, channel selection, noise, recordings and Methods sections. It reports what the hardware is and what recordings were obtained with it.',
            'That makes the source a study of instrumentation rather than of the sorting step, which is the alignment limit of this record. Denser and quieter recording improves the conditions under which sorting operates, but the cited work does not measure sorting error, so nothing here quantifies how often unit identity is correct.',
          ],
        },
        {
          heading: 'What remains unresolved',
          paragraphs: [
            'Sorting accuracy itself is unresolved on this record. Error rates, the frequency of merged or split units, and the sensitivity of results to algorithm choice would each require a source that studies sorting directly, and none is cited here.',
            'Chronic stability and clinical suitability are equally unresolved. A unit tracked across sessions may not be the same neuron, and the cited work does not establish that it is, so longitudinal and clinical claims need separately scoped evidence.',
          ],
        },
      ],
      originalContribution:
        'The contribution is separating instrument capability from inference correctness in a field where a probe citation is routinely offered as support for single-unit claims, and stating plainly that the cited source covers the instrument.',
    },
    comparison: NOT_APPLICABLE_COMPARISON(
      'spike sorting boundaries',
      'Although the record kind is comparison, the single cited source reports one instrument and no sorting alternative, so both columns of any axis would have to be supplied without citation.',
    ),
    calculation: NOT_APPLICABLE_CALCULATION(
      'No sorting error rate, yield figure or signal-to-noise threshold is fixed by the cited locator, so any expression here would imply a quantitative standard that the source does not set.',
    ),
  },
  {
    slug: 'mechanistic-interpretability-neural-feature-superposition',
    domainSlug: 'mechanistic-interpretability',
    selectionRationale:
      'The most connected record in the domain with six declared edges, a complete locator and rights basis. Its source addresses the subject directly, and it is the endpoint a Q-BR bridge tried and failed to reach, which makes its boundaries worth rendering carefully.',
    sourceAlignment: 'record-subject-supported',
    sourceAlignmentNote:
      'Toy Models of Superposition develops the superposition account directly, and the locator names the definitions, toy models, geometry and sparsity sections.',
    searchIntent: {
      primaryQuery: 'neural feature superposition',
      readerQuestion: 'What is superposition in a neural network, and what did the toy-model work actually show?',
      audience: 'Readers of interpretability research who need toy-model results kept separate from claims about production models.',
      readerOutcome:
        'The reader can define superposition, state the sparsity conditions under which it was demonstrated, and avoid transferring toy-model geometry to production systems.',
      supportingQuestions: [
        'What does it mean for a network to represent more features than dimensions?',
        'What role does sparsity play in superposition?',
        'Do toy-model results describe production language models?',
        'How does superposition relate to polysemantic neurons?',
      ],
      queryVariants: [
        'what is superposition neural network',
        'toy models of superposition explained',
        'features than dimensions interpretability',
      ],
      title: 'Neural feature superposition: what toy models showed',
      description:
        'Superposition as an account of networks representing more features than dimensions, the sparsity conditions the toy models assumed, and why production models differ.',
      trafficNonClaim: NO_TRAFFIC_CLAIM,
    },
    editorial: {
      directAnswer:
        'Superposition is the proposal that a network can represent more distinct features than it has dimensions by assigning them overlapping, non-orthogonal directions, tolerating interference in exchange for capacity. The cited work develops toy models exhibiting this under specified sparsity conditions. It does not establish that every feature in a production model has the same geometry or semantics.',
      sections: [
        {
          heading: 'What it is',
          paragraphs: [
            'If a layer has a fixed number of dimensions, the naive expectation is that it can cleanly represent at most that many features. Superposition is the account under which a network instead packs more features into the space by giving them directions that are not orthogonal, accepting some interference between them as the price of extra capacity.',
            'The record is registered as a concept and is bounded to the definitions, toy models, geometry, sparsity and feature-interference experiments named in its locator. It is a model of how representation might be organised, not a measurement taken from a deployed system.',
          ],
        },
        {
          heading: 'How the cited evidence works',
          paragraphs: [
            'The evidence is Toy Models of Superposition, published on the Transformer Circuits Thread on 14 September 2022. The work constructs small models where the number of features, the dimensionality and the sparsity of feature occurrence are all controlled, then examines the geometry the models adopt.',
            'The controlled setting is what gives the result its force and also what bounds it. Sparsity is an assumption of the construction rather than a measured property of a production network, so the demonstration is that superposition occurs under stated conditions, recorded here at single-study maturity as a theoretical model.',
          ],
        },
        {
          heading: 'What remains unresolved',
          paragraphs: [
            'Whether production models exhibit the same geometry is unresolved. A toy-model mechanism does not establish that features in a large deployed network share that structure or that any particular direction found there carries the semantics an interpreter assigns to it.',
            'The relationship between superposition and downstream interpretability methods is also unresolved on this record. Techniques that assume a sparse overcomplete basis are motivated by this account but are not validated by it, and treating the motivation as evidence for the method is precisely the transfer this record forbids.',
          ],
        },
      ],
      originalContribution:
        'The contribution is keeping the toy-model boundary attached to the concept itself, so that the sparsity assumption travels with the idea rather than being dropped when superposition is invoked to justify a downstream interpretability method.',
    },
    comparison: NOT_APPLICABLE_COMPARISON(
      'neural feature superposition',
      'The record cites one work and carries one claim, and the natural contrast, production-model geometry, is precisely what the source does not measure.',
    ),
    calculation: NOT_APPLICABLE_CALCULATION(
      'Feature counts, dimensionality and sparsity are parameters chosen inside the cited construction rather than quantities this record fixes, so an expression here would imply a general capacity formula the source does not assert.',
    ),
  },
  {
    slug: 'agentic-systems-mcp-mcp-capability-negotiation',
    domainSlug: 'agentic-systems-mcp',
    selectionRationale:
      'A mechanism-kind record whose source is a protocol specification, which makes the conformance-versus-safety boundary crisp. Complete locator and rights basis, and directly relevant to the tooling this codebase runs.',
    sourceAlignment: 'record-subject-supported',
    sourceAlignmentNote:
      'The MCP tools specification defines the discovery and invocation contracts the record describes, and the locator names those sections.',
    searchIntent: {
      primaryQuery: 'MCP capability negotiation',
      readerQuestion: 'How do MCP clients and servers agree on available tools, and what does conformance not guarantee?',
      audience: 'Engineers integrating Model Context Protocol servers who need protocol conformance separated from security properties.',
      readerOutcome:
        'The reader can describe how tools are discovered and invoked under the specification, and can state that conformance implies nothing about authorization or safety.',
      supportingQuestions: [
        'How does a client discover which tools a server exposes?',
        'What contract governs tool inputs and results?',
        'Does protocol conformance make a tool safe to call?',
        'Where do authorization decisions actually belong?',
      ],
      queryVariants: [
        'model context protocol tool discovery',
        'mcp tools specification explained',
        'mcp conformance vs tool safety',
      ],
      title: 'MCP capability negotiation: conformance is not safety',
      description:
        'How the Model Context Protocol specifies tool discovery, input schemas and result contracts, and why conforming to it establishes nothing about authorization or safety.',
      trafficNonClaim: NO_TRAFFIC_CLAIM,
    },
    editorial: {
      directAnswer:
        'Capability negotiation is the exchange in which an MCP client learns which tools a server exposes and how to call them. The cited specification defines the protocol roles and message contracts for discovering and invoking server-exposed tools, including input schemas, results and error handling. Conformance to those contracts does not establish that a tool is safe, correctly authorized, idempotent or resistant to malicious input.',
      sections: [
        {
          heading: 'What it is',
          paragraphs: [
            'An MCP client connects to a server without prior knowledge of what that server can do. Capability negotiation is the exchange that resolves this: the server advertises the tools it exposes together with schemas describing their inputs, and the client learns what it may call and how the call must be shaped.',
            'The record is registered as a mechanism and is bounded to the discovery, input schema, call, result, error handling and security consideration sections of its cited locator. It describes the contract, not any particular implementation of it.',
          ],
        },
        {
          heading: 'How the cited evidence works',
          paragraphs: [
            'The evidence is the Model Context Protocol specification covering tools, read at the sections just named. A specification is the appropriate source class for a claim about roles and message contracts, because the contract is exactly what the document defines.',
            'The record treats it accordingly as a bounded description rather than a measurement, recorded at single-study maturity as a theoretical model. It paraphrases the contract in original boundary language and reproduces no passage of the specification.',
          ],
        },
        {
          heading: 'What remains unresolved',
          paragraphs: [
            'Everything about trust remains unresolved. Protocol conformance does not establish that a tool is safe to invoke, that the caller is authorized to invoke it, that repeated invocation is harmless, or that the tool resists inputs crafted to subvert it, and the specification does not claim otherwise.',
            'The behaviour of tool output is likewise out of scope. A conforming result contract says the shape of a response is valid, not that its content is trustworthy, so the boundary between a well-formed result and a safe one has to be enforced separately by whatever consumes it.',
          ],
        },
      ],
      originalContribution:
        'The contribution is attaching the conformance-is-not-authorization boundary directly to the negotiation mechanism, where integration work tends to assume that a valid schema implies a safe call.',
    },
    comparison: NOT_APPLICABLE_COMPARISON(
      'MCP capability negotiation',
      'One specification is cited and one claim is carried, so any comparison against another protocol would need a second source that this record does not have.',
    ),
    calculation: NOT_APPLICABLE_CALCULATION(
      'The record describes message contracts, which have no numeric parameters. There is no rate, budget or threshold in the cited locator that an expression could reproduce.',
    ),
  },
  {
    slug: 'critical-supply-chains-high-purity-quartz-deposits',
    domainSlug: 'critical-supply-chains',
    selectionRationale:
      'The most connected record in the domain with six declared edges, a complete locator and a government-publication rights basis. A supply-side concept balances the physics and software records in the set.',
    sourceAlignment: 'record-subject-supported',
    sourceAlignmentNote:
      'The USGS critical mineral resources volume covers geology, production, processing, uses and supply considerations for selected commodities, which is the record subject.',
    searchIntent: {
      primaryQuery: 'high purity quartz supply',
      readerQuestion: 'Why does high-purity quartz matter industrially, and does geologic occurrence mean available supply?',
      audience: 'Supply-chain analysts and policy readers assessing material-availability claims about semiconductor inputs.',
      readerOutcome:
        'The reader can distinguish geologic resources from qualified industrial supply and can say what the cited USGS volume does and does not establish.',
      supportingQuestions: [
        'What makes a quartz deposit high purity?',
        'What is the difference between a resource and available supply?',
        'Does historical production establish future availability?',
        'What qualifies a material for a specific industrial process?',
      ],
      queryVariants: [
        'high purity quartz crucible supply',
        'quartz resources vs available supply',
        'usgs critical minerals quartz',
      ],
      title: 'High-purity quartz: resources versus qualified supply',
      description:
        'Why geologic occurrence and historical production of high-purity quartz do not establish qualified material availability for a specific industrial process.',
      trafficNonClaim: NO_TRAFFIC_CLAIM,
    },
    editorial: {
      directAnswer:
        'High-purity quartz is a feedstock whose trace-element content matters for downstream semiconductor processing, notably for crucibles used in silicon crystal growth. The cited USGS volume describes geology, production, processing, uses and supply considerations for selected commodities. Geologic occurrence and historical production do not establish that qualified material is available for any specific industrial process.',
      sections: [
        {
          heading: 'What it is',
          paragraphs: [
            'Quartz is abundant, but the grades that matter industrially are defined by trace-element content at levels where ordinary sources are unusable. High-purity quartz deposits are those whose impurity profile permits the demanding downstream uses, which is a far narrower category than quartz as a mineral.',
            'The record is registered as a concept in the critical-supply-chains graph and is bounded to the commodity and introductory chapters named in its locator, which distinguish resources, production, processing, uses and supply considerations from one another.',
          ],
        },
        {
          heading: 'How the cited evidence works',
          paragraphs: [
            'The evidence is the U.S. Geological Survey volume on critical mineral resources of the United States, published 19 December 2017, read at the commodity chapters and the introductory sections. A national geological survey is an appropriate source for statements about resources, production and processing.',
            'The structure of that source is what makes the record useful: it keeps resource estimates, production figures and supply considerations as separate categories rather than merging them, which is the distinction the record carries forward at single-study maturity.',
          ],
        },
        {
          heading: 'What remains unresolved',
          paragraphs: [
            'Qualified availability for a named process is unresolved. A deposit being geologically present, and having been produced from historically, does not establish that material meeting a specific purity specification can be obtained at a required volume, price or schedule.',
            'Concentration risk is likewise not quantified here. The record asserts no interval for processing concentration, export exposure or substitution feasibility, and any such figure would need a separately scoped record with its own evidence.',
          ],
        },
      ],
      originalContribution:
        'The contribution is separating three things that supply commentary habitually merges: what is in the ground, what has been produced, and what is qualified for a given process, with the cited volume supporting only the first two.',
    },
    comparison: NOT_APPLICABLE_COMPARISON(
      'high-purity quartz deposits',
      'A comparison across producing regions or grades would need per-region claims, and this record carries a single claim bounded to one survey volume.',
    ),
    calculation: NOT_APPLICABLE_CALCULATION(
      'No purity specification, reserve figure or concentration index is fixed by the cited locator, so any expression would imply a threshold the source does not set.',
    ),
  },
]

if (PILOT_SPECS.length !== 8) throw new Error(`Expected eight pilots; found ${PILOT_SPECS.length}.`)
if (new Set(PILOT_SPECS.map((spec) => spec.domainSlug)).size !== 8) {
  throw new Error('Pilots must cover eight distinct frontier domains.')
}

export interface CompiledPilot extends CompiledSubstantialPage {
  slug: string
  domainSlug: string
  recordKind: string
  selectionRationale: string
  sourceAlignment: SourceAlignment
  sourceAlignmentNote: string
}

export function compilePilots(): readonly CompiledPilot[] {
  return PILOT_SPECS.map((spec) => {
    const record = EPISTEMIC_RECORDS.find((entry) => entry.slug === spec.slug)
    if (!record) throw new Error(`Pilot record ${spec.slug} is not in the canonical graph.`)
    const claimId = claimIdFor(spec.slug)
    const compiled = compileSubstantialPage({
      record,
      graph: EPISTEMIC_RECORDS,
      searchIntent: spec.searchIntent,
      editorial: {
        ...spec.editorial,
        directAnswerClaimIds: [claimId],
        sections: spec.editorial.sections.map((section) => ({ ...section, claimIds: [claimId] })),
      },
      comparison: spec.comparison,
      calculation: spec.calculation,
    })
    return {
      ...compiled,
      slug: spec.slug,
      domainSlug: spec.domainSlug,
      recordKind: record.recordKind,
      selectionRationale: spec.selectionRationale,
      sourceAlignment: spec.sourceAlignment,
      sourceAlignmentNote: spec.sourceAlignmentNote,
    }
  })
}
