import cohort from '../content/religion/mayon/research-cohort-v1.json' with { type: 'json' }

import { provenanceDigest } from './evidence-dossier/digest.ts'
import {
  MAYON_CLAIMS,
  MAYON_CONNECTIONS,
  MAYON_KNOWLEDGE_PATH,
  MAYON_KNOWLEDGE_VERSION,
  MAYON_MODERN_BRIDGES,
  MAYON_SOURCES,
} from './mayon-knowledge.ts'

export const MAYON_TOPIC_VERSION = 'mayon-topics/1.0' as const
export const MAYON_ANSWER_REGISTRY_PATH = `${MAYON_KNOWLEDGE_PATH}/registry` as const

export type MayonAnswerClass =
  | 'direct-attestation'
  | 'source-bound-interpretation'
  | 'disputed-or-ambiguous'
  | 'not-established'
  | 'modern-disambiguation'

export interface MayonTopicComparison {
  left: string
  right: string
  finding: string
  boundary: string
}

export interface MayonTopic {
  slug: string
  title: string
  shortTitle: string
  question: string
  description: string
  directAnswer: string
  answerClass: MayonAnswerClass
  claimIds: readonly string[]
  connectionNames: readonly string[]
  comparison: MayonTopicComparison
  limitations: readonly string[]
  unresolvedQuestions: readonly string[]
  relatedSlugs: readonly string[]
  modernBridgePaths?: readonly string[]
  bibliographicSourceIds?: readonly string[]
  keywords: readonly string[]
}

