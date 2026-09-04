export const MAYON_KNOWLEDGE_VERSION = 'mayon-knowledge/0.2' as const
export const MAYON_KNOWLEDGE_PATH = '/knowledge/religion/mayon' as const
export const MAYON_KNOWLEDGE_DATE = '2026-09-04' as const

export type MayonEvidenceFrame = 'primary-text' | 'scholarly-interpretation' | 'bibliographic-record'
export type MayonRelationship =
  | 'name-used-in-the-same-cultic-complex'
  | 'traditional-identification'
  | 'mythic-parallel'
  | 'contrastive-co-attestation'
  | 'associated-figure'

export type MayonModernBridgeRelationship =
  | 'namesake-disambiguation'
  | 'modern-educational-application'
  | 'modern-editorial-bridge'

export interface MayonSource {
  id: string
  title: string
  publisher: string
  url: string
  version: string
  inspectedLocator: string
  frame: MayonEvidenceFrame
  contentInspected: boolean
  explanatoryEligible: boolean
  rightsBasis: string
  establishes: string
  boundary: string
}

export const MAYON_SOURCES: readonly MayonSource[] = [
  {
    id: 'tolkappiyam-porul-5',
    title: 'Tolkāppiyam III: Poruḷatikāram',
    publisher: 'Project Madurai edition preserved by the Göttingen Register of Electronic Texts in Indian Languages',
    url: 'https://textgridrep.org/browse/49tqk.0',
    version: 'TextGrid version dated 2025-05-27; Project Madurai base text prepared 1999–2001',
    inspectedLocator: 'Akattiṇaiyiyal, nūṟpā 5, lines beginning “māyōṉ mēya kāṭu uṟai ulakamum”',
    frame: 'primary-text',
    contentInspected: true,
    explanatoryEligible: true,
    rightsBasis: 'CC BY-NC-SA 4.0 for the TextGrid representation; short quotation with attribution',
    establishes: 'This edition prints Māyōṉ in the four-landscape sequence and associates him with the forest or pastoral world identified as mullai.',
    boundary: 'The stanza establishes its own wording and literary classification. It does not date the passage, reconstruct a prehistoric cult, or prove that every later figure called Tirumāl, Vishnu, or Krishna is identical to Māyōṉ in every period.',
  },
  {
    id: 'paripatal-project-madurai',
    title: 'Paripāṭal and Paripāṭal Tiraṭṭu',
    publisher: 'Project Madurai',
    url: 'https://www.projectmadurai.org/pm_etexts/utf8/pmuni0087.html',
    version: 'Unicode Tamil edition first published 2000; page copyright notice updated through 2021',
    inspectedLocator: 'Tirumāl poems 1–4 and 13 in the electronic text; especially poem 2 lines 20–25 and poem 3 lines 31–40',
    frame: 'primary-text',
    contentInspected: true,
    explanatoryEligible: true,
    rightsBasis: 'Project Madurai permits free distribution with its header intact; brief cited excerpts only',
    establishes: 'The surviving anthology contains hymnic material addressed to Tirumāl and records names, attributes, weapons, associated figures, and mythic allusions within those poems.',
    boundary: 'A devotional poem establishes what its speaker praises and narrates. It does not by itself establish historical events, a single system shared by every worshipper, or the direction in which Tamil and Sanskrit traditions influenced one another.',
  },
  {
    id: 'yamashita-1995-mayon-tirumal',
    title: 'Some Remarks on Tirumāl/Viṣṇu Cult in Early Tamil Religion and Literature',
    publisher: 'The Institute of Oriental Culture, University of Tokyo',
    url: 'https://repository.dl.itc.u-tokyo.ac.jp/record/27137/files/ioc12604.pdf',
    version: 'Departmental bulletin paper, volume 126 (1995), repository record DOI 10.15083/00027128',
    inspectedLocator: 'pp. 73–84: section I; section II introduction; section II.A.1–4; tables I–II',
    frame: 'scholarly-interpretation',
    contentInspected: true,
    explanatoryEligible: true,
    rightsBasis: 'Open university repository copy; paraphrase and limited quotation with attribution',
    establishes: 'Yamashita surveys early Tamil references to Māyōṉ–Tirumāl and compares the Paripāṭal material with Vishnu–Nārāyaṇa–Vāsudeva–Krishna traditions, identifying both parallels and differences.',
    boundary: 'This is one scholar’s reconstruction from literary evidence. Its proposed identifications and directions of influence remain interpretations, and the paper itself repeatedly distinguishes explicit wording from allusion and commentary.',
  },
  {
    id: 'subbiah-1988-early-south-india',
    title: 'Patterns in Religious Thought in Early South India: A Study of Classical Tamil Texts',
    publisher: 'McMaster University Open Access Dissertations and Theses',
    url: 'https://macsphere.mcmaster.ca/items/cb7a8643-b50b-447e-8964-7220a7ad2870',
    version: 'PhD dissertation submitted August 1988; repository scan made available through MacSphere',
    inspectedLocator: 'printed pp. 64–66, 71–74, 98–114, 150–154, and 218–221 of the repository scan',
    frame: 'scholarly-interpretation',
    contentInspected: true,
    explanatoryEligible: true,
    rightsBasis: 'Open university repository copy; paraphrase and limited quotation with page-level attribution',
    establishes: 'Subbiah analyzes the landscape-deity stanza, the surviving Paripāṭal corpus, named Tirumāl sites, sacred-space poetics, king-and-god comparisons, and the ambiguity of some divine or royal epithets.',
    boundary: 'This dissertation is a scholarly synthesis, not a manuscript witness or archaeological report. Its translations, site identifications, historical framing, and assessments of earlier scholarship remain attributed interpretations.',
  },
  {
    id: 'cict-paripatal-catalogue',
    title: 'Paripāṭal related E-books',
    publisher: 'Central Institute of Classical Tamil, Ministry of Education, Government of India',
    url: 'https://library.cict.in/41-6-pari.html',
    version: 'Public institutional catalogue page inspected 2026-09-04',
    inspectedLocator: 'About Ettuthokai–Paripāṭal and the table of downloadable editions',
    frame: 'bibliographic-record',
    contentInspected: false,
    explanatoryEligible: false,
    rightsBasis: 'Public government-institution catalogue; metadata is paraphrased and linked, with no full text reproduced',
    establishes: 'The catalogue records its own inventory of available Paripāṭal poems, subject counts, named poets and musicians, and editions offered by the institute.',
    boundary: 'This is a bibliographic control, not an inspected primary text or interpretive study. It may explain why published counts use different edition scopes, but it cannot support claims about Māyōṉ’s nature, history, or theology.',
  },
] as const

