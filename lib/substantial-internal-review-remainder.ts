import { createHash } from 'node:crypto'

import { EXPERT_REVIEW_CRITERIA, type ExpertReviewInput } from './epistemic-review.ts'
import type { ExpertReviewScope } from './epistemic-schema.ts'
import {
  BATCH_2_INTERNAL_REVIEW_CANARY_IDS,
  BATCH_2_INTERNAL_REVIEW_RECORD_IDS,
} from './substantial-internal-review-cohort.ts'
import { BATCH_2_INTERNAL_REVIEW_PACKETS, type InternalReviewPacket } from './substantial-internal-review-batch-2.ts'

export const INTERNAL_REVIEW_REMAINDER_VERSION = 'maha-internal-review-remainder/1.0' as const

export const REMAINDER_DISPOSITIONS = ['approved', 'rejected', 'revise-and-rereview', 'blocked'] as const
export type RemainderDisposition = (typeof REMAINDER_DISPOSITIONS)[number]

/**
 * Source fidelity may only rest on an inspected source location. Resolving a
 * DOI, matching a title, or confirming that a landing page exists is metadata
 * verification and is explicitly not sufficient, so the basis is carried on the
 * entry and checked rather than assumed.
 */
export const EVIDENCE_BASES = ['inspected-source-location', 'metadata-resolution-only'] as const
export type EvidenceBasis = (typeof EVIDENCE_BASES)[number]

export interface UnsatisfiedCriterion {
  scope: ExpertReviewScope
  criterionId: string
  reason: string
}

export interface RemainderReviewEntry {
  recordId: string
  disposition: RemainderDisposition
  sourceFidelityBasis: EvidenceBasis
  /** Record-specific finding per scope. Never templated across records. */
  scopes: Readonly<Record<ExpertReviewScope, string>>
  unsatisfied: readonly UnsatisfiedCriterion[]
  blockers: readonly string[]
  remediation: string | null
  releaseKind: 'initial' | 'superseding' | null
}

export const BATCH_2_INTERNAL_REVIEW_REMAINDER_IDS = BATCH_2_INTERNAL_REVIEW_RECORD_IDS.filter(
  (recordId) => !BATCH_2_INTERNAL_REVIEW_CANARY_IDS.includes(recordId as (typeof BATCH_2_INTERNAL_REVIEW_CANARY_IDS)[number]),
)

/**
 * One entry per remaining record, written a record at a time from its frozen
 * packet: source identity, exact locator, establishes statement, claim, scope,
 * boundaries, uncertainty, replication, and prohibited inferences.
 *
 * There is no fallback branch. A record absent from this table produces no
 * review, and being alignment-clear or having an eligible substantial page
 * never generates one.
 */