export const MAYON_TOPICS: readonly MayonTopic[] = [
  {
    slug: 'who-is-mayon',
    title: 'Who is Māyōṉ in early Tamil literature?',
    shortTitle: 'Who is Māyōṉ?',
    question: 'What is the narrowest useful definition supported by the inspected record?',
    description: 'A direct definition that begins with the Tolkāppiyam attestation and keeps later Tirumāl and Vishnu identifications historically typed.',
    directAnswer: 'Māyōṉ is a divine name directly attested in the Tolkāppiyam’s early Tamil landscape classification, where Māyōṉ is associated with mullai, the forest-pastoral landscape. Tirumāl, Vishnu, and Krishna belong to the explanation only through separately cited texts and historical interpretations—not as an automatic expansion of that one line.',
    answerClass: 'direct-attestation',
    claimIds: ['mayon-mullai', 'commentarial-identification-layer', 'tirumal-hymnic-corpus'],
    connectionNames: ['Tirumāl', 'Vishnu', 'Cēyōṉ / Murukan'],
    comparison: { left: 'Direct early attestation', right: 'Later or scholarly identification', finding: 'The Tolkāppiyam supplies the name and mullai relation; commentators and scholars supply the broader identifications.', boundary: 'Neither layer should be erased, but a later equation must not be back-written into the earlier wording.' },
    limitations: ['The source set is literary and scholarly; it contains no new inscriptional or archaeological finding.', 'The date and formation history of the relevant traditions are not solved by one stanza.', 'The spelling “Mayon” is an access form; transliteration choices do not settle etymology.'],
    unresolvedQuestions: ['How early are the surviving textual witnesses?', 'Which uses of Māl, Tirumāl, and Neṭiyōṉ belong to the same historical complex?'],
    relatedSlugs: ['mayon-in-the-tolkappiyam', 'mayon-and-tirumal', 'mayon-dravidian-god-question'],
    keywords: ['Māyōṉ', 'Mayon', 'early Tamil deity', 'mullai'],
  },
  {
    slug: 'mayon-in-the-tolkappiyam',
    title: 'Māyōṉ in the Tolkāppiyam',
    shortTitle: 'The Tolkāppiyam attestation',
    question: 'What does Akattiṇaiyiyal 5 state, and what is added by commentary?',
    description: 'A passage-level account of the Tolkāppiyam landscape stanza and the evidentiary boundary between its words and later identifications.',
    directAnswer: 'Akattiṇaiyiyal 5 names Māyōṉ first in a four-deity sequence and associates Māyōṉ with the forest-pastoral world later named mullai in the stanza. The line does not itself say “Vishnu,” “Krishna,” or “Tirumāl”; those identifications enter through commentarial and scholarly layers that must be cited separately.',
    answerClass: 'direct-attestation',
    claimIds: ['mayon-mullai', 'four-landscape-sequence', 'commentarial-identification-layer'],
    connectionNames: ['Cēyōṉ / Murukan', 'Vēntaṉ', 'Varuṇaṉ'],
    comparison: { left: 'Stanza wording', right: 'Commentarial mapping', finding: 'The stanza records four divine names and landscapes; commentary maps those names onto better-known divine identities.', boundary: 'A translation may explain the commentary, but it must not present the explanation as a literal word in the source line.' },
    limitations: ['This dossier uses one named electronic edition rather than a collation of manuscripts.', 'The stanza is a poetics classification, not a complete description of worship.', 'A textual sequence does not prove a single organized pantheon.'],
    unresolvedQuestions: ['How do major editions vary at this passage?', 'When are the four familiar identifications first attested in commentary?'],
    relatedSlugs: ['mayon-and-mullai', 'the-four-landscape-deity-sequence', 'mayon-and-vishnu'],
    keywords: ['Tolkāppiyam', 'Akattiṇaiyiyal', 'tiṇai', 'Māyōṉ'],
  },
  {
    slug: 'mayon-and-mullai',
    title: 'Māyōṉ and the mullai landscape',
    shortTitle: 'Māyōṉ and mullai',
    question: 'What kind of relationship does the source create between deity and landscape?',
    description: 'A bounded explanation of mullai as literary landscape, pastoral world, and later interpretive anchor—not a complete cult biography.',
    directAnswer: 'The inspected Tolkāppiyam passage pairs Māyōṉ with the forest-pastoral world in the ordered tiṇai sequence and names that landscape mullai. “Māyōṉ is associated with mullai” is therefore direct and supportable. Claims about a prehistoric pastoral cult, ethnic ownership, or every later use of the name require evidence beyond this stanza.',
    answerClass: 'direct-attestation',
    claimIds: ['mayon-mullai', 'four-landscape-sequence', 'poetic-comparison-not-identity'],
    connectionNames: ['Cēyōṉ / Murukan'],
    comparison: { left: 'Landscape association', right: 'Historical cult reconstruction', finding: 'The first is printed in the source; the second is a hypothesis requiring additional literary, material, and historical evidence.', boundary: 'A literary ecology can structure poetry without mapping one-to-one onto social practice.' },
    limitations: ['Mullai has a role inside an akam classification and should not be reduced to a modern biome label.', 'The source does not specify an exclusive territory or population.', 'Later poems may reuse the divine figure outside this exact landscape relation.'],
    unresolvedQuestions: ['How does mullai imagery change across early Tamil anthologies?', 'Which ritual or social practices can be documented independently of the poetics?'],
    relatedSlugs: ['mayon-in-the-tolkappiyam', 'the-four-landscape-deity-sequence', 'mayon-dravidian-god-question'],
    keywords: ['mullai', 'pastoral landscape', 'forest landscape', 'Tamil poetics'],
  },
  {
    slug: 'the-four-landscape-deity-sequence',
    title: 'The four landscape-deity sequence',
    shortTitle: 'Four landscape deities',
    question: 'How are Māyōṉ, Cēyōṉ, Vēntaṉ, and Varuṇaṉ related in the source?',
    description: 'A typed graph of co-attested divine names, their landscapes, and the later identifications that the stanza itself does not spell out.',
    directAnswer: 'The stanza places Māyōṉ, Cēyōṉ, Vēntaṉ, and Varuṇaṉ in one ordered literary classification, associated respectively with mullai, kuṟiñci, marutam, and neytal. Their direct relationship is contrastive co-attestation. Identifying them as Vishnu, Murukan, Indra, and Varuna is a second, commentarial layer.',
    answerClass: 'direct-attestation',
    claimIds: ['four-landscape-sequence', 'commentarial-identification-layer', 'mayon-mullai'],
    connectionNames: ['Cēyōṉ / Murukan', 'Vēntaṉ', 'Varuṇaṉ'],
    comparison: { left: 'Co-attested classification', right: 'Genealogy or identity', finding: 'The first follows from the list; the second is absent from it.', boundary: 'Proximity in a list cannot manufacture kinship, descent, equivalence, or a shared origin narrative.' },
    limitations: ['The fourfold stanza does not exhaust every landscape or divine figure in Tamil literature.', 'The familiar identifications have different evidentiary strengths.', 'The sequence alone cannot show how widely any mapping was practiced.'],
    unresolvedQuestions: ['Why does this passage use these four names?', 'How did commentators handle the limited independent evidence for Vēntaṉ and Varuṇaṉ?'],
    relatedSlugs: ['mayon-in-the-tolkappiyam', 'mayon-and-mullai', 'mayon-and-ceyon-murukan'],
    keywords: ['Cēyōṉ', 'Vēntaṉ', 'Varuṇaṉ', 'tiṇai deities'],
  },
  {
    slug: 'tirumal-in-the-paripatal',
    title: 'Tirumāl in the Paripāṭal',
    shortTitle: 'The Paripāṭal dossier',
    question: 'What kind of Tirumāl evidence survives, and why do poem counts differ?',
    description: 'A guide to the surviving hymnic corpus, its colophons, edition-dependent counts, attributes, and limits as historical evidence.',
    directAnswer: 'The surviving Paripāṭal material includes hymnic poems addressed to Tirumāl, with named authors or musicians in colophons, divine attributes, associated figures, sacred places, and compressed mythic allusions. Counts differ because catalogues and scholars do not always use the same denominator: transmitted poems, retrieved poems, fragments, or an expanded edited set.',
    answerClass: 'source-bound-interpretation',
    claimIds: ['tirumal-hymnic-corpus', 'paripatal-survival-and-counts', 'paripatal-colophons-and-performance', 'attributes-need-claim-level-typing'],
    connectionNames: ['Tirumāl', 'Vishnu', 'Balarama / Vāliyoṉ'],
    comparison: { left: 'Six Tirumāl songs in the CICT inventory', right: 'Seven Tirumāl poems in Subbiah’s expanded full-length set', finding: 'The difference reflects edition composition, especially retrieved material, rather than an arithmetic contradiction.', boundary: 'Every count must travel with its corpus definition; an edition-specific tally cannot silently become a claim about all surviving or original poems.' },
    limitations: ['The surviving collection is not the reported original seventy-poem anthology.', 'Hymnic praise cannot independently verify narrated events.', 'Performance setting is partly reconstructed from colophons and literary form.'],
    unresolvedQuestions: ['Which fragments belong to the original anthology?', 'How do the principal editions arrange retrieved poems?'],
    relatedSlugs: ['mayon-and-tirumal', 'mayon-attributes-and-iconography', 'mayon-sacred-space-and-temple-sites'],
    bibliographicSourceIds: ['cict-paripatal-catalogue'],
    keywords: ['Paripāṭal', 'Tirumāl hymns', 'Tamil bhakti', 'colophons'],
  },
  {
    slug: 'mayon-and-tirumal',
    title: 'Māyōṉ and Tirumāl',
    shortTitle: 'Māyōṉ–Tirumāl',
    question: 'How strong is the relation, and what does a combined label conceal?',
    description: 'A historical relation built from direct names, a denser Tirumāl hymn corpus, and scholarship that treats them as a connected early Tamil complex.',
    directAnswer: 'Māyōṉ and Tirumāl are strongly connected in the inspected scholarship and in the transition from the Tolkāppiyam landscape name to the denser Paripāṭal hymn corpus. “Māyōṉ–Tirumāl complex” is useful shorthand for that research object, but it must not erase changes in genre, date, name, sacred place, or theology.',
    answerClass: 'source-bound-interpretation',
    claimIds: ['mayon-mullai', 'tirumal-hymnic-corpus', 'commentarial-identification-layer', 'tirumal-transcendent-and-local'],
    connectionNames: ['Tirumāl', 'Vishnu'],
    comparison: { left: 'Māyōṉ in the landscape stanza', right: 'Tirumāl in hymnic poetry', finding: 'The sources present related but differently situated evidence: a compact poetics classification and a richer devotional corpus.', boundary: 'Continuity is an interpretive claim, not permission to make every feature simultaneous.' },
    limitations: ['No single inspected passage defines the entire relation.', 'Names may overlap without preserving identical connotations.', 'The corpus does not by itself determine the direction of historical influence.'],
    unresolvedQuestions: ['Which intermediate attestations connect the two corpora?', 'How did later commentators explain the name relation?'],
    relatedSlugs: ['who-is-mayon', 'tirumal-in-the-paripatal', 'mayon-names-mal-tirumal-netiyon'],
    keywords: ['Māyōṉ', 'Tirumāl', 'Māl', 'name relation'],
  },
  {
    slug: 'mayon-and-vishnu',
    title: 'Māyōṉ, Tirumāl, and Vishnu',
    shortTitle: 'The Vishnu identification',
    question: 'What supports the identification, and why must it remain historically typed?',
    description: 'An evidence map for traditional identification, textual attributes, scholarly comparisons, and their chronological limits.',
    directAnswer: 'The Māyōṉ–Tirumāl complex is traditionally identified with Vishnu, and the inspected Paripāṭal scholarship maps multiple weapons, banners, postures, cosmic images, and narratives onto Vishnu–Nārāyaṇa traditions. The evidence supports a historically important identification; it does not prove that every Māyōṉ attestation began with one unchanged pan-Indian identity.',
    answerClass: 'source-bound-interpretation',
    claimIds: ['visnu-relationship', 'commentarial-identification-layer', 'attributes-need-claim-level-typing'],
    connectionNames: ['Tirumāl', 'Vishnu', 'Krishna'],
    comparison: { left: 'Traditional identification', right: 'Timeless lexical identity', finding: 'The first is documented as a historical reception and interpretive relation; the second exceeds the evidence.', boundary: 'Shared attributes can strengthen a relationship claim without establishing when or how it formed.' },
    limitations: ['Several parallels are allusive rather than named directly.', 'The source set does not settle Tamil-to-Sanskrit or Sanskrit-to-Tamil priority.', 'Later theological coherence must not be projected backward without evidence.'],
    unresolvedQuestions: ['Which Vishnu identifications are earliest and explicit?', 'Which attributes have independent local histories?'],
    relatedSlugs: ['mayon-and-tirumal', 'mayon-and-krishna', 'mayon-attributes-and-iconography'],
    keywords: ['Vishnu', 'Nārāyaṇa', 'Tirumāl', 'historical identification'],
  },
  {
    slug: 'mayon-and-krishna',
    title: 'Māyōṉ and Krishna',
    shortTitle: 'The Krishna parallels',
    question: 'Which connections are explicit, which are allusive, and which remain uncertain?',
    description: 'A claim-level separation of Krishna-cycle comparisons from unrestricted identity statements.',
    directAnswer: 'The inspected scholarship connects selected Paripāṭal motifs—including a horse-demon episode and other compressed narratives—with Krishna traditions. That supports named mythic parallels and contributes to the broader Tirumāl–Vishnu relation. It does not support replacing every occurrence of Māyōṉ with Krishna or treating every dark-color epithet as a Krishna reference.',
    answerClass: 'source-bound-interpretation',
    claimIds: ['krishna-allusions', 'visnu-relationship', 'attributes-need-claim-level-typing'],
    connectionNames: ['Krishna', 'Tirumāl', 'Vishnu'],
    comparison: { left: 'Specific mythic parallel', right: 'Unrestricted identity', finding: 'A located episode can support comparison to the Krishna cycle; it cannot govern unrelated passages.', boundary: 'The unit of evidence is the passage and feature, not the modern name alone.' },
    limitations: ['Some readings depend on later commentary.', 'Poetic compression makes narrative identification probabilistic.', 'No inspected source establishes one date for all Krishna-related motifs.'],
    unresolvedQuestions: ['Which Tamil passages name Krishna forms directly?', 'What transmission histories best explain each parallel?'],
    relatedSlugs: ['mayon-and-vishnu', 'mayon-and-balarama-valiyon', 'mayon-attributes-and-iconography'],
    keywords: ['Krishna', 'horse demon', 'mythic parallel', 'Tirumāl'],
  },
  {
    slug: 'mayon-and-balarama-valiyon',
    title: 'Māyōṉ, Balarama, and Vāliyoṉ',
    shortTitle: 'Balarama and Vāliyoṉ',
    question: 'Why is “associated figure” safer than “another name for Māyōṉ”?',
    description: 'A bounded account of plough, palm-banner, color contrast, shared place, and scholarly Balarama identification.',
    directAnswer: 'The Paripāṭal material discussed by Yamashita and Subbiah places a plough-bearing or palm-bannered figure, Vāliyoṉ, in relation to Tirumāl and interprets him through Balarama. At Irunkuṉṟam, the paired dark and white appearances remain differentiated. Association is therefore directly useful; synonymy is not.',
    answerClass: 'source-bound-interpretation',
    claimIds: ['balarama-valiyon', 'irunkunram-dark-white-pair', 'attributes-need-claim-level-typing'],
    connectionNames: ['Balarama / Vāliyoṉ', 'Tirumāl'],
    comparison: { left: 'Paired or associated figures', right: 'One interchangeable identity', finding: 'The sources preserve two figures, contrasting appearances, and related actions.', boundary: 'The Balarama interpretation must remain attributed where the Tamil passage uses another name or compressed attribute.' },
    limitations: ['The plough attribute is not exclusive enough to prove identity by itself.', 'Commentarial mediation affects some mappings.', 'The relation may vary by poem and should not be generalized beyond located passages.'],
    unresolvedQuestions: ['How consistently is Vāliyoṉ distinguished across early texts?', 'Which passages explicitly name Balarama rather than imply him?'],
    relatedSlugs: ['mayon-and-krishna', 'tirumal-in-the-paripatal', 'mayon-sacred-space-and-temple-sites'],
    keywords: ['Balarama', 'Vāliyoṉ', 'plough', 'Irunkuṉṟam'],
  },
  {
    slug: 'mayon-and-ceyon-murukan',
    title: 'Māyōṉ and Cēyōṉ or Murukan',
    shortTitle: 'Māyōṉ and Cēyōṉ',
    question: 'What relation is directly established between the two divine names?',
    description: 'A contrastive relation grounded in the landscape stanza, with a separate account of later identification and contested sacred-site arguments.',
    directAnswer: 'Māyōṉ and Cēyōṉ are directly related by contrastive co-attestation: the Tolkāppiyam stanza places them in one sequence while associating them with different landscapes, mullai and kuṟiñci. Identifying Cēyōṉ with Murukan is commentarial. The stanza supplies neither a genealogy nor a claim that one cult displaced the other.',
    answerClass: 'source-bound-interpretation',
    claimIds: ['four-landscape-sequence', 'commentarial-identification-layer', 'site-identification-caution'],
    connectionNames: ['Cēyōṉ / Murukan', 'Tirumāl'],
    comparison: { left: 'Māyōṉ–mullai', right: 'Cēyōṉ–kuṟiñci', finding: 'The source differentiates the divine names through the landscapes assigned to them.', boundary: 'Contrast is not hostility, succession, family relation, or evidence of a zero-sum religious replacement.' },
    limitations: ['The Murukan equation is not the literal word used in the stanza.', 'Later site traditions cannot be projected backward without dated evidence.', 'Aḻakarmalai-related identifications remain partly disputed.'],
    unresolvedQuestions: ['How early is the Cēyōṉ–Murukan equation?', 'What material evidence bears on the competing hill-site identifications?'],
    relatedSlugs: ['the-four-landscape-deity-sequence', 'mayon-and-mullai', 'mayon-sacred-space-and-temple-sites'],
    keywords: ['Cēyōṉ', 'Murukan', 'kuṟiñci', 'contrastive co-attestation'],
  },
  {
    slug: 'mayon-names-mal-tirumal-netiyon',
    title: 'Māyōṉ, Māl, Tirumāl, and Neṭiyōṉ',
    shortTitle: 'Names and epithets',
    question: 'When can names be joined, and when must an occurrence stay unresolved?',
    description: 'An occurrence-level method for divine names and epithets that preserves ambiguity instead of normalizing it away.',
    directAnswer: 'Māyōṉ, Māl, and Tirumāl participate in a strongly connected early Tamil research complex, but an index should still record which form each passage actually uses. Neṭiyōṉ is the sharper warning: Subbiah preserves multiple possible divine and human referents in one difficult case. Normalizing first and asking later would destroy the evidence.',
    answerClass: 'disputed-or-ambiguous',
    claimIds: ['commentarial-identification-layer', 'tirumal-transcendent-and-local', 'netiyon-ambiguity'],
    connectionNames: ['Tirumāl', 'Vishnu', 'Krishna'],
    comparison: { left: 'Name-family indexing', right: 'Automatic identity resolution', finding: 'The first connects passages while retaining surface forms and uncertainty; the second makes an irreversible historical claim.', boundary: 'Every occurrence needs its own locator, context, and confidence.' },
    limitations: ['This dossier does not provide a complete concordance.', 'Etymology has not been independently established here.', 'The same epithet may function differently in divine, royal, or poetic comparison.'],
    unresolvedQuestions: ['Which early occurrences can be joined with high confidence?', 'What do manuscript variants do to the name inventory?'],
    relatedSlugs: ['mayon-and-tirumal', 'mayon-and-vishnu', 'mayon-dravidian-god-question'],
    keywords: ['Māl', 'Tirumāl', 'Neṭiyōṉ', 'Tamil epithets'],
  },
  {
    slug: 'mayon-attributes-and-iconography',
    title: 'Māyōṉ–Tirumāl attributes and iconography',
    shortTitle: 'Attributes and iconography',
    question: 'Which features are explicit, and which acquire meaning through comparison?',
    description: 'A provenance-aware map of color, weapons, banners, postures, plant and cosmic images across distinct passages and figures.',
    directAnswer: 'The inspected corpus and scholarship record dark color, disc, conch, serpent repose, eagle banner, lotus imagery, three strides, plough, and palm-tree banner. They do not occur as one checklist in one passage or always attach to the same figure. A reliable answer cites the particular poem and labels whether the feature is explicit, commentarial, or comparative.',
    answerClass: 'source-bound-interpretation',
    claimIds: ['attributes-need-claim-level-typing', 'visnu-relationship', 'krishna-allusions', 'balarama-valiyon'],
    connectionNames: ['Vishnu', 'Krishna', 'Balarama / Vāliyoṉ'],
    comparison: { left: 'Located attribute', right: 'Composite icon', finding: 'A located attribute is source evidence; a composite assembled from many passages is an editorial visualization.', boundary: 'The composite must never be presented as though one early text supplied it whole.' },
    limitations: ['No archaeological image corpus was inspected for this batch.', 'Shared symbols are not unique identifiers.', 'Color words and object names require philological context beyond an English gloss.'],
    unresolvedQuestions: ['Which features are earliest in Tamil?', 'How do material images compare with literary descriptions?'],
    relatedSlugs: ['tirumal-in-the-paripatal', 'mayon-and-vishnu', 'mayon-and-balarama-valiyon'],
    keywords: ['disc', 'conch', 'serpent', 'lotus', 'iconography'],
  },
  {
    slug: 'mayon-sacred-space-and-temple-sites',
    title: 'Māyōṉ–Tirumāl sacred space and temple sites',
    shortTitle: 'Sacred space and sites',
    question: 'How do poem, deity, mountain, temple, and journey become connected?',
    description: 'A source-bound account of Irunkuṉṟam, Iruntaiyur, Mālirunkuṉṟam, Aḻakarmalai, and the limits of modern site identification.',
    directAnswer: 'Subbiah reads the Paripāṭal as joining transcendent Tirumāl language to approachable places, especially Irunkuṉṟam and Iruntaiyur. In the Irunkuṉṟam material, residence, sight, approach, praise, family pilgrimage, and even identification of mountain with deity build sacred space poetically. Modern geographical and temple identifications remain separate historical propositions.',
    answerClass: 'source-bound-interpretation',
    claimIds: ['sacred-space-mountain-and-deity', 'tirumal-transcendent-and-local', 'site-identification-caution', 'irunkunram-dark-white-pair'],
    connectionNames: ['Tirumāl', 'Balarama / Vāliyoṉ', 'Cēyōṉ / Murukan'],
    comparison: { left: 'Literary sacred place', right: 'Modern archaeological identification', finding: 'The poem establishes its named and imagined place; modern identification requires chronology, geography, and independent evidence.', boundary: 'Similarity of names or continuous devotion alone cannot settle every site claim.' },
    limitations: ['No excavation or inscriptional dossier was inspected.', 'Several identifications are reported through modern scholarship.', 'Not all Tirumāl poems name a temple or earthly abode.'],
    unresolvedQuestions: ['Which site identifications have inscriptional support?', 'How did pilgrimage and temple institutions change after the early corpus?'],
    relatedSlugs: ['tirumal-in-the-paripatal', 'mayon-and-balarama-valiyon', 'mayon-and-ceyon-murukan'],
    keywords: ['Irunkuṉṟam', 'Iruntaiyur', 'Aḻakarmalai', 'sacred space'],
  },
  {
    slug: 'mayon-dravidian-god-question',
    title: 'Is Māyōṉ a “Dravidian god”?',
    shortTitle: 'The “Dravidian god” question',
    question: 'What can linguistic and textual location establish without turning history into a purity claim?',
    description: 'A historiographical answer that affirms early Tamil attestation while refusing unsupported ethnic purity and isolation narratives.',
    directAnswer: 'It is accurate to call Māyōṉ an early Tamil divine name and to study the figure within Dravidian-language literary history. It is not accurate, on the inspected evidence, to call Māyōṉ a culturally pure, isolated, or unchanged “Dravidian god.” The corpus records Tamil forms and landscapes alongside historically layered relations to Tirumāl, Vishnu, Krishna, and other figures.',
    answerClass: 'disputed-or-ambiguous',
    claimIds: ['mayon-mullai', 'commentarial-identification-layer', 'visnu-relationship', 'netiyon-ambiguity'],
    connectionNames: ['Tirumāl', 'Vishnu', 'Krishna'],
    comparison: { left: 'Dravidian-language attestation', right: 'Ethnic or cultural purity', finding: 'The first is a claim about the language and corpus; the second is a broad origin theory not established by those facts.', boundary: 'Contact, adaptation, continuity, and local creativity are not mutually exclusive historical possibilities.' },
    limitations: ['No population history follows from a literary name.', 'The direction of influence is not settled by vocabulary alone.', '“Dravidian” has linguistic, historical, political, and identity uses that must not be conflated.'],
    unresolvedQuestions: ['Which relations predate the extant texts?', 'What evidence can distinguish borrowing, convergence, translation, and reinterpretation?'],
    relatedSlugs: ['who-is-mayon', 'mayon-and-tirumal', 'mayon-names-mal-tirumal-netiyon'],
    keywords: ['Dravidian religion', 'Tamil religion', 'cultural contact', 'historiography'],
  },
  {
    slug: 'mayon-volcano-disambiguation',
    title: 'Māyōṉ and Mayon Volcano: a strict disambiguation',
    shortTitle: 'Māyōṉ and Mayon Volcano',
    question: 'Does a shared English spelling establish any historical relationship?',
    description: 'A machine-readable boundary between the early Tamil deity dossier and Maha’s modern Mayon Volcano products.',
    directAnswer: 'No inspected source establishes an etymological, cultic, geographical, or historical connection between the Tamil divine name Māyōṉ and Mayon Volcano in the Philippines. Maha links them only because the English spelling “Mayon” creates a real disambiguation need and because both belong to its public knowledge graph. The link is editorial, not historical evidence.',
    answerClass: 'modern-disambiguation',
    claimIds: ['mayon-mullai', 'commentarial-identification-layer'],
    connectionNames: [],
    comparison: { left: 'Māyōṉ in early Tamil literature', right: 'Mayon Volcano in Bicol', finding: 'They are distinct entities in different domains; the shared spelling triggers clarification, not a derivation claim.', boundary: 'Until a lawful, inspected source establishes more, “namesake” here means a navigation relation only.' },
    limitations: ['This dossier does not claim an etymology for the volcano’s name.', 'Modern Maha product names are not evidence about ancient Tamil religion.', 'Visual or symbolic resemblance would not establish contact or descent.'],
    unresolvedQuestions: ['What is the independently sourced history of the volcano’s name?', 'How should search systems rank the deity and volcano senses for different queries?'],
    relatedSlugs: ['who-is-mayon', 'mayon-and-mullai', 'mayon-dravidian-god-question'],
    modernBridgePaths: ['/apps/mayon', '/projects/mayon', '/books/the-volcanic-engine'],
    keywords: ['Mayon Volcano', 'Māyōṉ', 'disambiguation', 'namesake'],
  },
] as const

