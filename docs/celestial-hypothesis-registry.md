# Celestial Hypothesis Registry 0.1

The registry makes one narrow promise: a named celestial-timing hypothesis, its inputs, its primary metric, comparator policy, sample size, and analysis plan were fixed before the action and before its outcome was known.

It does not establish that astrology predicts anything. Every referenced astrology rule remains `unvalidated-tradition` regardless of the observed result.

## Lifecycle

`draft → registered → outcome-recorded → analyzed`

- Drafts are editable and may carry semantic validation blockers.
- Registration locks the canonical payload and SHA-256 digest before the action window begins.
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

## Deliberately absent

- Public participant or experiment listing, pending a re-identification review.
- Historical backtesting and Bayesian rule pruning.
- p-values, confidence intervals, Bayes factors, and multiple analysis-plan versions.
- Third-party webhook adapters and webhook-signature verification.
- Human-astrologer and random-baseline benchmark orchestration.
- Any medical, legal, investment, employment, housing, insurance, pregnancy, death, or personality-decision use.
