# Context Compiler permanent price step-up

Status: **staged policy and regression tests; not wired, activated, or deployed.**

## Approved commercial rule

The Context Compiler starts at 1,000 USDC base units ($0.001). Once the
verified shared monthly facilitator allowance reaches 1,000 successful
transactions, new quotes become 2,000 units ($0.002). The increase is
permanent, including after the billing month resets. It is not a count of
1,000 compiler purchases, and not a lifetime transaction counter.

Enterprise API-key authentication, credits and metering remain unchanged.
No new model calls, wallet payments or infrastructure services are needed to
test this policy.

## Implemented locally

- `lib/x402/compiler-price-policy.ts`: deterministic decision function with
  explicit shared billing scope, billing period and billing-evidence digest.
  Missing usage remains unknown. A supplied valid activation takes precedence
  over new-month counts and feed outages. This function does **not** persist
  the activation or independently authenticate the supplied billing evidence.
- Diagnostic settlement counting includes all observed offers and
  publisher-funded canaries, deduplicates network/transaction identities,
  and excludes failed settlements, verification and discovery calls. It is
  explicitly a lower bound, not an account-wide billing measurement.
- Discovery cache keys include the complete payment requirement. The inline
  commercial amount follows the actual requirement, and its digest changes
  when price, recipient, network, asset or other payment terms change.
- Gateway regression test: an old $0.001 signature receives a fresh $0.002
  challenge before facilitator verification or settlement. Only a newly
  authorized payment matching the new challenge is accepted. This does not
  promise grandfathered quotes or add delivery recovery to the stateless
  compiler endpoint.

## Remaining work before enabling automatic pricing

1. Verify the actual CDP billing scope and period, including other applications
   or activity sharing its allowance. No account billing export or usage API
   has been inspected for this change. The repository has no verified shared
   CDP billing-usage feed. Credentials alone are not evidence of usage.
2. Connect an authoritative usage adapter. Preserve its evidence privately.
   Only a trusted server-side adapter may construct a
   `VerifiedBillingObservation`; the type and digest alone do not prove the
   count. Do not accept one from a buyer request or public endpoint.
3. Persist the first threshold crossing atomically in a durable, monotonic
   activation record before publishing the raised price. Concurrent writers,
   process restarts and month rollover must not revert it. The current pure
   function has no database adapter and must not be used as an in-memory latch.
4. Resolve that durable state consistently in payment challenges, full offer
   declarations, `/agent-offers.json`, agentic-commerce discovery, current
   OpenAPI/LLM/MCP pricing and the purchase UI. Keep historical benchmark
   prices labelled as historical. Update readiness checks and deploy-time
   `X402_RESOURCES` handling so the new policy does not contradict the catalog.
5. If price state is unavailable, do not silently fall back to $0.001 or
   accept a payment against unknown terms. Settle no stale signatures and
   never automatically re-sign or initiate a second buyer payment.
6. Test the persisted boundary and all live projections in Preview without
   real funds, then obtain deployment approval. Verify live unpaid challenges
   and discovery after deployment. Bazaar/CABEZON may retain old indexed
   prices until refreshed; buyers must authorize the current live challenge.

## Verification

Run the synthetic policy and payment regression tests:

```sh
node --experimental-strip-types --test test/x402-compiler-price-policy.test.ts test/x402-discovery.test.ts test/x402-gateway.test.ts
```

These tests do not contact CDP, settle payments, prove billing coverage or
activate production pricing. A passing result is implementation evidence for
the staged rule, not evidence that automatic switching is live.

Provider references (checked September 9, 2026):
[facilitator pricing](https://docs.cdp.coinbase.com/x402/seller/facilitator)
and [x402 FAQ](https://docs.cdp.coinbase.com/x402/support/faq).
Reverify provider pricing and billing scope before enabling the adapter.