export const mayonTopicPath = (topic: Pick<MayonTopic, 'slug'>) => `${MAYON_KNOWLEDGE_PATH}/${topic.slug}`

export interface MayonTopicQuality {
  topicSlug: string
  eligible: boolean
  claimCoverage: number
  informationDimensions: number
  blockers: readonly string[]
}

export const MAYON_TOPIC_QUALITY: readonly MayonTopicQuality[] = MAYON_TOPICS.map((topic) => {
  const claims = topic.claimIds.map((id) => MAYON_CLAIMS.find((claim) => claim.id === id))
  const citedSources = claims.flatMap((claim) => claim?.sourceIds ?? []).map((id) => MAYON_SOURCES.find((source) => source.id === id))
  const blockers: string[] = []
  if (claims.some((claim) => !claim)) blockers.push('unknown-claim')
  if (claims.length < 2) blockers.push('insufficient-claim-coverage')
  if (citedSources.some((source) => !source?.contentInspected || !source.explanatoryEligible)) blockers.push('non-explanatory-source')
  if (topic.directAnswer.length < 220) blockers.push('thin-direct-answer')
  if (topic.limitations.length < 3) blockers.push('insufficient-limitations')
  if (topic.unresolvedQuestions.length < 2) blockers.push('insufficient-open-questions')
  if (topic.relatedSlugs.length < 3) blockers.push('insufficient-related-records')
  const informationDimensions = [
    topic.question,
    topic.directAnswer,
    claims.length >= 2,
    topic.comparison.finding,
    topic.comparison.boundary,
    topic.limitations.length >= 3,
    topic.unresolvedQuestions.length >= 2,
    topic.relatedSlugs.length >= 3,
    citedSources.length >= 2,
  ].filter(Boolean).length
  if (informationDimensions < 9) blockers.push('insufficient-information-value')
  return { topicSlug: topic.slug, eligible: blockers.length === 0, claimCoverage: claims.filter(Boolean).length, informationDimensions, blockers }
})

