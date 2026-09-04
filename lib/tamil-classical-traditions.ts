import cohort from '../content/religion/tamil-classical-traditions/research-cohort-v1.json' with { type: 'json' }

import { provenanceDigest } from './evidence-dossier/digest.ts'

export const TAMIL_CLASSICAL_VERSION = 'tamil-classical-traditions/1.0' as const
export const TAMIL_CLASSICAL_DATE = '2026-09-04' as const
export const TAMIL_CLASSICAL_PATH = '/knowledge/religion/tamil-classical-traditions' as const
export const TAMIL_CLASSICAL_REGISTRY_PATH = `${TAMIL_CLASSICAL_PATH}/registry` as const

export type TamilClassicalEvidenceFrame =
  | 'primary-text'
  | 'primary-text-in-translation'
  | 'scholarly-interpretation'

export interface TamilClassicalSource {
  id: string
  title: string
  publisher: string
  url: string
  version: string
  frame: TamilClassicalEvidenceFrame
  inspectedLocator: string
  rightsBasis: string
  establishes: string
  boundary: string
  contentInspected: true
  explanatoryEligible: true
}

export const TAMIL_CLASSICAL_SOURCES: readonly TamilClassicalSource[] = [
  {
    id: 'tolkappiyam-porul-5',
    title: 'Tolkāppiyam III: Poruḷatikāram',
    publisher: 'Project Madurai text preserved by TextGrid',
    url: 'https://textgridrep.org/browse/49tqk.0',
    version: 'TextGrid version dated 2025-05-27; Project Madurai base text prepared 1999–2001',
    frame: 'primary-text',
    inspectedLocator: 'Akattiṇaiyiyal, nūṟpā 5, complete six-line deity-and-landscape stanza',
    rightsBasis: 'CC BY-NC-SA 4.0 for the TextGrid representation; short quotation with attribution',
    establishes: 'The inspected edition prints a four-name sequence that associates Māyōṉ, Cēyōṉ, Vēntaṉ, and Varuṇaṉ with the forest-pastoral, mountain, sweet-water agricultural, and littoral worlds.',
    boundary: 'The stanza establishes wording inside a poetics classification. It does not provide a complete pantheon, identify every name through later Sanskrit terminology, or reconstruct the history of worship.',
    contentInspected: true,
    explanatoryEligible: true,
  },
  {
    id: 'paripatal-project-madurai',
    title: 'Paripāṭal and Paripāṭal Tiraṭṭu',
    publisher: 'Project Madurai',
    url: 'https://www.projectmadurai.org/pm_etexts/utf8/pmuni0087.html',
    version: 'Unicode Tamil edition first published 2000; page notice updated through 2021',
    frame: 'primary-text',
    inspectedLocator: 'Edition header; Tirumāl poems 1–4 and 13; Cevvēḷ poem 5; poem headings and colophons',
    rightsBasis: 'Project Madurai permits free distribution with its header intact; brief cited excerpts only',
    establishes: 'The edition presents poems grouped under named subjects and preserves headings or colophons that identify poets, music setters, and paṇ, together with the wording of the Tirumāl and Cevvēḷ poems inspected.',
    boundary: 'The edition establishes what it prints and labels. It does not by itself verify legendary collection size, reconstruct a performance, or make the anthology a single systematic theology.',
    contentInspected: true,
    explanatoryEligible: true,
  },
  {
    id: 'divya-prabandham-part-4',
    title: 'Nālāyira Divya Prabandham, Part 4: English translation',
    publisher: 'Project Madurai; translated by Kausalya Hart',
    url: 'https://www.projectmadurai.org/pm_etexts/utf8/pmuni0624_eng.html',
    version: 'Project Madurai English translation containing pāsurams 2971–4000',
    frame: 'primary-text-in-translation',
    inspectedLocator: 'Edition header and Tiruvāymoḻi pāsurams 3052–3054, 3147–3150, 3310–3320, 3541–3543, 3615–3628, 3648–3650, and 3849–3852',
    rightsBasis: 'Project Madurai distribution terms; limited quotation and paraphrase with translator attribution',
    establishes: 'The named English translation renders Nammāḻvār verses using forms including Māyan, Māl, Kaṇṇan, Nārāyaṇa, and Neṭumāl, and renders devotional speech tied to named temple places and Tamil poetic composition.',
    boundary: 'This source establishes how one translator renders specified verses. It cannot replace the Tamil wording, settle every name’s semantic range, or prove the chronology and historical formation of the traditions invoked.',
    contentInspected: true,
    explanatoryEligible: true,
  },
  {
    id: 'subbiah-1988-early-south-india',
    title: 'Patterns in Religious Thought in Early South India: A Study of Classical Tamil Texts',
    publisher: 'McMaster University Open Access Dissertations and Theses',
    url: 'https://macsphere.mcmaster.ca/items/cb7a8643-b50b-447e-8964-7220a7ad2870',
    version: 'PhD dissertation submitted August 1988; MacSphere repository scan',
    frame: 'scholarly-interpretation',
    inspectedLocator: 'Printed pp. 64–66, 71–74, 98–114, 150–154, and 218–221',
    rightsBasis: 'Open university repository copy; paraphrase and limited quotation with page-level attribution',
    establishes: 'Subbiah supplies an attributed reading of the landscape stanza, commentarial deity identifications, the surviving Paripāṭal corpus, its subject counts and colophons, Vāliyoṉ, sacred places, and ambiguous epithets.',
    boundary: 'The dissertation is a scholarly synthesis rather than a primary witness or archaeological report. Its translations, site identifications, historical framing, and evaluation of earlier scholarship remain attributed arguments.',
    contentInspected: true,
    explanatoryEligible: true,
  },
  {
    id: 'reddy-2011-telugu-literature',
    title: 'The Giver of the Worn Garland: Krishnadevaraya’s Āmuktamālyada',
    publisher: 'University of California, Berkeley eScholarship',
    url: 'https://escholarship.org/content/qt9v6585kp/qt9v6585kp.pdf',
    version: 'PhD dissertation, 2011, open institutional repository copy',
    frame: 'scholarly-interpretation',
    inspectedLocator: 'pp. 25–26, 30, 33–46, and 88–93: Tamil bhakti, Āḻvārs, Nālāyiram reception, and akam/tiṇai literary continuity',
    rightsBasis: 'Open institutional repository copy; paraphrase and limited quotation with page attribution',
    establishes: 'Reddy presents an attributed account of the Āḻvār corpus, Nammāḻvār, temple localization, the traditional Nāthamuni compilation account, Tamil Veda reception, and literary reuse of akam and tiṇai modes.',
    boundary: 'The work supports a scholarly history of literary forms and reception. Its reports of traditional authorship or compilation are tradition-attributed, and formal continuity does not prove an unchanged cult or identity.',
    contentInspected: true,
    explanatoryEligible: true,
  },
] as const

export interface TamilClassicalClaim {
  id: string
  heading: string
  statement: string
  frame: TamilClassicalEvidenceFrame
  sourceIds: readonly string[]
  sourceLocators: Readonly<Record<string, string>>
  limitation: string
}

const claim = (value: TamilClassicalClaim): TamilClassicalClaim => value

