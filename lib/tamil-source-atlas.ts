import cohort from '../content/religion/tamil-source-atlas/research-cohort-v1.json' with { type: 'json' }

import { provenanceDigest } from './evidence-dossier/digest.ts'
import { MAYON_KNOWLEDGE_PATH, MAYON_SOURCES } from './mayon-knowledge.ts'
import { TAMIL_CLASSICAL_PATH, TAMIL_CLASSICAL_SOURCES } from './tamil-classical-traditions.ts'
import { TIRUVAYMOLI_ATLAS_PATH, TIRUVAYMOLI_ATLAS_SOURCES } from './tiruvaymoli-passage-atlas.ts'

export const TAMIL_SOURCE_ATLAS_VERSION = 'tamil-source-atlas/1.0' as const
export const TAMIL_SOURCE_ATLAS_DATE = '2026-09-04' as const
export const TAMIL_SOURCE_ATLAS_PATH = '/knowledge/religion/tamil-source-atlas' as const
export const TAMIL_SOURCE_ATLAS_REGISTRY_PATH = `${TAMIL_SOURCE_ATLAS_PATH}/registry` as const

export type TamilSourceAtlasCategory =
  | 'paripatal-passage'
  | 'landscape-relationship'
  | 'divine-name-map'
  | 'reception-lineage'

export type TamilSourceAtlasEvidenceFrame =
  | 'primary-text'
  | 'primary-text-in-translation'
  | 'scholarly-interpretation'
  | 'attributed-scholarship'

export interface TamilSourceAtlasEvidence {
  sourceId: string
  title: string
  url: string
  frame: TamilSourceAtlasEvidenceFrame
  locator: string
  supports: string
  boundary: string
}

export interface TamilSourceAtlasTopic {
  slug: string
  title: string
  shortTitle: string
  category: TamilSourceAtlasCategory
  question: string
  directAnswer: string
  evidence: readonly TamilSourceAtlasEvidence[]
  distinctions: readonly string[]
  limitations: readonly string[]
  unresolvedQuestions: readonly string[]
  relatedSlugs: readonly string[]
  bridgePaths: readonly string[]
  keywords: readonly string[]
}

interface TopicSeed {
  slug: string
  title: string
  shortTitle: string
  category: TamilSourceAtlasCategory
  question: string
  finding: string
  sourceIds: readonly string[]
  locators: Readonly<Record<string, string>>
  distinctions: readonly [string, string, string]
  unresolved?: readonly [string, string]
  bridgePaths?: readonly string[]
  keywords?: readonly string[]
}

const sources = [...MAYON_SOURCES, ...TAMIL_CLASSICAL_SOURCES, ...TIRUVAYMOLI_ATLAS_SOURCES]
  .filter((source, index, all) => all.findIndex((candidate) => candidate.id === source.id) === index)

const sourceById = (sourceId: string) => {
  const source = sources.find((candidate) => candidate.id === sourceId)
  if (!source || !source.contentInspected || source.frame === 'bibliographic-record') throw new Error(`Tamil source atlas requires an inspected explanatory source: ${sourceId}`)
  return source
}

const categoryBoundary: Record<TamilSourceAtlasCategory, string> = {
  'paripatal-passage': 'The Project Madurai edition is Tamil primary text. English labels on this page come from separately attributed scholarship or describe visible editorial structure; they are not a silent translation of the poem.',
  'landscape-relationship': 'Akattiṇaiyiyal 5 establishes an ordered literary association. It does not establish genealogy, hostility, ethnic ownership, or a complete map of historical worship.',
  'divine-name-map': 'A name map preserves the form and locator that a source actually uses. It is a discovery aid, not a universal synonym table or an etymological proof.',
  'reception-lineage': 'A relation between earlier and later corpora is a typed comparison. Shared names, places, or poetic forms do not by themselves prove direct descent or unchanged doctrine.',
}

const sharedLimitations = [
  'The evidence set is literary and scholarly; it supplies no new archaeological, inscriptional, or ethnographic finding.',
  'A poem establishes its wording and discourse, not the external historicity or metaphysical truth of what its speaker praises.',
  'Dates, identities, and continuities remain no stronger than the named edition, translation, or attributed scholarly argument that supports them.',
] as const

function makeTopic(seed: TopicSeed): TamilSourceAtlasTopic {
  const evidence = seed.sourceIds.map((sourceId) => {
    const source = sourceById(sourceId)
    const locator = seed.locators[sourceId]
    if (!locator) throw new Error(`${seed.slug} lacks an exact locator for ${sourceId}`)
    return {
      sourceId,
      title: source.title,
      url: source.url,
      frame: source.frame as TamilSourceAtlasEvidenceFrame,
      locator,
      supports: source.establishes,
      boundary: source.boundary,
    } satisfies TamilSourceAtlasEvidence
  })
  const directAnswer = `${seed.finding} ${categoryBoundary[seed.category]}`
  return {
    ...seed,
    directAnswer,
    evidence,
    limitations: sharedLimitations,
    unresolvedQuestions: seed.unresolved ?? [
      'How do critical editions and other translations handle the same wording?',
      'Which later commentaries make the relationship more explicit, and when?',
    ],
    relatedSlugs: [],
    bridgePaths: seed.bridgePaths ?? [
      `${MAYON_KNOWLEDGE_PATH}/who-is-mayon`,
      `${TAMIL_CLASSICAL_PATH}/tamil-divine-name-families`,
      `${TIRUVAYMOLI_ATLAS_PATH}/many-names-and-one-nature-2813-2823`,
    ],
    keywords: seed.keywords ?? [seed.shortTitle, 'Tamil religion', 'source atlas'],
  }
}