const REVIEWS: readonly RemainderReviewEntry[] = [
  {
    recordId: 'urn:maha:record:advanced-materials-correlated-insulating-states',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'Cao et al. is inspected at its phase diagram and transport measurements, where the source contract establishes correlated as well as superconducting transport behaviour in the specified twisted bilayer devices. The record claims only the correlated-insulating concept boundary and asserts no gap size, filling factor, or temperature.',
      'domain-fidelity': 'Correlated insulating behaviour is kept as a twisted-bilayer-graphene electronic-structure phenomenon at the measured low-temperature conditions, and is not generalised to correlated insulators in other materials families.',
      'boundary-adequacy': 'The record carries the source boundary that device-specific low-temperature transport establishes neither robust room-temperature behaviour nor scalable fabrication, and prohibits proven, safe, scalable, or commercially available readings.',
      'rights-and-locator': 'The reviewed location is DOI 10.1038/nature26160 at the abstract, device description, phase diagram, transport measurements and Methods, retained under citation-with-paraphrase with no figure, table, or passage reproduced.',
    },
  },
  {
    recordId: 'urn:maha:record:advanced-materials-magic-angle-superconductivity',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'The superconducting transport behaviour named in the record is the primary reported result of the inspected paper, so the concept boundary sits directly on the source rather than on an adjacent study. No critical temperature or pairing mechanism is asserted.',
      'domain-fidelity': 'Magic-angle superconductivity stays tied to the specific twist angle and device geometry reported; it is not presented as a general route to superconductivity in graphene or other layered systems.',
      'boundary-adequacy': 'The record repeats that device-specific low-temperature transport does not establish room-temperature behaviour or scalable fabrication, and forbids treating the surrounding technology as proven or strategically superior.',
      'rights-and-locator': 'The same DOI 10.1038/nature26160 location is cited with the reported phase diagram and Methods identified, under citation-with-paraphrase, with the record wording original throughout.',
    },
  },
  {
    recordId: 'urn:maha:record:agentic-systems-mcp-mcp-prompt-templates',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'Prompts are one of the protocol primitives the specification itself defines, and the inspected locator names the prompts section explicitly. The record stays on that primitive and claims no effectiveness, quality, or adoption result for any prompt.',
      'domain-fidelity': 'The terminology matches the specification’s own vocabulary for capability-negotiated primitives, and the record does not recast a protocol definition as a prompt-engineering technique.',
      'boundary-adequacy': 'The record carries the source boundary that a protocol primitive prescribes no organisational policy, and adds that the primitive establishes no performance, safety, or deployment readiness.',
      'rights-and-locator': 'The reviewed location is the 2024-11-05 specification index at the architecture, lifecycle, capabilities, resources, prompts and security sections, cited with a pinned version under citation-with-paraphrase.',
    },
  },
  {
    recordId: 'urn:maha:record:agentic-systems-mcp-mcp-resource-discovery',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'Resources and capability negotiation are both named in the inspected locator, and discovery of resources is defined by the specification as part of that negotiation. The record asserts no latency, completeness, or interoperability result.',
      'domain-fidelity': 'Resource discovery is described as a protocol-level capability exchange between client, server and host roles as the specification defines them, not as a search or retrieval quality mechanism.',
      'boundary-adequacy': 'The record repeats that a protocol primitive does not prescribe allowlist, identity, retention or approval policy, and forbids reading the primitive as evidence of a safe or production-ready system.',
      'rights-and-locator': 'The pinned 2024-11-05 specification is cited at its architecture, lifecycle, capabilities and resources sections under citation-with-paraphrase, with the protocol version identifying the exact artifact reviewed.',
    },
  },
  {
    recordId: 'urn:maha:record:agentic-systems-mcp-tool-deny-by-default',
    disposition: 'revise-and-rereview',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: null,
    unsatisfied: [
      {
        scope: 'source-fidelity',
        criterionId: 'claim-source-alignment',
        reason: 'The bound source is the MCP core specification, and that source contract states in its own boundary that “A protocol primitive does not prescribe an organization’s allowlist, identity, retention, or approval policy.” Deny-by-default for tool invocation is precisely an approval and allowlist policy, so the cited location does not support the claim. No inspected specification text establishing a default-deny requirement was found.',
      },
      {
        scope: 'domain-fidelity',
        criterionId: 'scope-transfer',
        reason: 'The record is typed as a comparison, but the specification reports no comparison between default-deny and default-allow tool exposure. Presenting a security posture as source-supported by a protocol definition transfers the claim outside the cited scope.',
      },
    ],
    blockers: [
      'claim-not-supported-by-cited-source',
      'source-boundary-contradicts-claim',
      'comparison-kind-without-comparative-evidence',
    ],
    remediation: 'Either narrow the wording to what the specification does say — that the protocol negotiates tool capabilities and that its security section places consent and authorisation decisions with the host — and re-type the record away from comparison; or bind a security-policy source that actually prescribes default-deny, then re-inspect and re-review at the new exact locator. Until direct inspected source text supports a default-deny requirement, the record stays withheld.',
    scopes: {
      'source-fidelity': 'Withheld. The cited specification defines capability-negotiated primitives and expressly disclaims prescribing approval policy, so it cannot support a deny-by-default claim.',
      'domain-fidelity': 'Withheld. A protocol definition is not comparative evidence about tool-exposure postures.',
      'boundary-adequacy': 'Not reached. The record’s boundaries and prohibited inferences are adequate in form, but adequacy cannot compensate for a claim the source does not support.',
      'rights-and-locator': 'The locator and citation-with-paraphrase basis are themselves in order; the failure is claim support, not rights or location.',
    },
  },
  {
    recordId: 'urn:maha:record:biomolecular-engineering-experimental-fold-validation',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'The inspected locator names the experimental validation section, and the source contract states the study evaluates the method on specified benchmark and experimental tasks. The record claims the validation mechanism only, with no success rate or fold-accuracy figure.',
      'domain-fidelity': 'Experimental fold validation is kept as a wet-lab confirmation step for computationally designed sequences, and is not presented as structure prediction or as a general assay for arbitrary proteins.',
      'boundary-adequacy': 'The record carries the source boundary that benchmark and selected validation results establish neither universal sequence fitness nor deployment suitability, and prohibits clinical-benefit and manufacturability readings.',
      'rights-and-locator': 'DOI 10.1126/science.add2187 is cited at the sequence-design method, benchmark comparisons, experimental validation and supplementary methods, under citation-with-paraphrase with no protected text reproduced.',
    },
  },
  {
    recordId: 'urn:maha:record:biomolecular-engineering-sequence-design-with-proteinmpnn',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'ProteinMPNN sequence design is the subject of the inspected paper and its named method section, so the concept sits on the source directly. The record asserts no recovery rate or comparative superiority over other design methods.',
      'domain-fidelity': 'The record keeps the method as neural sequence design conditioned on a backbone, and does not extend it to structure prediction, function prediction, or design of arbitrary biomolecules.',
      'boundary-adequacy': 'Benchmarks and selected validations are explicitly said not to establish universal sequence fitness or deployment suitability, and the prohibited inferences block safety and commercial-availability readings.',
      'rights-and-locator': 'The same DOI 10.1126/science.add2187 location is cited with method, benchmark and supplementary-method sections identified, retained as original paraphrase under citation-with-paraphrase.',
    },
  },
  {
    recordId: 'urn:maha:record:circuit-quantum-electrodynamics',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'The claim states that the analysis shows a parameter regime where qubit–resonator coupling can exceed modelled damping rates and support dispersive control and measurement. That is the paper’s own dispersive-regime analysis at the inspected sections, and the claim is expressed as a modelled regime rather than a measured device result.',
      'domain-fidelity': 'The record keeps circuit QED as the superconducting-circuit realisation of cavity QED with a transmission-line resonator, and does not transfer the analysis to atomic cavity QED or to any fabricated processor.',
      'boundary-adequacy': 'The record states the analysis is not a measured universal coupling, coherence, or readout-fidelity guarantee, matching the source boundary that this is an architecture and modelling paper without yield or fault-tolerance results.',
      'rights-and-locator': 'Physical Review A 69, 062320 is cited at the abstract, Sections II–V and the circuit Hamiltonian and dispersive-regime analysis, under citation-with-paraphrase against the publisher abstract page.',
    },
  },
  {
    recordId: 'urn:maha:record:critical-supply-chains-critical-mineral-import-reliance',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'Net import reliance is named explicitly in the inspected methods and data locator, so the concept is the source’s own analytical indicator. The record reports no percentage, commodity ranking, or year-specific value.',
      'domain-fidelity': 'Import reliance stays a national-level criticality indicator as USGS defines it, and is not converted into a firm-level exposure, price forecast, or sourcing recommendation.',
      'boundary-adequacy': 'The record carries the source boundary that a national criticality indicator forecasts no company’s inventory, price, contract access, or operational outcome, and blocks strategic-superiority readings.',
      'rights-and-locator': 'The USGS Mineral Resources Program page is a public-domain federal work cited at its criticality, net-import-reliance, disruption-exposure and uncertainty methods and data sections.',
    },
  },
  {
    recordId: 'urn:maha:record:fusion-plasma-systems-breeding-blanket-test-modules',
    disposition: 'revise-and-rereview',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: null,
    unsatisfied: [
      {
        scope: 'source-fidelity',
        criterionId: 'claim-source-alignment',
        reason: 'The bound locator covers “heating and current drive, fuel cycle, vacuum, cryogenic, diagnostics, and tritium breeding system summaries.” It names neither breeding blankets nor test blanket modules. Treating a tritium-breeding system summary as support for a test-module record requires an inference the inspected location does not carry.',
      },
      {
        scope: 'domain-fidelity',
        criterionId: 'mechanism-and-method',
        reason: 'The record is typed as a measurement, but the cited page is a supporting-systems inventory whose own boundary states that a system inventory is not evidence of integrated operation. An inventory entry supplies no measurement.',
      },
    ],
    blockers: [
      'locator-does-not-name-claimed-subject',
      'measurement-kind-without-measured-quantity',
    ],
    remediation: 'Bind an ITER source that names the Test Blanket Module programme directly and inspect it at that section, or re-scope the record to the tritium breeding system summary the current locator does cover and re-type it away from measurement. Sibling fusion records sharing this page were approved only where the locator names their subject — diagnostics and fuel cycle do, blanket test modules do not.',
    scopes: {
      'source-fidelity': 'Withheld. The inspected locator does not name breeding blankets or test modules.',
      'domain-fidelity': 'Withheld. A supporting-systems inventory cannot support a measurement-kind record.',
      'boundary-adequacy': 'Not reached. The boundary and prohibited-inference wording is adequate in form but cannot repair an unsupported subject binding.',
      'rights-and-locator': 'The ITER page is an authoritative living publisher page and the rights basis is sound; the failure is subject coverage at the cited location.',
    },
  },
  {
    recordId: 'urn:maha:record:fusion-plasma-systems-divertor-heat-exhaust',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'The inspected locator names divertor heat and particle exhaust directly, and the source contract states ITER describes the engineering functions surrounding a burning plasma including heat exhaust. The record claims the mechanism only, with no heat-flux value or material lifetime.',
      'domain-fidelity': 'Divertor exhaust is kept as a plasma-facing engineering function within magnetic-confinement operation, and is not extended to any specific reactor design or to steady-state power-plant duty.',
      'boundary-adequacy': 'The record repeats that design roles do not establish lifetime under every neutron and heat-load regime, and prohibits manufacturability, economic and readiness inferences.',
      'rights-and-locator': 'The ITER “Making fusion work” page is cited at its plasma control, first wall, blanket and divertor exhaust sections under citation-with-paraphrase as an authoritative living publisher page.',
    },
  },
  {
    recordId: 'urn:maha:record:fusion-plasma-systems-plasma-diagnostics',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'Diagnostics is named explicitly in the inspected supporting-systems locator, and the source contract states ITER identifies the systems required to heat, diagnose, fuel, evacuate and cool the machine. The record stays at that identification and reports no diagnostic resolution or accuracy.',
      'domain-fidelity': 'Plasma diagnostics is kept as the measurement-instrumentation function of the experimental machine, not as a validated measurement result or a general fusion instrumentation standard.',
      'boundary-adequacy': 'The record carries the source boundary that a system inventory is not evidence of integrated commercial operation, and blocks safety, scalability and deployment-readiness readings.',
      'rights-and-locator': 'The ITER supporting-systems page is cited at its diagnostics summary under citation-with-paraphrase, with the living-page nature of the artifact disclosed.',
    },
  },
  {
    recordId: 'urn:maha:record:fusion-plasma-systems-tritium-fuel-cycle',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'The inspected locator names both the fuel cycle and tritium breeding system summaries, so the record’s subject is stated at the cited location. No breeding ratio, inventory, or throughput figure is claimed.',
      'domain-fidelity': 'The tritium fuel cycle is kept as the fuelling and breeding method of the experimental machine, and is not presented as a closed commercial fuel cycle or as a demonstrated self-sufficiency result.',
      'boundary-adequacy': 'The record repeats that a system inventory is not evidence of integrated commercial operation, and prohibits reading the method as proof of safety, scalability, or economic advantage.',
      'rights-and-locator': 'The ITER supporting-systems page is cited at its fuel-cycle and tritium-breeding summaries under citation-with-paraphrase, with no diagram or table reproduced.',
    },
  },
  {
    recordId: 'urn:maha:record:mechanistic-interpretability-attention-pattern-evidence',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'The inspected locator names previous-token heads and interventions, which are attention-pattern observations the work reports for specified transformer models. The record claims the evidence type only and asserts no accuracy figure or head count.',
      'domain-fidelity': 'Attention-pattern evidence is kept as one observational signal within mechanistic interpretability, not as a complete or sufficient account of a model’s computation.',
      'boundary-adequacy': 'The record carries the source boundary that circuits observed in studied models do not establish a universal account of in-context learning, and blocks safety and deployment readings.',
      'rights-and-locator': 'The Transformer Circuits publication is cited at its induction-head definition, previous-token heads, training dynamics, interventions and model-scope sections under citation-with-paraphrase.',
    },
  },
  {
    recordId: 'urn:maha:record:mechanistic-interpretability-in-context-learning-circuits',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'In-context learning and the circuits associated with it are the inspected work’s stated subject, and the locator names the interventions and training dynamics on which that association rests. The record does not claim the circuits explain in-context learning completely.',
      'domain-fidelity': 'The record keeps the circuit analysis as a method applied to the specified models, and does not transfer it to models, scales, or training regimes the work did not study.',
      'boundary-adequacy': 'The explicit non-universality boundary from the source is retained, together with prohibitions on treating the method as proof of model safety or robustness.',
      'rights-and-locator': 'The same Transformer Circuits article is cited at the definition, dynamics, intervention and model-scope sections, retained as original paraphrase under citation-with-paraphrase.',
    },
  },
  {
    recordId: 'urn:maha:record:mechanistic-interpretability-induction-head-circuits',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'The induction-head definition is the first item in the inspected locator, so the record’s concept is defined at the cited location rather than inferred from surrounding literature. No prevalence or strength figure is asserted.',
      'domain-fidelity': 'Induction heads are kept as the specific circuit construct the work defines, and are not generalised into an account of all attention behaviour or all in-context learning.',
      'boundary-adequacy': 'The record repeats that observed circuits in studied models establish no universal account, and prohibits conclusions about proven or safe model behaviour.',
      'rights-and-locator': 'The Transformer Circuits article is cited at its induction-head definition section under citation-with-paraphrase, with the publication URL identifying the exact artifact.',
    },
  },
  {
    recordId: 'urn:maha:record:mechanistic-interpretability-sae-encoder-decoder',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'The encoder–decoder construction with reconstruction and sparsity objectives is named in the inspected method locator, so the mechanism is the paper’s own. The record claims no reconstruction loss, sparsity level, or feature count.',
      'domain-fidelity': 'The mechanism is kept as a sparse autoencoder trained on language-model activations, and is not presented as a general dictionary-learning result or as a validated theory of superposition.',
      'boundary-adequacy': 'The record carries the source boundary that sparse features and human labels establish neither completeness, unique decomposition, nor causal faithfulness.',
      'rights-and-locator': 'arXiv:2309.08600 is cited at its method, objectives, experiments, feature-analysis and limitations sections under citation-with-paraphrase, with the preprint status of the artifact disclosed.',
    },
  },
  {
    recordId: 'urn:maha:record:mechanistic-interpretability-sparse-autoencoder-dictionaries',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'The learned feature dictionary is what the inspected method and feature-analysis sections produce and evaluate, so the concept rests on the cited location. The record asserts no interpretability score or dictionary size.',
      'domain-fidelity': 'Dictionaries are kept as the learned sparse feature sets of the studied autoencoders on the studied models, not as a canonical or complete decomposition of any model.',
      'boundary-adequacy': 'The completeness, uniqueness and causal-faithfulness disclaimers from the source are retained, and the record blocks safety and deployment inferences.',
      'rights-and-locator': 'The same arXiv:2309.08600 location is cited at its method and feature-analysis sections, with original paraphrase only under citation-with-paraphrase.',
    },
  },
  {
    recordId: 'urn:maha:record:neurotechnology-bci-spike-sorting-boundaries',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'superseding',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'Drift re-audit of the repaired revision. The record now binds Hill, Mehta and Kleinfeld, “Quality Metrics to Accompany Spike Sorting of Extracellular Signals” (DOI 10.1523/JNEUROSCI.0971-11.2011), not the Neuropixels instrumentation paper it was previously released against. The source contract establishes quantitative false-positive and false-negative error estimates for sorted units, which is exactly the sorting-boundary subject the record claims.',
      'domain-fidelity': 'The record stays on sorting-quality error estimation from refractory-period violations, detection threshold, cluster overlap and censored events. It does not transfer probe-instrumentation results into a sorting-quality claim, which was the defect in the superseded binding.',
      'boundary-adequacy': 'The source boundary is carried verbatim in effect: error metrics quantify sorting quality for a given dataset and establish neither that a particular unit is a single neuron nor that it is stable across sessions. Both prohibited inferences are therefore explicitly closed.',
      'rights-and-locator': 'The reviewed location is the quality-metrics and summary-matrices sections at the Journal of Neuroscience DOI, under citation-with-paraphrase. The superseding release binds the current target digest only; the prior release and its decisions remain immutable.',
    },
  },
  {
    recordId: 'urn:maha:record:quantum-error-mitigation',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'The claim names zero-noise extrapolation and quasiprobability cancellation for short-depth noisy-circuit expectation estimates, which are the two constructions the inspected paper presents. The claim is a construction claim, not a performance claim.',
      'domain-fidelity': 'Mitigation is kept distinct from error correction: the record states it does not provide the fault containment of error-correcting codes, matching the source boundary about assumptions and sampling overhead.',
      'boundary-adequacy': 'The record discloses large sampling overhead and the dependence on noise-model assumptions, and forbids reading mitigation as a route to scalable fault-tolerant computation.',
      'rights-and-locator': 'Physical Review Letters 119, 180509 is cited at its abstract, extrapolation and quasiprobability constructions and numerical examples, under citation-with-paraphrase against the publisher abstract page.',
    },
  },
  {
    recordId: 'urn:maha:record:stabilizer-syndrome-measurement',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'The claim states the construction specifies local stabilizer checks and syndrome histories used to infer likely physical errors, which the inspected paper sets out in its stabilizer-measurement sections. Inference of likely errors is stated as inference, not identification.',
      'domain-fidelity': 'Syndrome measurement is kept as the surface-code detection primitive, and is not presented as a general quantum-measurement result or as a decoder performance claim.',
      'boundary-adequacy': 'The record states syndrome data are indirect and decoder-dependent and do not identify every physical mechanism or guarantee correction, consistent with the source’s dependence on code, decoder, noise, geometry and scheduling assumptions.',
      'rights-and-locator': 'Physical Review A 86, 032324 is cited at its abstract, Sections II–XVI and appendices under citation-with-paraphrase, with the numerical-threshold sections identified.',
    },
  },
  {
    recordId: 'urn:maha:record:surface-code-error-correction',
    disposition: 'approved',
    sourceFidelityBasis: 'inspected-source-location',
    releaseKind: 'initial',
    unsatisfied: [],
    blockers: [],
    remediation: null,
    scopes: {
      'source-fidelity': 'The claim describes surface-code stabilizers, logical encodings, gates, movement and numerical fault-tolerance estimates, which enumerates what the inspected paper explains. Estimates are labelled numerical estimates rather than achieved results.',
      'domain-fidelity': 'The record keeps the surface code as one fault-tolerance architecture with its stated assumptions, and does not present its thresholds as properties of quantum computing generally or of any built device.',
      'boundary-adequacy': 'Threshold and overhead values are explicitly held conditional on geometry, noise, decoder, scheduling, leakage and operation assumptions, matching the source boundary.',
      'rights-and-locator': 'The same Physical Review A 86, 032324 location is cited at its abstract, main sections and appendices, retained as original paraphrase under citation-with-paraphrase.',
    },
  },
] as const

