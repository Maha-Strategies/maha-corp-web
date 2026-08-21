# x402 public evidence: discover, validate, decide

For an autonomous agent, a registry, or a conformance tool inspecting Maha's
x402 capabilities **without a credential and without seeing any source text**.

## Discover

```
GET https://www.mahastrategies.com/.well-known/x402-public-manifest.json
```

One document. Per offer: canonical resource, method, payment terms where
published, schema URLs, declaration-integrity digest, limits, retention
posture, and capability boundaries.

## What the manifest does and does not assert

It asserts **declared configuration** as of `configurationAsOf`. It explicitly
does not assert liveness, settlement history, registry indexing, uptime, or a
trust score — and it carries those five denials as machine-readable booleans in
`assertionBoundary`, so a consumer can check the boundary rather than parse
prose for it.

### `configurationAsOf` is not a freshness signal

The field is named for what it is: **the configuration snapshot this static
document describes**. It is deliberately not called `generatedAt`, because that
name invites the reading "last verified" — the one meaning it must never carry.

| It is | It is not |
| --- | --- |
| The snapshot of declared configuration in this document | A live probe time |
| Deterministic, so the artifact is reproducible | A build timestamp |
| Changed when the described configuration changes | A freshness, uptime, indexing or settlement observation |

The document states this in-band, so a consumer never has to find this page:

```jsonc
"configurationAsOfMeaning": "configurationAsOf is the configuration snapshot this document describes. It is not a probe time, a build timestamp, a freshness signal, or an observation of uptime, indexing or settlement."
```

**If you need to know whether an offer is payable right now, send an unpaid
request and read the 402.** Nothing in this document can answer that, by
design.

```jsonc
"assertionBoundary": {
  "assertsConfiguration": true,
  "assertsLiveness": false,
  "assertsSettlementHistory": false,
  "assertsRegistryIndexing": false,
  "assertsUptime": false,
  "assertsTrustScore": false,
  "configurationAsOfMeaning": "…not a probe time, a build timestamp, a freshness signal…",
  "proofOfPayability": "A live HTTP 402 PAYMENT-REQUIRED challenge from the canonical resource is the only proof an offer can be bought."
}
```

**Payment terms appear only on offers whose status is `active`.** A `withheld`
offer answers 401; publishing terms for it would invite a payment that cannot
succeed. `mps-autonomous-audit` is withheld today and its `payment` field is
`null` for exactly that reason.

| Status | Meaning |
| --- | --- |
| `active` | Declared payable. **Confirm with a live 402 before paying.** |
| `withheld` | Deliberately not payable. Do not attempt payment. |
| `evaluation-only` | Do not build against this. |
| `unavailable` | Not offered. |

## Validate

```bash
npm run verify:x402-public-evidence
```

Re-derives the manifest from the offer catalog, re-derives every declaration
digest, checks the conformance roll-ups against their own dimensions, and
refuses any secret or internal URL. **No network call, no payment, no
credential.** A hand-edited manifest fails, because a claim nobody derived is
not evidence.

## Two verdicts, deliberately not one

```
GET https://www.mahastrategies.com/.well-known/x402-conformance-result.json
```

**Protocol conformance** — is the payment contract well-formed, and is
payment-breaking behaviour absent?

**Discovery eligibility** — would a registry list this offer?

They fail independently, and tests assert they cannot leak into each other. A
replay-protection failure must not be softened by discovery passing, and a
stale digest must not be reported as a payment problem. There is no combined
score, and the validator rejects a document that publishes one.

Each dimension declares **how** its verdict was reached:

| Evidence class | Weight |
| --- | --- |
| `paid-settlement` | Strongest, and the rarest. |
| `unpaid-live-probe` | The live endpoint answered. |
| `local-contract-test` | Deterministic and reproducible — but it exercises Maha's implementation, not a deployed third party. |
| `third-party-tool` | An external tool's output. |
| `not-observed` | **Neither passing nor failing.** It was not measured. |

`settlement-observed` is `not-observed` today. No paid settlement was performed
to produce this document, so payment-path behaviour beyond the unpaid challenge
is unverified here. That is the single most important line in the file.

## Decide: when to request human review before paying

A reasonable agent policy, in order:

1. **Fetch the manifest.** If the offer is not `active`, stop.
2. **Request the resource unpaid.** No 402 challenge means not payable now,
   whatever the manifest says. The challenge is the authority; the manifest is
   a hint.
3. **Compare the challenge to the manifest** — resource, method, network,
   asset, amount. Any disagreement is a stop condition, not a rounding
   difference.
4. **Check the declaration digest** against the manifest. A mismatch means the
   published contract changed after you read it.
5. **Read the conformance result.** Treat `not-observed` as unknown, never as
   pass.
6. **Escalate to a human** when: the amount exceeds your standing authority;
   `settlement-observed` is not `paid-settlement`; any digest or term
   disagrees; retention says `verbatimExcerptsRetained: true` and your input is
   sensitive; or the offer creates a durable job (`requiresIdempotency: true`)
   and you cannot guarantee a stable idempotency key.

## This is not an independent trust score

Maha publishes evidence about Maha. It is reproducible, digest-pinned and
sanitized, and it is still self-reported. It is not an audit, not a rating, and
not a substitute for your own policy. Where a third party has assessed the
endpoint, that assessment is theirs to publish, not ours to summarize.

## Sanitization

No credential, payment signature, request content, response body, raw header,
or customer data appears in either document. The generator refuses to write a
file that trips a forbidden pattern, and tests assert the refusal works by
feeding it leaks on purpose.

## Status

**Implemented and locally verified.** Manifest generation from the catalog,
digest derivation, status and payment-term consistency, the separated verdict
model, sanitization refusal, and 18 tests including negative cases for stale
digests, wrong resource/network/version boundaries, roll-up disagreement,
flipped sanitization flags, and leaked secrets.

**Public and externally reproducible once merged and deployed.** Both documents
are served from `/.well-known/`; anyone can fetch them and re-run
`verify:x402-public-evidence` from a clone.

**Intentionally deferred.** Any liveness, settlement-count or freshness claim
that would need continuous probing to remain true.

**Still needs third-party validation.** Independent conformance tooling reading
this manifest; a registry consuming it; and a paid settlement to move
`settlement-observed` off `not-observed`.
