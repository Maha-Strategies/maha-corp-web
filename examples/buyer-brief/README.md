# Free purchase and recovery client

This directory is the **unpaid purchasing interface**, not the paid Buyer-Brief archive.
It never obtains or stores a private key. Octopus must provide its own wallet signer.
Do not treat running the local tests or reading the contract as authorization to pay.

## Before signing

1. Discover Maha through the CABEZON directory and record the actual identity and
   reputation checks performed. An unavailable check is not a pass. Those checks
   do not authorize spending or guarantee the contents of the pack.
2. GET `https://www.mahastrategies.com/api/v1/cabezon/buyer-brief`. Stop unless
   `purchaseEnabled` is true. Review the returned terms with Bryan.
3. Pin the archive SHA-256 independently against Mayone's activation email:
   `sha256:067bb1156b81dc95bb38ab7a0207a9ec4b9541a8b06abe3af8bd2e843c49a003`.
   Compare `termsHash` with `BUYER_BRIEF_TERMS_HASH` in the reviewed client revision.
4. Generate one order with `preparePackOrder(approvedBundleHash)`. Obtain Bryan's
   explicit approval for its `briefOrderHash(order)`, exactly **20 USDC**, the
   resource, recipient, terms, expiry and one purchase attempt. No extra fees,
   further evaluation calls, approvals, swaps, bridges or direct transfers are authorized.

## Local safety tests

From the repository root, with Node.js 24 or later:

```sh
node --experimental-strip-types --test test/buyer-brief-pack-client.test.ts
```

These tests use synthetic responses and signatures. They make no payments and
do not demonstrate live settlement.

## Buyer-controlled integration

Import `preparePackOrder`, `purchasePack` and `recoverPack` from `buy-pack.ts`;
import `briefOrderHash` from `../../lib/x402/buyer-brief-contract.ts`.
Connect `signTypedData` to Octopus's existing secure wallet interface. Do not
send credentials to Maha or put them in this repository.

```ts
const order = preparePackOrder(approvedBundleHash)
// Pause here for Bryan's approval of this exact hash and the terms.
const inputHash = briefOrderHash(order)
const result = await purchasePack({
  order,
  address: octopusWalletAddress,
  signTypedData: octopusWalletSignTypedData,
  statePath: privateDurableOrderStatePath,
  approval: {
    reference: bryanApprovalReference,
    inputHash,
    amountBaseUnits: '20000000',
    expiresAt: bryanApprovedExpiryISO,
  },
})
// Save result.archiveBytes privately, then inspect before extracting/running.
```

The placeholders above belong to the buyer's wallet application; this is not a
standalone CLI with an embedded wallet. The helper verifies the unsigned 402
before signing: Base chain 8453, native USDC
`0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`, amount 20,000,000 base units,
Maha recipient `0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28`, exact resource,
and a bounded authorization lifetime. It saves a mode-0600, exclusive-create
recovery file **before** signing and refuses another attempt using that path.

An error or timeout after signing is an unknown outcome, not permission to retry
payment. Keep the saved state. Call `recoverPack(privateDurableOrderStatePath)`:
it sends no payment authorization and asks for no new signature. If recovery
fails, contact `mayone@mahastrategies.com` with the order ID. Never email the
recovery secret, state file, payment signature or private key.

`requestPackSupport(statePath, kind)` accepts `delivery_problem`,
`correction_requested` or `refund_requested`. A queued ticket is not a delivered
email or completed refund. Email Mayone if acknowledgement is unavailable.

## Acceptance and evidence

Verify the returned archive bytes against the independently pinned hash and
inspect archive paths before extraction. Check the manifest and run its local
synthetic tests. Record separately: discovery, identity/reputation observations,
human authorization, payment receipt, independently checked chain transfer,
verified archive delivery, and Bryan's acceptance. Do not include private state
or payment signatures in a public or signed report.

Classify this as an **invited, assisted, real-payment test** if Bryan proceeds.
It is not evidence of unprompted demand or repeat real-work use. Later paid API
calls inside the pack require their own approval; they are not included in $20.
