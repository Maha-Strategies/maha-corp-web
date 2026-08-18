# Jyotiṣa source-bound coverage

Version: `jyotisha-source-coverage/0.1`

Registry: `astrology-traditions/0.2`

This release establishes breadth, not report-ready authority. A rule is eligible for generated output only after:

1. every cited passage has an accepted, digest-bound source-fidelity review; and
2. the rule has an accepted, digest-bound rule-formalization review.

Until both conditions hold, the compiler records `practitioner-review-required`. Practitioner acceptance means only that the passage and formalization were reviewed for fidelity. It is not scientific validation or product approval.

| Coverage area | Seed record | Status |
| --- | --- | --- |
| Planetary house placement | Tenth-house occupant and asserted wealth source | Encoded; awaiting review; always blocked from consumer reports by financial/employment policy |
| House rulers | Tenth lord → occupied Navāṃśa → Navāṃśa lord | Encoded; awaiting review; fallback semantics unresolved |
| Nakshatra interpretation | Natal Moon in Aśvinī | Encoded; awaiting review; always blocked from consumer reports as a personality/capability claim |
| Explicit yogas | Musala Āśraya yoga | Encoded; awaiting review; source variant preserved |
| Daśā interpretation | Daśā lord in houses 3, 6, 10, or 11 from the commencement ascendant | Encoded; awaiting review; convention unresolved |
| Transit interpretation | Moon transiting a zero-bindu sign in lunar Bhinna Aṣṭakavarga | Encoded; awaiting review; calculation not implemented |
| Mundane charts | Dhruva nakshatra for a declared foundation event | Encoded; awaiting review |
| Corporate charts | Incorporation as a modern foundation-event analogy | Encoded as Maha synthesis; awaiting review; not attributed to Varāhamihira |

## Source and transcription method

The new natal and timing passages come from N. Chidambaram Iyer’s 1885 English translation of Varāhamihira’s *Bṛhat Jātaka*, digitized by the Wellcome Collection and marked Public Domain. OCR was used to locate candidate pages only. Every excerpt was checked against the page image, bounded to 60 words, and given a printed-page plus scan-image locator.

Existing Bṛhat Saṃhitā passages support the mundane foundation rule. The corporate record is explicitly `maha-inference`: the source discusses stable nakshatras for towns, public utility, and works intended to endure, but does not discuss corporations or incorporation.

Horary remains empty because the available Lilly transcription is unreliable OCR. Western sidereal remains empty because the relevant modern sources are copyrighted and no quotation licence has been recorded.
