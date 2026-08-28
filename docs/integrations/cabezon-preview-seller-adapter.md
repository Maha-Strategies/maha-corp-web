# CABEZON Preview Seller adapter

## Scope

This adapter is a private, Preview-only compatibility surface for testing a bounded CABEZON Seller lifecycle. It does not replace Maha's existing public CARP/CABEZON discovery profile or any separately governed x402 experiment.

The adapter projects the canonical Maha offer catalog without payment terms and supports only:

1. exact pre-registered CARP Customer/Seller identity binding;
2. read-only offer discovery;
3. a free enquiry;
4. a deterministic fixture delivery reference; and
5. acknowledgement of that reference.

It cannot collect money, establish escrow, execute work autonomously, mutate the knowledge corpus, release canonical records, or deliver a customer artifact. `purchase_disabled` is explicit on every projected offer.

## Identity boundary

The current identity check is exact binding validation, not a new CARP signature implementation. The submitted DID, SAD SHA-256 digest and credential-free HTTPS endpoint must byte-match a pre-registered binding. A substituted endpoint fails even when the DID and digest are unchanged.

Configure Preview only:

- `CABEZON_PREVIEW_ENABLED=true`
- `CABEZON_PREVIEW_TOKEN` with at least 32 characters
- `CABEZON_PREVIEW_SELLER_BINDING_JSON` containing one binding object
- `CABEZON_PREVIEW_CUSTOMER_BINDINGS_JSON` containing 1–20 binding objects

The route gate also requires `VERCEL_ENV=preview`; Production returns 404 regardless of the feature flag.

## Private routes

- `GET /api/integrations/cabezon/preview/offers`
- `POST /api/integrations/cabezon/preview/enquiries`
- `POST /api/integrations/cabezon/preview/lifecycles/{lifecycleId}/delivery`
- `POST /api/integrations/cabezon/preview/lifecycles/{lifecycleId}/acknowledgement`

Every request requires the Preview bearer. Mutations require an `Idempotency-Key`. Responses are `no-store`, `noindex`, and omit enquiry prose and identity bindings.

## Persistence and replay

Apply `supabase/migrations/20260828110000_cabezon_preview_seller_adapter.sql` to the isolated Preview database before enabling the routes. The migration creates a lifecycle projection plus append-only event and action-idempotency ledgers. Public, anonymous and authenticated database roles receive no access; only the server-side service role can call the transition functions.

The lifecycle is:

`enquiry_received → offer_returned → delivery_recorded → acknowledgement_recorded`

An identical idempotency replay returns the stored lifecycle without adding an event. Reusing a key for changed input fails with `409`.

## Canary protocol

The local deterministic rehearsal is:

```sh
npm run canary:cabezon:private
```

Its committed, sanitized fixture is `fixtures/cabezon/preview-lifecycle.json`. Regeneration must be byte-identical.

The remote workflow is `.github/workflows/preview-cabezon-seller-canary.yml`. Its target URL is not dispatch input: `CABEZON_PREVIEW_BASE_URL` is a protected environment secret and must be the exact trusted `*.vercel.app` Preview origin. This prevents a dispatcher from redirecting the bearer or Vercel bypass secret to another host.

Before dispatch, configure the `preview-database` environment with:

- `CABEZON_PREVIEW_BASE_URL`
- `CABEZON_PREVIEW_TOKEN`
- `CABEZON_PREVIEW_SELLER_BINDING_JSON`
- `CABEZON_PREVIEW_CANARY_CUSTOMER_BINDING_JSON`
- `VERCEL_AUTOMATION_BYPASS_SECRET` when deployment protection requires it

Dispatch with confirmation `RUN PRIVATE CABEZON CANARY`. The uploaded artifact contains digests, statuses and event types only—never the bearer, bypass secret or enquiry prose.

## Promotion boundary

Do not add authenticated customer artifact delivery, payment, escrow, order execution, Production enablement or public indexing based on this canary alone. Those require separate threat modelling, authorization and a new protocol revision.