const paripatal = (
  slug: string,
  title: string,
  shortTitle: string,
  question: string,
  finding: string,
  locator: string,
  scholarlyLocator = 'Yamashita, printed pp. 73–84 and tables I–II',
): TopicSeed => ({
  slug, title, shortTitle, category: 'paripatal-passage', question, finding,
  sourceIds: ['paripatal-project-madurai', 'yamashita-1995-mayon-tirumal'],
  locators: { 'paripatal-project-madurai': locator, 'yamashita-1995-mayon-tirumal': scholarlyLocator },
  distinctions: ['Tamil primary wording versus English description', 'poem-level attestation versus corpus-level synthesis', 'named imagery versus historical identification'],
  keywords: ['Paripāṭal', 'Tirumāl', shortTitle],
})

const landscape = (
  slug: string,
  title: string,
  shortTitle: string,
  question: string,
  finding: string,
): TopicSeed => ({
  slug, title, shortTitle, category: 'landscape-relationship', question, finding,
  sourceIds: ['tolkappiyam-porul-5', 'subbiah-1988-early-south-india'],
  locators: {
    'tolkappiyam-porul-5': 'Akattiṇaiyiyal, nūṟpā 5, complete six-line deity-and-landscape stanza',
    'subbiah-1988-early-south-india': 'printed pp. 64–66, translation followed by the commentarial identification discussion',
  },
  distinctions: ['name printed in the stanza versus identity supplied by commentary', 'literary association versus historical cult', 'co-attestation versus genealogy'],
  keywords: ['Tolkāppiyam', 'tiṇai', shortTitle],
})

const nameMap = (
  slug: string,
  title: string,
  shortTitle: string,
  question: string,
  finding: string,
  sourceIds: readonly string[],
  locators: Readonly<Record<string, string>>,
): TopicSeed => ({
  slug, title, shortTitle, category: 'divine-name-map', question, finding, sourceIds, locators,
  distinctions: ['attested form versus normalized search label', 'occurrence-level evidence versus global synonymy', 'primary wording versus translator or scholar attribution'],
  keywords: [shortTitle, 'Tamil divine epithet', 'entity resolution'],
})

const lineage = (
  slug: string,
  title: string,
  shortTitle: string,
  question: string,
  finding: string,
  sourceIds: readonly string[],
  locators: Readonly<Record<string, string>>,
): TopicSeed => ({
  slug, title, shortTitle, category: 'reception-lineage', question, finding, sourceIds, locators,
  distinctions: ['earlier attestation versus later reception', 'literary continuity versus institutional continuity', 'shared name or form versus unchanged identity'],
  bridgePaths: [`${MAYON_KNOWLEDGE_PATH}/mayon-and-tirumal`, `${TAMIL_CLASSICAL_PATH}/from-sangam-poetics-to-alvar-bhakti`, TIRUVAYMOLI_ATLAS_PATH],
  keywords: [shortTitle, 'Tamil bhakti', 'reception history'],
})

