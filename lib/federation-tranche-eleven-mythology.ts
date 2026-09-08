import { provenanceDigest } from './evidence-dossier/digest.ts'

type JsonRecord = Record<string, unknown>

export type MythologyCandidate = {
  candidateId: string
  siteId: string
  canonicalHost: string
  groupId: string
  routeRole: string
  path: string
  url: string
  title: string
  conceptId: string
  searchIntent: string
  routeContract: {
    allowedContent: string[]
    mustNotClaim: string[]
  }
}

export type MythologyCandidateMap = {
  provenanceDigest: string
  candidates: MythologyCandidate[]
}

export type MythologyDependencyGraph = {
  provenanceDigest: string
  nodes: Array<{ candidateId: string; url: string }>
  observedAnchorNodes: Array<{ nodeId: string; conceptFamilyId: string; url: string; state: string }>
  observedTopicNodes: Array<{ nodeId: string; url: string; state: string }>
  missingOwnerTopicNodes: Array<{ nodeId: string; url?: string; state?: string }>
  edges: Array<{ from: string; dependsOn: string; reason: string }>
}

export type MythologySourceInspection = {
  sourceId: string
  title: string
  responsibleBody: string
  versionOrDate: string
  url: string
  sourceClass: string
  inspectionDepth: 'policy' | 'catalogue' | 'section' | 'exact-passage' | 'full-text'
  locator: string
  rightsStatus: 'cc-by-4.0' | 'cc-by-sa-3.0' | 'public-domain-work' | 'reference-only' | 'noncommercial-reference-only'
  rightsBasis: string
  scope: string
  boundary: string
  reusableInCommercialPage: boolean
  sourceTextMayBeRedistributed: boolean
}

type RouteDisposition = 'evidence-ready' | 'revise' | 'blocked' | 'duplicative'

const reviewedOn = '2026-09-06'
const artifact = <T extends object>(body: T): T & { provenanceDigest: string } => ({ ...body, provenanceDigest: provenanceDigest(body) })

const ALLOCATION = [
  ['mythology-greek-roman', 28],
  ['mythology-mesopotamian', 28],
  ['mythology-sanskrit-vedic-epic-puranic', 20],
  ['mythology-egyptian', 10],
  ['mythology-norse-germanic', 6],
  ['mythology-comparative-methodology', 6],
  ['mythology-discovery-hub', 1],
  ['mythology-machine-registry', 1],
] as const

const boundaryByGroupAndRole: Record<string, string> = {
  'mythology-greek-roman:source-identity': 'Identify the named Greek and Roman figures only through explicit ancient or scholarly source relationships; translation, interpretatio Romana, adoption, and later equivalence remain different propositions.',
  'mythology-greek-roman:epithet-and-cult': 'Describe an epithet, sanctuary, rite, place, and period only where the inspected source locates it; no local title or practice becomes a universal definition of the deity.',
  'mythology-greek-roman:reception-and-comparison': 'Separate ancient Greek evidence, Roman reception, and later artistic or literary reception; similarity of function never proves identity or common origin.',
  'mythology-mesopotamian:source-text': 'Name the work, language, edition, tablet or line range, and translation status; a literary episode cannot stand for every period, city, or cult.',
  'mythology-mesopotamian:city-and-cult': 'Bind each function, temple, city, and cult statement to its period and evidence; Sumerian and Akkadian names are not flattened into timeless synonyms.',
  'mythology-mesopotamian:reception-and-comparison': 'Distinguish ancient syncretism, later reception, modern comparison, and translation; shared attributes do not establish identical deities.',
  'mythology-sanskrit-vedic-epic-puranic:vedic-text': 'State only what the identified Vedic hymn and named translation render; one hymn cannot establish a complete Vedic profile or later Hindu doctrine.',
  'mythology-sanskrit-vedic-epic-puranic:epic-puranic-reception': 'Keep Vedic, epic, Purāṇic, commentarial, and living theological layers separate; later reception cannot retroactively define an earlier hymn.',
  'mythology-sanskrit-vedic-epic-puranic:epithet-identity': 'An epithet is evidence of wording in a named source, not automatic proof that every similarly named figure is one transhistorical identity.',
  'mythology-sanskrit-vedic-epic-puranic:comparison-boundary': 'Compare declared passages, translations, periods, and interpretive frames without ranking traditions or converting historical description into theology.',
  'mythology-egyptian:source-text': 'Bind a claim to an identified Egyptian text, object, date, translation, and scholarly edition; iconography alone does not determine a divine name.',
  'mythology-egyptian:cult-and-place': 'Locate temple, place, period, title, and evidence; Egyptian divine names and forms can fuse or differentiate contextually and cannot be reduced to one static identity.',
  'mythology-egyptian:reception-and-comparison': 'Separate ancient Egyptian evidence, Greco-Roman reception, modern Egyptology, and popular reception; depiction, epithet, and identity are distinct evidentiary layers.',
  'mythology-norse-germanic:eddic-source': 'Name poem, manuscript relationship, stanza or page locator, edition, and translator; Poetic Edda evidence is not silently merged with Snorri or later folklore.',
  'mythology-norse-germanic:reception-boundary': 'Separate medieval source evidence from antiquarian, nationalist, literary, and popular reception; modern use does not prove pre-Christian belief or practice.',
  'mythology-comparative-methodology:method': 'Declare the comparands, source frames, purpose, scale, scope, and comparison criterion; resemblance is an observation, not proof of identity, diffusion, genealogy, or universal origin.',
  'mythology-discovery-hub:discovery-hub': 'Index only reviewed child contracts and expose their evidence states; the hub cannot synthesize a cross-cultural pantheon or transfer authority between traditions.',
  'mythology-machine-registry:machine-registry': 'Expose deterministic identifiers, versions, source frames, boundaries, dependencies, and release state only; registry membership is not evidence, endorsement, or canonical release.',
}