export const MAYON_CORPUS_DEPTH = {
  before: {
    indexPages: 1,
    topicPages: 0,
    sourceBoundClaims: 5,
    explanatorySources: 3,
    generativeQuestions: 0,
    typedHistoricalConnections: 7,
    modernDisambiguationBridges: 3,
  },
  after: {
    indexPages: 1,
    topicPages: MAYON_TOPICS.length,
    sourceBoundClaims: MAYON_CLAIMS.length,
    explanatorySources: MAYON_SOURCES.filter((source) => source.contentInspected && source.explanatoryEligible).length,
    bibliographicControls: MAYON_SOURCES.filter((source) => source.frame === 'bibliographic-record').length,
    claimUsesAcrossTopics: MAYON_TOPICS.reduce((sum, topic) => sum + topic.claimIds.length, 0),
    generativeQuestions: cohort.queries.length,
    typedHistoricalConnections: MAYON_CONNECTIONS.length,
    modernDisambiguationBridges: MAYON_MODERN_BRIDGES.length,
    eligibleTopicPages: MAYON_TOPIC_QUALITY.filter((quality) => quality.eligible).length,
    informationDimensionsPerTopic: Math.min(...MAYON_TOPIC_QUALITY.map((quality) => quality.informationDimensions)),
  },
} as const