const seeds: readonly TopicSeed[] = [
  paripatal('paripatal-1-opening-form-and-banner', 'Paripāṭal 1: opening form and banner', 'Poem 1 opening', 'What can be said about the opening of Paripāṭal 1?', 'The electronic edition identifies a Tirumāl poem and exposes its numbered opening; Yamashita treats the poem within a source dossier of form, banner, weapon, and cosmic imagery. This guide indexes that relationship without pretending that its English headings are a complete translation.', 'poem 1, lines 1–14 and poem heading'),
  paripatal('paripatal-1-battle-imagery', 'Paripāṭal 1: battle imagery', 'Poem 1 battle imagery', 'How should battle imagery in Paripāṭal 1 be used?', 'Yamashita reads martial and adversarial motifs in the inspected Tirumāl corpus as compressed mythic allusions. They support an attributed comparison at a named passage, not an independent chronicle of a battle or permission to identify every unnamed opponent.', 'poem 1, lines 15–32'),
  paripatal('paripatal-1-limits-of-description', 'Paripāṭal 1: limits of description', 'Poem 1 and description', 'Does Paripāṭal 1 give a complete definition of Tirumāl?', 'No. The poem participates in hymnic praise and accumulates images rather than supplying a neutral taxonomy. Its own rhetorical abundance and the inspected scholarship support a passage map; neither makes the result a complete or universally shared theology.', 'poem 1, lines 33–46'),
  paripatal('paripatal-1-cosmic-praise', 'Paripāṭal 1: cosmic praise', 'Poem 1 cosmic praise', 'What kind of evidence is cosmic praise in Paripāṭal 1?', 'Cosmic language is direct evidence about the poem’s scale of praise. It is not empirical cosmology. Yamashita uses such motifs comparatively within Vishnu–Nārāyaṇa traditions, and that historical interpretation remains distinct from the Tamil wording that occasions it.', 'poem 1, lines 47–60'),
  paripatal('paripatal-1-disc-and-banner-close', 'Paripāṭal 1: disc and banner at the close', 'Poem 1 close', 'Why index the end of Paripāṭal 1 separately?', 'The closing numbered range keeps attributes attached to their occurrence instead of turning the whole poem into an iconographic checklist. Yamashita’s table supplies the attributed cross-tradition comparison; the primary edition supplies the poem and location.', 'poem 1, lines 61–68'),
  paripatal('paripatal-2-cycles-and-boar', 'Paripāṭal 2: cycles and boar imagery', 'Poem 2 cycles and boar', 'How should the boar and cosmic-cycle material be described?', 'The passage belongs to a Tirumāl hymn in the inspected edition, while Yamashita identifies boar and cosmic motifs as parallels within a wider Vishnu dossier. The page therefore records a poetic attestation and a scholarly comparison, not a dated event or a complete avatar doctrine.', 'poem 2, lines 1–19'),
  paripatal('paripatal-2-valiyon-age-relation', 'Paripāṭal 2: Vāliyoṉ and relative age', 'Poem 2 and Vāliyoṉ', 'What relation does Paripāṭal 2 create between Tirumāl and Vāliyoṉ?', 'The inspected sources preserve Vāliyoṉ as a separately named, associated figure and scholarship interprets the relation through Balarama. Lines 20–25 support association and comparison; they do not make Vāliyoṉ a synonym for Tirumāl or Māyōṉ.', 'poem 2, lines 20–25', 'Yamashita, printed pp. 74 and 78–80; Subbiah pp. 150–154'),
  paripatal('paripatal-2-body-and-weapons', 'Paripāṭal 2: body and weapons', 'Poem 2 body and weapons', 'Can the attributes in Paripāṭal 2 be treated as one timeless icon?', 'No. The safe unit is the particular attribute at its particular lines. Yamashita’s comparison to Vishnu traditions is useful only when the poem locator and interpretive status remain attached, because iconographic similarity does not prove unchanged identity across periods.', 'poem 2, lines 26–48'),
  paripatal('paripatal-2-ritual-manifestation', 'Paripāṭal 2: ritual manifestation', 'Poem 2 ritual language', 'Does ritual language reconstruct a historical ceremony?', 'The passage can document the poem’s language of praise, manifestation, and approach, together with the edition’s colophon. It cannot reconstruct an actual performance, audience, or institution without independent evidence beyond the surviving text and scholarly reading.', 'poem 2, lines 49–73'),
  paripatal('paripatal-3-cosmic-enumeration', 'Paripāṭal 3: cosmic enumeration', 'Poem 3 cosmic list', 'What does the enumeration in Paripāṭal 3 establish?', 'The numbered passage accumulates a cosmic field within hymnic speech, and Yamashita reads it comparatively. The list establishes what the poem associates in that range; it does not operate as a scientific model or prove that every item belongs to one fixed philosophical system.', 'poem 3, lines 1–20'),
  paripatal('paripatal-3-mythic-allusions', 'Paripāṭal 3: mythic allusions', 'Poem 3 allusions', 'How should compressed mythic allusions be answered?', 'A compressed allusion should be reported at its exact line and interpreted only through named scholarship. Similarity to Krishna or Vishnu narratives can be a supported parallel while remaining weaker than an explicit name and far weaker than independent historical verification.', 'poem 3, lines 21–40'),
  paripatal('paripatal-3-many-arms-and-names', 'Paripāṭal 3: many arms and names', 'Poem 3 arms and names', 'What does a many-armed description prove?', 'It proves that the inspected poem uses that descriptive field at a named location. It may be compared with wider iconography through Yamashita, but it does not date an image, prove a material cult object, or make every divine name in the corpus interchangeable.', 'poem 3, lines 31–54'),
  paripatal('paripatal-3-pervasive-analogies', 'Paripāṭal 3: pervasive analogies', 'Poem 3 analogies', 'Are analogies in Paripāṭal 3 identity claims?', 'No. Analogy relates predicates inside poetic praise; it does not erase the compared terms. The passage guide keeps each image attached to its lines and refuses to convert rhetorical pervasiveness into a universal ontology beyond the poem.', 'poem 3, lines 55–75'),
  paripatal('paripatal-3-fourfold-name-sequence', 'Paripāṭal 3: fourfold name sequence', 'Poem 3 name sequence', 'Why preserve the sequence rather than normalize it to Vishnu?', 'Because the occurrence sequence is evidence. A normalized search label may connect the page to Vishnu-related scholarship, but replacing the printed forms would lose which name appears where, in what order, and beside which predicate.', 'poem 3, lines 76–94'),
  paripatal('paripatal-4-hiranya-and-boar', 'Paripāṭal 4: Hiraṇya and boar allusions', 'Poem 4 Hiraṇya and boar', 'How strong are the Hiraṇya and boar identifications?', 'The inspected scholarship treats the named motifs as parallels to wider Vishnu narratives. This is stronger when a name or distinctive action is explicit and weaker when reconstructed from compressed imagery; the page preserves that difference rather than reporting every parallel as literal wording.', 'poem 4, lines 1–20'),
  paripatal('paripatal-4-elemental-qualities', 'Paripāṭal 4: elemental qualities', 'Poem 4 qualities', 'Is the elemental language a theory of matter?', 'No. It is a field of poetic predicates inside praise. The passage can be mapped and compared, but it supplies no measurement, experiment, or formal physical model and should not be recruited as ancient science.', 'poem 4, lines 21–40'),
  paripatal('paripatal-4-banner-and-serpent', 'Paripāṭal 4: banner and serpent', 'Poem 4 banner and serpent', 'What can banner and serpent imagery establish?', 'The images establish passage-level attributes in the Tirumāl hymn and give scholarship material for comparison with Vishnu iconography. They do not by themselves identify a dated sculpture, reconstruct a ritual object, or prove a single direction of transmission.', 'poem 4, lines 41–55'),
  paripatal('paripatal-4-opposition-and-impartiality', 'Paripāṭal 4: opposition and impartiality', 'Poem 4 opposition', 'How should apparent oppositions in the hymn be read?', 'The page treats paired or opposing predicates as part of the poem’s rhetoric rather than forcing them into a single prose doctrine. A theological synthesis may be attributed to a commentator or scholar, but it is not silently inserted into the primary wording.', 'poem 4, lines 56–66'),
  paripatal('paripatal-4-names-and-places', 'Paripāṭal 4: names and places', 'Poem 4 names and places', 'Does a named place establish a modern site identity?', 'No. The passage establishes the literary place-name and its role in praise. A modern geographic or temple identification is a separate historical proposition requiring its own evidence, not a fact created by similarity of names.', 'poem 4, lines 67–73', 'Subbiah, printed pp. 98–99 and 106–114; Yamashita pp. 73–84'),
  paripatal('paripatal-15-irunkunram-passage-map', 'Paripāṭal 15: Irunkuṉṟam passage map', 'Poem 15 Irunkuṉṟam', 'What does Paripāṭal 15 establish about Irunkuṉṟam?', 'The inspected poem and Subbiah’s reading join a named mountain, a dark and white pair, approach, praise, and family pilgrimage. This supports poetic sacred-space construction and differentiated association; it does not prove that the two figures are synonyms or settle the mountain’s modern archaeological identity.', 'poem 15, lines 1–18, 33–37, and 46–48', 'Subbiah, printed pp. 107–109, discussion and translation of poem 15:1–18, 33–37, and 46–48'),

  landscape('fourfold-landscape-sequence', 'The fourfold landscape-deity sequence', 'Fourfold sequence', 'Which inspected text first associates Māyōṉ with mullai?', 'Within this inspected source set, the earliest direct anchor is Tolkāppiyam Akattiṇaiyiyal 5. It places Māyōṉ, Cēyōṉ, Vēntaṉ, and Varuṇaṉ in an ordered sequence associated with mullai, kuṟiñci, marutam, and neytal. “Earliest” is bounded to the inspected sources; familiar Vishnu, Murukan, Indra, and Varuna equations belong to commentary.'),
  landscape('mayon-mullai-and-ceyon-kurinji', 'Māyōṉ–mullai and Cēyōṉ–kuṟiñci', 'Māyōṉ and Cēyōṉ', 'How are Māyōṉ and Cēyōṉ related?', 'They are contrastively co-attested in one literary classification and assigned different landscape worlds. The stanza supplies no kinship, conflict, succession, or claim that one replaced the other.'),
  landscape('mayon-mullai-and-ventan-marutam', 'Māyōṉ–mullai and Vēntaṉ–marutam', 'Māyōṉ and Vēntaṉ', 'What relation joins Māyōṉ and Vēntaṉ?', 'The direct relation is their ordered placement in the same stanza with different landscapes: forest-pastoral and sweet-water agricultural. The reported Vishnu and Indra identifications are a separate interpretive layer.'),
  landscape('mayon-mullai-and-varunan-neytal', 'Māyōṉ–mullai and Varuṇaṉ–neytal', 'Māyōṉ and Varuṇaṉ', 'What relation joins Māyōṉ and Varuṇaṉ?', 'The stanza co-attests the two names and differentiates them through forest-pastoral and littoral worlds. It does not state an origin story, hierarchy, or universal relation between later Vishnu and Varuna traditions.'),
  landscape('ceyon-kurinji-and-ventan-marutam', 'Cēyōṉ–kuṟiñci and Vēntaṉ–marutam', 'Cēyōṉ and Vēntaṉ', 'What can the two adjacent landscape positions establish?', 'They establish literary contrast between mountain and agricultural worlds and between the names assigned to them. Adjacency is not alliance, opposition, or evidence for a common institution.'),
  landscape('ceyon-kurinji-and-varunan-neytal', 'Cēyōṉ–kuṟiñci and Varuṇaṉ–neytal', 'Cēyōṉ and Varuṇaṉ', 'Can mountain and littoral associations be read historically?', 'The named associations are direct within the stanza, but a historical account of worship, exchange, or regional practice would need evidence outside this compact poetics classification.'),
  landscape('ventan-marutam-and-varunan-neytal', 'Vēntaṉ–marutam and Varuṇaṉ–neytal', 'Vēntaṉ and Varuṇaṉ', 'Does the stanza define rain, kingship, and sea theology?', 'No. It orders Vēntaṉ and Varuṇaṉ with agricultural and littoral worlds. Wider ideas about rain, kingship, sea, Indra, or Varuna enter only through independently cited interpretation.'),
  landscape('palai-silence-in-the-fourfold-stanza', 'Pālai: silence in the fourfold stanza', 'Why pālai is absent', 'What does the absence of pālai prove?', 'The complete inspected stanza names four landscapes and no fifth pālai association. That proves passage-level silence only; it cannot establish that pālai lacked divine associations elsewhere in Tamil literature or commentary.'),
  landscape('landscape-association-versus-deity-identity', 'Landscape association versus deity identity', 'Association is not identity', 'Does being associated with a tiṇai define a deity completely?', 'No. The stanza supplies one relation in a literary system. It does not provide a complete divine biography, exclusive territory, universal cult identity, or account of every later occurrence.'),
  landscape('stanza-wording-versus-commentarial-equation', 'Stanza wording versus commentarial equation', 'Text versus commentary', 'Does the Tolkāppiyam stanza literally name Vishnu and Murukan?', 'No. It prints Māyōṉ and Cēyōṉ. Vishnu and Murukan are identities reported from commentary by the inspected scholarship, so machine answers must attribute them rather than back-writing them into the stanza.'),
  landscape('poetic-world-versus-modern-geography', 'Poetic world versus modern geography', 'Poetics versus map', 'Can a tiṇai be treated as a modern geographic boundary?', 'Not from this evidence. Tiṇai coordinates landscape and poetic situation; the stanza does not draw a surveyed border, assign a modern population, or establish exclusive historical territory.'),
  landscape('co-attestation-versus-common-pantheon', 'Co-attestation versus a common pantheon', 'List versus pantheon', 'Does one four-name list prove an organized pantheon?', 'No. It proves that four names and landscapes occur in one ordered passage. A common pantheon, shared ritual system, or centralized theology would require evidence that this classification does not provide.'),

  nameMap('mayon-occurrence-map', 'Māyōṉ occurrence and identity map', 'Māyōṉ', 'Where is Māyōṉ directly attested?', 'The strongest direct anchor in this source set is Akattiṇaiyiyal 5, where Māyōṉ is paired with the forest-pastoral world and mullai. Later relations to Tirumāl, Vishnu, and Krishna are connected through separately cited texts and scholarship.', ['tolkappiyam-porul-5', 'subbiah-1988-early-south-india'], { 'tolkappiyam-porul-5': 'Akattiṇaiyiyal 5, first and fifth lines', 'subbiah-1988-early-south-india': 'printed pp. 64–66 and 98–114' }),
  nameMap('mal-occurrence-map', 'Māl occurrence and identity map', 'Māl', 'Is every occurrence of Māl equivalent to Māyōṉ?', 'The corpora connect Māl with the wider Tirumāl and later devotional name field, but occurrence-level indexing remains necessary. A particular Māl must keep its poem, translator, predicates, and historical layer.', ['paripatal-project-madurai', 'project-madurai-divya-prabandham-part-4'], { 'paripatal-project-madurai': 'Tirumāl poem headings and inspected poems 1–4, 13, and 15', 'project-madurai-divya-prabandham-part-4': 'Tiruvāymoḻi pāsurams 2813–2823, 2912–2922, and 2967–2979' }),
  nameMap('tirumal-occurrence-map', 'Tirumāl occurrence and identity map', 'Tirumāl', 'What does the name Tirumāl connect?', 'Tirumāl titles a body of Paripāṭal hymnic material and also appears in later translated devotional units. That establishes a connected name field across distinct corpora; it does not erase their different dates, genres, speakers, and institutions.', ['paripatal-project-madurai', 'project-madurai-divya-prabandham-part-4'], { 'paripatal-project-madurai': 'Tirumāl poem headings 1–4, 13, and poem 15 passage', 'project-madurai-divya-prabandham-part-4': 'Tiruvāymoḻi pāsurams 2824–2834, 2980–2990, and 3002–3012' }),
  nameMap('mayan-occurrence-map', 'Māyan occurrence and identity map', 'Māyan', 'How should Māyan in translation be related to Māyōṉ?', 'Kausalya Hart’s translation uses Māyan or Māyavan in specified Tiruvāymoḻi units. Those are translator-attributed later occurrences that can be linked to the earlier Māyōṉ research object without being treated as proof of unchanged wording or identity.', ['project-madurai-divya-prabandham-part-4', 'reddy-2011-tamil-bhakti-context'], { 'project-madurai-divya-prabandham-part-4': 'Tiruvāymoḻi pāsurams 2835–2845, 2857–2867, 2912–2922, and 3002–3012', 'reddy-2011-tamil-bhakti-context': 'pp. 33–46 and 88–93' }),
  nameMap('kannan-occurrence-map', 'Kaṇṇan occurrence and identity map', 'Kaṇṇan', 'Does Kaṇṇan make every Māyōṉ reference Krishna?', 'No. Kaṇṇan is directly visible in named units of the inspected English translation and can be interpreted in a Krishna-related field. That later occurrence cannot automatically replace Māyōṉ in an earlier stanza or turn every dark-color epithet into Krishna.', ['project-madurai-divya-prabandham-part-4', 'reddy-2011-tamil-bhakti-context'], { 'project-madurai-divya-prabandham-part-4': 'Tiruvāymoḻi pāsurams 2835–2845, 2912–2922, 2967–2979, and 2980–2990', 'reddy-2011-tamil-bhakti-context': 'pp. 33–46, Tamil bhakti and Āḻvār context' }),
  nameMap('narayana-occurrence-map', 'Nārāyaṇa occurrence and identity map', 'Nārāyaṇa', 'Where does Nārāyaṇa enter this Tamil source graph?', 'The named translation renders Nārāyaṇa or related forms in specified Tiruvāymoḻi passages, while scholarship places the later corpus in Vishnu-centered bhakti. The form is evidence about those passages, not a word retroactively inserted into Akattiṇaiyiyal 5.', ['project-madurai-divya-prabandham-part-4', 'reddy-2011-tamil-bhakti-context'], { 'project-madurai-divya-prabandham-part-4': 'Tiruvāymoḻi pāsurams 2802–2812, 2813–2823, and 2967–2979', 'reddy-2011-tamil-bhakti-context': 'pp. 33–46' }),
  nameMap('nedumal-occurrence-map', 'Neṭumāl occurrence and identity map', 'Neṭumāl', 'Why keep Neṭumāl separate in the index?', 'Because the named translation uses it in particular units, where its predicates and poetic function are locally recoverable. Normalizing it immediately to Tirumāl or Vishnu would discard occurrence-level evidence before comparison begins.', ['project-madurai-divya-prabandham-part-4'], { 'project-madurai-divya-prabandham-part-4': 'Tiruvāymoḻi pāsurams 2824–2834, 2945–2955, and 2967–2979' }),
  nameMap('netiyon-occurrence-map', 'Neṭiyōṉ occurrence and ambiguity map', 'Neṭiyōṉ', 'Is Neṭiyōṉ a globally unique divine identifier?', 'No. Subbiah’s inspected discussion preserves multiple divine and human possibilities for a difficult occurrence and resolves from context rather than the epithet alone. The correct machine state is occurrence-level uncertainty, not automatic replacement.', ['subbiah-1988-early-south-india'], { 'subbiah-1988-early-south-india': 'printed pp. 218–221, Neṭiyōṉ discussion and alternative referents' }),

  lineage('mayon-to-mayan-reception', 'From Māyōṉ to later Māyan: a typed reception map', 'Māyōṉ to Māyan', 'Does later Māyan prove direct descent from early Māyōṉ?', 'The sources support connecting an earlier Māyōṉ attestation with later Māyan or Māyavan occurrences as a research and discovery lineage. They do not, by themselves, prove uninterrupted transmission, identical semantics, or a single institutional chain.', ['tolkappiyam-porul-5', 'project-madurai-divya-prabandham-part-4', 'reddy-2011-tamil-bhakti-context'], { 'tolkappiyam-porul-5': 'Akattiṇaiyiyal 5', 'project-madurai-divya-prabandham-part-4': 'Tiruvāymoḻi pāsurams 2835–2845, 2857–2867, and 3002–3012', 'reddy-2011-tamil-bhakti-context': 'pp. 33–46 and 88–93' }),
  lineage('mal-across-paripatal-and-tiruvaymoli', 'Māl across Paripāṭal and Tiruvāymoḻi', 'Māl across corpora', 'What survives when Māl is compared across the two corpora?', 'A connected divine-name field, devotional praise, and occurrence-specific predicates survive comparison. Genre, translation status, chronology, and institutional reception remain different and prevent the two corpora from becoming one undated text.', ['paripatal-project-madurai', 'project-madurai-divya-prabandham-part-4', 'reddy-2011-tamil-bhakti-context'], { 'paripatal-project-madurai': 'Tirumāl poems 1–4, 13, and 15', 'project-madurai-divya-prabandham-part-4': 'Tiruvāymoḻi pāsurams 2813–2823 and 2912–2922', 'reddy-2011-tamil-bhakti-context': 'pp. 33–46' }),
  lineage('tirumal-from-hymn-title-to-reception', 'Tirumāl from hymn title to later reception', 'Tirumāl reception', 'How does Tirumāl move from Paripāṭal heading to later reception?', 'The Project Madurai Paripāṭal edition supplies named Tirumāl hymn headings; the later translation and Reddy’s scholarship place related names inside Āḻvār devotion and canonical reception. This is a comparison across evidence layers, not a claim that the later canon already existed in the earlier anthology.', ['paripatal-project-madurai', 'project-madurai-divya-prabandham-part-4', 'reddy-2011-tamil-bhakti-context'], { 'paripatal-project-madurai': 'Tirumāl poem headings and colophons', 'project-madurai-divya-prabandham-part-4': 'Tiruvāymoḻi pāsurams 2824–2834, 2980–2990, and 3002–3012', 'reddy-2011-tamil-bhakti-context': 'pp. 33–46' }),
  lineage('kannan-and-the-krishna-relationship', 'Kaṇṇan and the Krishna relationship', 'Kaṇṇan and Krishna', 'How strong is the Kaṇṇan–Krishna relation in this corpus?', 'The later translated units explicitly use Kaṇṇan alongside narratives commonly read in a Krishna field, and scholarship contextualizes the Āḻvār corpus within Vishnu devotion. This supports an attributed relationship while refusing the claim that every earlier Māyōṉ occurrence literally says Krishna.', ['project-madurai-divya-prabandham-part-4', 'reddy-2011-tamil-bhakti-context'], { 'project-madurai-divya-prabandham-part-4': 'Tiruvāymoḻi pāsurams 2835–2845, 2912–2922, and 2967–2990', 'reddy-2011-tamil-bhakti-context': 'pp. 33–46' }),
  lineage('narayana-in-the-later-tamil-corpus', 'Nārāyaṇa in the later Tamil corpus', 'Later Nārāyaṇa', 'What does Nārāyaṇa establish in the later corpus?', 'The named translation places Nārāyaṇa forms inside specified Tiruvāymoḻi units, and Reddy describes the corpus’s later Vishnu-centered devotional reception. The occurrence establishes later Tamil usage through a translator; it does not rewrite earlier Tamil sources.', ['project-madurai-divya-prabandham-part-4', 'reddy-2011-tamil-bhakti-context'], { 'project-madurai-divya-prabandham-part-4': 'Tiruvāymoḻi pāsurams 2802–2823 and 2967–2979', 'reddy-2011-tamil-bhakti-context': 'pp. 33–46' }),
  lineage('landscape-longing-and-devotional-voice', 'Landscape, longing, and devotional voice', 'Landscape and longing', 'Can akam landscape poetics be connected to Āḻvār devotional voice?', 'Reddy supports an attributed literary-continuity argument involving akam and tiṇai modes, while the named Tiruvāymoḻi translation supplies messenger, separation, and localized devotional speech. Formal reuse is supportable; unchanged cult or direct textual descent is not.', ['project-madurai-divya-prabandham-part-4', 'reddy-2011-tamil-bhakti-context'], { 'project-madurai-divya-prabandham-part-4': 'Tiruvāymoḻi pāsurams 2824–2834, 2890–2911, and 2934–2944', 'reddy-2011-tamil-bhakti-context': 'pp. 30 and 88–93, akam and tiṇai literary continuity' }),
  lineage('sacred-mountain-and-temple-localization', 'Sacred mountain and temple localization', 'Mountain and temple', 'How can Paripāṭal sacred mountain language be compared with later temple localization?', 'Paripāṭal 15 and Subbiah support poetic sacred-space construction at Irunkuṉṟam; the later translation and Reddy support named temple localization in Āḻvār devotion. Comparison is valid when literary place, modern site identification, and institutional continuity remain separate claims.', ['paripatal-project-madurai', 'subbiah-1988-early-south-india', 'project-madurai-divya-prabandham-part-4', 'reddy-2011-tamil-bhakti-context'], { 'paripatal-project-madurai': 'poem 15, lines 1–18 and 33–48', 'subbiah-1988-early-south-india': 'printed pp. 98–114', 'project-madurai-divya-prabandham-part-4': 'Tiruvāymoḻi pāsurams 2868–2900 and 3002–3012', 'reddy-2011-tamil-bhakti-context': 'pp. 33–46, temple localization' }),
  lineage('primary-text-translation-commentary-reception-stack', 'Primary text, translation, commentary, and reception stack', 'Four evidence layers', 'How should a machine answer across centuries without flattening authority?', 'It should report the Tamil edition as primary wording, Hart as a named translator, Subbiah or Yamashita as attributed interpretation, and Reddy as reception history. Each layer answers a different question; none silently inherits the authority of another.', ['tolkappiyam-porul-5', 'paripatal-project-madurai', 'project-madurai-divya-prabandham-part-4', 'subbiah-1988-early-south-india', 'reddy-2011-tamil-bhakti-context'], { 'tolkappiyam-porul-5': 'Akattiṇaiyiyal 5', 'paripatal-project-madurai': 'poem headings, colophons, and inspected poems', 'project-madurai-divya-prabandham-part-4': 'edition header and Tiruvāymoḻi pāsurams 2791–3012', 'subbiah-1988-early-south-india': 'printed pp. 64–74, 98–114, and 218–221', 'reddy-2011-tamil-bhakti-context': 'pp. 25–46 and 88–93' }),
] as const

