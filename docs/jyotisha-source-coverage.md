# Jyotiṣa source-bound coverage

Version: `jyotisha-source-coverage/0.2`

Registry: `astrology-traditions/0.3`

This release contains 101 passage-linked Jyotiṣa records. It establishes reviewable breadth, not report-ready authority. A rule is eligible for generated output only after:

1. every cited passage has an accepted, digest-bound source-fidelity review; and
2. the rule has an accepted, digest-bound rule-formalization review.

Until both conditions hold, the compiler records `practitioner-review-required`. Practitioner acceptance means only that the passage and formalization were reviewed for fidelity. It is not scientific validation or product approval.

| Coverage area | Records | Scope | Status |
| --- | ---: | --- | --- |
| Planetary house placement | 8 | Compound tenth-house avocation doctrine plus seven atomic planet mappings | Encoded; awaiting review; always blocked from reports by financial/employment policy |
| House rulers | 1 | Tenth lord → occupied Navāṃśa → Navāṃśa lord | Encoded; awaiting review; fallback semantics unresolved |
| Nakshatra interpretation | 27 | Complete natal Moon nakṣatra sequence from Chapter XVI | Encoded; awaiting review; always blocked from reports as determinative personal claims |
| Explicit yogas | 1 | Musala Āśraya yoga | Encoded; awaiting review; source variant preserved |
| Daśā interpretation | 1 | Daśā lord in houses 3, 6, 10, or 11 from the commencement ascendant | Encoded; awaiting review; convention unresolved |
| Transit interpretation | 1 | Moon transiting a zero-bindu sign in lunar Bhinna Aṣṭakavarga | Encoded; awaiting review; calculation not implemented |
| Mundane and corporate charts | 2 | Classical Dhruva foundation doctrine and a separately labelled incorporation synthesis | Encoded; awaiting review; synthesis is not attributed to Varāhamihira |
| Pañcāṅga classification and selection | 60 | 27 nakṣatra-class records, 15 tithi groups, 11 karaṇa records, and 7 bounded activity techniques | Encoded; awaiting review; harmful Tīkṣṇa/Ugra activity instructions are not operationalized |

## Atomic rule families

Compound lists are split into one condition-to-claim record per calculable value. This permits a reviewer to accept, reject, or revise one mapping without approving an entire chapter. Shared passages remain shared rather than duplicated.

| Family | Count |
| --- | ---: |
| Nakṣatra class taxonomy | 27 |
| Tithi group taxonomy | 15 |
| Movable karaṇa lord mapping | 7 |
| Fixed karaṇa sequence membership | 4 |
| Natal Moon nakṣatra doctrine | 27, including the existing Aśvinī seed |
| Tenth-house planet mapping | 7, in addition to the existing compound rule |
| Bounded activity-selection techniques | 7 |

The classification registry preserves source tensions. Hasta, for example, appears both in the Laghu list and in the moving-work list; both passage identifiers remain attached to the same atomic rule. Punarvasu appears in the shaving election list but is not assigned to an activity class in verses 6–11. These are review facts, not inconsistencies for the compiler to silently repair.

## Source and transcription method

The natal passages come from N. Chidambaram Iyer’s 1885 English translation of Varāhamihira’s *Bṛhat Jātaka*, digitized by the Wellcome Collection and marked Public Domain. OCR was used to locate candidate pages only. Every excerpt was checked against the page image, bounded to 60 words, and given a printed-page plus scan-image locator. Historical spelling and typographic irregularities are retained in excerpts and normalized only in structured conditions.

The pañcāṅga and activity-selection records use Iyer’s public-domain 1884 *Bṛhat Saṃhitā* translation. The corporate record remains explicitly `maha-inference`: the source discusses stable nakshatras for towns, public utility, and works intended to endure, but does not discuss corporations or incorporation.

Sharp and severe nakṣatra verses include instructions involving punishment, imprisonment, poison, violence, and other harm. The registry records only their class lists. Those harmful activity instructions are not structured as executable rules.

Horary remains empty because the available Lilly transcription is unreliable OCR. Western sidereal remains empty because the relevant modern sources are copyrighted and no quotation licence has been recorded.
