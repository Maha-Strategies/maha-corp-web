# Celestial calculation products v0.1

Status: **production promotion authorized on 2026-09-09**, with catalog and
CABEZON seller declarations prepared. Deployment and live verification are
separate release steps; catalog availability alone does not prove indexing.
Existing public knowledge HTML remains free. Existing enterprise celestial
authentication, consent, report storage and billing are unchanged.

## Offers

| POST route | USDC | Bounded output |
| --- | ---: | --- |
| `/api/v1/calculations/positions` | 0.01 | Seven classical bodies, one UTC instant, Tropical and versioned Lahiri Sidereal longitudes |
| `/api/v1/calculations/chart` | 0.05 | One chart, Sidereal whole-sign houses, mean nodes, geometric aspects and panchanga |
| `/api/v1/calculations/vimshottari` | 0.10 | Birth balance, nine mahadashas, nine antardashas in the active mahadasha at one reference instant |

Prices are pilot prices, not benchmarked market rates. Catalog status and
`X402_RESOURCES` are separate gates. Preview verification is unpaid. The user
separately authorized up to 0.16 USDC for three sequential production indexing
canaries, one per product; this is not standing authorization for repeat purchases.

GET on each exact route is free contract discovery and does not calculate the
caller's input. The full schemas and synthetic examples also derive from the
offer registry at `/api/discovery/x402-offers/{offerId}`. Static agent documents
describe their available contracts. No new MCP server or tool transport is
introduced; a future MCP adapter must respect this same execution contract.

## Input and scope

Use JSON POST bodies, at most 2,048 UTF-8 bytes, with exactly the declared fields.
Unknown fields (including names, notes, email addresses and local place labels)
are rejected. `dataClass` must be `public` or `synthetic`. This is a caller
declaration, not an automatic detector of personal data.

All products require `instantUtc`, in canonical `YYYY-MM-DDTHH:mm:ss.sssZ` form,
within 1600–2099. The caller resolves local time, DST folds and missing local
times. Impossible dates are rejected, not silently normalized.

Chart and timing require numeric `latitudeDegrees` (-89.9 to 89.9) and
`longitudeDegrees` (-180 to 180). Elevation is fixed to zero; no geocoding runs.
Timing also requires `referenceInstantUtc`, at or after the birth instant and
strictly less than 100 × 365.2425 days later, itself within 1600–2099.

