# Practitioner review layer

Practitioner review is an append-only expert-judgement record, not a product approval workflow. Each review binds one reviewer profile version to one frozen artifact version and SHA-256 digest. A later edit creates a different target digest and cannot inherit the earlier verdict.

The three review lanes remain separate:

| Scope | Target | Required criteria |
| --- | --- | --- |
| Calculation conventions | Maha Vedic calculation profile | Lahiri ayanamsa; mean versus true lunar node; whole-sign houses; actual-nakshatra-stay-time Vimshottari balance |
| Source fidelity | One passage from the astrology registry | Transcription accuracy; locator accuracy; contextual integrity |
| Rule formalization | One interpretation rule with its cited passages | Condition fidelity; interpretation fidelity; exceptions and variants |

There is no product target and no aggregate approval state. The system derives a scoped verdict from the criterion verdicts:

- all `agree` → `accepted`;
- any reservation → `accepted-with-reservations`;
- any `revise` → `revision-required`;
- any `disagree` → `disagreed`;
- any `not-qualified` → `abstained`, unless a stronger negative verdict is present.

A `revise` or `disagree` criterion requires a structured disagreement naming the criterion, severity, statement, and optional proposed resolution. The record also preserves an overall rationale, declared conflicts, qualifications for the selected scope, reviewer identity URL, affiliation, and profile version.

## Private workflow

The operator workspace is `/admin/practitioner-reviews`. It requires the dedicated `PRACTITIONER_REVIEW_TOKEN`; it does not reuse customer, registry, or general editorial credentials. The API is `GET/POST /api/admin/practitioner-reviews`.

`GET` returns the current frozen targets and append-only history. `POST` accepts one complete scoped review. There is no update or delete method. To amend a review, submit a new record with `supersedesReviewId`; the database permits supersession only for the same reviewer and frozen target version.

Reviewer suitability is recorded as an explicit attestation with qualifications and conflicts. The software does not infer that somebody is qualified merely because they possess the bearer token.

## Persistence boundary

Migration `20260817000200_practitioner_review_layer.sql` creates immutable versioned reviewer profiles and append-only review records. Direct service-role insertion, update, deletion, and truncation are revoked; writes go through one security-definer function with scope/type and identity-version checks.

The review boundary is returned with every API response:

> A practitioner review records a scoped expert judgement about one frozen calculation profile, source passage, or rule formalization. It is not product approval, scientific validation, or evidence that astrology predicts outcomes.