export interface MayonClaim {
  id: string
  heading: string
  statement: string
  frame: MayonEvidenceFrame
  sourceIds: readonly string[]
  locator: string
  sourceLocators: Readonly<Record<string, string>>
  limitation: string
}

export const MAYON_CLAIMS: readonly MayonClaim[] = [
  {
    id: 'mayon-mullai',
    heading: 'The earliest anchor is a literary landscape',
    statement: 'In the inspected Tolkāppiyam edition, Māyōṉ is named in the sequence of deities associated with four tiṇai and is attached to the forest or pastoral world, mullai.',
    frame: 'primary-text',
    sourceIds: ['tolkappiyam-porul-5'],
    locator: 'Akattiṇaiyiyal 5, first and fifth lines of the stanza',
    sourceLocators: { 'tolkappiyam-porul-5': 'Akattiṇaiyiyal 5, first and fifth lines of the stanza' },
    limitation: 'This is an attestation inside a poetics and classification text. “God of the pastoral land” is a bounded description of that association, not a complete biography or an uncontested ethnic origin claim.',
  },
  {
    id: 'four-landscape-sequence',
    heading: 'Māyōṉ appears in a contrastive system',
    statement: 'The same stanza places Cēyōṉ, Vēntaṉ, and Varuṇaṉ alongside Māyōṉ and maps the four names to kuṟiñci, marutam, and neytal as well as mullai.',
    frame: 'primary-text',
    sourceIds: ['tolkappiyam-porul-5'],
    locator: 'Akattiṇaiyiyal 5, complete six-line deity-and-landscape sequence',
    sourceLocators: { 'tolkappiyam-porul-5': 'Akattiṇaiyiyal 5, complete six-line deity-and-landscape sequence' },
    limitation: 'Co-attestation creates a literary relation, not identity, genealogy, or proof that each name had one uniform cult across Tamilakam.',
  },
  {
    id: 'tirumal-hymnic-corpus',
    heading: 'The Paripāṭal supplies a denser Tirumāl dossier',
    statement: 'The extant Paripāṭal contains six complete odes and one fragment treated by Yamashita as Tirumāl material; the poems preserve weapons, companions, incarnational allusions, praise language, and cosmological motifs rather than one systematic account.',
    frame: 'scholarly-interpretation',
    sourceIds: ['paripatal-project-madurai', 'yamashita-1995-mayon-tirumal'],
    locator: 'Yamashita p. 77 and p. 78 opening paragraph; Project Madurai Tirumāl poem headings',
    sourceLocators: {
      'paripatal-project-madurai': 'Tirumāl poems 1–4 and 13, poem headings and opening colophons',
      'yamashita-1995-mayon-tirumal': 'p. 77 and p. 78 opening paragraph',
    },
    limitation: 'The count concerns the extant anthology, not its legendary original size. The surviving descriptions are fragmentary and frequently allusive.',
  },
  {
    id: 'visnu-relationship',
    heading: 'The Vishnu relationship is strong but historically typed',
    statement: 'Yamashita describes Tirumāl as traditionally identified with Vishnu and reads several early Tamil motifs—disc, conch, serpent repose, lotus-navel, three strides, and named adversaries—as parallels to Vishnu, Narayana, or Krishna materials.',
    frame: 'scholarly-interpretation',
    sourceIds: ['yamashita-1995-mayon-tirumal'],
    locator: 'Yamashita pp. 73–84, especially pp. 74–75 and tables I–II',
    sourceLocators: { 'yamashita-1995-mayon-tirumal': 'pp. 73–84, especially pp. 74–75 and tables I–II' },
    limitation: 'A parallel is not proof of a timeless one-to-one identity or of a single direction of borrowing. Some identifications rely on later commentators, and the article marks several readings as probable or allusive.',
  },
  {
    id: 'balarama-valiyon',
    heading: 'Balarama or Vāliyoṉ remains a related figure, not a synonym',
    statement: 'The inspected scholarship reads Paripāṭal passages about a plough-bearing aspect and the figure Vāliyoṉ in relation to Balarama, while preserving separate names and verse locations.',
    frame: 'scholarly-interpretation',
    sourceIds: ['yamashita-1995-mayon-tirumal', 'paripatal-project-madurai'],
    locator: 'Yamashita pp. 74 and 78–80; Paripāṭal poem 2 lines 20–25 and poem 13 lines 30–33',
    sourceLocators: {
      'yamashita-1995-mayon-tirumal': 'printed pp. 74 and 78–80, Balarama and Vāliyoṉ discussion',
      'paripatal-project-madurai': 'Tirumāl poem 2 lines 20–25 and poem 13 lines 30–33',
    },
    limitation: 'The relationship is reconstructed from attributes and commentary. It must not be flattened into “Māyōṉ is Balarama.”',
  },
  {
    id: 'commentarial-identification-layer',
    heading: 'The stanza and its identifications belong to different evidentiary layers',
    statement: 'Subbiah prints the Tolkāppiyam landscape stanza and then separately reports that medieval and modern commentators identify Māyōṉ with Māl or Vishnu, Cēyōṉ with Murukan, Vēntaṉ with Indra, and Varuṇaṉ with Varuna.',
    frame: 'scholarly-interpretation',
    sourceIds: ['tolkappiyam-porul-5', 'subbiah-1988-early-south-india'],
    locator: 'Subbiah printed pp. 64–66, immediately after his translation of Tolkāppiyam Poruḷatikāram Akattiṇaiyiyal 5',
    sourceLocators: {
      'tolkappiyam-porul-5': 'Akattiṇaiyiyal 5, complete six-line deity-and-landscape sequence',
      'subbiah-1988-early-south-india': 'printed pp. 64–66, immediately after the translation of Tolkāppiyam Poruḷatikāram Akattiṇaiyiyal 5',
    },
    limitation: 'The deity names and landscapes occur in the stanza; the four equations are reported from commentary. A careful answer must not quote a later identification as though it were explicit wording in the earlier verse.',
  },
  {
    id: 'paripatal-survival-and-counts',
    heading: 'Counts depend on what an edition includes',
    statement: 'Subbiah distinguishes the anthology’s reported original seventy poems, twenty-two transmitted poems, additional poems retrieved from commentaries, and an expanded group of twenty-five full-length poems that includes seven classified as Tirumāl poems.',
    frame: 'scholarly-interpretation',
    sourceIds: ['subbiah-1988-early-south-india'],
    locator: 'Subbiah printed pp. 71–74, including the subject table and the note on retrieved poems and fragments',
    sourceLocators: { 'subbiah-1988-early-south-india': 'printed pp. 71–74, including the subject table and the note on retrieved poems and fragments' },
    limitation: 'Six, seven, eight, twenty-two, twenty-four, and twenty-five can all describe different editorial denominators. None should be presented without naming whether it counts transmitted poems, retrieved poems, fragments, or the reported original collection.',
  },
  {
    id: 'paripatal-colophons-and-performance',
    heading: 'The anthology preserves an author-and-music apparatus',
    statement: 'Subbiah’s inventory says the Paripāṭal colophon names not only each poem’s author but also the person who set its music, and he characterizes the Tirumāl and Cevvēḷ poems as hymnic material likely intended for choral singing or chanting.',
    frame: 'scholarly-interpretation',
    sourceIds: ['subbiah-1988-early-south-india', 'paripatal-project-madurai'],
    locator: 'Subbiah printed pp. 72–74 and 106–107; Project Madurai poem headings and colophons',
    sourceLocators: {
      'subbiah-1988-early-south-india': 'printed pp. 72–74 and 106–107, colophon and performance discussion',
      'paripatal-project-madurai': 'Tirumāl poems 1–4 and 13, poem headings and colophons',
    },
    limitation: 'The preserved colophon is direct bibliographic evidence within an edition; the reconstruction of performance setting is scholarly interpretation. Neither establishes a single ritual practice for every poem or audience.',
  },
  {
    id: 'irunkunram-dark-white-pair',
    heading: 'Irunkuṉṟam preserves a paired but differentiated image',
    statement: 'In Subbiah’s discussion of Paripāṭal 15, Irunkuṉṟam is the abode of a dark and a white figure interpreted as Vishnu and Balarama; their appearances differ while the poem compares the relation of their actions to word and meaning.',
    frame: 'scholarly-interpretation',
    sourceIds: ['subbiah-1988-early-south-india', 'paripatal-project-madurai'],
    locator: 'Subbiah printed pp. 107–109, citing Paripāṭal 15:1–18, 33–37, and 46–48',
    sourceLocators: {
      'subbiah-1988-early-south-india': 'printed pp. 107–109, discussion and translation of Paripāṭal 15:1–18, 33–37, and 46–48',
      'paripatal-project-madurai': 'Tirumāl poem 15 lines 1–18, 33–37, and 46–48',
    },
    limitation: 'The passage supports association and poetic pairing at a named site. It does not make the two figures synonyms, prove that one developed from the other, or license every later Vishnu–Balarama doctrine.',
  },
  {
    id: 'sacred-space-mountain-and-deity',
    heading: 'Sacred space is made through more than a location label',
    statement: 'Subbiah reads Paripāṭal 15 as moving from Māl’s residence at Irunkuṉṟam to language that treats the mountain itself as divine, making sight, approach, praise, and family pilgrimage part of the poem’s sacred-space construction.',
    frame: 'scholarly-interpretation',
    sourceIds: ['subbiah-1988-early-south-india', 'paripatal-project-madurai'],
    locator: 'Subbiah printed pp. 107–109, especially his analysis after Paripāṭal 15:1–18 and 33–48',
    sourceLocators: {
      'subbiah-1988-early-south-india': 'printed pp. 107–109, especially the analysis after Paripāṭal 15:1–18 and 33–48',
      'paripatal-project-madurai': 'Tirumāl poem 15 lines 1–18 and 33–48',
    },
    limitation: 'This is an interpretation of the poem’s spatial rhetoric. It does not independently date a temple structure, prove continuous occupation, or identify every geographical name with a modern site.',
  },
  {
    id: 'tirumal-transcendent-and-local',
    heading: 'The corpus can present transcendence and local presence together',
    statement: 'Subbiah notes that five Tirumāl poems do not name an earthly abode, yet reads the collection as combining a formless or universal divinity with a deity available under different names at specific trees, mountains, islands, and other places.',
    frame: 'scholarly-interpretation',
    sourceIds: ['subbiah-1988-early-south-india', 'paripatal-project-madurai'],
    locator: 'Subbiah printed pp. 113–114, discussing Paripāṭal poems 1–4 and 13 and translating a passage from poem 4',
    sourceLocators: {
      'subbiah-1988-early-south-india': 'printed pp. 113–114, discussion of Paripāṭal poems 1–4 and 13 and translation of a passage from poem 4',
      'paripatal-project-madurai': 'Tirumāl poems 1–4 and 13, especially poem 4',
    },
    limitation: 'The claim describes a tension within the inspected poetic corpus and Subbiah’s reading of it. It is not proof that all early Tamil worshippers held one systematic doctrine of omnipresence or incarnation.',
  },
  {
    id: 'site-identification-caution',
    heading: 'Modern site identifications remain arguments',
    statement: 'Subbiah reports the common association of Mālirunkuṉṟam or Irunkuṉṟam with Aḻakarmalai near Madurai, while also recording that the identification of the Murukan site Paḻamutircōlai with Aḻakarmalai is disputed for lack of early independent evidence.',
    frame: 'scholarly-interpretation',
    sourceIds: ['subbiah-1988-early-south-india'],
    locator: 'Subbiah printed pp. 98–99 and 106, with notes to Paripāṭal 15:17 and 22–23 and the site-identification literature',
    sourceLocators: { 'subbiah-1988-early-south-india': 'printed pp. 98–99 and 106, with notes to Paripāṭal 15:17 and 22–23 and the site-identification literature' },
    limitation: 'A literary place-name, a later temple, and a modern geographical identification are separate claims. The dissertation reports arguments about their relation; it does not turn any disputed match into a settled fact.',
  },
  {
    id: 'poetic-comparison-not-identity',
    heading: 'A god can function as a comparison without becoming the human subject',
    statement: 'Subbiah discusses Puṟanāṉūṟu 56 as comparing a king’s wrath, strength, fame, and determination with four divine figures, including Vāliyoṉ, Māyōṉ, and Murukan, within a conventional language of heroic praise.',
    frame: 'scholarly-interpretation',
    sourceIds: ['subbiah-1988-early-south-india'],
    locator: 'Subbiah printed pp. 218–220, citing Puṟanāṉūṟu 56:1–16 and Tolkāppiyam Poruḷatikāram Puṟattiṇaiyiyal 5:9–10',
    sourceLocators: { 'subbiah-1988-early-south-india': 'printed pp. 218–220, citing Puṟanāṉūṟu 56:1–16 and Tolkāppiyam Poruḷatikāram Puṟattiṇaiyiyal 5:9–10' },
    limitation: 'A simile or praise comparison establishes a literary use of the divine figure, not incarnation, genealogy, political theology shared by every poet, or the historicity of the divine action invoked.',
  },
  {
    id: 'netiyon-ambiguity',
    heading: 'Neṭiyōṉ must be resolved occurrence by occurrence',
    statement: 'Subbiah’s discussion of Neṭiyōṉ concludes that one difficult figure may allude to Vishnu, Krishna, or Paraśurāma, may be the god directly, or may be a historical person later imagined through Vaishnava terms; the evidence does not select one answer securely.',
    frame: 'scholarly-interpretation',
    sourceIds: ['subbiah-1988-early-south-india'],
    locator: 'Subbiah printed pp. 220–221, concluding discussion of Neṭiyōṉ’s identity after the king-and-god comparison',
    sourceLocators: { 'subbiah-1988-early-south-india': 'printed pp. 220–221, concluding discussion of Neṭiyōṉ’s identity after the king-and-god comparison' },
    limitation: 'The ambiguity is the result. An index that automatically maps every Neṭiyōṉ to Vishnu or to a human king would erase the unresolved alternatives the inspected scholarship explicitly preserves.',
  },
  {
    id: 'krishna-allusions',
    heading: 'Krishna connections range from named parallels to uncertain allusions',
    statement: 'Yamashita compares the horse-demon material and other Paripāṭal motifs with Krishna traditions, while repeatedly distinguishing explicit names and attributes from stories inferred through compressed poetic allusion or later commentary.',
    frame: 'scholarly-interpretation',
    sourceIds: ['yamashita-1995-mayon-tirumal'],
    locator: 'Yamashita pp. 78–84, especially the prose discussions accompanying tables I–II',
    sourceLocators: { 'yamashita-1995-mayon-tirumal': 'pp. 78–84, especially the prose discussions accompanying tables I–II' },
    limitation: 'These comparisons can support a typed mythic parallel, not the assertion that Māyōṉ is simply Krishna in every early occurrence or that the direction and date of transmission have been demonstrated.',
  },
  {
    id: 'attributes-need-claim-level-typing',
    heading: 'Attributes do not all carry the same evidentiary weight',
    statement: 'Across the inspected Paripāṭal text and Yamashita’s tables, dark color, disc, conch, serpent repose, eagle banner, lotus imagery, three strides, plough, and palm-tree banner attach to different figures, passages, and levels of interpretation.',
    frame: 'scholarly-interpretation',
    sourceIds: ['yamashita-1995-mayon-tirumal', 'paripatal-project-madurai'],
    locator: 'Yamashita pp. 74–84 and tables I–II; Project Madurai Tirumāl poems 2, 3, 4, 13, and 15',
    sourceLocators: {
      'yamashita-1995-mayon-tirumal': 'printed pp. 74–84 and tables I–II',
      'paripatal-project-madurai': 'Tirumāl poems 2, 3, 4, 13, and 15',
    },
    limitation: 'A feature may be explicit in one poem, supplied by commentary in another, or used by a scholar as a parallel. Listing attributes without those distinctions manufactures a composite portrait no single passage contains.',
  },
] as const

