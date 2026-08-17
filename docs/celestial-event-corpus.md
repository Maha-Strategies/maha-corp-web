# Celestial event corpus

The durable event corpus supplies the denominator that historical milestone-only calibration lacks. It stores both qualifying milestones and ordinary periods selected by a locked clock policy under one pseudonymous corpus definition.

## Scientific boundary

A scheduled interval is only a candidate negative example. It becomes a `non-event` observation after the declared system of record supplies evidence that no event satisfying the locked definition occurred during the complete interval. The evidence payload is hashed in memory and discarded; the corpus stores only its digest, source class, and system-of-record identifier.

Historical exposure rates are descriptive. They can generate hypotheses and identify data-quality problems, but they cannot establish causation or predictive performance. Only an untouched or prospective evaluation registered before outcomes are known may support a performance claim.

## Lifecycle

1. Create a private draft containing a pseudonym, natal-profile digest, event definition, evidence procedure, activity type, sampling window, anchor, cadence, and interval duration.
2. Inspect the generated schedule, then lock the definition. Locking is irreversible.
3. Append milestones and evidence-backed non-event intervals. Precise natal inputs are supplied for compilation but never persisted.
4. Inspect descriptive feature exposure: milestone count, non-event count, baseline event rate, and feature-specific rate ratios.

The database prevents updates or deletion of observations, rejects observations before the corpus is locked, verifies the locked definition digest, and independently enforces time-window and systematic-clock alignment.

## Private API

- `POST /api/v1/celestial-corpus/corpora` — create or revise a draft.
- `POST /api/v1/celestial-corpus/corpora/{corpusId}/lock` — irreversibly lock the definition.
- `GET /api/v1/celestial-corpus/corpora/{corpusId}/schedule` — generate candidate denominator intervals.
- `POST /api/v1/celestial-corpus/corpora/{corpusId}/observations` — append 1–100 compiled observations.
- `GET /api/v1/celestial-corpus/corpora/{corpusId}/observations` — inspect records and descriptive exposure summary.

All routes use the existing private celestial registry bearer token and service-role database connection. The operator console is at `/admin/celestial-corpus`.

## Production operational verification

The manual `Production celestial study` workflow runs one synthetic corpus lifecycle and one harmless hypothesis-registry lifecycle against the canonical Production host. It requires approval through the `production-canary` environment. Its published artifact contains lifecycle states, digests, aggregate counts, and epistemic boundaries only; a recursive denylist refuses participant, natal, birth, observer, coordinate, and raw-evidence fields before publication.