export interface MayonAnswerEntry {
  id: string
  question: string
  topicSlug: string
  answerClass: MayonAnswerClass
  answer: string
  claimIds: readonly string[]
  citations: readonly { sourceId: string; title: string; url: string; locator: string }[]
  limitations: readonly string[]
  notEstablished: string
  relatedPaths: readonly string[]
}

const cohortSlugs = cohort.topicSlugs as string[]
const cohortQueries = cohort.queries as string[]

export const MAYON_ANSWER_ENTRIES: readonly MayonAnswerEntry[] = cohortQueries.map((question, index) => {
  const topicSlug = cohortSlugs[Math.floor(index / 5)]
  const topic = MAYON_TOPICS.find((candidate) => candidate.slug === topicSlug)
  if (!topic) throw new Error(`Unknown frozen Māyōṉ topic: ${topicSlug}`)
  const claims = topic.claimIds.map((claimId) => {
    const claim = MAYON_CLAIMS.find((candidate) => candidate.id === claimId)
    if (!claim) throw new Error(`Unknown Māyōṉ claim: ${claimId}`)
    return claim
  })
  const citations = [...new Set(claims.flatMap((claim) => claim.sourceIds))].map((sourceId) => {
    const source = MAYON_SOURCES.find((candidate) => candidate.id === sourceId)
    if (!source || !source.contentInspected || !source.explanatoryEligible) throw new Error(`Non-explanatory Māyōṉ source: ${sourceId}`)
    return {
      sourceId,
      title: source.title,
      url: source.url,
      locator: claims
        .filter((claim) => claim.sourceIds.includes(sourceId))
        .map((claim) => claim.sourceLocators[sourceId])
        .join('; '),
    }
  })
  return {
    id: `mayon-q${String(index + 1).padStart(3, '0')}`,
    question,
    topicSlug,
    answerClass: topic.answerClass,
    answer: topic.directAnswer,
    claimIds: topic.claimIds,
    citations,
    limitations: topic.limitations,
    notEstablished: topic.comparison.boundary,
    relatedPaths: topic.relatedSlugs.map((slug) => `${MAYON_KNOWLEDGE_PATH}/${slug}`),
  }
})