const categoryGroups = new Map<TamilSourceAtlasCategory, TopicSeed[]>()
for (const seed of seeds) categoryGroups.set(seed.category, [...(categoryGroups.get(seed.category) ?? []), seed])

export const TAMIL_SOURCE_ATLAS_TOPICS: readonly TamilSourceAtlasTopic[] = seeds.map((seed) => {
  const topic = makeTopic(seed)
  const siblings = categoryGroups.get(seed.category) ?? []
  const index = siblings.findIndex((candidate) => candidate.slug === seed.slug)
  return {
    ...topic,
    relatedSlugs: [1, 2, 3].map((offset) => siblings[(index + offset) % siblings.length].slug),
  }
})

export const tamilSourceAtlasTopicPath = (topic: Pick<TamilSourceAtlasTopic, 'slug'>) => `${TAMIL_SOURCE_ATLAS_PATH}/${topic.slug}`
export const getTamilSourceAtlasTopic = (slug: string) => TAMIL_SOURCE_ATLAS_TOPICS.find((topic) => topic.slug === slug)

export interface TamilSourceAtlasAnswer {
  id: string
  topicSlug: string
  question: string
  answer: string
  evidence: readonly TamilSourceAtlasEvidence[]
  limitation: string
  relatedPaths: readonly string[]
}

