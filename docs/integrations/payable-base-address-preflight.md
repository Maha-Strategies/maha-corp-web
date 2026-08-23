# Base address preflight adapter — bounded, pre-money only

This adapter consumes IllWar5047's public **payable address preflight** contract for a Base address. It does not fetch the provider, request an x402 payment, sign a transaction, create an escrow order, or decide that a future release will succeed.

The provider schema is pinned at `fixtures/payable-address-preflight/schema.json`; the fixture set is at `fixtures/payable-address-preflight/fixtures.json` (SHA-256 `529fa30d6be7b12cbff6752b53d032a32eb888a39057c54ac3c26bebe52fc893`). The locked preview is retained only to validate the provider's signature construction. Its fixed EOA is not evidence about a buyer, seller, or escrow recipient.

Signer authority is pinned to the provider's public [proof manifest](https://x402.nsgoods.org/proof/index.json), specifically its authoritative `signer_registry` entry for the separate `payable-address` service—not learned from a response's `signed_by` field or the legacy `signers` map. `fixtures/payable-address-preflight/proof-manifest.json` is a minimal public snapshot used only for synthetic verification. The adapter never fetches the manifest or the provider itself.

## Gate

`evaluatePayableAddressPreflight` requires an already-fetched proof manifest whose active, time-valid `payable-address` registry entry is reachable from Maha's reviewed local root pin, a valid ECDSA `personal_sign` response signature, Base chain, exact schema version 1, matching subject address, and a response no older than 60 seconds. `signed_by` is verification convenience only; it is never trust-on-first-use. Unknown response fields and provider values outside the declared enums are refused.

An unknown, inactive, expired, not-yet-valid, or service-mismatched signer fails closed before any response can advance. A rotated key is accepted only when `signer_rotations` connects it to Maha's local root pin, its `announced_at` precedes activation, and the registry's `valid_from`/`valid_until` values exactly match the published rotation boundary. During a declared overlap, both active time-valid keys can verify responses. An unannounced signer change remains equivalent to a signature mismatch.

| Result | Meaning | May progress to a paid CABEZON test? |
| --- | --- | --- |
| `approved_for_pre_money_progress` | Fresh signed EOA, a successful simulated transfer path, and `plausible_direct_recipient`. | No — this is still only a pre-money gate. |
| `review_required` | Contract recipient or application-specific recipient path. | No, until a separate application-specific review establishes the path. |
| `denied` | Invalid signature/schema, stale response, unknown classification, a missing evaluation, or a simulated revert. | No. |

`none_detected` is not proof that an address is not a proxy. It means only that the provider's EIP-1967/EIP-1167 checks did not find one. Base USDC itself is a known example of a proxy outside that detection method.

## Explicit limitations

This adapter intentionally does **not** establish token behavior allowlisting, fee-on-transfer behavior, USDC blocklist state, sanctions status, a contract's withdrawal authority, escrow compatibility, or a future release outcome. Any required property reported as `not_evaluated` blocks progress. A signed response is point-in-time evidence, not a settlement guarantee.

Before any paid CABEZON test, use separate controls for token behavior, blocklist/sanctions screening of both parties, seller DID-to-wallet/order binding, and the recovery scenarios in the versioned CARP pre-money gate.