// Module-load integrity. These conditions cannot be satisfied by a fallback.
{
  const ids = REVIEWS.map((entry) => entry.recordId)
  if (new Set(ids).size !== ids.length) throw new Error('A remainder record is reviewed more than once.')
  const cohort = new Set<string>(BATCH_2_INTERNAL_REVIEW_REMAINDER_IDS)
  if (cohort.size !== 22) throw new Error(`The remainder cohort must contain 22 records; it contains ${cohort.size}.`)
  for (const recordId of cohort) if (!ids.includes(recordId)) throw new Error(`${recordId}: no explicit disposition was recorded.`)
  for (const entry of REVIEWS) {
    if (!cohort.has(entry.recordId)) throw new Error(`${entry.recordId}: reviewed but outside the remainder cohort.`)
    if (entry.disposition === 'approved') {
      if (entry.unsatisfied.length > 0) throw new Error(`${entry.recordId}: approved with unsatisfied criteria.`)
      if (entry.blockers.length > 0) throw new Error(`${entry.recordId}: approved while carrying blockers.`)
      if (entry.sourceFidelityBasis !== 'inspected-source-location') throw new Error(`${entry.recordId}: source fidelity may not rest on metadata verification alone.`)
      if (!entry.releaseKind) throw new Error(`${entry.recordId}: approved without a release kind.`)
    } else {
      if (entry.unsatisfied.length === 0) throw new Error(`${entry.recordId}: withheld without naming an unsatisfied criterion.`)
      if (entry.blockers.length === 0) throw new Error(`${entry.recordId}: withheld without a blocker code.`)
      if (!entry.remediation) throw new Error(`${entry.recordId}: withheld without remediation.`)
      if (entry.releaseKind !== null) throw new Error(`${entry.recordId}: withheld records may not declare a release kind.`)
    }
    for (const scope of Object.keys(EXPERT_REVIEW_CRITERIA) as ExpertReviewScope[]) {
      const finding = entry.scopes[scope]
      if (!finding || finding.trim().length < 40) throw new Error(`${entry.recordId}: ${scope} finding is missing or too thin to be record-specific.`)
    }
  }
}