Synthetic position example (not an actual person's birth record):

```json
{"dataClass":"synthetic","instantUtc":"2000-01-01T12:00:00.000Z"}
```

The two frames are explicit, not averaged. House placement is Sidereal
whole-sign only. The Lahiri calculation uses Maha's versioned J2000 anchor and
IAU2006 precession, not a promise of exact Swiss Ephemeris equivalence. Timing
uses actual nakshatra stay time and a 365.2425-day year. A reference date does
not purchase every subperiod over a horizon. No transit-window/station solver,
forecasting narrative, outcome recommendation or predictive certification is sold.

Only the existing deterministic computation functions are called. No Anthropic,
OpenAI, model inference, new LLM dependency, geocoder or source acquisition is
needed for these calculations. Existing shared x402 infrastructure remains in use.

## Privacy boundary

- Never put personal birth details in query strings, headers or payment metadata.
- Query strings are rejected without echoing them. This cannot erase a URL already
  received by a CDN, browser or hosting log: clients must never send it there.
- The service does not persist input, output, `inputDigest` or `receiptDigest`.
  Those digests are returned privately to the caller; hashes of guessable birth
  information are not anonymization and must not be published.
- Payment infrastructure receives the standard authorization and fixed offer URL,
  not the calculation body. The application does not add birth details to on-chain
  data. Wallet and payment records remain subject to blockchain visibility.
- Existing usage metering retains offer/status and coarse discovery categories,
  not raw User-Agent, referrer, IP, input or output. It is not proof of demand.
- Sentry's existing scrubber removes request bodies, headers, query strings,
  application extras and exception messages. The Vercel log-drain inventory was
  empty at release review; this is not a guarantee about every platform-internal
  access record. No actual personal
  record was used in development or testing.

## Payment and enterprise separation

These **exact** three routes own their x402 gate, rather than entering the generic
enterprise credit gate. They reject `Authorization` and `x-api-key`, including
requests also carrying payment. Enterprise clients continue using
`/api/v1/celestial` under the existing contract. No tenant API unit or enterprise
report unit is consumed by this new service.

The route validates a bounded input and prepares its deterministic output before
settling a presented payment. It releases the output only after the normal x402
gate admits it. These three offers reserve capacity before settlement; refusal
does not settle the authorization. Reservations are released on failed payment
and thrown settlement operations. Forged `x-maha-*` headers do not grant access. Slots are released
in `finally`. `PAYMENT-RESPONSE` and the calculation receipt are distinct artifacts.

There is no durable calculation job or stored response. Existing protocol replay
protection prevents reusing an authorization as a new purchase. A new authorization
is a new purchase; no input-digest-based idempotent recovery is promised. Network
loss after settlement remains a disclosed limitation: do not claim exactly-once
delivery, automatic refunds or response retrieval. Never retry with a new payment
until the first outcome has been reconciled. Personal-input workloads are excluded.

## Receipts and buyer verification

`inputDigest` is SHA-256 of the normalized input encoded as sorted-key JSON.
`receiptDigest` is SHA-256 of the entire response except `receiptDigest`, encoded
the same way. Arrays retain order, object keys are sorted, non-finite numbers are
rejected and optional undefined core fields are absent from the JSON wire form.
Every convention/version and numerical result is included in the commitment.

`verifyCelestialProduct(offerId, expectedInput, response)` checks the digest and
recomputes the expected product locally. It does not verify signatures, settlement
or astrology's predictive validity. The existing buyer-delivery checker separately
pins exact captured request/response bytes, validates their schema, and invokes
this calculation verifier. A private trusted capture is necessary to claim that
a particular response was received; locally fabricated capture bytes prove no
external buyer interaction.

## Repeatable zero-payment checks

```sh
npm run test:x402-celestial
npm run benchmark:x402-celestial
npm run celestial:conformance
npm run verify:x402-public-evidence
npm run typecheck
```

The payment suite injects a synthetic facilitator, ledger, chain confirmer,
capacity store and telemetry sink. It tests free discovery and unpaid challenges,
correct price binding, rejected/duplicate payments, chain contradictions, output
delivery and digest verification independently. No wallet, secrets, production
credentials or paid services are used.

The benchmark measures warm local compute and response size, not cloud cost or
profit. The pilot has no model or external calculation API cost; hosting,
facilitator, storage, failures and support are not zero. No measured cloud-margin
percentage is claimed. Review real invoice and latency data before scaling volume.

## Demand accounting

`summarizeCalculationDemand` accepts confirmed gateway-ledger records with the
exact resource URL. It separates operator wallets and known publisher-funded
transactions from external repeat wallets; conflicting, unconfirmed, failed and
amount-only records are excluded. The operator/funding inventory must be complete.
The helper can consume a private reconciled gateway export; no new public buyer
reporting endpoint or automatic export job has been added.

These prices overlap existing products. Base transfers alone cannot identify the
product; do not label a 0.01 transfer as a position calculation without a recorded
route. The public settlement refresh continues excluding withheld offers from
its price catalog. Settlement, delivery, indexing and customer value remain four
different observations. All test fixtures here are synthetic, not customers or
publisher-funded on-chain canaries. The separate protected workflow records real
canaries as publisher-funded and refuses automatic workflow reruns. After verified
settlement and payload, its state is `settled_and_verified_pending_index` until
delayed read-only observations find the exact Bazaar resource and price. Indexing
lag does not cause another purchase.

## Release gates

Local verification on 2026-09-09: 212 targeted regression tests passed; TypeScript,
targeted lint and the existing 180-case conformance command passed. Actual Next
development HTTP routes returned GET 200 and POST 402 at 10000, 50000 and 100000
USDC base units using the synthetic examples. Local probes supplied HTTPS
forwarding metadata because the existing protocol requires HTTPS resource URLs;
that requirement was not relaxed. This was not a Vercel Preview or production build.

Thirty warm synthetic calculations per offer measured p95 compute of approximately
0.75 ms (positions), 2.46 ms (chart) and 8.77 ms (timing), with response sizes
2,445 / 12,023 / 6,244 bytes. These development-machine measurements are not a
service-level promise or margin estimate. The simulation used no real payments.

1. Run local suites and inspect schemas, fixed examples, limits and licence usage.
2. Verify Preview GET/POST behavior, safe logging configuration and request caps.
3. Review measured economics and payment failure/recovery semantics.
4. Obtain production-promotion authorization, mark offers available and add exact
   routes to `X402_RESOURCES`; preserve all existing enabled resources.
5. Deploy, confirm unpaid 402 challenges, then separately authorize any real paid
   canary. Verify settlement and buyer payload before delayed read-only indexing
   checks. Record canaries outside external customer demand.