export const TAMIL_CLASSICAL_CLAIMS: readonly TamilClassicalClaim[] = [
  claim({ id: 'tinai-literary-system', heading: 'Tiṇai coordinates more than scenery', statement: 'Reddy describes akam and tiṇai conventions as a literary system in which landscape participates with human situation, mood, season, time, flora, fauna, and characteristic action rather than functioning as decorative geography alone.', frame: 'scholarly-interpretation', sourceIds: ['reddy-2011-telugu-literature'], sourceLocators: { 'reddy-2011-telugu-literature': 'pp. 30 and 88–93, discussion of akam conventions and tiṇai modalities' }, limitation: 'This is an attributed literary account. It does not prove that every poem uses every convention or that the classifications directly describe one uniform historical religious practice.' }),
  claim({ id: 'fourfold-stanza', heading: 'The inspected stanza names four landscape associations', statement: 'Akattiṇaiyiyal 5 places Māyōṉ, Cēyōṉ, Vēntaṉ, and Varuṇaṉ in an ordered sequence associated with the forest-pastoral, mountain, sweet-water agricultural, and littoral worlds, conventionally indexed as mullai, kuṟiñci, marutam, and neytal.', frame: 'primary-text', sourceIds: ['tolkappiyam-porul-5'], sourceLocators: { 'tolkappiyam-porul-5': 'Akattiṇaiyiyal 5, complete six-line deity-and-landscape stanza' }, limitation: 'The passage is a compact poetics classification, not a complete inventory of Tamil deities, a genealogy, or evidence that all four associations arose at the same time.' }),
  claim({ id: 'commentarial-identity-layer', heading: 'Familiar identifications enter through commentary', statement: 'After presenting the landscape stanza, Subbiah separately reports commentarial identifications of Māyōṉ with Māl or Vishnu, Cēyōṉ with Murukan, Vēntaṉ with Indra, and Varuṇaṉ with Varuna.', frame: 'scholarly-interpretation', sourceIds: ['tolkappiyam-porul-5', 'subbiah-1988-early-south-india'], sourceLocators: { 'tolkappiyam-porul-5': 'Akattiṇaiyiyal 5, where the four Tamil forms occur', 'subbiah-1988-early-south-india': 'printed pp. 64–66, translation followed by the commentarial identification discussion' }, limitation: 'The four names are in the stanza; the equations are reported from commentary. A later identification must not be quoted as if it were a word in the earlier line.' }),
  claim({ id: 'ceyon-kurinji', heading: 'Cēyōṉ is paired with the mountain world', statement: 'In the inspected stanza Cēyōṉ is the divine name associated with the mountain world indexed as kuṟiñci, immediately contrasted with Māyōṉ’s forest-pastoral association.', frame: 'primary-text', sourceIds: ['tolkappiyam-porul-5'], sourceLocators: { 'tolkappiyam-porul-5': 'Akattiṇaiyiyal 5, second line and the landscape names in the fifth and sixth lines' }, limitation: 'The source supports a literary association and contrast. It provides no genealogy between Cēyōṉ and Māyōṉ and does not itself print the later form Murukan.' }),
  claim({ id: 'ventan-marutam', heading: 'Vēntaṉ is paired with the sweet-water agricultural world', statement: 'The third association in the inspected stanza joins Vēntaṉ to the world of sweet water, which the closing lines place in the marutam position of the fourfold classification.', frame: 'primary-text', sourceIds: ['tolkappiyam-porul-5'], sourceLocators: { 'tolkappiyam-porul-5': 'Akattiṇaiyiyal 5, third line and the ordered landscape names in the closing lines' }, limitation: 'This establishes the association inside this passage. It does not by itself define every use of vēntaṉ, establish a universal rain cult, or print the name Indra.' }),
  claim({ id: 'varunan-neytal', heading: 'Varuṇaṉ is paired with the littoral world', statement: 'The fourth association in the inspected stanza places Varuṇaṉ with the great sandy world, corresponding in the ordered close to neytal, the littoral landscape.', frame: 'primary-text', sourceIds: ['tolkappiyam-porul-5'], sourceLocators: { 'tolkappiyam-porul-5': 'Akattiṇaiyiyal 5, fourth line and the ordered landscape names in the closing lines' }, limitation: 'The line supports a named literary pairing. It does not settle the complete semantic history of Varuṇaṉ or make every Tamil and Sanskrit occurrence identical.' }),
  claim({ id: 'palai-passage-silence', heading: 'Pālai is absent from this complete stanza', statement: 'The complete inspected six-line sequence closes with four landscape names—mullai, kuṟiñci, marutam, and neytal—and does not name pālai or assign a fifth deity in this passage.', frame: 'primary-text', sourceIds: ['tolkappiyam-porul-5'], sourceLocators: { 'tolkappiyam-porul-5': 'Akattiṇaiyiyal 5, complete stanza including its closing enumeration' }, limitation: 'Absence from one stanza proves only passage-level silence. It cannot establish that pālai lacked divine associations elsewhere, in other textual layers, or in later commentary.' }),
  claim({ id: 'paripatal-survival', heading: 'Paripāṭal counts depend on the editorial denominator', statement: 'Subbiah distinguishes a reported original collection of seventy poems from twenty-two transmitted poems and from expanded counts that include pieces recovered through commentary, producing different totals for the surviving anthology and its subject groups.', frame: 'scholarly-interpretation', sourceIds: ['subbiah-1988-early-south-india', 'paripatal-project-madurai'], sourceLocators: { 'subbiah-1988-early-south-india': 'printed pp. 71–74, subject table and discussion of transmitted and recovered poems', 'paripatal-project-madurai': 'edition header and complete electronic table of poem headings' }, limitation: 'A poem count is meaningful only with its edition and inclusion rule. No one number should be presented as though transmitted poems, recovered pieces, fragments, and legendary extent were the same set.' }),
  claim({ id: 'paripatal-subject-groups', heading: 'The extant anthology preserves distinct subject groupings', statement: 'The inspected edition labels poems for Tirumāl and Cevvēḷ and poems concerning the Vaiyai, while Subbiah’s inventory treats these as major surviving subject groups rather than as interchangeable names for one subject.', frame: 'scholarly-interpretation', sourceIds: ['paripatal-project-madurai', 'subbiah-1988-early-south-india'], sourceLocators: { 'paripatal-project-madurai': 'Tirumāl poem headings 1–4 and 13, Cevvēḷ poem 5 heading, and Vaiyai poem headings', 'subbiah-1988-early-south-india': 'printed pp. 71–74, subject inventory and table' }, limitation: 'Anthology organization establishes editorial and poetic grouping, not a complete theology or proof that deity, river, place, and performance carried the same authority.' }),
  claim({ id: 'paripatal-colophons', heading: 'Poet, music setter, and paṇ remain separate fields', statement: 'The electronic headings and Subbiah’s discussion preserve an apparatus in which the poem’s author, the person who set its music, and its named paṇ can be recorded separately.', frame: 'scholarly-interpretation', sourceIds: ['paripatal-project-madurai', 'subbiah-1988-early-south-india'], sourceLocators: { 'paripatal-project-madurai': 'poems 1, 2, and 5, headings that separately name the poet, music setter, and paṇ', 'subbiah-1988-early-south-india': 'printed pp. 72–74 and 106–107, colophon and proposed performance context' }, limitation: 'A colophon establishes the labels transmitted by that edition. It does not independently reconstruct sound, staging, audience, or whether every attribution is contemporaneous with composition.' }),
  claim({ id: 'name-family-occurrence-level', heading: 'Names must be indexed at occurrence level', statement: 'The inspected Paripāṭal and Tiruvāymoḻi materials use several forms—including Māl, Tirumāl, Māyan, Kaṇṇan, Nārāyaṇa, and Neṭumāl—inside distinct verses and genres, making the attested form and locator evidence that should survive normalization.', frame: 'primary-text-in-translation', sourceIds: ['paripatal-project-madurai', 'divya-prabandham-part-4'], sourceLocators: { 'paripatal-project-madurai': 'Tirumāl poem headings and inspected occurrences in poems 1–4 and 13', 'divya-prabandham-part-4': 'Tiruvāymoḻi pāsurams 3052–3054, 3147–3150, 3310–3320, and 3849–3852 in Kausalya Hart’s translation' }, limitation: 'Co-occurrence within connected devotional corpora does not make every form a context-free synonym. Translation and transliteration can also normalize distinctions present in Tamil.' }),
  claim({ id: 'valiyon-associated-figure', heading: 'Vāliyoṉ is associated without becoming a synonym', statement: 'The inspected Paripāṭal passage and Subbiah’s analysis preserve Vāliyoṉ or a plough-bearing white figure in relation to Tirumāl material, while keeping the figure and attributes separately named.', frame: 'scholarly-interpretation', sourceIds: ['paripatal-project-madurai', 'subbiah-1988-early-south-india'], sourceLocators: { 'paripatal-project-madurai': 'Tirumāl poem 2 lines 20–25 and related Vāliyoṉ wording', 'subbiah-1988-early-south-india': 'printed pp. 107–109 and 150–154, paired-figure and Balarama discussion' }, limitation: 'Association, color contrast, plough imagery, and scholarly identification with Balarama do not make Vāliyoṉ another unrestricted name for Māyōṉ or Tirumāl.' }),
  claim({ id: 'netiyon-ambiguity', heading: 'Neṭiyōṉ is not resolved by the epithet alone', statement: 'Subbiah’s discussion of a difficult Neṭiyōṉ occurrence preserves multiple divine and human possibilities and argues from context rather than treating the epithet as a globally unique identifier.', frame: 'scholarly-interpretation', sourceIds: ['subbiah-1988-early-south-india'], sourceLocators: { 'subbiah-1988-early-south-india': 'printed pp. 218–221, discussion of Neṭiyōṉ and alternative referents' }, limitation: 'The ambiguity of one occurrence does not make every occurrence unknowable. It requires passage-by-passage resolution with uncertainty retained when the context underdetermines the referent.' }),
  claim({ id: 'alvar-corpus', heading: 'The Āḻvārs belong to a later devotional corpus', statement: 'Reddy describes the Āḻvārs and the Nālāyira Divya Prabandham as a Tamil devotional corpus associated with Vishnu and temple-centered bhakti, distinct from the earlier Sangam anthology context even where literary forms and names can be compared.', frame: 'scholarly-interpretation', sourceIds: ['reddy-2011-telugu-literature', 'divya-prabandham-part-4'], sourceLocators: { 'reddy-2011-telugu-literature': 'pp. 33–46, discussion of Āḻvārs, Nammāḻvār, the Nālāyiram, and Tamil bhakti', 'divya-prabandham-part-4': 'edition header identifying the translated pāsuram range and Tiruvāymoḻi sequence' }, limitation: 'The label later is a historical and literary relation, not a judgment of value. The texts do not become Sangam poems because they reuse Tamil forms or divine names.' }),
  claim({ id: 'nalayiram-reception', heading: 'Compilation and “Tamil Veda” are reception claims', statement: 'Reddy reports the traditional association of the Nālāyiram’s recovery or compilation with Nāthamuni and describes its reception as a Tamil Veda within later Śrīvaiṣṇava structures of dual Sanskrit and Tamil authority.', frame: 'scholarly-interpretation', sourceIds: ['reddy-2011-telugu-literature'], sourceLocators: { 'reddy-2011-telugu-literature': 'pp. 44–46, Nālāyiram, Nāthamuni tradition, Tamil Veda, and Ubhaya Vedānta discussion' }, limitation: 'The compilation narrative is explicitly tradition-attributed. A reception title establishes how a corpus is valued and authorized, not independent proof of its legendary chronology.' }),
  claim({ id: 'tiruvaymoli-name-uses', heading: 'The translation preserves a dense later name field', statement: 'Kausalya Hart’s translation of specified Tiruvāymoḻi verses renders Māyan, Māl, Kaṇṇan, Nārāyaṇa, and Neṭumāl within devotional speech, allowing the later corpus to be queried without pretending that one English gloss exhausts the Tamil forms.', frame: 'primary-text-in-translation', sourceIds: ['divya-prabandham-part-4'], sourceLocators: { 'divya-prabandham-part-4': 'pāsurams 3052–3054, 3147–3150, 3310–3320, and 3849–3852' }, limitation: 'These are translator-attributed renderings of named verses. They cannot by themselves establish etymology, date the names’ first use, or make each form semantically identical.' }),
  claim({ id: 'tiruvaymoli-temple-localization', heading: 'Devotion is localized at named places', statement: 'The inspected translation places devotional speech at named temple localities including Tirukkuḍandai and Tirumāliruñcōlai, while Reddy discusses temple localization as a feature of Tamil bhakti.', frame: 'scholarly-interpretation', sourceIds: ['divya-prabandham-part-4', 'reddy-2011-telugu-literature'], sourceLocators: { 'divya-prabandham-part-4': 'pāsurams 3310–3320 and 3849–3852, named-place devotional sequences', 'reddy-2011-telugu-literature': 'pp. 25–26, local and translocal bhakti and temple localization' }, limitation: 'A poetic named place and a historical temple institution are related but distinct claims. The passages do not alone prove continuous structures, dates, or unchanged ritual use.' }),
  claim({ id: 'tamil-poetic-composition', heading: 'The translated poetic voice attributes composition to the deity', statement: 'In pāsurams 3541–3543, the named translation renders the poet as saying that Māyan made him compose Tamil pāsurams, making divine agency part of the poem’s own self-description.', frame: 'primary-text-in-translation', sourceIds: ['divya-prabandham-part-4'], sourceLocators: { 'divya-prabandham-part-4': 'pāsurams 3541–3543 in Kausalya Hart’s English translation' }, limitation: 'This establishes a theological and poetic claim made by the translated voice. It is not an empirically verified causal account of composition or evidence that every community interprets inspiration identically.' }),
  claim({ id: 'akam-bhakti-literary-continuity', heading: 'Continuity can be literary without being an unchanged religion', statement: 'Reddy traces ways that later Tamil devotional poetry reuses or transforms akam and tiṇai modalities, including intimate voice, separation, place, and longing, while treating the bhakti corpus as historically and institutionally distinct.', frame: 'scholarly-interpretation', sourceIds: ['reddy-2011-telugu-literature'], sourceLocators: { 'reddy-2011-telugu-literature': 'pp. 30 and 88–93, akam modes and their later devotional adaptation' }, limitation: 'Reuse of a poetic grammar does not prove direct institutional descent, unchanged deity identity, or survival of every earlier religious practice into the Āḻvār period.' }),
  claim({ id: 'primary-translation-commentary-separation', heading: 'Each layer answers a different question', statement: 'The source set permits direct wording claims from the Tamil editions, translator-attributed claims from the English Tiruvāymoḻi, and historical or interpretive claims from dissertations, provided that no layer silently inherits the authority of another.', frame: 'scholarly-interpretation', sourceIds: ['tolkappiyam-porul-5', 'paripatal-project-madurai', 'divya-prabandham-part-4', 'subbiah-1988-early-south-india', 'reddy-2011-telugu-literature'], sourceLocators: { 'tolkappiyam-porul-5': 'Akattiṇaiyiyal 5, direct Tamil text', 'paripatal-project-madurai': 'edition header, poem headings, colophons, and inspected Tamil poems', 'divya-prabandham-part-4': 'edition header naming Kausalya Hart’s translation and inspected pāsurams', 'subbiah-1988-early-south-india': 'printed pp. 64–74 and 218–221, explicitly scholarly discussion', 'reddy-2011-telugu-literature': 'pp. 25–46 and 88–93, explicitly scholarly and reception-historical discussion' }, limitation: 'This is a governance rule for evidence use, not a claim that the editions are critical editions, the translations are uniquely correct, or the two dissertations represent consensus.' }),
] as const