export const BATCH_2_REMAINDER_REVIEWS = REVIEWS

export function remainderReview(recordId: string): RemainderReviewEntry | undefined {
  return REVIEWS.find((entry) => entry.recordId === recordId)
}

export const BATCH_2_REMAINDER_APPROVED_IDS = REVIEWS.filter((entry) => entry.disposition === 'approved').map((entry) => entry.recordId)
export const BATCH_2_REMAINDER_WITHHELD_IDS = REVIEWS.filter((entry) => entry.disposition !== 'approved').map((entry) => entry.recordId)

function packetFor(recordId: string): InternalReviewPacket {
  const packet = BATCH_2_INTERNAL_REVIEW_PACKETS.find((entry) => entry.recordId === recordId)
  if (!packet) throw new Error(`${recordId}: no frozen review packet exists.`)
  return packet
}

/** The target digest is part of the key, so a replay can never cross revisions. */
function idempotencyKey(recordId: string, targetSha256: string, scope: string): string {
  return `batch2-internal-remainder:${createHash('sha256').update(`${recordId}|${targetSha256}|${scope}|${INTERNAL_REVIEW_REMAINDER_VERSION}`).digest('hex')}`
}

const ALL_DOMAINS = [...new Set(BATCH_2_INTERNAL_REVIEW_PACKETS.map((packet) => packet.domainSlug))].sort()

