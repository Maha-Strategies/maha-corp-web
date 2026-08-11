# Three-offer x402 rollout

Operational record for the tiered autonomous offers. The catalog in
`lib/x402/offers.ts` is the source of truth for everything published; this file
covers the gates a promotion needs and the numbers behind them.

**Nothing here has been merged, migrated, enabled in Production, or settled on
Mainnet.** Two of the three offers are deliberately not payable.

## Status

| Offer | Method and path | Amount | Payable today |
| --- | --- | --- | --- |
| `context-compression` | `POST /api/v1/compress` | 1000 (`$0.001`) | yes — Production |
| `deep-context-evaluation` | `POST /api/v1/compress/evaluate` | 10000 (`$0.01`) | **no — preview** |
| `mps-autonomous-audit` | `POST /api/v1/mps/audit` | 100000 (`$0.10`) | **no — withheld** |

A published price is not an offer to sell. Only a live `PAYMENT-REQUIRED`
challenge proves an offer can be bought; `status` and `payableNow` in the
manifests are authoritative for everything else, and readiness fails if a
non-available offer is ever enabled for payment.

Matching is exact on method *and* path, which is what keeps
`POST /api/v1/mps/audit/{auditId}` unpriced: recovering a job you already paid
for must never cost a second payment.

## Payment-header interoperability

x402 v2 asks a payer to echo the declaration it was served. Vercel caps a
request header at 16 KB and the parser enforces 16,384 characters. Measured
through the real `createPaidFetch`, the shipped client produced:

| Offer | Before | After |
| --- | ---: | ---: |
| `context-compression` | 16,232 | 9,120 |
| `deep-context-evaluation` | 26,920 | 11,828 |
| `mps-autonomous-audit` | 10,376 | 6,752 |

Two of three were unpayable by a conforming client, failing as
`payment_header_too_large` on a payload the payer built correctly from our own
challenge.

The fix shrinks what the challenge sends, not what clients must speak. The 402
carries a complete-but-compact declaration — every required field, type, enum
and const, plus a **verbatim** input example — and the uncompacted schemas are
served at `/api/discovery/x402-offers/{offerId}`, which the challenge links via
`maha-offer.declarationUrl`.

Compaction only ever loosens a schema, so the inline form never rejects a
payload the endpoint accepts. Two exemptions are deliberate: input examples are
never truncated, because the deep contract requires evidence spans to be exact
substrings and a crawler that paid and replayed a broken example would get a
400; and arrays of short strings are kept whole, because `warningCodes` is the
machine-readable limitations list.

Digest-only binding survives as an **optional Maha extension**, documented as
such. External interoperability does not depend on it — the full echo fits.

Budget: 12,288 characters (75% of the hard limit). The test fails on the budget
so a future field surfaces in CI rather than as an unpayable offer.

## Idempotency and recovery

The proxy settles before the route runs, so route-level deduplication could
never prevent a double charge. A payer whose request timed out retried with a
freshly signed authorization, paid twice, and was told `idempotentReplay: true`.

The claim is now taken between verification and settlement — the only window
where the payer is known and no money has moved — binding offer, payer,
idempotency key, declared input hash, resource and price in a single
`INSERT ... ON CONFLICT`. A repeat returns the original transaction without
settling; a key reused with different input is refused 409 before settlement; an
unreadable store refuses rather than failing open. The route then enforces the
declared hash against the real body, so the header cannot lie.

Payers of an idempotent offer must send `x-maha-idempotency-key` (equal to
`clientRequestId`) and `x-maha-input-hash`.

Recovery no longer depends on a secret held only in a response. The retrieval
credential is derived from `X402_RETRIEVAL_TOKEN_SECRET` and the audit id, so it
is recomputable on any instance and re-issued on the free idempotent replay. If
the secret is absent the route refuses **before** the model boundary rather than
taking money for a job nobody could open. No background execution was added; an
unawaited promise on a frozen serverless instance is not durability.

## MPS unit economics

Computed in `lib/x402/mps-unit-economics.ts`, asserted in tests. `claude-sonnet-4-6`
at $3/$15 per MTok, 1,500 max output tokens, ~700-token prompt template.

