# Base address preflight adapter — bounded, pre-money only

This adapter consumes IllWar5047's public **payable address preflight** contract for a Base address. It does not fetch the provider, request an x402 payment, sign a transaction, create an escrow order, or decide that a future release will succeed.

The provider schema is pinned at `fixtures/payable-address-preflight/schema.json`; the expanded fixture set is at `fixtures/payable-address-preflight/fixtures.json` (SHA-256 `83cc0a2cba1150059abbe67f275e7f0a6d72b2ad2a1903445b61db8d4a28ecd9`). The bundle includes four complete frozen response envelopes signed through the provider's production signing path: a known EOA, a plain contract, an EIP-1967 proxy, and an invariant-based zero-address transfer revert. The locked preview is retained separately to validate the provider's current signature construction. Neither the frozen envelopes nor the preview are current evidence about a buyer, seller, escrow recipient, or future transfer.

Signer authority is pinned to the provider's public [proof manifest](https://x402.nsgoods.org/proof/index.json), specifically its authoritative `signer_registry` entry for the separate `payable-address` service—not learned from a response's `signed_by` field or the legacy `signers` map. The reviewed proof-manifest snapshot is pinned at SHA-256 `afad74421615403c80862e63b47336ab25d7b948460fcabdbabaabafe41a9809`, matching the pointer carried by every frozen envelope. The adapter never fetches the manifest or the provider itself.

## Frozen signed-envelope verification

For every envelope, Maha independently checks all of the following before evaluating policy:

1. the exact bundle digest;
2. the envelope's proof-manifest URL, version, timestamp, and SHA-256 against the reviewed local snapshot;
3. Python `json.dumps(sort_keys=True, separators=(',', ':'), ensure_ascii=True)` compatible canonicalization after removing only `signed_by` and `signature`;
4. the declared SHA-256 of that canonical body;
5. EIP-191 signature recovery through the manifest-authorized signer; and
6. the response fields against the provider's static expectations before deriving Maha's own decision.

The fixture wrapper's `expected`, `reason_codes`, and `example_downstream_policy` fields are unsigned explanatory metadata. They are never passed to the gate and cannot authorize a decision. Passing the wrapper instead of its signed `response` is rejected as an unknown-field envelope.

The four governed outcomes are intentionally asymmetric: the EOA permits only `approved_for_pre_money_progress`; the plain contract and EIP-1967 proxy require application-specific review; and the genuine transfer revert is denied. Tampering with any signed policy field makes signature verification fail closed.

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
