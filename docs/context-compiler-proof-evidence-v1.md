# Context Compiler proof contract and evidence checkpoint v1

Status: frozen contract; partner validation recorded; production proof service not yet accepted.

This checkpoint freezes Maha's proof-contract v3, its v3.1 canonicalization clarification, and the exact fixture bytes used in the ogurec14 interoperability pass. The machine-readable record is `test/fixtures/context-proof-evidence-v1.json`.

## What is frozen

- The public/private witness boundary, half-open UTF-8 offsets, SHA-256 encodings, source-coverage arithmetic, retained-set uniqueness claim, and token-estimator non-claims.
- The production `inputHash` and `outputHash` preimages documented in the v3.1 addendum.
- The N=128 support ceiling and both reject-before-proof/no-charge paths.
- Five original fixture payloads plus the partial-coverage fixture. Their digests, along with both fixture indexes, remain pinned by regression tests.
- The public Context Compiler response remains unchanged. Proof material is still a sidecar contract.

Any change to a pinned artifact or fixture is a new contract version, not an edit to this checkpoint.

## Evidence recorded from ogurec14

The partner reported successful real-proof validation for N=70 and N=128 against Maha's nested envelope, byte-equivalent public values, correct pre-prover rejection for N=129 and the duplicate adversary, exact 3/4 source coverage, production hash re-derivation, and the confirmed invalid-token-arithmetic rejection.

Five repeated runs produced:

| Fixture | Median | Range |
| --- | ---: | ---: |
| N=70 | 51.4 s | 48.7–52.2 s |
| N=128 | 34.4 s | 33.7–35.8 s |

The apparent inverse scaling was traced to source hashing: N=70 made about 3.1 times as many SHA precompile syscalls. Reported proof size was approximately 2.9 MB and peak memory was 10–15 GiB. These are development-machine measurements, not a production SLO.

This evidence is deliberately classified as partner-reported. Maha can reproduce fixture bytes, commitments, rejection decisions, and digests locally; the external proof files are not stored in this repository.

## Remaining acceptance gate

The messages supplied to Maha did not include the exact ELF digest and SP1 verifying key for the final schema-aligned build after the last canonicalization and token-arithmetic changes. Earlier identifiers belong to superseded builds and must not be relabelled as the v1 verifier.

Production acceptance therefore requires one final immutable handoff:

1. the schema-aligned repository tag or commit;
2. its Docker-reproducible ELF SHA-256 digest;
3. its SP1 verifying-key `bytes32()` value; and
4. proof-file digests, or a signed evidence manifest, for the two successful fixtures.

Until those identifiers are independently reproduced and added in a new evidence record, the contract is frozen but no production proof service is approved or advertised.