export type TamilClassicalAnswerClass = 'direct-text' | 'translation-bound' | 'attributed-interpretation' | 'passage-silence' | 'reception-history'

export interface TamilClassicalTopic {
  slug: string
  title: string
  shortTitle: string
  question: string
  description: string
  directAnswer: string
  answerClass: TamilClassicalAnswerClass
  claimIds: readonly string[]
  comparison: { left: string; right: string; finding: string; boundary: string }
  limitations: readonly string[]
  unresolvedQuestions: readonly string[]
  relatedSlugs: readonly string[]
  mayonSlugs: readonly string[]
  keywords: readonly string[]
}

const sharedLimitations = [
  'The corpus is literary; it does not by itself provide archaeological confirmation or a complete social history.',
  'Translation, commentary, and scholarly interpretation remain attributed rather than being rewritten as words in the primary passage.',
  'A relation across texts does not establish an unchanged deity identity, cult, institution, or doctrine across centuries.',
] as const

const topic = (value: TamilClassicalTopic): TamilClassicalTopic => value

export const TAMIL_CLASSICAL_TOPICS: readonly TamilClassicalTopic[] = [
  topic({ slug: 'tinai-as-a-poetic-system', title: 'Tiṇai as a poetic system', shortTitle: 'What is tiṇai?', question: 'How should tiṇai be understood before using it to classify gods?', description: 'Landscape, human situation, time, mood, and characteristic action treated as a coordinated literary grammar.', directAnswer: 'Tiṇai is more than a list of physical landscapes. In the inspected scholarship it is a Tamil poetic system that coordinates place with human situation, mood, season, time, characteristic beings, and forms of action. The deity associations therefore belong first to literary classification; using them as a transparent census of historical worship would require evidence the classification itself does not supply.', answerClass: 'attributed-interpretation', claimIds: ['tinai-literary-system', 'fourfold-stanza', 'primary-translation-commentary-separation'], comparison: { left: 'Poetic landscape system', right: 'Historical religious map', finding: 'The first is directly available in the texts and literary analysis; the second requires independent historical evidence.', boundary: 'A literary ecology can preserve religious material without becoming a complete ethnography.' }, limitations: sharedLimitations, unresolvedQuestions: ['How do manuscript and commentarial traditions vary the tiṇai scheme?', 'Which deity associations recur independently outside poetics texts?'], relatedSlugs: ['reading-the-landscape-deity-stanza', 'ceyon-and-kurinji', 'from-sangam-poetics-to-alvar-bhakti'], mayonSlugs: ['mayon-and-mullai', 'the-four-landscape-deity-sequence'], keywords: ['tiṇai', 'Tamil poetics', 'akam', 'landscape deities'] }),
  topic({ slug: 'reading-the-landscape-deity-stanza', title: 'Reading the Tolkāppiyam landscape-deity stanza', shortTitle: 'The fourfold stanza', question: 'What belongs to the stanza, and what belongs to later commentary?', description: 'A line-by-line evidence boundary for the four divine names and their better-known identifications.', directAnswer: 'The inspected stanza itself names Māyōṉ, Cēyōṉ, Vēntaṉ, and Varuṇaṉ and orders four associated landscape worlds. It does not print Vishnu, Murukan, Indra, and Varuna as explanatory equivalents. Those familiar equations enter through a separate commentarial layer reported by scholarship, so a reliable answer must preserve both the original forms and the provenance of each later identification.', answerClass: 'direct-text', claimIds: ['fourfold-stanza', 'commentarial-identity-layer', 'primary-translation-commentary-separation'], comparison: { left: 'Tamil wording in Akattiṇaiyiyal 5', right: 'Reported commentarial identifications', finding: 'The sources support both layers when they are labelled separately.', boundary: 'Explanation may accompany a primary form but cannot silently replace it or inherit the authority of the earlier wording.' }, limitations: sharedLimitations, unresolvedQuestions: ['Which commentaries first state each equation?', 'How do major editions translate the landscape terms?'], relatedSlugs: ['tinai-as-a-poetic-system', 'ceyon-and-kurinji', 'palai-and-the-fourfold-stanza'], mayonSlugs: ['mayon-in-the-tolkappiyam', 'the-four-landscape-deity-sequence'], keywords: ['Tolkāppiyam', 'landscape deity stanza', 'commentary', 'primary text'] }),
  topic({ slug: 'ceyon-and-kurinji', title: 'Cēyōṉ and the kuṟiñci landscape', shortTitle: 'Cēyōṉ and kuṟiñci', question: 'What does the inspected source establish about Cēyōṉ?', description: 'The mountain-world association, its contrast with Māyōṉ, and the separate Murukan identification.', directAnswer: 'Cēyōṉ is the divine name paired with the mountain world in the inspected Tolkāppiyam stanza, conventionally indexed as kuṟiñci. The same sequence distinguishes Cēyōṉ from Māyōṉ through their different landscape positions. Subbiah reports the later commentarial identification with Murukan, but that name is not a word in this stanza and the passage supplies no genealogy or conflict between the figures.', answerClass: 'direct-text', claimIds: ['ceyon-kurinji', 'fourfold-stanza', 'commentarial-identity-layer'], comparison: { left: 'Cēyōṉ–kuṟiñci', right: 'Māyōṉ–mullai', finding: 'The direct relationship is contrastive co-attestation in one literary system.', boundary: 'Contrast does not imply hostility, descent, replacement, or ethnic division.' }, limitations: sharedLimitations, unresolvedQuestions: ['Where is the Cēyōṉ–Murukan equation first attested?', 'How do Cevvēḷ poems relate to the Tolkāppiyam name?'], relatedSlugs: ['tinai-as-a-poetic-system', 'reading-the-landscape-deity-stanza', 'tirumal-cevvel-and-vaiyai'], mayonSlugs: ['mayon-and-ceyon-murukan', 'the-four-landscape-deity-sequence'], keywords: ['Cēyōṉ', 'Murukan', 'kuṟiñci', 'mountain landscape'] }),
  topic({ slug: 'ventan-and-marutam', title: 'Vēntaṉ and the marutam landscape', shortTitle: 'Vēntaṉ and marutam', question: 'What is direct evidence for Vēntaṉ, and what is commentary?', description: 'A bounded reading of the sweet-water agricultural association and the reported Indra identification.', directAnswer: 'Vēntaṉ occupies the third position in the inspected stanza and is associated with the sweet-water agricultural world ordered as marutam. The source therefore supports a passage-level Vēntaṉ–marutam relation. It does not itself print “Indra”; that equation is reported from commentary, and the one line cannot establish every historical meaning of kingship, rain, agriculture, or divine sovereignty.', answerClass: 'direct-text', claimIds: ['ventan-marutam', 'fourfold-stanza', 'commentarial-identity-layer'], comparison: { left: 'Vēntaṉ in the stanza', right: 'Indra in commentary', finding: 'A direct Tamil form and a later explanatory identity are both useful when their layers remain visible.', boundary: 'The equation is not permission to replace every occurrence automatically or to erase the passage that carries the Tamil form.' }, limitations: sharedLimitations, unresolvedQuestions: ['How is Vēntaṉ used outside this stanza?', 'What independent evidence connects Vēntaṉ, rain, and kingship?'], relatedSlugs: ['reading-the-landscape-deity-stanza', 'varunan-and-neytal', 'tinai-as-a-poetic-system'], mayonSlugs: ['the-four-landscape-deity-sequence'], keywords: ['Vēntaṉ', 'Indra', 'marutam', 'agricultural landscape'] }),
  topic({ slug: 'varunan-and-neytal', title: 'Varuṇaṉ and the neytal landscape', shortTitle: 'Varuṇaṉ and neytal', question: 'What does the littoral association establish?', description: 'The fourth landscape pairing without treating name resemblance as a complete historical identity.', directAnswer: 'Varuṇaṉ is the fourth divine name in the inspected stanza and is associated with the great sandy or littoral world ordered as neytal. That makes the Varuṇaṉ–neytal relation direct evidence within this passage. The resemblance to Varuna and the reported commentarial equation are relevant, but neither permits every Tamil and Sanskrit occurrence to be collapsed into one undated identity.', answerClass: 'direct-text', claimIds: ['varunan-neytal', 'fourfold-stanza', 'commentarial-identity-layer'], comparison: { left: 'Passage-level Varuṇaṉ', right: 'Broader Varuna identification', finding: 'The first is printed; the second requires the explicitly cited commentarial or historical layer.', boundary: 'Name similarity is evidence to investigate, not a complete transmission history.' }, limitations: sharedLimitations, unresolvedQuestions: ['Which early Tamil passages independently describe Varuṇaṉ?', 'How do commentaries explain the maritime association?'], relatedSlugs: ['reading-the-landscape-deity-stanza', 'ventan-and-marutam', 'palai-and-the-fourfold-stanza'], mayonSlugs: ['the-four-landscape-deity-sequence'], keywords: ['Varuṇaṉ', 'Varuna', 'neytal', 'littoral landscape'] }),
  topic({ slug: 'palai-and-the-fourfold-stanza', title: 'Pālai and the limits of the fourfold stanza', shortTitle: 'Why is pālai absent?', question: 'What can silence in one complete passage establish?', description: 'A negative-evidence guide that refuses to turn passage-level silence into tradition-wide absence.', directAnswer: 'Pālai does not appear in the complete six-line deity-and-landscape stanza inspected here: the closing sequence names only mullai, kuṟiñci, marutam, and neytal. That supports the narrow statement “this stanza assigns no fifth pālai deity.” It does not prove that pālai had no divine association anywhere in Tamil literature, commentary, ritual, or later classification; those are separate research questions.', answerClass: 'passage-silence', claimIds: ['palai-passage-silence', 'fourfold-stanza', 'primary-translation-commentary-separation'], comparison: { left: 'Absence from one complete stanza', right: 'Absence from a whole tradition', finding: 'Only the first is established by inspection.', boundary: 'Silence is scoped to the inspected passage and must not be universalized into a claim about every Tamil text or historical practice.' }, limitations: sharedLimitations, unresolvedQuestions: ['Which texts or commentaries assign divine figures to pālai?', 'Is pālai derived or transformed within other tiṇai classifications?'], relatedSlugs: ['reading-the-landscape-deity-stanza', 'tinai-as-a-poetic-system', 'varunan-and-neytal'], mayonSlugs: ['the-four-landscape-deity-sequence'], keywords: ['pālai', 'negative evidence', 'Tolkāppiyam', 'landscape classification'] }),
  topic({ slug: 'what-is-the-paripatal', title: 'What is the Paripāṭal?', shortTitle: 'The Paripāṭal anthology', question: 'What survives, how is it organized, and why do counts differ?', description: 'The anthology’s transmitted shape, subject groups, and editorial denominators kept explicit.', directAnswer: 'Paripāṭal is a classical Tamil anthology whose surviving materials include poems grouped around Tirumāl, Cevvēḷ, and the Vaiyai. Counts differ because scholars and editions may count transmitted poems, poems recovered through commentary, fragments, or a reported original collection. It is safest to cite the exact edition and denominator rather than repeat one total as though every published count described the same corpus.', answerClass: 'attributed-interpretation', claimIds: ['paripatal-survival', 'paripatal-subject-groups', 'paripatal-colophons'], comparison: { left: 'Transmitted anthology', right: 'Reported original extent', finding: 'Both are claims about the corpus, but they have different evidentiary status and denominators.', boundary: 'A legendary total is not the same object as the extant text, and the two counts cannot be substituted without naming the editorial rule.' }, limitations: sharedLimitations, unresolvedQuestions: ['How do critical editions delimit recovered pieces?', 'What manuscript evidence underlies the electronic edition?'], relatedSlugs: ['tirumal-cevvel-and-vaiyai', 'paripatal-poets-musicians-and-pann', 'tamil-divine-name-families'], mayonSlugs: ['tirumal-in-the-paripatal', 'mayon-and-tirumal'], keywords: ['Paripāṭal', 'Eight Anthologies', 'Tamil hymns', 'surviving poems'] }),
  topic({ slug: 'tirumal-cevvel-and-vaiyai', title: 'Tirumāl, Cevvēḷ, and Vaiyai in the Paripāṭal', shortTitle: 'Paripāṭal subject groups', question: 'How can deity hymns and river poems share an anthology without becoming equivalent?', description: 'A comparison of the principal surviving subject groups and the boundaries of anthology-level inference.', directAnswer: 'The inspected edition preserves distinct poem headings for Tirumāl and Cevvēḷ and poems concerning the Vaiyai, while the scholarship inventories them as major subject groups within one anthology. Shared collection membership supports comparison of genre, praise, place, and performance. It does not make Tirumāl and Cevvēḷ identical, turn the river into the same kind of entity, or yield one systematic creed.', answerClass: 'direct-text', claimIds: ['paripatal-subject-groups', 'paripatal-survival', 'paripatal-colophons'], comparison: { left: 'Shared anthology', right: 'Distinct poetic subjects', finding: 'Collection-level relation coexists with subject-level non-equivalence.', boundary: 'Proximity in an anthology is not identity or equal theological function, and collection membership cannot erase the different subjects of address.' }, limitations: sharedLimitations, unresolvedQuestions: ['How do the subject groups differ in address and place?', 'How did compilers understand their shared collection?'], relatedSlugs: ['what-is-the-paripatal', 'paripatal-poets-musicians-and-pann', 'ceyon-and-kurinji'], mayonSlugs: ['tirumal-in-the-paripatal', 'mayon-and-ceyon-murukan'], keywords: ['Tirumāl', 'Cevvēḷ', 'Vaiyai', 'Paripāṭal'] }),
  topic({ slug: 'paripatal-poets-musicians-and-pann', title: 'Paripāṭal poets, music setters, and paṇ', shortTitle: 'Poet, musician, and paṇ', question: 'What does the anthology’s colophon apparatus preserve?', description: 'Authorship and music metadata without claiming to reconstruct a lost performance.', directAnswer: 'The inspected Paripāṭal headings and Subbiah’s discussion preserve separate fields for the poem’s author, the person credited with setting its music, and the named paṇ. That is unusually valuable performance metadata and should remain structured rather than flattened into one creator field. It still does not reproduce the historical sound, prove every attribution’s date, or establish one performance setting for all poems.', answerClass: 'attributed-interpretation', claimIds: ['paripatal-colophons', 'paripatal-subject-groups', 'primary-translation-commentary-separation'], comparison: { left: 'Transmitted colophon metadata', right: 'Reconstructed performance', finding: 'The first is available in the edition; the second remains an interpretation requiring additional evidence.', boundary: 'A named paṇ is not an audio recording or a complete score, and the colophon alone cannot reconstruct the historical performance.' }, limitations: sharedLimitations, unresolvedQuestions: ['How are the named paṇ interpreted in musicological scholarship?', 'Do manuscript witnesses agree on every colophon?'], relatedSlugs: ['what-is-the-paripatal', 'tirumal-cevvel-and-vaiyai', 'tamil-divine-name-families'], mayonSlugs: ['tirumal-in-the-paripatal'], keywords: ['Paripāṭal', 'paṇ', 'Tamil music', 'colophon'] }),
  topic({ slug: 'tamil-divine-name-families', title: 'Tamil divine name families and occurrence-level indexing', shortTitle: 'Divine epithets as data', question: 'Why should Māl, Tirumāl, Māyan, Kaṇṇan, and related forms remain visible?', description: 'An evidence model for connected divine names that resists automatic synonym replacement.', directAnswer: 'Tamil devotional corpora preserve connected forms such as Māl, Tirumāl, Māyan, Kaṇṇan, Nārāyaṇa, and Neṭumāl in different verses, genres, and historical layers. A knowledge system can connect them while retaining the exact form, source, translator, and passage. Replacing every occurrence with “Vishnu” may help broad discovery but destroys evidence about wording, semantic range, chronology, and poetic function.', answerClass: 'translation-bound', claimIds: ['name-family-occurrence-level', 'tiruvaymoli-name-uses', 'netiyon-ambiguity'], comparison: { left: 'Connected name family', right: 'Universal synonym list', finding: 'The first preserves evidence-bearing occurrences; the second erases distinctions before they can be studied.', boundary: 'Normalization is an access layer, not a claim that all forms are identical.' }, limitations: sharedLimitations, unresolvedQuestions: ['Which forms share etymology and which share only reception?', 'How do editions and translators normalize each form?'], relatedSlugs: ['netiyon-and-epithet-ambiguity', 'nammalvar-and-the-tiruvaymoli', 'from-sangam-poetics-to-alvar-bhakti'], mayonSlugs: ['mayon-names-mal-tirumal-netiyon', 'mayon-and-tirumal'], keywords: ['Tamil divine names', 'Māl', 'Māyan', 'Kaṇṇan'] }),
  topic({ slug: 'valiyon-and-balarama', title: 'Vāliyoṉ and Balarama in early Tamil interpretation', shortTitle: 'Vāliyoṉ and Balarama', question: 'What kind of relation is actually supported?', description: 'A distinction among textual adjacency, attributed identification, and unrestricted identity.', directAnswer: 'The inspected Paripāṭal material and scholarship place Vāliyoṉ or a white plough-bearing figure beside Tirumāl material and interpret the figure in relation to Balarama. This supports “associated figure” and an attributed Balarama identification. It does not support treating Vāliyoṉ as another unrestricted name for Māyōṉ, merging the two figures, or extending one passage’s imagery to every period.', answerClass: 'attributed-interpretation', claimIds: ['valiyon-associated-figure', 'name-family-occurrence-level', 'primary-translation-commentary-separation'], comparison: { left: 'Associated figure in named passages', right: 'Another name for Māyōṉ', finding: 'The evidence supports the first and refuses the second.', boundary: 'Adjacency and related iconography do not erase separately attested names or license unrestricted identity across other texts and periods.' }, limitations: sharedLimitations, unresolvedQuestions: ['How early is the explicit Balarama identification?', 'How do other Tamil sources use Vāliyoṉ?'], relatedSlugs: ['tamil-divine-name-families', 'what-is-the-paripatal', 'tirumal-cevvel-and-vaiyai'], mayonSlugs: ['mayon-and-balarama-valiyon', 'mayon-and-tirumal'], keywords: ['Vāliyoṉ', 'Balarama', 'plough', 'Paripāṭal'] }),
  topic({ slug: 'netiyon-and-epithet-ambiguity', title: 'Neṭiyōṉ and the ambiguity of divine epithets', shortTitle: 'Neṭiyōṉ is not a unique ID', question: 'How should an uncertain epithet be represented?', description: 'Occurrence-level resolution with multiple possible referents preserved where the passage underdetermines them.', directAnswer: 'Neṭiyōṉ is a useful warning against treating an epithet as a database identifier. In the inspected discussion, one difficult occurrence permits several divine or human readings and must be interpreted from context. The correct machine response is therefore occurrence-level resolution with candidates, evidence, and uncertainty—not a global replacement rule that converts every Neṭiyōṉ into Vishnu.', answerClass: 'attributed-interpretation', claimIds: ['netiyon-ambiguity', 'name-family-occurrence-level', 'primary-translation-commentary-separation'], comparison: { left: 'Contextual epithet resolution', right: 'Global name normalization', finding: 'The first can preserve ambiguity; the second turns an open question into false certainty.', boundary: 'Ambiguity in one occurrence does not invalidate well-supported readings elsewhere.' }, limitations: sharedLimitations, unresolvedQuestions: ['Which Neṭiyōṉ occurrences are securely divine?', 'Which lexical and narrative signals disambiguate the title?'], relatedSlugs: ['tamil-divine-name-families', 'valiyon-and-balarama', 'nammalvar-and-the-tiruvaymoli'], mayonSlugs: ['mayon-names-mal-tirumal-netiyon'], keywords: ['Neṭiyōṉ', 'epithet ambiguity', 'entity resolution', 'Tamil religion'] }),
  topic({ slug: 'who-are-the-alvars', title: 'Who are the Āḻvārs?', shortTitle: 'The Āḻvār corpus', question: 'Where do the Āḻvārs sit relative to Sangam literature?', description: 'A later Tamil devotional corpus with tradition, scholarship, and primary hymns kept in their own frames.', directAnswer: 'The Āḻvārs are Tamil devotional poet-saints whose hymns belong to a later Vishnu-centered bhakti corpus rather than to the Sangam anthologies. Reddy’s scholarly account and the translated Tiruvāymoḻi support study of their poetry, temple localization, and reception. Traditional biographies and compilation narratives remain tradition-attributed; they should not be presented as independently verified chronology.', answerClass: 'reception-history', claimIds: ['alvar-corpus', 'nalayiram-reception', 'primary-translation-commentary-separation'], comparison: { left: 'Sangam anthology context', right: 'Later Āḻvār bhakti corpus', finding: 'They can be connected through Tamil literary history without being treated as one period or archive.', boundary: 'Later reception cannot retroactively change the wording or date of an earlier text.' }, limitations: sharedLimitations, unresolvedQuestions: ['How should individual Āḻvār dates be represented?', 'Which biographical claims have independent documentary support?'], relatedSlugs: ['what-is-the-nalayira-divya-prabandham', 'nammalvar-and-the-tiruvaymoli', 'from-sangam-poetics-to-alvar-bhakti'], mayonSlugs: ['mayon-and-tirumal', 'mayon-sacred-space-and-temple-sites'], keywords: ['Āḻvārs', 'Tamil bhakti', 'Vishnu devotion', 'poet-saints'] }),
  topic({ slug: 'what-is-the-nalayira-divya-prabandham', title: 'What is the Nālāyira Divya Prabandham?', shortTitle: 'The Nālāyiram', question: 'How should collection, compilation tradition, and authority be distinguished?', description: 'The hymn collection’s content and later reception without converting tradition into verified chronology.', directAnswer: 'The Nālāyira Divya Prabandham is the collected Tamil hymn corpus associated with the twelve Āḻvārs in later Śrīvaiṣṇava tradition. Reddy reports the traditional role of Nāthamuni in recovering or compiling it and its reception as a “Tamil Veda.” Those are historically important authority claims, but the traditional narrative and title do not by themselves independently verify the chronology of collection.', answerClass: 'reception-history', claimIds: ['alvar-corpus', 'nalayiram-reception', 'tiruvaymoli-name-uses'], comparison: { left: 'Collection content', right: 'Compilation and authority tradition', finding: 'The corpus can be read directly while its received history is reported with attribution.', boundary: 'Canonical status is evidence about reception, not automatic proof of historical propositions.' }, limitations: sharedLimitations, unresolvedQuestions: ['What are the earliest witnesses to the collection’s organization?', 'How did Tamil and Sanskrit authority interact across institutions?'], relatedSlugs: ['who-are-the-alvars', 'nammalvar-and-the-tiruvaymoli', 'from-sangam-poetics-to-alvar-bhakti'], mayonSlugs: ['mayon-and-tirumal'], keywords: ['Nālāyira Divya Prabandham', 'Nālāyiram', 'Tamil Veda', 'Nāthamuni'] }),
  topic({ slug: 'nammalvar-and-the-tiruvaymoli', title: 'Nammāḻvār and the Tiruvāymoḻi', shortTitle: 'Nammāḻvār’s Tiruvāymoḻi', question: 'What can the inspected translation establish about names, place, and poetic voice?', description: 'Named pāsurams, translator-attributed divine names, temple places, and the poem’s account of its own composition.', directAnswer: 'The inspected Project Madurai translation presents Nammāḻvār’s Tiruvāymoḻi as devotional poetry that uses forms including Māyan, Māl, Kaṇṇan, Nārāyaṇa, and Neṭumāl, addresses named temple places, and attributes Tamil poetic composition to the deity in the speaker’s voice. These are passage-level translation claims, not permission to replace the Tamil text or certify divine agency as an external fact.', answerClass: 'translation-bound', claimIds: ['tiruvaymoli-name-uses', 'tiruvaymoli-temple-localization', 'tamil-poetic-composition'], comparison: { left: 'Named translator’s rendering', right: 'Unmediated Tamil wording', finding: 'The translation makes specified passages accessible but remains an attributed interpretation.', boundary: 'A machine answer should cite the pāsuram and translator rather than present English wording as lexically final.' }, limitations: sharedLimitations, unresolvedQuestions: ['How do other translations render the same name forms?', 'Which manuscript or critical edition should anchor lexical analysis?'], relatedSlugs: ['who-are-the-alvars', 'what-is-the-nalayira-divya-prabandham', 'tamil-divine-name-families'], mayonSlugs: ['mayon-and-tirumal', 'mayon-names-mal-tirumal-netiyon'], keywords: ['Nammāḻvār', 'Tiruvāymoḻi', 'Māyan', 'Tamil bhakti'] }),
  topic({ slug: 'from-sangam-poetics-to-alvar-bhakti', title: 'From Sangam poetics to Āḻvār bhakti', shortTitle: 'Continuity and transformation', question: 'What can be connected without claiming unchanged survival?', description: 'Literary continuity, transformed voice, temple localization, and the limits of direct-descent narratives.', directAnswer: 'Scholars can trace literary continuities from akam and tiṇai poetics into later Tamil bhakti: intimate voice, longing, place, separation, and reunion can be reused or transformed in devotion. The Āḻvār corpus is nevertheless historically and institutionally distinct, with named temple localization and later canonical reception. Shared forms support a history of literary transformation, not proof of one unchanged religion or direct cultic descent.', answerClass: 'attributed-interpretation', claimIds: ['akam-bhakti-literary-continuity', 'alvar-corpus', 'tiruvaymoli-temple-localization'], comparison: { left: 'Literary continuity', right: 'Unchanged religious identity', finding: 'The first is supported as an attributed scholarly argument; the second exceeds the inspected evidence.', boundary: 'Formal inheritance, thematic reuse, and historical continuity are not interchangeable claims.' }, limitations: sharedLimitations, unresolvedQuestions: ['Which intermediate texts document the transformation?', 'How do temple institutions alter the inherited poetic grammar?'], relatedSlugs: ['tinai-as-a-poetic-system', 'who-are-the-alvars', 'nammalvar-and-the-tiruvaymoli'], mayonSlugs: ['mayon-and-tirumal', 'mayon-sacred-space-and-temple-sites'], keywords: ['Sangam poetics', 'Āḻvār bhakti', 'akam', 'literary continuity'] }),
] as const