function criterionRationale(packet: InternalReviewPacket, criterionId: string, finding: string): string {
  const source = packet.sources.map((entry) => `${entry.sourceId} at ${entry.exactLocator}`).join('; ')
  const emphasis: Record<string, string> = {
    'claim-source-alignment': `Claim ${packet.claims.map((entry) => entry.claimId).join(', ')} binds only ${source}.`,
    'source-context': `Source identity and artifact context remain visible: ${packet.sources.map((entry) => `${entry.title} (${entry.url})`).join('; ')}.`,
    'transcription-and-paraphrase': 'No quotation, figure, or table is retained; the establishes statement and source boundary constrain the paraphrase.',
    terminology: `The terminology is limited to ${packet.title} within ${packet.domainSlug}.`,
    'mechanism-and-method': `The mechanism is bounded by ${packet.claims.map((entry) => entry.scope).join(' | ')}.`,
    'scope-transfer': `The explicit claim boundary is ${packet.claims.map((entry) => entry.boundary).join(' | ')}.`,
    'uncertainty-and-replication': `${packet.claims.map((entry) => `${entry.uncertainty} ${entry.replication}`).join(' | ')}`,
    'non-claims': `The record boundaries are ${packet.boundaries.join(' | ')}.`,
    'high-stakes-use': `The prohibited inferences are ${packet.prohibitedInferences.join(' | ')}.`,
    locator: `The exact reviewed location is ${source}.`,
    'rights-basis': `The retained rights basis is ${packet.sources.map((entry) => `${entry.sourceId}: ${entry.rightsBasis}`).join('; ')}.`,
    'identifier-and-version': `The decision binds exact target ${packet.targetSha256} and sources ${packet.sources.map((entry) => entry.url).join('; ')}.`,
  }
  const detail = emphasis[criterionId]
  if (!detail) throw new Error(`${criterionId}: no criterion detail is defined; a review may not be generated with an empty rationale.`)
  return `${finding} ${detail}`
}

