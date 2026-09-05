import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import batchOne from '../content/scaling/epistemic-clearing-batch-1.json' with { type: 'json' }
import batchTwo from '../content/scaling/epistemic-clearing-batch-2.json' with { type: 'json' }
import routeMap from '../content/scaling/epistemic-clearing-route-candidates-v1.json' with { type: 'json' }
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { buildEpistemicClearingGuide, type Candidate, type Lane } from './generate-epistemic-clearing-batch-2.ts'

const ROOT = resolve(import.meta.dirname, '..')
const OUTPUT_ROOT = process.argv[2] ? resolve(process.argv[2]) : ROOT
const PREPARED_ON = '2026-09-05'
const LAST_AUTHORIZED_STATIC_PAGE_COUNT = 993
const PRIOR_PREPARED_ROUTES = 507

type BoundaryInspection = {
  candidateId: string
  path: string
  sourceId: 'project-madurai-tiruvaymoli-part-4' | 'project-madurai-paripatal'
  sourceUrl: string
  sourceFileSha256: `sha256:${string}`
  title: string
  locator: string
  boundaryEvidence: string
  sequenceStatus: 'consecutive-numbering' | 'source-numbering-anomaly-recorded' | 'editorial-segment-at-printed-boundary'
  inspectionDepth: 'edition-structure-and-unit-boundary'
  interpretationInspected: false
  sourceAnomaly: string | null
  provenanceDigest?: `sha256:${string}`
}

type ParipatalSegment = {
  kind: 'main-poem' | 'collected-fragment'
  poemOrFragment: number
  subject: string
  lines?: [number, number]
}

const TIRUVAYMOLI_SOURCE = {
  sourceId: 'project-madurai-tiruvaymoli-part-4' as const,
  title: 'Nālāyira Divya Prabhandam, Part 4 — English translation by Kausalya Hart',
  url: 'https://www.projectmadurai.org/pm_etexts/utf8/pmuni0624_eng.html',
  fileSha256: 'sha256:f20a94850e74e0d62f7fa726ca24eebfc53ad6a44dcc406cacec1944da961660' as const,
  rightsBasis: 'Project Madurai permits free distribution when its header remains intact; Maha stores only boundary metadata and paraphrases, and links to the edition.',
}

const PARIPATAL_SOURCE = {
  sourceId: 'project-madurai-paripatal' as const,
  title: 'Paripāṭal and Paripāṭal tiraṭṭu — Project Madurai Tamil e-text',
  url: 'https://www.projectmadurai.org/pm_etexts/utf8/pmuni0087.html',
  fileSha256: 'sha256:07497b27fa06415c89e0023530d7599595521f400cc088cbaeaee9f2ea8e4fc9' as const,
  rightsBasis: 'Project Madurai permits free distribution when its header remains intact; Maha stores only boundary metadata and does not silently translate the Tamil text.',
}

const paripatalPoems = [
  [1, 'Tirumāl', 68], [2, 'Tirumāl', 76], [3, 'Tirumāl', 94], [4, 'Tirumāl', 73],
  [5, 'Cevvēḷ', 81], [6, 'Vaiyai', 106], [7, 'Vaiyai', 86], [8, 'Cevvēḷ', 130],
  [9, 'Cevvēḷ', 85], [10, 'Vaiyai', 131], [11, 'Vaiyai', 140], [12, 'Vaiyai', 100],
  [13, 'Tirumāl', 64], [14, 'Cevvēḷ', 32], [15, 'Tirumāl', 66], [16, 'Vaiyai', 55],
  [17, 'Cevvēḷ', 53], [18, 'Cevvēḷ', 56], [19, 'Cevvēḷ', 105], [20, 'Vaiyai', 111],
  [21, 'Cevvēḷ', 70], [22, 'Vaiyai', 45],
] as const

const splitPoems: Readonly<Record<number, readonly [number, number]>> = {
  8: [65, 130],
  10: [65, 131],
  11: [70, 140],
  19: [50, 105],
  20: [55, 111],
}

const paripatalMainSegments: ParipatalSegment[] = paripatalPoems.flatMap(([poem, subject, lastLine]) => {
  const split = splitPoems[poem]
  if (!split) return [{ kind: 'main-poem' as const, poemOrFragment: poem, subject, lines: [1, lastLine] }]
  return [
    { kind: 'main-poem' as const, poemOrFragment: poem, subject, lines: [1, split[0]] },
    { kind: 'main-poem' as const, poemOrFragment: poem, subject, lines: [split[0] + 1, split[1]] },
  ]
})

