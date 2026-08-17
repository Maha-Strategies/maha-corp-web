# Celestial Hypothesis Registry 0.2

The registry makes one narrow promise: a named celestial-timing hypothesis, its structured categorical verdict, inputs, primary metric, comparator policy, sample size, and analysis plan were fixed before the action and before its outcome was known.

It does not establish that astrology predicts anything. Every referenced astrology rule remains `unvalidated-tradition` regardless of the observed result.

## Lifecycle

`draft → registered → outcome-recorded → analyzed`

- Drafts are editable and may carry semantic validation blockers.
- Registration locks the canonical payload and SHA-256 digest before the action window begins.
- The locked verdict is one of `favorable`, `unfavorable`, `conflicting`, `abstain-no-coverage`, or `abstain-unresolved-variant`. There is no auspiciousness score or uncalibrated confidence percentage.
- Outcomes are append-only, tied to the registration digest, and retain a digest rather than the raw telemetry payload.
- Version `binary-outcome/1` analyzes exactly one fixed sample size after its declared horizon. It reports counts and effect size, but no p-value or confidence interval.
- There is no discarded or unpublished-result state.

## Private API

All routes require `Authorization: Bearer $CELESTIAL_REGISTRY_TOKEN`. The token must contain at least 32 bytes. Missing authorization or Supabase configuration fails closed.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/celestial-hypotheses/drafts` | Create or amend an unlocked draft |
| `POST` | `/api/v1/celestial-hypotheses/{id}/register` | Validate and take the immutable lock |
| `POST` | `/api/v1/celestial-hypotheses/{id}/outcomes` | Append one instrumented observation |
| `GET` | `/api/v1/celestial-hypotheses/{id}` | Read private lifecycle and result state |
| `GET` | `/api/v1/celestial-hypotheses/{id}/provenance` | Read the complete digest and source chain |

The private operator console is `/admin/celestial-hypotheses`. It keeps the bearer token in component memory and does not persist it.

## Integrity boundary

The application and database both enforce the critical chronology and immutability rules:

- the canonical fact bundle is validated, stored inside the locked draft, and required to match its declared ID and digest;
- registration must precede the action window;
- an optimistic draft digest prevents a concurrent edit from being locked under an older hash;
- observation follows the action, retrieval follows observation, and future-dated retrieval is rejected;
- outcomes and analyses cannot be updated, deleted, or truncated by `service_role`;
- the fixed sample closes after analysis, preventing optional stopping or later outcome substitution;
- no public database role can read or write these tables.

The comparator is a pre-declared null baseline, not a causal control. Matching weekday, local hour, geography, and activity removes obvious scheduling differences but does not control unobserved confounding.

## Activity corpus and verdict contract

Classical rules remain unchanged in the astrology tradition registry. A separate `celestial-activity-rules/0.1` corpus maps source-described undertakings to the seven modern, non-high-stakes activity types accepted by the registry. Each initial mapping is explicitly `maha-synthesis`: the classical source does not mention software releases, campaigns, maintenance windows, or automated jobs.

`celestial-verdict/0.1` is generated deterministically from the activity, named tradition, applicable rules, fact-bundle digest, metric, and pre-declared target. The registration gate recomputes it and rejects hand-edited classifications. Conflicting directions are preserved instead of averaged. A known unresolved rule variant forces abstention under `preserve-conflict-and-abstain/1`.

The verdict digest and classification are carried into the provenance bundle. Its `unvalidated` calibration status cannot be raised by the verdict compiler; calibration requires prospective outcomes under this frozen format.

## Deliberately absent

- Public participant or experiment listing, pending a re-identification review.
- Historical backtesting and Bayesian rule pruning.
- p-values, confidence intervals, Bayes factors, and multiple analysis-plan versions.
- Third-party webhook adapters and webhook-signature verification.
- Human-astrologer recruitment and task orchestration. The shared AstroBench submission contract and descriptive scoring exist; paired inferential comparison does not.
- Any medical, legal, investment, employment, housing, insurance, pregnancy, death, or personality-decision use.