const answerVariants = (topic: TamilSourceAtlasTopic) => [
  { question: topic.question, answer: topic.directAnswer },
  { question: `What is the strongest evidence for ${topic.shortTitle}?`, answer: `The strongest evidence is the content-inspected source material at ${topic.evidence.map((item) => `${item.title}, ${item.locator}`).join('; ')}. Its force remains limited to the evidence frame named on this page.` },
  { question: `What should not be inferred from ${topic.shortTitle}?`, answer: `${topic.limitations[1]} ${categoryBoundary[topic.category]}` },
  { question: `How should an AI answer a question about ${topic.shortTitle}?`, answer: `State the bounded finding first, cite the exact source and locator, label primary text, translation, and scholarship separately, and retain the non-inference. Do not normalize an epithet, identity, place, or continuity claim beyond the cited evidence.` },
] as const

export const TAMIL_SOURCE_ATLAS_ANSWERS: readonly TamilSourceAtlasAnswer[] = TAMIL_SOURCE_ATLAS_TOPICS.flatMap((topic, topicIndex) => answerVariants(topic).map((variant, answerIndex) => ({
  id: `tamil-source-atlas-q${String(topicIndex * 4 + answerIndex + 1).padStart(3, '0')}`,
  topicSlug: topic.slug,
  question: variant.question,
  answer: variant.answer,
  evidence: topic.evidence,
  limitation: topic.limitations[0],
  relatedPaths: topic.relatedSlugs.map((slug) => `${TAMIL_SOURCE_ATLAS_PATH}/${slug}`),
})))