const paripatalFragmentSubjects = [
  'Tirumāl', 'Vaiyai', 'Vaiyai', 'Vaiyai', 'unattributed surviving fragment', 'unattributed surviving fragment',
  'Madurai', 'unattributed surviving fragment', 'unattributed surviving fragment', 'unattributed surviving fragment',
  'unattributed surviving fragment', 'unattributed surviving fragment', 'possible Paripāṭal fragment',
] as const

const paripatalSegments: ParipatalSegment[] = [
  ...paripatalMainSegments,
  ...paripatalFragmentSubjects.map((subject, index) => ({
    kind: 'collected-fragment' as const,
    poemOrFragment: index + 1,
    subject,
  })),
]

if (paripatalMainSegments.length !== 27 || paripatalSegments.length !== 40) {
  throw new Error(`Paripāṭal stabilization expected 27 main-poem segments and 40 total segments; received ${paripatalMainSegments.length} and ${paripatalSegments.length}.`)
}

const usedPaths = new Set([...batchOne.pages, ...batchTwo.pages].map((page) => page.path))
const remaining = routeMap.candidates.filter((candidate) => !usedPaths.has(candidate.proposedPath))

function candidatesFor(lanes: readonly Lane[]): Candidate[] {
  return remaining.filter((candidate) => lanes.includes(candidate.lane)).sort((left, right) => left.rank - right.rank)
}

const tamilCandidates = candidatesFor(['tamil-religion'])
const paripatalCandidates = tamilCandidates
  .filter((candidate) => candidate.subcategory === 'Paripatal passage guide')
  .sort((left, right) => left.proposedPath.localeCompare(right.proposedPath))
const tiruvaymoliCandidates = tamilCandidates
  .filter((candidate) => candidate.subcategory === 'Tiruvaymoli complete-unit guide')
  .sort((left, right) => left.proposedPath.localeCompare(right.proposedPath))

if (paripatalCandidates.length !== 40 || tiruvaymoliCandidates.length !== 50) {
  throw new Error(`Tamil stabilization expected 40 Paripāṭal and 50 Tiruvāymoḻi candidates; received ${paripatalCandidates.length} and ${tiruvaymoliCandidates.length}.`)
}

const paripatalInspections: BoundaryInspection[] = paripatalCandidates.map((candidate, index) => {
  const segment = paripatalSegments[index]
  const locator = segment.kind === 'main-poem'
    ? `Main Paripāṭal collection, poem ${segment.poemOrFragment} (${segment.subject}), lines ${segment.lines![0]}–${segment.lines![1]}`
    : `Paripāṭal tiraṭṭu, surviving fragment ${segment.poemOrFragment} (${segment.subject}), complete printed fragment`
  const entry: BoundaryInspection = {
    candidateId: candidate.candidateId,
    path: candidate.proposedPath,
    sourceId: PARIPATAL_SOURCE.sourceId,
    sourceUrl: PARIPATAL_SOURCE.url,
    sourceFileSha256: PARIPATAL_SOURCE.fileSha256,
    title: segment.kind === 'main-poem'
      ? `Paripāṭal poem ${segment.poemOrFragment} (${segment.subject}), lines ${segment.lines![0]}–${segment.lines![1]}`
      : `Paripāṭal tiraṭṭu fragment ${segment.poemOrFragment} (${segment.subject})`,
    locator,
    boundaryEvidence: segment.kind === 'main-poem'
      ? `The Tamil e-text prints poem ${segment.poemOrFragment} under the ${segment.subject} heading and prints terminal line ${segment.lines![1]}; this route is an editorial segment bounded by those printed line numbers.`
      : `The collected fragment is bounded by its printed fragment heading and the next printed fragment heading${segment.poemOrFragment === 13 ? ' or the collection-complete marker' : ''}.`,
    sequenceStatus: 'editorial-segment-at-printed-boundary',
    inspectionDepth: 'edition-structure-and-unit-boundary',
    interpretationInspected: false,
    sourceAnomaly: null,
  }
  return { ...entry, provenanceDigest: provenanceDigest(entry) }
})