export const tamilClassicalTopicPath = (value: Pick<TamilClassicalTopic, 'slug'>) => `${TAMIL_CLASSICAL_PATH}/${value.slug}`

export interface TamilClassicalAnswerEntry {
  id: string
  question: string
  topicSlug: string
  answerClass: TamilClassicalAnswerClass
  answer: string
  claimIds: readonly string[]
  citations: readonly { sourceId: string; title: string; url: string; locator: string; frame: TamilClassicalEvidenceFrame }[]
  limitations: readonly string[]
  notEstablished: string
  relatedPaths: readonly string[]
}

const cohortSlugs = cohort.topicSlugs as string[]
const cohortQuestions = cohort.queries as string[]

export const TAMIL_CLASSICAL_ANSWERS: readonly TamilClassicalAnswerEntry[] = cohortQuestions.map((question, index) => {
  const topicSlug = cohortSlugs[Math.floor(index / 5)]
  const selectedTopic = TAMIL_CLASSICAL_TOPICS.find((candidate) => candidate.slug === topicSlug)
  if (!selectedTopic) throw new Error(`Unknown frozen Tamil-classical topic: ${topicSlug}`)
  const claims = selectedTopic.claimIds.map((claimId) => {
    const selectedClaim = TAMIL_CLASSICAL_CLAIMS.find((candidate) => candidate.id === claimId)
    if (!selectedClaim) throw new Error(`Unknown Tamil-classical claim: ${claimId}`)
    return selectedClaim
  })
  const citations = [...new Set(claims.flatMap((item) => item.sourceIds))].map((sourceId) => {
    const source = TAMIL_CLASSICAL_SOURCES.find((candidate) => candidate.id === sourceId)
    if (!source) throw new Error(`Unknown Tamil-classical source: ${sourceId}`)
    return {
      sourceId,
      title: source.title,
      url: source.url,
      frame: source.frame,
      locator: claims.filter((item) => item.sourceIds.includes(sourceId)).map((item) => item.sourceLocators[sourceId]).join('; '),
    }
  })
  return {
    id: `tamil-classical-q${String(index + 1).padStart(3, '0')}`,
    question,
    topicSlug,
    answerClass: selectedTopic.answerClass,
    answer: selectedTopic.directAnswer,
    claimIds: selectedTopic.claimIds,
    citations,
    limitations: selectedTopic.limitations,
    notEstablished: selectedTopic.comparison.boundary,
    relatedPaths: selectedTopic.relatedSlugs.map((slug) => `${TAMIL_CLASSICAL_PATH}/${slug}`),
  }
})