export interface MayonConnection {
  name: string
  tamil?: string
  relationship: MayonRelationship
  basis: string
  boundary: string
  sourceIds: readonly string[]
}

export const MAYON_CONNECTIONS: readonly MayonConnection[] = [
  { name: 'Tirumāl', tamil: 'திருமால்', relationship: 'name-used-in-the-same-cultic-complex', basis: 'The scholarship treats Māyōṉ–Tirumāl as a connected early Tamil complex, while the Paripāṭal headings and passages preserve Tirumāl or Māl forms in their own locations.', boundary: 'This label describes the corpus under study; it does not erase changes in name, context, or theology.', sourceIds: ['paripatal-project-madurai', 'yamashita-1995-mayon-tirumal', 'subbiah-1988-early-south-india'] },
  { name: 'Vishnu', relationship: 'traditional-identification', basis: 'Yamashita and Subbiah report the traditional identification and document shared iconographic, mythic, and sacred-place elements in early Tamil literature.', boundary: 'Traditional identification is historically important evidence, not proof that every attestation began as the same concept.', sourceIds: ['yamashita-1995-mayon-tirumal', 'subbiah-1988-early-south-india'] },
  { name: 'Krishna', relationship: 'mythic-parallel', basis: 'The paper connects the horse-demon Kūntal passage and other allusions with the Krishna cycle.', boundary: 'The article’s argument is interpretive; one parallel does not make every Māyōṉ passage a Krishna narrative.', sourceIds: ['yamashita-1995-mayon-tirumal'] },
  { name: 'Balarama / Vāliyoṉ', relationship: 'associated-figure', basis: 'The Paripāṭal and the inspected scholarship preserve plough-bearing, palm-banner, color-contrast, and Vāliyoṉ material adjacent to Tirumāl.', boundary: 'Association, adjacency, and a proposed incorporated aspect do not establish lexical identity or make Vāliyoṉ another unrestricted name for Māyōṉ.', sourceIds: ['paripatal-project-madurai', 'yamashita-1995-mayon-tirumal', 'subbiah-1988-early-south-india'] },
  { name: 'Cēyōṉ / Murukan', tamil: 'சேயோன்', relationship: 'contrastive-co-attestation', basis: 'Cēyōṉ follows Māyōṉ in the Tolkāppiyam landscape stanza and is associated there with kuṟiñci; Subbiah separately reports the commentarial Murukan identification.', boundary: 'The stanza distinguishes their landscapes; it supplies no genealogy between them.', sourceIds: ['tolkappiyam-porul-5', 'subbiah-1988-early-south-india'] },
  { name: 'Vēntaṉ', tamil: 'வேந்தன்', relationship: 'contrastive-co-attestation', basis: 'Vēntaṉ appears in the same four-landscape stanza and is associated with marutam.', boundary: 'The equation with Indra is a later or scholarly identification, not wording present in the inspected stanza itself.', sourceIds: ['tolkappiyam-porul-5', 'subbiah-1988-early-south-india'] },
  { name: 'Varuṇaṉ', tamil: 'வருணன்', relationship: 'contrastive-co-attestation', basis: 'Varuṇaṉ appears in the same stanza and is associated with neytal.', boundary: 'The co-attestation establishes the name and literary placement, not a complete history of Varuna worship; Subbiah notes the lack of matching references in the extant poems he surveys.', sourceIds: ['tolkappiyam-porul-5', 'subbiah-1988-early-south-india'] },
] as const

