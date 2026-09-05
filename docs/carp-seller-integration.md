# Maha CARP/CABEZON Seller Integration

Maha's CABEZON Seller profile publishes the same three digitally delivered products that are payable through Maha's Production x402 boundary:

| CABEZON `offeringRef` | Product | Fixed direct-x402 price |
| --- | --- | ---: |
| `maha:context-compression:v1` | Context Compression | 0.001 USDC |
| `maha:deep-context-evaluation:v1` | Deep Context Evaluation | 0.01 USDC |
| `maha:mps-autonomous-audit:v1` | MPS Automated Claim Triage | 0.10 USDC |

The Seller profile derives the amount, resource, status, capability boundaries, retention statement, and idempotency requirement from Maha's authoritative x402 catalog. CABEZON discovery does not create a second price or widen what any product claims to do.

The Seller profile also publishes **Samley Signature Collection Cinnamon Tea — Pallet RFQ** as an enquiry-only physical-goods offer. Maha remains the CABEZON Seller and RFQ coordinator; Samley Teas is named only as the prospective fulfilling exporter, with no CABEZON membership or standing partnership asserted. `purchase` fails closed with `QUOTE_REQUIRED` and returns no payment instructions.

The profile additionally publishes **Bogawantalawa Legend Black Tea — one-box retail test** under `maha:bogawantalawa-legend-black-tea:retail-test-v1`. Maha owns one sealed 100 g retail box (50 × 2 g tea bags) purchased locally in Sri Lanka and acts only as the seller of that unit. No manufacturer authorization, distributorship, retailer relationship, replenishment, or long-term availability is asserted. The photographed outer packaging has visible minor compression/creasing, which must be disclosed to and accepted by a buyer.

This one-unit listing is also enquiry-only and `purchasable: false`. A purchase-shaped call using the exact three-field RFQ boundary returns `QUOTE_REQUIRED` without payment, escrow, or delivery instructions. Before creating an order-specific purchasable offer, Maha must reconfirm the unit, check the destination-specific food-import and carrier path, obtain the recipient/importer details, quote shipping and total price, allocate duties and taxes, and record the buyer's acceptance of package condition. Statements printed on the manufacturer packaging are label evidence, not independently verified Maha claims; Maha adopts no health or environmental claim from the box.

The product evidence is published at `https://www.mahastrategies.com/artifacts/carp/bogawantalawa-legend-tea-retail-test-v1.json`. It records label transcription, inventory and commercial boundaries, and SHA-256 digests of the four seller-supplied photographs. The artifact now links byte-identical public inspection copies of those photographs; no local paths, buyer data, credentials, or receipt image are published.

The RFQ purchase boundary accepts exactly this CABEZON v0.2 object while the offer remains enquiry-only:

```json
{
  "offeringRef": "maha:samley-cinnamon-tea:rfq-v1",
  "quantity": 1,
  "agreedPrice": null
}
```

Legacy positional arguments and object fields outside those three keys are refused with JSON-RPC `-32602`. In particular, delivery, payment, escrow, customer-reference, and special-instruction fields are not accepted at this boundary. This prevents a caller from treating an RFQ request as an order or silently supplying pre-quote commercial instructions.

The confirmed reference configuration is item **SG-S8**: 40 g boxes containing 20 individually wrapped tea bags, 24 boxes per master carton, 99 cartons (2,376 boxes) per approximately 230 kg pallet, with a reported three-year shelf life. The supplier indicated an FOB product price of USD 0.60 per box, making the indicative pallet product value USD 1,425.60. This is non-binding, has no named FOB port, and excludes freight, insurance, duties, taxes, clearance, warehousing, and last-mile delivery.

### Physical RFQ gate

Before the physical offer can become purchasable, the durable offer record must bind:

- Samley's confirmation of availability and authority to supply the quoted product;
- the final carton/pallet dimensions, weight, certificate set, FOB port, price, currency, payment terms, and quote expiry;
- destination country and the importer/consignee responsible for lawful import;
- customs, duties, labelling, inspection, carrier, tracking, delivery, rejection, refund, and dispute terms; and
- a reviewed escrow or payment flow that keeps the product price, CARP admission fee, buyer bond, escrow fee, freight, duties, and Maha margin distinct.

Until every order-specific item is confirmed by the supplier and buyer, the profile is useful only for CABEZON discovery and RFQ enquiries. It cannot take money or create an order.

## Public identity and contracts

- Canonical Seller role: `https://raw.githubusercontent.com/bitsanity/cabezon/master/roles/seller.json`
- Maha's merged upstream contribution: `https://github.com/bitsanity/cabezon/pull/1`
- Maha role mirror: `https://www.mahastrategies.com/.well-known/carp/seller-role.json`
- Maha Seller profile: `https://www.mahastrategies.com/.well-known/carp/seller.json`
- Maha DID: `https://www.mahastrategies.com/.well-known/carp/did.json`
- Maha signed Agent Descriptor (SAD): `https://www.mahastrategies.com/.well-known/carp/sad.json`
- CARP endpoint: `https://www.mahastrategies.com`
- Fulfillment resources:
  - `POST https://www.mahastrategies.com/api/v1/compress`
  - `POST https://www.mahastrategies.com/api/v1/compress/evaluate`
  - `POST https://www.mahastrategies.com/api/v1/mps/audit`

The public DID is a `did:key` derived from a dedicated secp256k1 key. The SAD is RFC 8785-canonicalized and signed as detached ES256K JWS. The private key is stored only as the sensitive Production environment variable `CARP_AGENT_PRIVATE_KEY`; it must never appear in this repository, logs, artifacts, or discovery responses.

The Seller role is no longer a Maha-only proposal. Bryan merged Maha's physical/digital fulfillment generalization as CABEZON Seller model v0.2. The public mirror therefore records the canonical source and contribution rather than claiming an unadopted extension. El-Cabezon has returned Maha in the live Seller directory, so the public profile records directory membership as confirmed separately from any buyer-to-seller peer approval.

## Transport and trust boundary

The public CARP compatibility layer implements:

- `GET /cgi-bin/did`
- `GET /cgi-bin/maha-strategies`
- `GET /cgi-bin/challenge`
- `POST /cgi-bin/response`
- `POST /cgi-bin/encrequest`
- `POST /cgi-bin/encresult`

Identity proof uses ADILOS. Seller requests and asynchronous results use `ecjsonrpc` encrypted JSON-RPC. Only El-Cabezon's published compressed public key is currently allowlisted. CABEZON directory membership does not automatically approve a member as a direct Maha peer: Maha requires the prospective peer's canonical SAD/DID public key and callback URL before changing the allowlist. Session challenges and received answers use environment-scoped Upstash keys rather than instance-local files, so serverless invocations do not pretend to have persistent local state.

The implementation intentionally does not expose the reference host's LAN-only `nextrequest`, `nextanswer`, `result`, `adddid`, or `obrequest` CGI endpoints. Seller replies are handled at the request boundary and delivered asynchronously to El-Cabezon's `encresult` endpoint using Next.js `after()`.

## Digital fulfillment model

Each digital enquiry result follows the merged Seller v0.2 shape. The stable references are:

- `offeringRef: maha:context-compression:v1`
- `offeringRef: maha:deep-context-evaluation:v1`
- `offeringRef: maha:mps-autonomous-audit:v1`

For every offer the returned record includes:

- `kind: digital`
- the offer's exact decimal USDC price on `eip155:8453`
- digital JSON fulfillment with an offer-specific estimate and deadline
- input and output schema links to the public offer contract
- exact limitations preserved from the authoritative x402 catalog