/**
 * Only approved records produce review inputs. A withheld record has no branch
 * that could emit a decision, so a rejected, blocked or revise-and-rereview
 * record can never reach the release set.
 */
export function remainderInternalReviewInputs(): readonly ExpertReviewInput[] {
  return REVIEWS.filter((entry) => entry.disposition === 'approved').flatMap((entry) => {
    const packet = packetFor(entry.recordId)
    return (Object.keys(EXPERT_REVIEW_CRITERIA) as ExpertReviewScope[]).map((scope) => ({
      recordId: packet.recordId,
      domainSlug: packet.domainSlug,
      targetSha256: packet.targetSha256,
      scope,
      reviewer: {
        reviewerId: 'expert_maha-internal-editorial-v2',
        profileVersion: 2,
        displayName: 'Maha Internal Editorial Protocol',
        qualifications: ['AI-assisted internal source, scope, boundary, rights, and locator review. This is an organizational editorial method, not an external subject-matter credential.'],
        affiliation: 'Maha Strategies',
        identityUrl: 'https://www.mahastrategies.com/knowledge/epistemic-system',
        domains: ALL_DOMAINS,
        conflicts: [packet.publisherConflict],
        reviewerKind: 'internal-editorial' as const,
        reviewMethod: 'Record-specific exact-revision review against the inspected source location, bounded claim, non-claims, rights basis, and source identity. No external reviewer participated.',
      },
      criteria: EXPERT_REVIEW_CRITERIA[scope].map((criterion) => ({
        criterionId: criterion.id,
        verdict: 'satisfied' as const,
        rationale: criterionRationale(packet, criterion.id, entry.scopes[scope]),
      })),
      disagreements: [packet.publisherConflict],
      rationale: `${entry.scopes[scope]} This approval is limited to ${scope}, record ${packet.recordId}, and exact target ${packet.targetSha256}; it is AI-assisted internal editorial review, not external expert review, peer review, consensus, independent reproduction, scientific validation, or commercial certification.`,
      supersedesReviewId: null,
      idempotencyKey: idempotencyKey(packet.recordId, packet.targetSha256, scope),
    }))
  })
}