const tiruvaymoliInspections: BoundaryInspection[] = tiruvaymoliCandidates.map((candidate, index) => {
  const unit = index + 47
  const start = 3299 + index * 11
  const end = start + 10
  const numberingAnomaly = start === 3530
  const entry: BoundaryInspection = {
    candidateId: candidate.candidateId,
    path: candidate.proposedPath,
    sourceId: TIRUVAYMOLI_SOURCE.sourceId,
    sourceUrl: TIRUVAYMOLI_SOURCE.url,
    sourceFileSha256: TIRUVAYMOLI_SOURCE.fileSha256,
    title: `Tiruvāymoḻi ${start}–${end}: complete-unit boundary`,
    locator: numberingAnomaly
      ? `Tiruvāymoḻi printed sequence 3530–3540; the item between 3534 and 3536 is printed as 3435 in this edition`
      : `Tiruvāymoḻi pāsurams ${start}–${end}, complete printed unit ${unit}`,
    boundaryEvidence: `The Project Madurai edition prints eleven items in this sequence and closes it with the unit's Saḍagopan verse at ${end}.`,
    sequenceStatus: numberingAnomaly ? 'source-numbering-anomaly-recorded' : 'consecutive-numbering',
    inspectionDepth: 'edition-structure-and-unit-boundary',
    interpretationInspected: false,
    sourceAnomaly: numberingAnomaly
      ? 'The edition prints 3435 between 3534 and 3536. Maha preserves the observed typo and does not silently relabel the source text as 3535.'
      : null,
  }
  return { ...entry, provenanceDigest: provenanceDigest(entry) }
})

const inspectionBody = {
  schemaVersion: 'maha-tamil-passage-boundary-inspection/1.0',
  inspectedOn: PREPARED_ON,
  scope: 'Edition identity, rights notice, printed poem or pāsuram sequence, terminal boundary, and source anomalies only. Passage interpretation, translation fidelity, historical inference, and theology were not reviewed by this inspection.',
  sources: [
    { ...TIRUVAYMOLI_SOURCE, observedEditionHeader: 'Part 4, pāsurams 2971–4000; Tiruvāymoḻi 2791–3892; English translation by Kausalya Hart' },
    { ...PARIPATAL_SOURCE, observedEditionHeader: 'Paripāṭal and Paripāṭal tiraṭṭu, Tamil script Unicode e-text; revised 20 November 2021' },
  ],
  counts: {
    total: paripatalInspections.length + tiruvaymoliInspections.length,
    paripatalEditorialSegments: paripatalInspections.length,
    tiruvaymoliCompleteUnits: tiruvaymoliInspections.length,
    sourceNumberingAnomalies: tiruvaymoliInspections.filter((entry) => entry.sourceAnomaly).length,
    interpretationInspected: 0,
  },
  entries: [...paripatalInspections, ...tiruvaymoliInspections],
}
const inspectionArtifact = { ...inspectionBody, provenanceDigest: provenanceDigest(inspectionBody) }