The purchase method accepts the v0.2 object shape and the legacy array during the compatibility period. It resolves the exact `offeringRef`, then validates quantity, price, network and digital delivery mode before returning an order-bound direct-x402 instruction for that offer. A price copied from one Maha offer cannot authorize either of the others.

CABEZON v0.2 describes escrow as authoritative for its standard order lifecycle. Maha's initial bounded experiment makes the existing direct-x402 settlement explicit instead of inventing an escrower. The purchase response therefore includes `mode: x402_direct`, `service: x402`, the exact resource, Base USDC contract, payee and base-unit amount. It must not be represented as an escrow-backed CABEZON order until a compatible escrower exists and has been tested.

Digital delivery evidence consists of:

- the x402 `PAYMENT-RESPONSE` transaction,
- the product-specific result identifier and published digests,
- the returned result bytes when a content digest is published.

A digest proves byte identity, not correctness, quality, buyer acceptance, or entitlement to release escrowed funds. No source text or compiled context is placed in a public fulfillment descriptor.

## Verification sequence

1. Verify the published DID and SAD signature:

   ```bash
   npm run verify:carp-identity -- https://www.mahastrategies.com/.well-known/carp/sad.json
   ```

2. Run the non-paying identity handshake and encrypted Concierge `about` request:

   ```bash
   CARP_AGENT_PRIVATE_KEY='<dedicated-key>' npm run handshake:carp
   ```

   This creates a sanitized artifact containing public identity, peer identity, check results and a request ID. It never records the private key, session key, ADILOS challenge/response, encrypted payload, or result content.

3. Confirm that El-Cabezon returns Maha's SAD under the Seller directory. This has completed; it does not by itself authorize every CABEZON member as a direct Maha peer.

4. Run one free encrypted `enquiry` for each exact digital `offeringRef` and verify that the Seller returns only the requested canonical offering.

5. Run local, non-paying `purchase` contract checks for all three offerings and verify that each returns only its own exact amount and resource. A CARP admission fee, Mall rent, or escrow payment is out of scope unless its real recipient and terms are separately reviewed.

6. Only with fresh, offer-specific authorization, make a bounded x402 payment and preserve the resulting transaction, product result identifier and output digest. Do not treat authorization for one amount or offer as authorization for another, and do not repeat a signed payment after an ambiguous response.

7. Publish the sanitized evidence and ask Bryan to cite the verified integration. Directory confirmation and a completed delivery are facts to prove separately.

### RFQ purchase verification

The metadata-only record at [`../artifacts/carp/rfq-purchase-verification-v0.2.json`](../artifacts/carp/rfq-purchase-verification-v0.2.json) records the bounded live verification completed through El-Cabezon. It proves the response boundary only: encrypted transport, an explicit `QUOTE_REQUIRED` error, and absence of payment, escrow, and delivery instructions. It does not prove a supplier order, a payment flow, fulfillment, delivery, or settlement.

### Thrivbe buyer-side review

The sanitized record at [`../artifacts/carp/thrivbe-buyer-review-2026-08-27.json`](../artifacts/carp/thrivbe-buyer-review-2026-08-27.json) preserves Robin/Thrivbe's independent review. Directory discovery and the public commercial-boundary inspection passed. Maha's direct encrypted enquiry failed closed with HTTP 401 because Thrivbe's identity was not separately approved as a Maha peer. No purchase, payment, escrow, reservation, or delivery action occurred. A single retry is permitted only after Maha verifies Thrivbe's canonical public key and callback URL; the first 401 is not rewritten as a successful round trip.

## Failure boundaries

- An unknown CARP key is rejected before decrypting a request.
- A stale quote, wrong network, wrong asset, physical destination, or duplicate logical order is refused.
- The Seller never signs the buyer's x402 payment.
- Payment instructions are not delivery evidence.
- A transport acknowledgment is not directory membership.
- No CARP rent, admission fee, or escrow amount is inferred from placeholder role files.
- An x402 failure remains an x402 failure; it is not translated into a shipment or fulfillment event.