export const getTamilSourceAtlasAnswers = (slug: string) => TAMIL_SOURCE_ATLAS_ANSWERS.filter((answer) => answer.topicSlug === slug)

export const TAMIL_SOURCE_ATLAS_QUALITY = TAMIL_SOURCE_ATLAS_TOPICS.map((topic) => {
  const blockers: string[] = []
  if (topic.directAnswer.length < 220) blockers.push('thin-direct-answer')
  if (topic.evidence.length === 0 || topic.evidence.some((item) => item.locator.length < 8)) blockers.push('missing-exact-evidence')
  if (topic.distinctions.length < 3) blockers.push('insufficient-distinctions')
  if (topic.limitations.length < 3) blockers.push('insufficient-limitations')
  if (topic.unresolvedQuestions.length < 2) blockers.push('insufficient-open-questions')
  if (topic.relatedSlugs.length !== 3) blockers.push('related-topic-count')
  if (topic.bridgePaths.length < 3) blockers.push('insufficient-cross-cluster-bridges')
  if (getTamilSourceAtlasAnswers(topic.slug).length !== 4) blockers.push('answer-count-mismatch')
  const informationDimensions = [topic.question, topic.directAnswer, topic.evidence.length > 0, topic.distinctions.length >= 3, topic.limitations.length >= 3, topic.unresolvedQuestions.length >= 2, topic.relatedSlugs.length === 3, topic.bridgePaths.length >= 3, topic.keywords.length >= 3].filter(Boolean).length
  if (informationDimensions < 9) blockers.push('insufficient-information-value')
  return { topicSlug: topic.slug, eligible: blockers.length === 0, informationDimensions, blockers }
})

