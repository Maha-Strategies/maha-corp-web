# AstroBench prospective protocol 0.1

AstroBench compares the Maha rule engine, blinded human astrologers, an ordinary operational baseline, and a random-clock baseline on the same prospective tasks. It is an evaluation contract, not evidence that astrology works.

Before the first eligible outcome, a protocol locks the activity, objective metric, target, sample size, stopping rule, multiplicity policy, and primary score. Every participant submits one of the same three predictions: `meets-or-exceeds-target`, `misses-target`, or `abstain`.

## Blinding and chronology

- Tasks use pseudonymous IDs. Human astrologers do not see the engine verdict, telemetry outcome, or other participants' answers.
- The Maha engine submission binds the SHA-256 digest of its pre-registered structured verdict. Human and baseline submissions cannot carry that digest.
- Every submission is timestamped and hashed before the outcome becomes available. Late submissions are invalid.
- The objective outcome is reduced to whether its observed rate met the protocol's pre-declared target; the threshold cannot be selected after inspection.

## Scores

The primary metric is accuracy with abstention counted as an error. This prevents selective answering from manufacturing a win. Coverage and accuracy when answered are secondary metrics and must be shown beside the primary result.

Superiority is not established by a larger point estimate. A future analysis version must pre-declare the paired statistical comparison, interval or posterior criterion, minimum effect worth claiming, and multiplicity correction before the system may claim that one participant class beat another.

## Not yet implemented

The contract, validation, hashing, and descriptive participant scoring exist. Recruitment, identity verification for human astrologers, task assignment, outcome ingestion, paired inferential analysis, and a public benchmark leaderboard remain future work.