function stabilizeTamilGuide(candidate: Candidate) {
  const inspection = inspectionArtifact.entries.find((entry) => entry.candidateId === candidate.candidateId)
  if (!inspection) throw new Error(`Missing Tamil boundary inspection for ${candidate.proposedPath}.`)
  const base = buildEpistemicClearingGuide(candidate)
  const { provenanceDigest: _oldDigest, ...baseBody } = base
  if (!_oldDigest.startsWith('sha256:')) throw new Error(`Base guide is not digest-bound for ${candidate.proposedPath}.`)
  const isTiruvaymoli = inspection.sourceId === TIRUVAYMOLI_SOURCE.sourceId
  const directAnswer = isTiruvaymoli
    ? `${inspection.boundaryEvidence} This establishes the addressable unit in this edition. It does not establish an unmediated Tamil reading, translation equivalence, historical practice, or theological truth.${inspection.sourceAnomaly ? ` ${inspection.sourceAnomaly}` : ''}`
    : `${inspection.boundaryEvidence} This establishes an addressable Tamil passage boundary. It does not translate the passage, identify every name or voice, establish historical practice, or adjudicate theology.`
  const methodBoundary = isTiruvaymoli
    ? 'The edition identity and complete-unit boundary were inspected. The guide does not claim that its translation, divine-name relationships, historical setting, reception history, or theology were independently verified.'
    : 'The Tamil edition structure and exact editorial segment boundary were inspected. No unmediated English translation, name interpretation, historical inference, or theological conclusion is supplied.'
  const question = isTiruvaymoli
    ? `What does the printed boundary of ${inspection.title.replace(': complete-unit boundary', '')} establish?`
    : `How should ${inspection.title} be used as a bounded primary-text passage?`
  const sourceLinks = [
    {
      title: isTiruvaymoli ? 'Tiruvāymoḻi passage atlas' : 'Tamil religion source atlas',
      path: isTiruvaymoli ? '/knowledge/religion/tiruvaymoli' : '/knowledge/religion/tamil-source-atlas',
      role: 'inspected-source-projection' as const,
    },
    ...base.sourceLinks.filter((link) => link.path !== '/knowledge/religion/tamil-source-atlas'),
  ]
  const body = {
    ...baseBody,
    title: inspection.title,
    searchIntent: question,
    question,
    directAnswer,
    summary: `Source-boundary guide for ${inspection.title}, with the exact edition locator, permitted inference, required attribution, and explicit interpretation limits.`,
    evidenceFrame: 'edition-boundary-inspected-without-interpretive-finding',
    methodBoundary,
    sourceLinks,
    decisionRecord: {
      ...base.decisionRecord,
      subject: inspection.title,
      question,
      minimumEvidence: `The exact source identity and boundary inspection at ${inspection.locator}; a named translation or scholarship source is additionally required for any interpretation.`,
      resultStatus: 'The edition boundary is inspected; no passage-level interpretive result has been produced.',
    },
    questions: [
      { question, answer: directAnswer },
      { question: `Which edition and locator govern ${inspection.title}?`, answer: `${isTiruvaymoli ? TIRUVAYMOLI_SOURCE.title : PARIPATAL_SOURCE.title}; ${inspection.locator}.` },
      { question: `What has actually been inspected for ${inspection.title}?`, answer: `${inspection.boundaryEvidence} Interpretation and translation fidelity were not inspected.` },
      { question: `What must be added before interpreting ${inspection.title}?`, answer: 'Use a named translation or language-qualified reading, attribute commentary and scholarship separately, and bind each claim to the smallest supporting passage.' },
      { question: `What must a machine refuse to infer from ${inspection.title}?`, answer: methodBoundary },
    ],
    sourceBoundaryInspection: {
      sourceId: inspection.sourceId,
      sourceUrl: inspection.sourceUrl,
      sourceFileSha256: inspection.sourceFileSha256,
      locator: inspection.locator,
      inspectionDepth: inspection.inspectionDepth,
      interpretationInspected: inspection.interpretationInspected,
      sourceAnomaly: inspection.sourceAnomaly,
      inspectionEntryDigest: inspection.provenanceDigest,
    },
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

type BuiltGuide = ReturnType<typeof buildEpistemicClearingGuide> | ReturnType<typeof stabilizeTamilGuide>

function buildBatch(
  batchNumber: 3 | 4 | 5 | 6,
  objective: string,
  candidates: Candidate[],
  pages: BuiltGuide[],
  priorBatchDigests: readonly string[],
) {
  const preparedBefore = PRIOR_PREPARED_ROUTES + ({ 3: 0, 4: 140, 5: 340, 6: 430 } as const)[batchNumber]
  const body = {
    schemaVersion: 'maha-epistemic-clearing-batch/1.0',
    preparedOn: PREPARED_ON,
    batchNumber,
    objective,
    selection: {
      sourceMapDigest: routeMap.provenanceDigest,
      excludesBatchDigests: priorBatchDigests,
      lanes: [...new Set(candidates.map((candidate) => candidate.lane))],
      exactCandidateIds: candidates.map((candidate) => candidate.candidateId),
      provisionalCandidatesAdmitted: candidates.filter((candidate) => candidate.canonicalSlugStatus !== 'stable-candidate').length,
      provisionalAdmissionRule: batchNumber === 5
        ? 'A provisional passage candidate enters only when the immutable boundary-inspection artifact names its exact candidate id, path, source, locator, boundary evidence, and entry digest.'
        : 'No provisional candidate is admitted.',
    },
    deploymentGate: {
      state: 'build-withheld' as const,
      lastOperatorAuthorizedStaticPageCount: LAST_AUTHORIZED_STATIC_PAGE_COUNT,
      priorPreparedRoutes: preparedBefore,
      thisBatchRoutes: pages.length,
      cumulativePreparedRoutes: preparedBefore + pages.length,
      projectedPreparedSitePages: LAST_AUTHORIZED_STATIC_PAGE_COUNT + preparedBefore + pages.length,
      exactBuildCountMeasured: false as const,
      instruction: 'Do not run a Next.js, Vercel, Preview, or Production build without new explicit operator approval.',
    },
    counts: {
      total: pages.length,
      boundedQuestions: pages.reduce((sum, page) => sum + page.questions.length, 0),
      byLane: Object.fromEntries([...new Set(candidates.map((candidate) => candidate.lane))].map((lane) => [lane, pages.filter((page) => page.lane === lane).length])),
      sourceBoundaryInspected: pages.filter((page) => 'sourceBoundaryInspection' in page).length,
      subjectSpecificResultsClaimed: pages.filter((page) => page.resultStatus !== 'no-subject-specific-result-claimed').length,
    },
    publicationBoundary: 'Prepared routes are local code and content only. They are not built, deployed, observed, indexed, clicked, commercially validated, or canonical scientific releases.',
    pages,
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

const evidenceCandidates = candidatesFor(['evidence-clearing'])
const mathematicsAstronomyCandidates = candidatesFor(['mathematics-astronomy'])
const astrologyCrossCandidates = candidatesFor(['astrology-infrastructure', 'cross-domain-synthesis'])

if (evidenceCandidates.length !== 140) throw new Error(`Expected 140 remaining evidence candidates, found ${evidenceCandidates.length}.`)
if (mathematicsAstronomyCandidates.length !== 200) throw new Error(`Expected 200 remaining mathematics/astronomy candidates, found ${mathematicsAstronomyCandidates.length}.`)
if (tamilCandidates.length !== 90) throw new Error(`Expected 90 remaining Tamil candidates, found ${tamilCandidates.length}.`)
if (astrologyCrossCandidates.length !== 63) throw new Error(`Expected 63 remaining astrology/cross-domain candidates, found ${astrologyCrossCandidates.length}.`)

const batchThree = buildBatch(3, 'Prepare 140 evidence-clearing routes that turn the governed evidence architecture into bounded public decision procedures.', evidenceCandidates, evidenceCandidates.map(buildEpistemicClearingGuide), [batchOne.provenanceDigest, batchTwo.provenanceDigest])
const batchFour = buildBatch(4, 'Prepare 200 formal mathematics and observational astronomy verification routes over public references and reproducible methods.', mathematicsAstronomyCandidates, mathematicsAstronomyCandidates.map(buildEpistemicClearingGuide), [batchOne.provenanceDigest, batchTwo.provenanceDigest, batchThree.provenanceDigest])
const batchFive = buildBatch(5, 'Stabilize and prepare 90 Tamil primary-text passage routes only after inspecting their exact edition boundaries.', tamilCandidates, tamilCandidates.map(stabilizeTamilGuide), [batchOne.provenanceDigest, batchTwo.provenanceDigest, batchThree.provenanceDigest, batchFour.provenanceDigest])
const batchSix = buildBatch(6, 'Prepare 50 astrology infrastructure routes and 13 typed cross-domain bridge routes without computing charts or transferring validity.', astrologyCrossCandidates, astrologyCrossCandidates.map(buildEpistemicClearingGuide), [batchOne.provenanceDigest, batchTwo.provenanceDigest, batchThree.provenanceDigest, batchFour.provenanceDigest, batchFive.provenanceDigest])

const allPaths = [...batchOne.pages, ...batchTwo.pages, ...batchThree.pages, ...batchFour.pages, ...batchFive.pages, ...batchSix.pages].map((page) => page.path)
if (allPaths.length !== 1_000 || new Set(allPaths).size !== 1_000) {
  throw new Error(`The six batches must contain exactly 1,000 unique paths; received ${allPaths.length} paths and ${new Set(allPaths).size} unique paths.`)
}

const outputs = [
  ['content/scaling/tamil-passage-boundary-inspection-v1.json', inspectionArtifact],
  ['content/scaling/epistemic-clearing-batch-3.json', batchThree],
  ['content/scaling/epistemic-clearing-batch-4.json', batchFour],
  ['content/scaling/epistemic-clearing-batch-5.json', batchFive],
  ['content/scaling/epistemic-clearing-batch-6.json', batchSix],
] as const

for (const [relativePath, artifact] of outputs) {
  const output = resolve(OUTPUT_ROOT, relativePath)
  mkdirSync(resolve(output, '..'), { recursive: true })
  writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`)
}

console.log(`Prepared four local tranches with ${batchThree.pages.length + batchFour.pages.length + batchFive.pages.length + batchSix.pages.length} routes and ${[batchThree, batchFour, batchFive, batchSix].reduce((sum, batch) => sum + batch.counts.boundedQuestions, 0)} bounded questions; no build or deployment ran.`)