export interface MayonModernBridge {
  name: string
  path: string
  relationship: MayonModernBridgeRelationship
  basis: string
  boundary: string
}

/**
 * Contemporary Maha links are deliberately kept outside MAYON_CONNECTIONS.
 * They are navigation and editorial relationships, not claims about the
 * historical Māyōṉ tradition.
 */
export const MAYON_MODERN_BRIDGES: readonly MayonModernBridge[] = [
  {
    name: 'Mayon Volcano explorer',
    path: '/apps/mayon',
    relationship: 'namesake-disambiguation',
    basis: 'Maha also publishes an educational application named Mayon about Mayon Volcano in Bicol. The shared English spelling makes disambiguation useful to readers and machines.',
    boundary: 'This is a namesake link only. The inspected early Tamil sources do not establish an etymological, cultic, geographic, or historical relationship between Māyōṉ and Mayon Volcano.',
  },
  {
    name: 'Mayon Virtual Field Trip',
    path: '/projects/mayon',
    relationship: 'modern-educational-application',
    basis: 'The project documents how Maha represents Mayon Volcano, historical memory, uncertainty, and hazard boundaries in an educational model.',
    boundary: 'The project concerns a Philippine volcano and a modern educational model. It is not evidence about the Tamil deity and does not turn a shared name into a historical claim.',
  },
  {
    name: 'The Volcanic Engine',
    path: '/books/the-volcanic-engine',
    relationship: 'modern-editorial-bridge',
    basis: 'Maha’s open research edition supplies the broader volcanology context to which the Mayon Volcano project belongs.',
    boundary: 'This bridge organizes Maha’s contemporary knowledge system. It does not claim that volcanoes are an attribute, symbol, landscape, or origin of Māyōṉ in the inspected Tamil texts.',
  },
] as const