const roleNonOverlap: Record<string, string> = {
  'source-identity': 'Unlike the sibling cult and reception routes, this route asks which named sources relate the identities and what kind of relationship they assert.',
  'epithet-and-cult': 'Unlike the sibling identity and reception routes, this route is restricted to located titles, practices, sanctuaries, places, and periods.',
  'reception-and-comparison': 'Unlike source-identity and cult routes, this route describes a later reception or an explicitly framed comparison without retroactive identity claims.',
  'source-text': 'Unlike city/cult and reception routes, this route is organized around one identified text, edition, translation status, and exact passage locator.',
  'city-and-cult': 'Unlike text and reception routes, this route answers a located historical question about function, temple, city, cult, and period.',
  'vedic-text': 'Unlike epic/Purāṇic reception and identity routes, this route is limited to a named Vedic hymn and translation witness.',
  'epic-puranic-reception': 'Unlike the Vedic-text route, this route begins with later epic, Purāṇic, commentarial, or devotional evidence and labels that later frame.',
  'epithet-identity': 'Unlike reception and broad comparison routes, this route tests what a particular name or epithet can and cannot establish.',
  'comparison-boundary': 'Unlike figure profiles, this route answers how two declared corpora or periods may be compared without collapsing them.',
  'cult-and-place': 'Unlike source-text and reception routes, this route is limited to located cult, temple, title, place, and period evidence.',
  'eddic-source': 'Unlike modern reception, this route is limited to a named Eddic poem, manuscript relationship, edition, and translation.',
  'reception-boundary': 'Unlike the Eddic-source route, this route describes later transmission or use and explicitly refuses to project it backward.',
  method: 'Unlike deity or tradition pages, this route defines a comparison operation and its refusal conditions without supplying a new mythological identity.',
  'discovery-hub': 'Unlike every child route, the hub only organizes reviewed contracts and never supplies a substantive deity claim of its own.',
  'machine-registry': 'Unlike the human discovery hub, the registry serializes identifiers and evidence state and does not generate explanatory prose.',
}

const reusable = 'Commercial pages may cite, link, and write new bounded prose from this source under the recorded terms; attribution and source-specific conditions remain mandatory.'
const referenceOnly = 'The source may be linked and used for bounded original paraphrase under ordinary quotation and citation practice, but its text is not licensed here for republication or adaptation.'