export const TAMIL_CLASSICAL_QUALITY = TAMIL_CLASSICAL_TOPICS.map((selectedTopic) => {
  const claims = selectedTopic.claimIds.map((id) => TAMIL_CLASSICAL_CLAIMS.find((candidate) => candidate.id === id))
  const sources = claims.flatMap((item) => item?.sourceIds ?? []).map((id) => TAMIL_CLASSICAL_SOURCES.find((candidate) => candidate.id === id))
  const blockers: string[] = []
  if (claims.some((item) => !item) || claims.length < 2) blockers.push('insufficient-claim-coverage')
  if (sources.some((item) => !item?.contentInspected || !item.explanatoryEligible)) blockers.push('uninspected-source')
  if (selectedTopic.directAnswer.length < 220) blockers.push('thin-direct-answer')
  if (selectedTopic.limitations.length < 3) blockers.push('insufficient-limitations')
  if (selectedTopic.unresolvedQuestions.length < 2) blockers.push('insufficient-open-questions')
  if (selectedTopic.relatedSlugs.length < 3) blockers.push('insufficient-related-topics')
  if (selectedTopic.mayonSlugs.length < 1) blockers.push('missing-mayon-bridge')
  const dimensions = [selectedTopic.question, selectedTopic.directAnswer, claims.length >= 2, selectedTopic.comparison.finding, selectedTopic.comparison.boundary, selectedTopic.limitations.length >= 3, selectedTopic.unresolvedQuestions.length >= 2, selectedTopic.relatedSlugs.length >= 3, sources.length >= 2].filter(Boolean).length
  if (dimensions < 9) blockers.push('insufficient-information-value')
  return { topicSlug: selectedTopic.slug, eligible: blockers.length === 0, claimCoverage: claims.filter(Boolean).length, informationDimensions: dimensions, blockers }
})