export const MAYON_OPEN_QUESTIONS = [
  'How should each early occurrence of Māyōṉ, Māl, Tirumāl, and Neṭiyōṉ be indexed without assuming that every epithet is interchangeable?',
  'Which proposed Vishnu, Krishna, Narayana, and Balarama parallels are explicit in the Tamil wording, which are allusions, and which enter through commentary?',
  'How do manuscript witnesses and modern editions differ at the relevant Tolkāppiyam and Paripāṭal passages?',
  'What can inscriptional, iconographic, and archaeological evidence add without being made to say what only literary texts state?',
  'How did later Āḻvār and Śrīvaiṣṇava traditions receive, reinterpret, or bypass the earlier Māyōṉ–Tirumāl material?',
] as const

export const MAYON_GOVERNANCE = {
  primaryTextClaims: MAYON_CLAIMS.filter((claim) => claim.frame === 'primary-text').length,
  scholarlyInterpretations: MAYON_CLAIMS.filter((claim) => claim.frame === 'scholarly-interpretation').length,
  claimsWithExactLocators: MAYON_CLAIMS.filter((claim) => claim.locator.length > 0).length,
  claimsWithBoundaries: MAYON_CLAIMS.filter((claim) => claim.limitation.length > 0).length,
  prohibitedInferences: [
    'Māyōṉ is proved to be an ethnically pure or isolated “Dravidian god.”',
    'Māyōṉ, Tirumāl, Vishnu, Krishna, and Balarama are interchangeable in every text and period.',
    'A devotional poem independently verifies the historical or supernatural event it narrates.',
    'A shared weapon, color, landscape, or story proves direct descent without further evidence.',
    'The shared spelling “Mayon” proves a relationship between Māyōṉ and Mayon Volcano.',
  ],
} as const

export function mayonSource(id: string): MayonSource | undefined {
  return MAYON_SOURCES.find((source) => source.id === id)
}