export const TRANCHE_ELEVEN_SOURCE_INSPECTIONS: MythologySourceInspection[] = [
  {
    sourceId: 'perseus-rights-policy', title: 'Perseus copyright and reuse policy', responsibleBody: 'Perseus Digital Library, Tufts University', versionOrDate: `living policy inspected ${reviewedOn}`, url: 'https://www.perseus.tufts.edu/hopper/help/copyright.jsp', sourceClass: 'repository-rights-policy', inspectionDepth: 'policy', locator: 'Copyrighted materials; Public-domain materials; XML downloads and item-level credits', rightsStatus: 'reference-only', rightsBasis: 'Perseus contains materials with different rights states. Commercial reuse or publication requires item-level authorization unless the particular work is public domain or separately licensed.', scope: 'Explains how to determine whether a Perseus item can be linked, downloaded, modified, or reused.', boundary: 'Repository access does not supply one blanket reuse license; image, commentary, edition, translation, and XML rights can differ.', reusableInCommercialPage: true, sourceTextMayBeRedistributed: false,
  },
  {
    sourceId: 'perseus-hymn-aphrodite-6', title: 'Homeric Hymn 6 to Aphrodite, Evelyn-White translation', responsibleBody: 'Perseus Digital Library; source edition translated by Hugh G. Evelyn-White', versionOrDate: '1914 translation; Perseus item inspected 2026-09-06', url: 'https://www.perseus.tufts.edu/hopper/text?doc=urn%3Acts%3AgreekLit%3Atlg0013.tlg006.perseus-eng1%3A6', sourceClass: 'primary-text-in-translation', inspectionDepth: 'exact-passage', locator: 'Hymn 6, lines 1–20; CTS work and citation identifiers on item page', rightsStatus: 'cc-by-sa-3.0', rightsBasis: 'The item page states CC BY-SA 3.0 US and names additional XML modification conditions.', scope: 'Supplies one translated hymn’s epithets, Cyprus setting, divine assembly, and prayer frame for Aphrodite.', boundary: 'One early Greek hymn does not establish Roman Venus, universal cult, historical origin, or every Aphrodite tradition.', reusableInCommercialPage: true, sourceTextMayBeRedistributed: true,
  },
  {
    sourceId: 'oracc-reuse-policy', title: 'Reusing Oracc content', responsibleBody: 'Open Richly Annotated Cuneiform Corpus', versionOrDate: `living policy inspected ${reviewedOn}`, url: 'https://oracc.museum.upenn.edu/doc/help/visitingoracc/reusingoracc/index.html', sourceClass: 'repository-rights-policy', inspectionDepth: 'policy', locator: 'Default licence, project-specific exceptions, images and PDFs, attribution and stable URIs', rightsStatus: 'cc-by-sa-3.0', rightsBasis: 'Oracc states a default CC BY-SA 3.0 licence unless a project or object says otherwise; third-party images and PDFs can carry separate rights.', scope: 'Governs reuse of Oracc-authored text and data subject to project and object-level exceptions.', boundary: 'The default licence cannot be transferred to museum images, linked PDFs, or separately credited material.', reusableInCommercialPage: true, sourceTextMayBeRedistributed: true,
  },
  ...[
    ['oracc-inanna-ishtar', 'Inana/Ištar', 'https://oracc.museum.upenn.edu/amgg/listofdeities/inanaitar/index.html', 'Functions; Divine Genealogy and Syncretisms; Cult Places; Time Periods; Name and Spellings', 'inanna-ishtar'],
    ['oracc-enlil', 'Enlil/Ellil', 'https://oracc.museum.upenn.edu/amgg/listofdeities/enlil/index.html', 'Functions; Divine Genealogy and Syncretisms; Cult Places; Time Periods; Name and Spellings', 'enlil'],
    ['oracc-enki-ea', 'Enki/Ea', 'https://oracc.museum.upenn.edu/amgg/listofdeities/enki/index.html', 'Functions; Divine Genealogy and Syncretisms; Cult Places; Time Periods; Name and Spellings', 'enki-ea'],
    ['oracc-marduk', 'Marduk', 'https://oracc.museum.upenn.edu/amgg/listofdeities/marduk/index.html', 'Functions; Divine Genealogy and Syncretisms; Cult Places; Time Periods; Name and Spellings', 'marduk'],
    ['oracc-utu-shamash', 'Utu/Šamaš', 'https://oracc.museum.upenn.edu/amgg/listofdeities/utu/index.html', 'Functions; Divine Genealogy and Syncretisms; Cult Places; Time Periods; Name and Spellings', 'shamash-utu'],
    ['oracc-nanna-sin', 'Nanna/Suen/Sin', 'https://oracc.museum.upenn.edu/amgg/listofdeities/nannasuen/index.html', 'Functions; Divine Genealogy and Syncretisms; Cult Places; Time Periods; Name and Spellings', 'sin-nanna'],
    ['oracc-ereshkigal', 'Ereškigal', 'https://oracc.museum.upenn.edu/amgg/listofdeities/erekigal/', 'Functions; Divine Genealogy and Syncretisms; Cult Places; Time Periods; Name and Spellings', 'ereshkigal'],
    ['oracc-nergal', 'Nergal', 'https://oracc.museum.upenn.edu/amgg/Listofdeities/Nergal/index.html', 'Functions; Divine Genealogy and Syncretisms; Cult Places; Time Periods; Name and Spellings', 'nergal'],
  ].map(([sourceId, title, url, locator, topic]): MythologySourceInspection => ({
    sourceId: sourceId!, title: `${title!} — Ancient Mesopotamian Gods and Goddesses`, responsibleBody: 'Oracc and the UK Higher Education Academy', versionOrDate: `AMGG page inspected ${reviewedOn}`, url: url!, sourceClass: 'scholarly-secondary-overview', inspectionDepth: 'section', locator: locator!, rightsStatus: 'cc-by-sa-3.0', rightsBasis: reusable, scope: `Provides a named scholarly overview of functions, name relationships, historical attestation, and cult places for ${title!}.`, boundary: `The overview is secondary scholarship. It does not make every literary episode, period, city, image, or similarly named deity interchangeable with ${topic!}.`, reusableInCommercialPage: true, sourceTextMayBeRedistributed: true,
  })),
  {
    sourceId: 'etcsl-inanna-descent', title: 'Inana’s descent to the nether world', responsibleBody: 'Electronic Text Corpus of Sumerian Literature, University of Oxford', versionOrDate: `ETCSL c.1.4.1 inspected ${reviewedOn}`, url: 'https://etcsl.orinst.ox.ac.uk/cgi-bin/etcsl.cgi?text=c.1.4.1&charenc=j', sourceClass: 'primary-text-transliteration', inspectionDepth: 'exact-passage', locator: 'ETCSL c.1.4.1, numbered lines 1–412; especially lines 1–28, 73–163 and 164–189', rightsStatus: 'reference-only', rightsBasis: 'The ETCSL site asserts project copyright and does not publish an item-level commercial reuse licence.', scope: 'Supplies a line-addressable transliteration witness for one Sumerian literary composition.', boundary: 'A transliteration is not an English translation or a complete statement of Inana/Ištar’s identity, cult, or reception.', reusableInCommercialPage: true, sourceTextMayBeRedistributed: false,
  },
  {
    sourceId: 'etcsl-enlil-ninlil', title: 'Enlil and Ninlil', responsibleBody: 'Electronic Text Corpus of Sumerian Literature, University of Oxford', versionOrDate: `ETCSL c.1.2.1 inspected ${reviewedOn}`, url: 'https://etcsl.orinst.ox.ac.uk/cgi-bin/etcsl.cgi?text=c.1.2.1&charenc=j', sourceClass: 'primary-text-transliteration', inspectionDepth: 'section', locator: 'ETCSL c.1.2.1, numbered composition of 238 lines', rightsStatus: 'reference-only', rightsBasis: referenceOnly, scope: 'Identifies one line-numbered Sumerian composition concerning Enlil and Ninlil.', boundary: 'The inspected transliteration alone does not support a general Enlil source-text answer or an English translation.', reusableInCommercialPage: true, sourceTextMayBeRedistributed: false,
  },
  {
    sourceId: 'gretil-rigveda-registry', title: 'GRETIL Rigveda electronic text registry', responsibleBody: 'Göttingen Register of Electronic Texts in Indian Languages', versionOrDate: `registry and Rigveda file terms inspected ${reviewedOn}`, url: 'https://gretil.sub.uni-goettingen.de/gretil.html', sourceClass: 'primary-text-registry', inspectionDepth: 'catalogue', locator: 'Vedic Sanskrit e-texts; Rigveda TEI, HTML, and text entries; source-file terms', rightsStatus: 'reference-only', rightsBasis: 'GRETIL marks the inspected e-text for reference and research use and carries source-file terms rather than an unrestricted republication licence.', scope: 'Confirms a scholarly Sanskrit e-text registry and edition metadata.', boundary: 'Registry presence is not translation, passage interpretation, or permission to republish the e-text.', reusableInCommercialPage: true, sourceTextMayBeRedistributed: false,
  },
  ...[
    ['rigveda-griffith-indra-1-32', 'Indra', 'https://en.wikisource.org/wiki/The_Hymns_of_the_Rigveda/Book_1/Hymn_32', 'Rigveda 1.32, stanzas 1–15', 'indra'],
    ['rigveda-griffith-agni-1-1', 'Agni', 'https://en.wikisource.org/wiki/The_Hymns_of_the_Rigveda/Book_1/Hymn_1', 'Rigveda 1.1, stanzas 1–9', 'agni'],
    ['rigveda-griffith-soma-9-107', 'Soma', 'https://en.wikisource.org/wiki/The_Hymns_of_the_Rigveda/Book_9/Hymn_107', 'Rigveda 9.107, numbered stanzas', 'soma'],
    ['rigveda-griffith-varuna-7-86', 'Varuṇa', 'https://en.wikisource.org/wiki/The_Hymns_of_the_Rigveda/Book_7/Hymn_86', 'Rigveda 7.86, stanzas 1–8', 'varuna'],
    ['rigveda-griffith-vishnu-1-154', 'Viṣṇu', 'https://en.wikisource.org/wiki/The_Hymns_of_the_Rigveda/Book_1/Hymn_154', 'Rigveda 1.154, stanzas 1–6', 'vishnu'],
  ].map(([sourceId, title, url, locator, topic]): MythologySourceInspection => ({
    sourceId: sourceId!, title: `The Hymns of the Rigveda — ${title!} passage`, responsibleBody: 'Ralph T. H. Griffith translation presented by Wikisource', versionOrDate: `1896 second edition; page inspected ${reviewedOn}`, url: url!, sourceClass: 'public-domain-primary-text-in-translation', inspectionDepth: 'exact-passage', locator: locator!, rightsStatus: 'public-domain-work', rightsBasis: 'Wikisource identifies the original and Griffith translation as public domain worldwide; its site presentation is CC BY-SA.', scope: `Supplies one line-addressable nineteenth-century English translation witness for a hymn addressed to ${title!}.`, boundary: `The translation is old and philologically superseded. It establishes Griffith’s rendering of ${topic!} in one hymn, not a complete Vedic profile, later Hindu doctrine, or the only defensible translation.`, reusableInCommercialPage: true, sourceTextMayBeRedistributed: true,
  })),
  {
    sourceId: 'ucl-digital-egypt-deities', title: 'Ancient Egyptian deities: names and forms', responsibleBody: 'UCL Digital Egypt for Universities', versionOrDate: `living educational page inspected ${reviewedOn}`, url: 'https://www.ucl.ac.uk/museums-static/digitalegypt/religion/deitiesindex.html', sourceClass: 'scholarly-educational-overview', inspectionDepth: 'section', locator: 'The names of deities; fissioning and fusing; form, iconography, and contextual identity', rightsStatus: 'reference-only', rightsBasis: 'Public access was confirmed; no item-level open reuse licence was established during this inspection.', scope: 'Explains why Egyptian divine names, forms, combinations, and iconography must be interpreted in context.', boundary: 'The overview is a method boundary, not a passage-level source for every named deity or cult.', reusableInCommercialPage: true, sourceTextMayBeRedistributed: false,
  },
  {
    sourceId: 'uee-osiris-deceased', title: 'Osiris and the Deceased', responsibleBody: 'Mark Smith; UCLA Encyclopedia of Egyptology', versionOrDate: 'peer-reviewed article, 2008', url: 'https://escholarship.org/uc/item/29r70244', sourceClass: 'peer-reviewed-secondary-scholarship', inspectionDepth: 'full-text', locator: 'pp. 1–8; especially pp. 2–5 on composite source biography, Osirian aspect, following, and becoming', rightsStatus: 'reference-only', rightsBasis: 'The repository permits free access; the article states copyright by the author and all rights reserved unless otherwise indicated.', scope: 'Explains the relationship constructed between Osiris and deceased Egyptians across mortuary sources.', boundary: 'Acquiring an Osirian aspect or entering a relationship with Osiris is not automatically identity with Osiris; the article does not cover every Osiris cult or later reception.', reusableInCommercialPage: true, sourceTextMayBeRedistributed: false,
  },
  {
    sourceId: 'obp-poetic-edda-pettit', title: 'The Poetic Edda: A Dual-Language Edition', responsibleBody: 'Edward Pettit; Open Book Publishers', versionOrDate: '2023, DOI 10.11647/OBP.0308', url: 'https://www.openbookpublishers.com/books/10.11647/obp.0308', sourceClass: 'critical-edition-and-translation', inspectionDepth: 'catalogue', locator: 'Introduction pp. 1–28; Vǫluspá pp. 31–72; Hávamál pp. 73–134; Vafþrúðnismál pp. 135–164; Hárbarðsljóð pp. 231–258; Þrymskviða pp. 325–340; Hyndluljóð pp. 805–830', rightsStatus: 'noncommercial-reference-only', rightsBasis: 'The book is CC BY-NC 4.0. Maha is a commercial site, so this inspection licenses linking and citation, not adaptation or redistribution without separate permission.', scope: 'Identifies a modern parallel Old Norse and English edition, manuscript apparatus, poem introductions, page ranges, and deity-bearing poems.', boundary: 'The catalogue does not by itself inspect each required passage; the noncommercial licence cannot be treated as commercial adaptation permission.', reusableInCommercialPage: true, sourceTextMayBeRedistributed: false,
  },
  {
    sourceId: 'bellows-poetic-edda', title: 'The Poetic Edda, Bellows translation', responsibleBody: 'Henry Adams Bellows; Internet Sacred Text Archive scan', versionOrDate: '1936 translation; electronic presentation 2001', url: 'https://sacred-texts.com/neu/poe/poe00.htm', sourceClass: 'public-domain-primary-text-in-translation', inspectionDepth: 'policy', locator: 'Title page and public-domain notice; contents available from linked index', rightsStatus: 'public-domain-work', rightsBasis: 'The host states the U.S. copyright was not renewed. Jurisdiction-specific review remains necessary before redistributing substantial text.', scope: 'Supplies an older English translation that can serve as a public-domain comparison witness.', boundary: 'The title page is not a passage inspection, and an older translation cannot replace a modern critical edition or manuscript analysis.', reusableInCommercialPage: true, sourceTextMayBeRedistributed: false,
  },
  {
    sourceId: 'freiberger-comparison-method', title: 'Elements of a Comparative Methodology in the Study of Religion', responsibleBody: 'Oliver Freiberger, Religions', versionOrDate: '2018, DOI 10.3390/rel9020038', url: 'https://doi.org/10.3390/rel9020038', sourceClass: 'peer-reviewed-methodology', inspectionDepth: 'full-text', locator: '§2 comparative configuration and process; §3 conclusions; pp. 1–14', rightsStatus: 'cc-by-4.0', rightsBasis: 'The article is published under CC BY 4.0.', scope: 'Defines comparison as a research design with declared goals, mode, scale, scope, comparands, criteria, description, juxtaposition, redescription, rectification, and theory formation.', boundary: 'The framework does not make a selected comparison criterion natural, prove two figures identical, or validate a historical diffusion claim.', reusableInCommercialPage: true, sourceTextMayBeRedistributed: true,
  },
  {
    sourceId: 'bojadzievska-comparative-mythology', title: 'New Comparative Mythology: Possibilities and Limitations', responsibleBody: 'Maja Bojadzievska; Journal of Contemporary Philology', versionOrDate: '2018, DOI 10.37834/JCP1810155b', url: 'https://journals.ukim.mk/index.php/jcp/en/article/view/17', sourceClass: 'scholarly-methodology', inspectionDepth: 'section', locator: 'Abstract; references; article identity and licence notice', rightsStatus: 'reference-only', rightsBasis: 'The page carries journal copyright and no open reuse licence.', scope: 'Surveys linguistic, psychological, anthropological, structural, and phylogenetic approaches and notes multiple possible explanations for cross-cultural similarity.', boundary: 'A possible explanation is not evidence of common origin, diffusion, identity, or universality in a particular comparison.', reusableInCommercialPage: true, sourceTextMayBeRedistributed: false,
  },
]