export const TAMIL_CLASSICAL_PUBLIC_REGISTRY = {
  version: TAMIL_CLASSICAL_VERSION,
  name: 'Classical Tamil religion and reception answer registry',
  purpose: 'Answer source-led questions about landscape deities, Paripāṭal, Tamil divine epithets, and Āḻvār reception without merging primary wording, translation, commentary, and historical interpretation.',
  evidenceFrames: {
    primaryText: 'Establishes wording in the named electronic edition and passage.',
    primaryTextInTranslation: 'Establishes the named translator’s rendering of a specified passage.',
    scholarlyInterpretation: 'Carries an attributed argument within the inspected pages and stated boundary.',
  },
  sources: TAMIL_CLASSICAL_SOURCES,
  claims: TAMIL_CLASSICAL_CLAIMS,
  quality: TAMIL_CLASSICAL_QUALITY,
  topics: TAMIL_CLASSICAL_TOPICS.map((selectedTopic) => ({ ...selectedTopic, path: tamilClassicalTopicPath(selectedTopic), mayonPaths: selectedTopic.mayonSlugs.map((slug) => `/knowledge/religion/mayon/${slug}`) })),
  answers: TAMIL_CLASSICAL_ANSWERS,
  prohibitedInferences: [
    'A later commentarial identity is a word printed in the earlier stanza.',
    'A shared divine name proves semantic identity in every passage and period.',
    'Literary continuity proves unchanged cult, theology, institution, or ethnic ownership.',
    'A primary text or translation verifies its own metaphysical propositions as external facts.',
    'Traditional compilation history is independently verified chronology.',
  ],
} as const