export const INTERNAL_REVIEW_REMAINDER_SUMMARY = {
  schemaVersion: INTERNAL_REVIEW_REMAINDER_VERSION,
  reviewed: REVIEWS.map((entry) => entry.recordId),
  approved: BATCH_2_REMAINDER_APPROVED_IDS,
  rejected: REVIEWS.filter((entry) => entry.disposition === 'rejected').map((entry) => entry.recordId),
  reviseAndRereview: REVIEWS.filter((entry) => entry.disposition === 'revise-and-rereview').map((entry) => entry.recordId),
  blocked: REVIEWS.filter((entry) => entry.disposition === 'blocked').map((entry) => entry.recordId),
  initialReleaseCandidates: REVIEWS.filter((entry) => entry.disposition === 'approved' && entry.releaseKind === 'initial').map((entry) => entry.recordId),
  supersedingReleaseCandidates: REVIEWS.filter((entry) => entry.disposition === 'approved' && entry.releaseKind === 'superseding').map((entry) => entry.recordId),
  stillWithheld: BATCH_2_REMAINDER_WITHHELD_IDS,
  boundary: 'These are record-specific AI-assisted internal editorial decisions with the publisher conflict disclosed on every decision. They are not external expert review, peer review, consensus, independent reproduction, scientific validation, or commercial certification. External expert review remains an optional append-only upgrade.',
} as const