The previous version called 0.5 tokens/character a worst case. It is not:
English prose is ~0.25, and dense CJK, minified code or base64 reach roughly
1.0 — and the cap is expressed in characters, so nothing prevents it.

| | Expected (0.5 t/c, 15% failures) | **Conservative (1.0 t/c, 35% failures)** | 32 KB hypothetical |
| --- | ---: | ---: | ---: |
| Model incl. retries | $0.0394 | $0.0627 | $0.1810 |
| Facilitator + infra | $0.0070 | $0.0070 | $0.0070 |
| **Total cost** | **$0.0464** | **$0.0697** | **$0.1880** |
| **Margin at $0.10** | 53.6% | **30.3%** | **−88.0%** |
| Minimum safe price | 46,396 | **69,729** | 187,977 |

**Verdict: the price is sound.** The conservative margin of 30.3% clears the
25% promotion floor. Two caveats: the offer remains withheld for infrastructure
reasons, not economic ones — a green margin is not permission to ship; and the
6,000-character passage cap is doing real commercial work. At a genuine 32 KB
passage the offer is **loss-making** ($0.19 to serve for $0.10). The earlier
calculation showed that case as narrowly profitable only because it priced
tokens at half their worst rate.

## Retention, stated correctly

The earlier claim — "no source text is retained" — was true of the compression
offers and **false of the MPS audit**, whose results identify each claim by a
6–25 word verbatim excerpt. A result that could not quote what it tagged would
be unusable, so excerpts are retained by design.

Published everywhere now: *the complete submitted passage is not retained; audit
results retain short verbatim claim excerpts, classifications, rationales,
hashes, and operational metadata.* Corrected in the catalog, OpenAPI, agent
card, agent offers, `llms.txt`, the response body and its schema, the migration
comments, and tests.

The compression offers genuinely retain nothing and still say so.

## Analytics

`x402_repeat_payers` counted rows in `x402_payments` — the replay guard, written
*before* settlement returns — so failed and contradicted attempts counted as
purchases, inflating the exact number a subscription decision would rest on.

It now joins `x402_settlements` and counts only `chain_status = 'confirmed'`.
Unconfirmed and failed attempts are reported in separate columns rather than
folded in or dropped: a deployment without a chain RPC would otherwise report a
confident zero.

## Readiness

`GET /api/admin/x402-readiness`, behind the existing readiness bearer token.
Reports configuration contradictions, missing tables and migrations, an offer
enabled but published as preview/withheld, settlement configuration validity,
and discovery consistency. 503 on any failure, so it can gate a promotion.

It reports state, never configuration: no secret, credential, payee, asset
address or facilitator host appears in the output, and a test asserts that.

`withheld` enabled anywhere is a failure. `preview` enabled is a warning —
that is the intended state outside Production, and failing on it would train
operators to ignore the one signal that matters.

**No environment currently enables either new offer.** The branch-scoped
Preview variable that briefly enabled Deep Context has been removed; earlier
Preview deployments built while it existed still carry it in their frozen
environment and should be deleted or left to expire rather than promoted.

## Remaining infrastructure gates

These are external and none of them is worked around in code.

1. **The unified Maha platform database has pending migrations.** Maha OS and
   Maha's infrastructure products intentionally share one governed Production
   store; separation into another Supabase project is no longer a promotion
   gate. The pending offer telemetry, MPS audit-job and admission migrations
   must still be reviewed, applied through the protected migration workflow,
   and verified before either offer is enabled. Nothing is enabled merely
   because the architectural boundary changed.
2. **No paid end-to-end settlement** has been executed for either new offer.
3. **Durable recovery is proven in tests, not against a real deployment.**
4. `X402_RETRIEVAL_TOKEN_SECRET` (≥32 characters) must exist before the MPS
   offer can be enabled anywhere. It is currently unset, and the route refuses
   rather than degrading.

## Production environment changes required

None yet, and none should be made. When the gates above are cleared, promotion
would need `X402_RESOURCES` re-expressed as `method`+`path` entries (the old
`pathPrefix` spelling still parses, so the current value keeps working
unchanged) plus `X402_RETRIEVAL_TOKEN_SECRET` for the MPS offer.

Amount, description and concurrency cap are read from the catalog, so a stale
variable can no longer sell an offer at a price the manifests contradict;
contradictions are reported by readiness instead.