export const TAMIL_CLASSICAL_REGISTRY_DIGEST = provenanceDigest(TAMIL_CLASSICAL_PUBLIC_REGISTRY)

export function getTamilClassicalTopic(slug: string): TamilClassicalTopic | undefined {
  return TAMIL_CLASSICAL_TOPICS.find((candidate) => candidate.slug === slug)
}

export function getTamilClassicalAnswers(topicSlug: string): readonly TamilClassicalAnswerEntry[] {
  return TAMIL_CLASSICAL_ANSWERS.filter((entry) => entry.topicSlug === topicSlug)
}

export function answerTamilClassicalQuestion(question: string): TamilClassicalAnswerEntry | undefined {
  const normalized = question.normalize('NFC').trim().toLocaleLowerCase('en-US').replace(/[?.!]+$/u, '')
  return TAMIL_CLASSICAL_ANSWERS.find((entry) => entry.question.normalize('NFC').trim().toLocaleLowerCase('en-US').replace(/[?.!]+$/u, '') === normalized)
}

function assertTamilClassicalCorpus() {
  if (!cohort.frozen || cohortSlugs.length !== 16 || cohortQuestions.length !== 80) throw new Error('The Tamil-classical cohort must remain frozen at 16 topics and 80 questions.')
  if (TAMIL_CLASSICAL_TOPICS.length !== 16 || TAMIL_CLASSICAL_ANSWERS.length !== 80) throw new Error('Every frozen Tamil-classical topic and question must be implemented.')
  if (new Set(TAMIL_CLASSICAL_TOPICS.map((item) => item.slug)).size !== 16) throw new Error('Duplicate Tamil-classical topic slug.')
  if (new Set(TAMIL_CLASSICAL_ANSWERS.map((item) => item.question.normalize('NFC').toLocaleLowerCase('en-US'))).size !== 80) throw new Error('Duplicate Tamil-classical question.')
  if (!TAMIL_CLASSICAL_QUALITY.every((item) => item.eligible)) throw new Error(`Ineligible Tamil-classical topic: ${JSON.stringify(TAMIL_CLASSICAL_QUALITY.filter((item) => !item.eligible))}`)
  const topicSlugs = new Set(TAMIL_CLASSICAL_TOPICS.map((item) => item.slug))
  const mayonSlugs = new Set(['who-is-mayon', 'mayon-in-the-tolkappiyam', 'mayon-and-mullai', 'the-four-landscape-deity-sequence', 'tirumal-in-the-paripatal', 'mayon-and-tirumal', 'mayon-and-vishnu', 'mayon-and-krishna', 'mayon-and-balarama-valiyon', 'mayon-and-ceyon-murukan', 'mayon-names-mal-tirumal-netiyon', 'mayon-attributes-and-iconography', 'mayon-sacred-space-and-temple-sites', 'mayon-dravidian-god-question', 'mayon-volcano-disambiguation'])
  for (const selectedTopic of TAMIL_CLASSICAL_TOPICS) {
    if (!selectedTopic.relatedSlugs.every((slug) => topicSlugs.has(slug))) throw new Error(`${selectedTopic.slug} has an unknown related topic.`)
    if (!selectedTopic.mayonSlugs.every((slug) => mayonSlugs.has(slug))) throw new Error(`${selectedTopic.slug} has an unknown Māyōṉ bridge.`)
  }
  for (const item of TAMIL_CLASSICAL_CLAIMS) {
    if (new Set(item.sourceIds).size !== item.sourceIds.length) throw new Error(`${item.id} repeats a source.`)
    if (Object.keys(item.sourceLocators).sort().join('|') !== [...item.sourceIds].sort().join('|')) throw new Error(`${item.id} lacks source-specific locators.`)
  }
}

assertTamilClassicalCorpus()