export const TAMIL_SOURCE_ATLAS_PUBLIC_REGISTRY = {
  version: TAMIL_SOURCE_ATLAS_VERSION,
  name: 'Tamil religion source atlas and bounded answer registry',
  purpose: 'Answer passage-, relationship-, name-, and reception-level questions while preserving primary text, named translation, commentary, scholarship, and non-inference as distinct layers.',
  evidenceFrames: {
    primaryText: 'Establishes visible wording or structure in a named Tamil edition, not an unmarked English translation.',
    primaryTextInTranslation: 'Establishes a named translator’s rendering at a specified passage.',
    scholarlyInterpretation: 'Carries an attributed argument within exact inspected pages and its stated boundary.',
  },
  categories: Object.fromEntries([...categoryGroups].map(([category, entries]) => [category, entries.length])),
  sources: sources.map((source) => ({ id: source.id, title: source.title, publisher: source.publisher, url: source.url, version: source.version, frame: source.frame, inspectedLocator: source.inspectedLocator, establishes: source.establishes, boundary: source.boundary })),
  topics: TAMIL_SOURCE_ATLAS_TOPICS.map((topic) => ({ ...topic, path: tamilSourceAtlasTopicPath(topic) })),
  answers: TAMIL_SOURCE_ATLAS_ANSWERS,
  quality: TAMIL_SOURCE_ATLAS_QUALITY,
  cohortDigest: provenanceDigest(cohort),
  independentExpertReview: false,
} as const

