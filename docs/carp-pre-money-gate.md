# CABEZON pre-money gate

Version 1.1.0 · synthetic-contract specification · no live payment authority

## Purpose

This gate defines the evidence that must be present before Maha can ask a buyer
to fund a CABEZON/escrobot order. It is a deterministic metadata evaluator, not
a blockchain client, screening provider, escrower, payment authorization, or
substitute for independent review.

`PRE_MONEY_READY_FOR_EXTERNAL_REVIEW` means only that all declared evidence was
supplied and passed the local structural checks. It always carries
`moneyAuthorized: false`. A real escrower must enforce its own release checks.

## Required preconditions

1. **Token behavior** — the token is explicitly allowlisted and behaves as a
   standard ERC-20 for this escrow path. Fee-on-transfer, no-boolean-return,
   and unknown token behavior block the order. This prevents recorded balances
   from exceeding escrow balances.
2. **Both counterparties** — buyer and seller each have clear blocklist,
   sanctions, and payability evidence. Checking only a seller cannot prevent a
   buyer-side transfer failure from blocking a release.
3. **Recipient capability** — the seller is classified as EOA or contract. A
   contract recipient must demonstrate the relevant receive/withdraw path;
   ETH pull-withdraw flows require both plain-ETH reception and an ability to
   initiate withdrawal.
4. **Escrow recovery** — verified deployed source, a positive timeout-block
   value, and successful synthetic tests for release failure, an unresponsive
   buyer after shipment, and administrator unavailability.
5. **Identity binding** — a Seller DID key signs a binding of its DID, seller
   EVM address, and the escrow-generated `bytes32` order ID. Seller-defined
   order references are not a substitute.

## Order and delivery evidence

`CARPEscrowOrderBinding` is detached ES256K JWS over RFC 8785 canonical JSON.
It binds the Seller DID, Seller EVM address, and escrow-generated order ID.

`signedEscrowDeliveryReference` is also signed by the Seller DID key, uses the
same on-chain order ID, and carries only structured request/result digests plus
an optional raw-binary artifact digest. It cannot authorize payment, prove
delivery retrieval, prove buyer acceptance, or release escrow.

## RFQ boundary

Every enquiry-only offer must publish `purchasable: false`, in addition to null
price and payment/escrow fields. Absence of payment terms is not a dependable
machine signal. A purchase attempt must return `QUOTE_REQUIRED` without payment
instructions.

## Deployment boundary

This gate is not connected to ClawFace, escrobot, an on-chain screening oracle,
or a funds-release transaction. Before any payment test, the chosen escrower
must state which conditions it enforces before deposit and immediately before
release, and how a blocked release is routed to arbitration/recovery.

## Confirmed current CABEZON boundary

Recorded 2026-08-22 from Bryan Woods&apos;s implementation description. This is a
description of the currently confirmed boundary, not an audit of ClawFace or
escrobot source code.

- **RFQ incompatibility:** escrobot requires a non-zero price to create an
  order. An enquiry-only offer with `purchasable: false` cannot use it as a
  paid RFQ escrower.
- **No protocol-bound commerce evidence:** escrobot does not enforce the
  Seller DID-to-wallet-to-`bytes32` order binding or a Seller-DID-signed,
  order-bound delivery reference. Putting a signature inside a tracking field
  would be an application convention, not an escrow contract control.
- **No stated escrow allowlist or preflight:** CARP&apos;s ACL establishes a
  handshake identity boundary; it is not a token-behavior allowlist, sanctions
  or blocklist screen, payability check, recipient-capability check, or
  before-release control. ClawFace currently proxies escrobot transactions
  rather than enforcing this gate.
- **Recovery remains unproven:** a timeout path and admin force-resolution are
  described, but shipment disputes can require buyer confirmation or human
  arbitration. The planned administrator panel is not yet a tested quorum or
  unavailable-panel recovery mechanism.

Therefore `escrobot_current` is modeled as `PRE_MONEY_BLOCKED` for an RFQ
order. It may be useful for a separately scoped, non-RFQ commerce test, but it
does not satisfy this gate. A paid RFQ test needs a specialized escrower or a
new contract with quoted-order support and explicit evidence/control hooks.