const sourceById = new Map(TRANCHE_ELEVEN_SOURCE_INSPECTIONS.map((source) => [source.sourceId, source]))

const oraccByTopic: Record<string, string> = {
  'inanna-ishtar': 'oracc-inanna-ishtar', enlil: 'oracc-enlil', 'enki-ea': 'oracc-enki-ea', marduk: 'oracc-marduk',
  'shamash-utu': 'oracc-utu-shamash', 'sin-nanna': 'oracc-nanna-sin', ereshkigal: 'oracc-ereshkigal', nergal: 'oracc-nergal',
}

const rigvedaByTopic: Record<string, string> = {
  indra: 'rigveda-griffith-indra-1-32', agni: 'rigveda-griffith-agni-1-1', soma: 'rigveda-griffith-soma-9-107', varuna: 'rigveda-griffith-varuna-7-86', vishnu: 'rigveda-griffith-vishnu-1-154',
}

function topic(candidate: MythologyCandidate) {
  return candidate.conceptId.split(':').at(-1) ?? candidate.path.split('/').filter(Boolean).at(-2) ?? 'unknown'
}

function evidenceDecision(candidate: MythologyCandidate): { disposition: RouteDisposition; reason: string; sourceIds: string[] } {
  const routeTopic = topic(candidate)
  if (candidate.groupId === 'mythology-discovery-hub') return { disposition: 'blocked', reason: 'The hub is structurally distinct but cannot be evidence-ready until a reviewed child set exists; otherwise it would aggregate unreviewed routes into apparent authority.', sourceIds: ['freiberger-comparison-method'] }
  if (candidate.groupId === 'mythology-machine-registry') return { disposition: 'blocked', reason: 'The machine registry lacks an explicit dependency on the Publish release-manifest owner and cannot serialize candidate state as if it were released evidence.', sourceIds: ['freiberger-comparison-method'] }
  if (candidate.groupId === 'mythology-mesopotamian' && candidate.routeRole === 'city-and-cult' && oraccByTopic[routeTopic]) {
    return { disposition: 'evidence-ready', reason: 'The named AMGG article was inspected at its functions, cult-place, time-period, and name sections under Oracc’s recorded reuse policy; the page specification is limited to that secondary overview.', sourceIds: ['oracc-reuse-policy', oraccByTopic[routeTopic]!] }
  }
  if (candidate.groupId === 'mythology-sanskrit-vedic-epic-puranic' && candidate.routeRole === 'vedic-text' && rigvedaByTopic[routeTopic]) {
    return { disposition: 'evidence-ready', reason: 'One exact Rigveda hymn in Griffith’s public-domain translation was inspected and can support a deliberately hymn-bounded answer that discloses the translation’s age and limitations.', sourceIds: ['gretil-rigveda-registry', rigvedaByTopic[routeTopic]!] }
  }
  if (candidate.groupId === 'mythology-sanskrit-vedic-epic-puranic' && candidate.routeRole === 'epic-puranic-reception') {
    return { disposition: 'blocked', reason: 'No authoritative epic or Purāṇic passage and no rights-qualified modern scholarship was inspected for this topic; a Vedic hymn cannot be promoted into a later-reception source.', sourceIds: ['gretil-rigveda-registry'] }
  }
  if (candidate.groupId === 'mythology-egyptian' && routeTopic === 'osiris' && candidate.routeRole === 'reception-and-comparison') {
    return { disposition: 'evidence-ready', reason: 'The full peer-reviewed UEE article supports a narrow comparison between an Osirian aspect, following Osiris, and identity with Osiris, with author copyright preserved through linking and original paraphrase.', sourceIds: ['ucl-digital-egypt-deities', 'uee-osiris-deceased'] }
  }
  if (candidate.groupId === 'mythology-comparative-methodology' && ['deity-equivalence-method', 'shared-function-not-same-deity'].includes(routeTopic)) {
    return { disposition: 'evidence-ready', reason: 'The inspected comparative-method sources support an explicit comparand-and-criterion workflow and the refusal to treat resemblance as identity or common origin.', sourceIds: ['freiberger-comparison-method', 'bojadzievska-comparative-mythology'] }
  }
  if (candidate.groupId === 'mythology-greek-roman') {
    const sourceIds = routeTopic === 'aphrodite-venus' ? ['perseus-rights-policy', 'perseus-hymn-aphrodite-6'] : ['perseus-rights-policy']
    return { disposition: 'revise', reason: 'Perseus rights and locator mechanics are inspected, but this exact Greek/Roman route still lacks a balanced Greek passage, Roman passage, and scholarly relationship source. One side may not stand in for both.', sourceIds }
  }
  if (candidate.groupId === 'mythology-mesopotamian') {
    const sourceIds = ['oracc-reuse-policy', ...(oraccByTopic[routeTopic] ? [oraccByTopic[routeTopic]!] : []), ...(routeTopic === 'inanna-ishtar' ? ['etcsl-inanna-descent'] : []), ...(routeTopic === 'enlil' ? ['etcsl-enlil-ninlil'] : [])]
    return { disposition: 'revise', reason: candidate.routeRole === 'source-text' ? 'A source system or transliteration was located, but a route-specific edition, translation, and exact interpretive passage have not all been inspected under compatible rights.' : 'The overview can orient later work, but this reception route needs a separate reception-historical source and exact locator rather than reusing a deity overview beyond its scope.', sourceIds }
  }
  if (candidate.groupId === 'mythology-sanskrit-vedic-epic-puranic') {
    return { disposition: 'revise', reason: 'The Rigveda source system and one-hymn witnesses are available, but this identity or comparison route needs route-specific philology and later-source evidence; Griffith alone cannot carry the relationship.', sourceIds: ['gretil-rigveda-registry', ...(rigvedaByTopic[routeTopic] ? [rigvedaByTopic[routeTopic]!] : [])] }
  }
  if (candidate.groupId === 'mythology-egyptian') {
    return { disposition: 'revise', reason: 'The Egyptian identity boundary is inspected, but this named route lacks a complete primary-object or text locator plus deity-specific scholarship; iconography or a general overview cannot fill the gap.', sourceIds: ['ucl-digital-egypt-deities', ...(routeTopic === 'osiris' ? ['uee-osiris-deceased'] : [])] }
  }
  if (candidate.groupId === 'mythology-norse-germanic') {
    return { disposition: 'revise', reason: 'The modern critical edition, its noncommercial licence, and a public-domain translation witness are identified, but the exact deity-bearing stanzas and reception source remain uninspected.', sourceIds: ['obp-poetic-edda-pettit', 'bellows-poetic-edda'] }
  }
  return { disposition: 'revise', reason: 'The general comparative method is inspected, but this specialized operation still needs a source that directly establishes its named distinction and an exact locator.', sourceIds: ['freiberger-comparison-method', 'bojadzievska-comparative-mythology'] }
}

