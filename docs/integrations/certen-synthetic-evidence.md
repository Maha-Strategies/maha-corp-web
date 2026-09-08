# Certen developer example: evidence before signing, payload after delivery

**Status:** proposed Maha-side integration fixture v0.1. Synthetic, offline, unsigned, zero payments. Not a Certen implementation or conformance claim. No production APIs, customer information, wallets or credentials are required.

## What this demonstrates

A synthetic CABEZON buyer proposes a context-compression purchase at 1,000 USDC base units (0.001 USDC). A synthetic headless-signer boundary checks an independently pinned approval, identity labels, exact resource, recipient, amount, validity window, nonce, source evidence and selected context. It either returns `eligible_for_signer_review` or `withhold`.

The example runs Maha's real local context compiler against one short synthetic policy. Production-random pack IDs are replaced by one clearly synthetic fixed ID so artifacts and receipts reproduce byte-for-byte. It checks whether the stipulated text remains present; it does not establish that a model understood it or that the policy is substantively correct.

A separate, simulated post-execution stage captures a structured product response and replays the buyer-delivery verifier. A later delivery failure does not rewrite the earlier signing decision. The example cannot use a future response as a prerequisite for the payment that obtains it.

## Run

From the repository root, using its locked dependencies:

```sh
npm run demo:certen-evidence
npm run demo:certen-evidence -- --output-dir /absolute/path/new-certen-example
```

Choose a **new directory with an existing parent**. The exporter refuses to overwrite files. It writes:

| Artifact | Purpose |
| --- | --- |
| `example.json` | Exact proposed intent, synthetic approval, ordered source evidence, selected context and captured response. |
| `trust.json` | Independently supplied authorization/capture roots, fixed evaluation time, empty synthetic nonce history. |
| `request.json`, `response.json` | Exact captured bytes for offline replay. |
| `capture.json` | Byte commitments, product/route and simulated HTTP status. |
| `report.json` | Separate pre-sign and delivery outcomes, deterministic receipt, negative cases and limitations. |

Use the `captureSha256` from `trust.json` to replay the payload:

```sh
npm run verify:x402-buyer-delivery -- \
  --capture /absolute/path/new-certen-example/capture.json \
  --request /absolute/path/new-certen-example/request.json \
  --response /absolute/path/new-certen-example/response.json \
  --expected-capture-sha256 sha256:<captureSha256-from-trust.json>
```

All `synthetic:*` identities, recipient and network are non-operational labels, not valid addresses or real Certen identities. The fixed time is 2026-09-08T12:00:00Z; authority expires at 13:00:00Z. Keeping the clock fixed makes the fixture replayable; a real signer must use a trusted current clock. Test-only roots packaged alongside artifacts demonstrate reproducibility, **not independent attestation**.

## Proposed handoff to Certen

| Maha-side record | Certen integration question |
| --- | --- |
| Actor, signer, approved intent and nonce | How should these bind to actual ADI/Key Book authority and signature participation? |
| Exact resource, recipient, asset and amount | Which canonical Intent/execution commitment fields should the adapter use? |
| Ordered source IDs, source hashes and selected-context digest | Which evidence commitment does the headless signer consume, and how are missing records rejected? |
| Policy version, pinned approval and allow/withhold result | Who supplies the trusted approval and controls expiry, revocation and override? |
| Post-delivery byte commitments and local verifier result | How should this off-chain observation link to transaction identity and proof of effect without conflating them? |

The fixture's field names are **proposals for discussion**, not a claim to match Certen's current wire format. No actual Proof of Intent, Merkle proof, BLS signature, Authority Vault execution, ADI delegation, escrow release or on-chain proof of effect is generated or verified.

## Acceptance criteria

1. Identical fixture, trust roots, clock and nonce history produce the same verdict and receipt digest.
2. Original approved evidence yields `eligible_for_signer_review`; no signature is issued.
3. Changes to any intent field, policy approval, source evidence or selected context withhold. Expired/not-yet-valid authority and previously used nonces also withhold.
4. Missing, truncated, malformed or altered response bytes reject delivery. Processing jobs stay pending. No repurchase happens.
5. Unsupplied authority, settlement, remote buyer identity and substantive acceptance remain unverified—not inferred.

The exporter demonstrates five negative cases; the regression tests cover every intent field, rehashed authorization mutations, expiry, replay, malformed inputs, payload corruption and all 11 offer contracts.

## What Maha would preserve in a real bounded evaluation

With agreed access and retention rules: exact source/version locators and ordered digests; the context commitment; the request/resource and policy/authority commitments; each check and its limitations; the actual Certen proof/transaction references where available; post-delivery capture or authenticated acknowledgment; and a deterministic receipt tying those records together. Private source bytes can remain with their owner. Digests alone cannot recover missing source material or prove an absent observation.

Before any live build, Certen's developers need to confirm their signer adapter and canonical intent/proof formats, define the trusted clock and durable nonce/approval store, identify one customer workflow, and agree acceptance criteria and responsibility for each boundary. Customer-facing implementation is separate paid scope; this fixture creates no commercial commitment.