export const MAYON_PUBLIC_REGISTRY = {
  version: MAYON_TOPIC_VERSION,
  knowledgeVersion: MAYON_KNOWLEDGE_VERSION,
  name: 'Māyōṉ source-bound answer registry',
  purpose: 'Answer common questions from inspected evidence while preserving direct attestation, interpretation, ambiguity, and modern disambiguation as different result classes.',
  evidenceFramePolicy: {
    primaryText: 'Establishes wording in a named passage, not historical or metaphysical truth.',
    scholarlyInterpretation: 'Carries an attributed argument within the inspected scope and limitations.',
    bibliographicRecord: 'Reconciles catalogue or edition metadata and is never explanatory evidence.',
  },
  sources: MAYON_SOURCES.map((source) => ({
    id: source.id,
    title: source.title,
    publisher: source.publisher,
    url: source.url,
    version: source.version,
    inspectedLocator: source.inspectedLocator,
    frame: source.frame,
    contentInspected: source.contentInspected,
    explanatoryEligible: source.explanatoryEligible,
    establishes: source.establishes,
    boundary: source.boundary,
  })),
  historicalConnections: MAYON_CONNECTIONS,
  modernBridges: MAYON_MODERN_BRIDGES,
  quality: MAYON_TOPIC_QUALITY,
  depth: MAYON_CORPUS_DEPTH,
  topics: MAYON_TOPICS.map((topic) => ({
    slug: topic.slug,
    path: mayonTopicPath(topic),
    title: topic.title,
    question: topic.question,
    directAnswer: topic.directAnswer,
    answerClass: topic.answerClass,
    claimIds: topic.claimIds,
    limitations: topic.limitations,
    unresolvedQuestions: topic.unresolvedQuestions,
    relatedPaths: topic.relatedSlugs.map((slug) => `${MAYON_KNOWLEDGE_PATH}/${slug}`),
    keywords: topic.keywords,
  })),
  answers: MAYON_ANSWER_ENTRIES,
} as const

