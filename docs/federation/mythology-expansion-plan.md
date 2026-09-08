# Cross-cultural mythology expansion plan

Status: **planned-local-unreleased**

## Purpose

Extend `/knowledge/religion` beyond its strong Tamil source atlases with a cross-cultural mythology collection. Mythology is treated as a corpus of narratives, names, images, rituals, places, and reception histories—not as a synonym for religion and not as a label meaning “false.”

The collection must help a person or machine answer four different questions without conflating them:

1. What does an identified primary source actually say?
2. How does a named translation render it?
3. How has an attributed scholar, community, artist, or institution interpreted or received it?
4. What historical, archaeological, comparative, or theological conclusion remains unsupported?

## Current imbalance

The general religion layer already provides 18 methodological concepts and 8 bounded comparisons. The substantial source-led clusters beneath it contain 125 Tamil detail pages:

- 15 Māyōṉ topics;
- 16 classical Tamil religion and reception topics;
- 48 Tamil source-atlas topics;
- 46 Tiruvāymoḻi passage units.

That strength remains intact. The expansion adds parallel source-led depth rather than weakening or renaming the Tamil work.

## Route architecture

- `/knowledge/religion/mythology` — discovery hub.
- `/knowledge/religion/mythology/registry` — digest-bound machine registry.
- `/knowledge/religion/mythology/methods/{slug}` — source, translation, image, ritual, dating, reception, and comparison protocols.
- `/knowledge/religion/mythology/{tradition}/{source}/{passage}` — exact-locator passage guides.
- `/knowledge/religion/mythology/entities/{slug}` — name and identity maps across identified sources.
- `/knowledge/religion/mythology/relationships/{slug}` — typed, directional relationships.
- `/knowledge/religion/mythology/reception/{slug}` — later literary, ritual, artistic, political, or theological reception.
- `/knowledge/religion/mythology/comparisons/{slug}` — same-axis comparisons that explicitly refuse identity-by-similarity.

## Two-hundred-route allocation

| Collection | Routes | Initial emphasis |
| --- | ---: | --- |
| Greek and Roman | 36 | Hesiodic and Homeric passages, divine names, cult epithets, later Roman reception |
| Mesopotamian | 36 | Sumerian and Akkadian compositions, deity relationships, descent, flood, kingship, and transmission |
| Sanskrit, Vedic, epic, and Purāṇic | 32 | Named textual strata, deity epithets, narrative change, translation, and Tamil connections |
| Egyptian | 24 | Inscribed and papyrus witnesses, solar and Osirian corpora, kingship, afterlife, and material context |
| Norse and Germanic | 20 | Eddic witnesses, prose reception, name relationships, cosmology, and later reconstruction |
| Chinese | 16 | Named classical witnesses, divine and culture-hero traditions, commentary, and later reception |
| Japanese | 12 | Kojiki and Nihon Shoki source differences, kami names, shrine reception, and translation boundaries |
| Mesoamerican | 10 | Identified manuscripts, inscriptions, material witnesses, named translations, and colonial mediation |
| African source and rights pilots | 4 | Community- and rights-led protocols; no decontextualized extraction of restricted oral knowledge |
| Comparative methodology | 8 | Motif comparison, divine-name disambiguation, syncretism, reception, translation, and non-equivalence |
| Hub and registry | 2 | Human discovery and machine retrieval |
| **Total** | **200** | |

Route allocation is a research ceiling, not a publication promise. Any tradition may yield fewer routes when lawful access, source identity, exact locators, translation rights, community authority, or claim support are insufficient.

## Tranche 11

The first 100 candidates should favor corpora with inspectable, stable, and lawfully reusable source infrastructure:

- 28 Greek and Roman;
- 28 Mesopotamian;
- 20 Sanskrit and Vedic;
- 10 Egyptian;
- 6 Norse and Germanic;
- 6 comparative-method pages;
- 1 hub;
- 1 registry.

Candidate source leads include the Perseus Greek and Roman collections, Oxford’s Electronic Text Corpus of Sumerian Literature, the Open Richly Annotated Cuneiform Corpus, and Göttingen’s Register of Electronic Texts in Indian Languages. These are leads only. No candidate becomes evidence-ready until the exact work, edition or corpus version, passage locator, translation identity, rights basis, claim scope, and boundary have been inspected.

## Typed relationship contract

Allowed relationship types include:

- `directly-attested-in`;
- `named-as-in-translation`;
- `co-attested-with`;
- `genealogy-stated-in`;
- `opposed-in-narrative`;
- `cult-epithet-of-in-source`;
- `later-identified-with-by`;
- `received-as-by`;
- `motif-parallel-not-identity`;
- `contrasts-with`;
- `name-disambiguated-from`;
- `not-established-as-equivalent`.

Every edge is directional, source-bound, versioned, and non-transitive by default. A shared domain, animal, weapon, color, flood, descent, kingship, or celestial association never establishes that two deities or narratives are the same.

## Evidence frames

Each page must keep these frames separate:

- primary wording or material observation;
- named edition, witness, inscription, object, or performance;
- named translation and its semantic choices;
- attributed commentary or scholarship;
- historical inference and uncertainty;
- living community or institutional account;
- reception history;
- theology or tradition-internal interpretation;
- Maha’s bounded comparative synthesis.

Machine answers must state which frame supports each sentence. Metadata-only and abstract-only sources remain non-explanatory. A translation may be linked and paraphrased only within its rights basis; public accessibility is not permission to reproduce it.

## Community and cultural-rights boundary

Public availability does not authorize extraction of restricted, sacred, initiatory, funerary, or community-controlled knowledge. Oral-tradition pages require a documented public authority, consent and customary-access review, a lawful representation, and a reason the page benefits rather than merely mines the represented community. If those conditions are absent, the candidate is blocked.

## Candidate-map migration

The existing `federation-route-candidates-v1` and Tranches 1–10 remain immutable. A versioned candidate-map migration will:

1. preserve all 1,000 already selected candidate identities and decisions;
2. mark 200 unselected future candidates as superseded before review;
3. add exactly 200 mythology candidates;
4. retain 1,628 active federation candidates and the 4,000-route target;
5. record every retired and replacement candidate in an append-only lineage manifest;
6. refuse any Tranche 11 candidate whose dependency points to a superseded or unready definition.

Selection of the 200 displaced future candidates must use semantic duplication, evidence availability, machine utility, and differentiation—not merely low URL similarity or an arbitrary property quota.

## Build boundary

This plan creates no route, sitemap entry, `llms.txt` entry, canonical release, Next.js build, Vercel build, deployment, or Production mutation. The mythology collection remains local until its evidence packets, exact-revision reviews, dependency graph, implementation contracts, and the complete 4,000-route publication tranche are ready and the owner separately authorizes a build.