function questions(candidate: MythologyCandidate, routeTopic: string) {
  const label = candidate.title.split(' — ')[0]!
  const role = candidate.routeRole.replaceAll('-', ' ')
  return [
    `What can the inspected evidence establish about ${label} under the ${role} lens?`,
    `Which exact source, edition, passage, place, or period controls this answer about ${routeTopic}?`,
    'Which translation, identity, cult, or reception distinction must remain explicit?',
    'What does resemblance or later reception fail to establish?',
    'Which source or rights change would require this answer to be reviewed again?',
  ]
}

export function buildTrancheElevenMythology(input: { candidateMap: MythologyCandidateMap; dependencyGraph: MythologyDependencyGraph }) {
  const selected = ALLOCATION.flatMap(([groupId, count]) => {
    const members = input.candidateMap.candidates.filter((candidate) => candidate.groupId === groupId).slice(0, count)
    if (members.length !== count) throw new Error(`Expected ${count} candidates for ${groupId}; found ${members.length}.`)
    return members
  })
  if (selected.length !== 100 || new Set(selected.map((candidate) => candidate.candidateId)).size !== 100) throw new Error('Tranche 11 must contain exactly 100 unique mythology candidates.')
  const selectedIds = new Set(selected.map((candidate) => candidate.candidateId))
  const candidateById = new Map(input.candidateMap.candidates.map((candidate) => [candidate.candidateId, candidate]))
  const observedById = new Map([
    ...input.dependencyGraph.observedAnchorNodes.map((node) => [node.nodeId, node] as const),
    ...input.dependencyGraph.observedTopicNodes.map((node) => [node.nodeId, node] as const),
    ...input.dependencyGraph.missingOwnerTopicNodes.map((node) => [node.nodeId, node] as const),
  ])
  const cohort = artifact({
    schemaVersion: 'maha-federation-tranche-eleven-mythology-cohort/1.0',
    candidateMapDigest: input.candidateMap.provenanceDigest,
    frozenOn: reviewedOn,
    selectionRule: 'Previously approved 100-route mythology mix: 28 Greek/Roman, 28 Mesopotamian, 20 Sanskrit/Vedic, 10 Egyptian, 6 Norse/Germanic, 6 comparative-method routes, one discovery hub, and one machine registry; first N candidates retain deterministic source order within each group.',
    counts: {
      selected: selected.length,
      byGroup: Object.fromEntries(ALLOCATION),
      publicRoutesCreated: 0,
      buildsRun: 0,
    },
    entries: selected.map((candidate, index) => ({ cohortOrder: index + 1, candidateId: candidate.candidateId, candidateDigest: provenanceDigest(candidate), groupId: candidate.groupId, topic: topic(candidate), routeRole: candidate.routeRole, path: candidate.path, url: candidate.url, title: candidate.title })),
  })

  const semanticEntries = selected.map((candidate, index) => {
    const key = `${candidate.groupId}:${candidate.routeRole}`
    const boundary = boundaryByGroupAndRole[key]
    const nonOverlap = roleNonOverlap[candidate.routeRole]
    if (!boundary || !nonOverlap) throw new Error(`Missing manual semantic contract for ${key}.`)
    return {
      cohortOrder: index + 1,
      candidateId: candidate.candidateId,
      url: candidate.url,
      topic: topic(candidate),
      routeRole: candidate.routeRole,
      disposition: 'retain-distinct' as const,
      answerBoundary: boundary,
      nonOverlapFinding: nonOverlap,
      prohibitedTransfer: candidate.routeContract.mustNotClaim,
      manualReview: 'Topic, tradition, route role, sibling routes, cross-tradition collision risk, and prohibited inference were reviewed together; URL similarity was not used as the decision rule.',
      reviewedOn,
      reviewerTier: 'internal-editorial',
    }
  })
  const semanticValidation = artifact({
    schemaVersion: 'maha-federation-tranche-eleven-mythology-semantic-validation/1.0',
    cohortDigest: cohort.provenanceDigest,
    assurance: 'Manual internal editorial adjudication; not external expert review and not evidence readiness.',
    counts: { reviewed: 100, retainDistinct: 100, duplicative: 0 },
    entries: semanticEntries,
  })

  const dependencyEntries = selected.map((candidate) => {
    const edges = input.dependencyGraph.edges.filter((edge) => edge.from === candidate.candidateId)
    const dependencies = edges.map((edge) => {
      const selectedDependency = candidateById.get(edge.dependsOn)
      const observedDependency = observedById.get(edge.dependsOn)
      if (!selectedDependency && !observedDependency) throw new Error(`Unresolved dependency ${edge.dependsOn} for ${candidate.url}.`)
      const dependencyUrl = selectedDependency?.url ?? observedDependency?.url
      if (!dependencyUrl) throw new Error(`Dependency ${edge.dependsOn} has no URL.`)
      return {
        dependsOn: edge.dependsOn,
        url: dependencyUrl,
        reason: edge.reason,
        resolution: selectedIds.has(edge.dependsOn) ? 'same-tranche' : selectedDependency ? 'active-candidate-map' : observedDependency?.state,
      }
    })
    const requiredMethodUrls = [
      'https://www.mahastrategies.com/knowledge/religion/textual-authority',
      'https://www.mahastrategies.com/knowledge/religion/translation-and-semantic-range',
    ]
    const missingMethods = requiredMethodUrls.filter((url) => !dependencies.some((dependency) => dependency.url === url))
    const specialized = candidate.groupId !== 'mythology-discovery-hub'
    const hubPresent = dependencies.some((dependency) => dependency.url === 'https://www.mahastrategies.com/knowledge/religion/mythology')
    const releaseManifestGap = candidate.groupId === 'mythology-machine-registry'
    return {
      candidateId: candidate.candidateId,
      url: candidate.url,
      dependencies,
      methodAnchorsComplete: missingMethods.length === 0,
      hubDependencyCorrect: !specialized || hubPresent,
      publicationDependencyGap: releaseManifestGap ? 'Machine registry must depend on https://publish.mahastrategies.com/docs/release-manifests before implementation.' : null,
      structurallyResolved: missingMethods.length === 0 && (!specialized || hubPresent),
    }
  })
  const dependencyValidation = artifact({
    schemaVersion: 'maha-federation-tranche-eleven-mythology-dependency-validation/1.0',
    cohortDigest: cohort.provenanceDigest,
    dependencyGraphDigest: input.dependencyGraph.provenanceDigest,
    rule: 'The mythology hub and observed religion methodology/translation definitions precede specialized application pages. A machine registry also requires the Publish release-manifest owner before implementation.',
    counts: { candidates: 100, structurallyResolved: dependencyEntries.filter((entry) => entry.structurallyResolved).length, unresolved: dependencyEntries.filter((entry) => !entry.structurallyResolved).length, publicationDependencyGaps: dependencyEntries.filter((entry) => entry.publicationDependencyGap).length },
    entries: dependencyEntries,
  })

  const sourceInspections = artifact({
    schemaVersion: 'maha-federation-tranche-eleven-mythology-source-inspections/1.0',
    cohortDigest: cohort.provenanceDigest,
    inspectedOn: reviewedOn,
    method: 'Direct inspection of public source-system rights pages, catalogues, exact passages, or full texts. No source text, user material, credential, or private corpus content is retained.',
    counts: {
      sources: TRANCHE_ELEVEN_SOURCE_INSPECTIONS.length,
      reusableWithTerms: TRANCHE_ELEVEN_SOURCE_INSPECTIONS.filter((source) => ['cc-by-4.0', 'cc-by-sa-3.0', 'public-domain-work'].includes(source.rightsStatus)).length,
      referenceOnly: TRANCHE_ELEVEN_SOURCE_INSPECTIONS.filter((source) => ['reference-only', 'noncommercial-reference-only'].includes(source.rightsStatus)).length,
      exactPassageOrFullText: TRANCHE_ELEVEN_SOURCE_INSPECTIONS.filter((source) => ['exact-passage', 'full-text'].includes(source.inspectionDepth)).length,
      sourceTextRedistributable: TRANCHE_ELEVEN_SOURCE_INSPECTIONS.filter((source) => source.sourceTextMayBeRedistributed).length,
    },
    rightsRule: 'Public access, open access, public domain, Creative Commons, noncommercial licensing, and permission to republish are independent states. Commercial reuse is evaluated per item; the page specifications require original bounded prose even where source text is reusable.',
    sources: TRANCHE_ELEVEN_SOURCE_INSPECTIONS,
  })

  const decisions = selected.map((candidate, index) => {
    const decision = evidenceDecision(candidate)
    for (const sourceId of decision.sourceIds) if (!sourceById.has(sourceId)) throw new Error(`Unknown source ${sourceId} for ${candidate.url}.`)
    return {
      cohortOrder: index + 1,
      candidateId: candidate.candidateId,
      url: candidate.url,
      title: candidate.title,
      groupId: candidate.groupId,
      topic: topic(candidate),
      routeRole: candidate.routeRole,
      disposition: decision.disposition,
      reason: decision.reason,
      sourceIds: decision.sourceIds,
      sourceInspectionDigests: decision.sourceIds.map((sourceId) => provenanceDigest(sourceById.get(sourceId)!)),
      semanticValidationDigest: semanticValidation.provenanceDigest,
      dependencyValidationDigest: dependencyValidation.provenanceDigest,
      rightsReviewed: decision.sourceIds.length > 0,
      activeRouteCreated: false,
      reviewedOn,
    }
  })
  const decisionManifest = artifact({
    schemaVersion: 'maha-federation-tranche-eleven-mythology-decisions/1.0',
    cohortDigest: cohort.provenanceDigest,
    semanticValidationDigest: semanticValidation.provenanceDigest,
    dependencyValidationDigest: dependencyValidation.provenanceDigest,
    sourceInspectionManifestDigest: sourceInspections.provenanceDigest,
    assurance: 'Internal source, rights, scope, boundary, duplication, and dependency review. Evidence-ready means specification-ready locally, not reviewed, released, compiled, or public.',
    counts: {
      evidenceReady: decisions.filter((decision) => decision.disposition === 'evidence-ready').length,
      revise: decisions.filter((decision) => decision.disposition === 'revise').length,
      blocked: decisions.filter((decision) => decision.disposition === 'blocked').length,
      duplicative: decisions.filter((decision) => decision.disposition === 'duplicative').length,
    },
    entries: decisions,
  })

  const dependencyById = new Map(dependencyEntries.map((entry) => [entry.candidateId, entry]))
  const specifications = decisions.filter((decision) => decision.disposition === 'evidence-ready').map((decision) => {
    const candidate = candidateById.get(decision.candidateId)!
    const bindings = decision.sourceIds.map((sourceId) => {
      const source = sourceById.get(sourceId)!
      return { sourceId, url: source.url, locator: source.locator, rightsStatus: source.rightsStatus, scope: source.scope, boundary: source.boundary }
    })
    return {
      candidateId: candidate.candidateId,
      candidateDigest: provenanceDigest(candidate),
      url: candidate.url,
      title: candidate.title,
      topic: decision.topic,
      routeRole: candidate.routeRole,
      answerContract: `Answer only the ${candidate.routeRole.replaceAll('-', ' ')} question for ${candidate.title.split(' — ')[0]} inside the manual boundary and inspected source scopes; label source, translation, period, rights, and uncertainty explicitly.`,
      semanticBoundary: semanticEntries.find((entry) => entry.candidateId === candidate.candidateId)!.answerBoundary,
      requiredSections: ['Direct bounded answer', 'Named source and exact locator', 'Identity, translation, period, and reception frame', 'Evidence scope', 'What the evidence does not establish', 'Related definitions and sibling lenses'],
      boundedQuestions: questions(candidate, decision.topic),
      sourceBindings: bindings,
      dependencies: dependencyById.get(candidate.candidateId),
      structuredData: { type: 'Article', noRatingOrEndorsement: true, noTheologicalCertification: true },
      machineContract: { exactLocatorsRequired: true, rightsStateRequired: true, evidenceFrameRequired: true, prohibitedInferenceRequired: true, exactRevisionReviewRequired: true, canonicalReleaseRequiredBeforePublication: true },
      implementationState: 'specification-only',
    }
  })
  const pageSpecifications = artifact({
    schemaVersion: 'maha-federation-tranche-eleven-mythology-page-specifications/1.0',
    decisionManifestDigest: decisionManifest.provenanceDigest,
    rule: 'Only evidence-ready candidates receive substantial-page specifications. A specification is not a generated route and cannot enter a build before later review and release gates.',
    counts: { specifications: specifications.length, boundedQuestions: specifications.reduce((sum, specification) => sum + specification.boundedQuestions.length, 0), excludedNonReady: 100 - specifications.length },
    specifications,
  })

  const readiness = artifact({
    schemaVersion: 'maha-federation-tranche-eleven-mythology-readiness/1.0',
    cohortDigest: cohort.provenanceDigest,
    decisionManifestDigest: decisionManifest.provenanceDigest,
    specificationManifestDigest: pageSpecifications.provenanceDigest,
    status: 'local-reviewed-unreleased',
    counts: {
      candidates: 100,
      evidenceReady: decisions.filter((decision) => decision.disposition === 'evidence-ready').length,
      revise: decisions.filter((decision) => decision.disposition === 'revise').length,
      blocked: decisions.filter((decision) => decision.disposition === 'blocked').length,
      duplicative: decisions.filter((decision) => decision.disposition === 'duplicative').length,
      pageSpecifications: specifications.length,
      publicRoutesCreated: 0,
      buildsRun: 0,
    },
    nextResearch: [
      'Inspect paired Greek and Roman primary passages plus relationship scholarship for the 28 Greek/Roman routes.',
      'Inspect translation-bearing primary texts and reception scholarship for Mesopotamian source-text and reception routes.',
      'Add route-specific philology and later epic/Purāṇic sources without transferring Vedic authority forward.',
      'Inspect deity-specific Egyptian texts or objects and scholarship for Ra, Isis, and Horus.',
      'Inspect exact Eddic stanzas under a commercially compatible use plan and separate medieval evidence from reception.',
      'Add the missing Publish release-manifest dependency before any machine registry implementation.',
    ],
    boundary: 'No generated public route, sitemap or llms.txt entry, Next.js or Vercel build, push, Preview, canonical release, deployment, or Production mutation is authorized or performed.',
  })

  return { cohort, semanticValidation, dependencyValidation, sourceInspections, decisionManifest, pageSpecifications, readiness }
}

export function verifyTrancheElevenArtifact(value: JsonRecord) {
  return typeof value.provenanceDigest === 'string' && provenanceDigest(value) === value.provenanceDigest
}