export const MAYON_PUBLIC_REGISTRY_DIGEST = provenanceDigest(MAYON_PUBLIC_REGISTRY)

export function getMayonTopic(slug: string): MayonTopic | undefined {
  return MAYON_TOPICS.find((topic) => topic.slug === slug)
}

export function getMayonConnection(name: string) {
  return MAYON_CONNECTIONS.find((connection) => connection.name === name)
}

export function getMayonModernBridge(path: string) {
  return MAYON_MODERN_BRIDGES.find((bridge) => bridge.path === path)
}

export function answerMayonQuestion(question: string): MayonAnswerEntry | undefined {
  const normalized = question.normalize('NFC').trim().toLocaleLowerCase('en-US').replace(/[?.!]+$/u, '')
  return MAYON_ANSWER_ENTRIES.find((entry) => entry.question.normalize('NFC').trim().toLocaleLowerCase('en-US').replace(/[?.!]+$/u, '') === normalized)
}

function assertMayonTopicCorpus() {
  if (cohortSlugs.length !== 15 || cohortQueries.length !== 75) throw new Error('The frozen Māyōṉ cohort must remain 15 topics and 75 queries.')
  if (MAYON_TOPICS.length !== cohortSlugs.length) throw new Error('Every frozen Māyōṉ topic must be implemented exactly once.')
  if (MAYON_ANSWER_ENTRIES.length !== cohortQueries.length) throw new Error('Every frozen Māyōṉ query must have an answer contract.')
  if (new Set(MAYON_TOPICS.map((topic) => topic.slug)).size !== MAYON_TOPICS.length) throw new Error('Duplicate Māyōṉ topic slug.')
  if (new Set(MAYON_ANSWER_ENTRIES.map((entry) => entry.question.normalize('NFC').toLocaleLowerCase('en-US'))).size !== MAYON_ANSWER_ENTRIES.length) throw new Error('Duplicate Māyōṉ question.')
  if (!MAYON_TOPIC_QUALITY.every((quality) => quality.eligible)) throw new Error(`Ineligible Māyōṉ topic: ${JSON.stringify(MAYON_TOPIC_QUALITY.filter((quality) => !quality.eligible))}`)
  const topicSlugs = new Set(MAYON_TOPICS.map((topic) => topic.slug))
  const connectionNames = new Set(MAYON_CONNECTIONS.map((connection) => connection.name))
  const modernPaths = new Set(MAYON_MODERN_BRIDGES.map((bridge) => bridge.path))
  for (const topic of MAYON_TOPICS) {
    if (!topic.relatedSlugs.every((slug) => topicSlugs.has(slug))) throw new Error(`${topic.slug} has an unknown related topic.`)
    if (!topic.connectionNames.every((name) => connectionNames.has(name))) throw new Error(`${topic.slug} has an unknown historical connection.`)
    if (!(topic.modernBridgePaths ?? []).every((path) => modernPaths.has(path))) throw new Error(`${topic.slug} has an unknown modern bridge.`)
    const bibliographic = (topic.bibliographicSourceIds ?? []).map((id) => MAYON_SOURCES.find((source) => source.id === id))
    if (bibliographic.some((source) => source?.frame !== 'bibliographic-record' || source.contentInspected || source.explanatoryEligible)) throw new Error(`${topic.slug} treats a bibliographic record as explanatory evidence.`)
  }
}

assertMayonTopicCorpus()
