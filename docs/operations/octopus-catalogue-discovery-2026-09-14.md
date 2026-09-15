# Octopus catalogue compatibility — 2026-09-14

Status: implemented and verified locally; not deployed or observed by Octopus.
Branch: codex/octopus-catalogue-discovery, based on origin/main b038d48d.
The user's original dirty checkout was not changed.

## Change

- `/index.html` links to `/index.json`, the canonical seller profile and a free
  product-array catalogue. The main human homepage is unchanged.
- `/index.json` returns an array of service descriptors following the public
  Octopus index.json shape observed on 2026-09-14: service, descrip,
  http-request, authentication, synchronous and http-response.
- Free `about` and `catalog` GET services are distinct from paid product POSTs.
  Paid entries explicitly identify x402, exact terms, synthetic request examples
  and declaration/schema links. No generic CARP fee format is invented.
- Seller profile schemaVersion 0.1.4 derives all released, production-payable,
  unblocked digital offers from X402_OFFERS. It preserves legacy offering refs.
- Display prices derive from base-unit strings using integer arithmetic; no
  separate manual price table or rounding of sub-cent products remains.
- Catalogue includes 31 digital offers (including all 25 launch products), plus
  the two existing physical RFQs. Root menu has 33 services: two free catalogue
  accessors plus 31 digital services. These are different counts/meanings.
- Physical listings remain non-purchasable. No wallet, payment, peer allowlist,
  signed SAD, Nautilus record or production x402 configuration changed.

## Checks

- 30 catalogue/CARP tests passed, including existing exact purchase-price and
  RFQ refusal tests plus all-product coverage, examples and precision tests.
- Scoped ESLint passed.
- `next typegen` then full `tsc --noEmit --incremental false` passed.
- Local webpack-mode Next server returned 200 for index.html, index.json,
  api/discovery/carp/catalog and .well-known/carp/seller.json. JSON counts match.
- Turbopack local smoke check was blocked by the shared node_modules symlink;
  webpack worked. No production build or deployment is claimed.

## Remaining release verification

Ship this isolated change through the repository's release process. Confirm all
four production URLs, then check a newly timestamped Octopus report. Its parser
source was not available at the guessed public repository, so matching the
observed menu convention is not yet an end-to-end Octopus compatibility result.
Do not claim that an UP status proves payment, delivery or quality.

The existing signed SAD is not silently regenerated: any stale descriptive
claims in that separately signed artifact require an explicit reviewed refresh.
No paid request or re-indexing payment is needed to verify these GET surfaces.