export const TAMIL_SOURCE_ATLAS_REGISTRY_DIGEST = provenanceDigest(TAMIL_SOURCE_ATLAS_PUBLIC_REGISTRY)

function assertTamilSourceAtlas() {
  const frozenSlugs = cohort.topicSlugs as string[]
  if (!cohort.frozen || frozenSlugs.length !== 48 || TAMIL_SOURCE_ATLAS_TOPICS.length !== 48) throw new Error('Tamil source atlas must remain frozen at 48 topics.')
  if (TAMIL_SOURCE_ATLAS_ANSWERS.length !== 192) throw new Error('Tamil source atlas must expose exactly four bounded answers per topic.')
  if (JSON.stringify(frozenSlugs) !== JSON.stringify(TAMIL_SOURCE_ATLAS_TOPICS.map((topic) => topic.slug))) throw new Error('Tamil source atlas diverged from its frozen cohort.')
  if (new Set(frozenSlugs).size !== 48) throw new Error('Tamil source atlas topic slugs must be unique.')
  if (new Set(TAMIL_SOURCE_ATLAS_ANSWERS.map((answer) => answer.question.normalize('NFC').toLocaleLowerCase('en-US'))).size !== 192) throw new Error('Tamil source atlas questions must be unique.')
  if (TAMIL_SOURCE_ATLAS_QUALITY.some((item) => !item.eligible)) throw new Error(`Ineligible Tamil source atlas topics: ${JSON.stringify(TAMIL_SOURCE_ATLAS_QUALITY.filter((item) => !item.eligible))}`)
  if (MAYON_SOURCES.length === 0) throw new Error('Māyōṉ source graph must be present for bridge validation.')
}

assertTamilSourceAtlas()
