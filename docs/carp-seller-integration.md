# Maha CARP/CABEZON Seller Integration

Maha's first CABEZON offering is **Deep Context Evaluation**, a digitally delivered service paid directly through its existing x402 v2 resource on Base Mainnet.

## Public contracts and proposal status

- Canonical CABEZON Seller role: `https://raw.githubusercontent.com/bitsanity/cabezon/master/roles/seller.json`
- Maha Seller role extension proposal: `https://www.mahastrategies.com/.well-known/carp/seller-role.json`
- Maha seller profile: `https://www.mahastrategies.com/.well-known/carp/seller.json`
- Fulfillment resource: `POST https://www.mahastrategies.com/api/v1/compress/evaluate`

The extension is a Maha proposal, not an adopted CABEZON standard. It keeps the canonical `about`, `enquiry`, and `purchase` services and the existing CARP wire fields, while defining delivery evidence that distinguishes a digital result from a carrier shipment. Do not describe it as CABEZON v0.2 unless the upstream project adopts it.

The seller profile intentionally reports `contract_ready_pending_carp_handshake`. Maha is not a CABEZON member until a dedicated CARP host has a signed DID and SAD, completes the Concierge and Registrar handshakes, and is accepted into the directory. The public profile contains null identity fields until that happens; it is not a substitute for the signed documents served by the CARP host.

## Order and payment boundary

The CARP `purchase` fee and the selected offer price are different payments:

1. The optional CARP fee pays the Seller Agent to admit and process an order. CABEZON uses it to deter denial-of-service and token-burning attacks.
2. The Deep Context Evaluation price is exactly 10,000 USDC base units ($0.01) and is paid to the declared x402 resource.

The purchase result therefore returns `mode: x402_direct`. It does not invent an escrow transaction for a synchronous digital utility. Digital delivery is evidenced by the returned `evaluationId`, `outputHash`, and x402 `PAYMENT-RESPONSE` transaction. The shared Seller proposal also defines `carrier_shipment` for physical goods, where a carrier and tracking reference are the delivery evidence.

Deep Context Evaluation does **not** promise an automatic refund. A malformed application payload may fail after an x402 settlement because the gateway handles payment before the route validates the body. The seller profile states this boundary and directs delivery failures to support with order and payment evidence rather than inventing a recovery guarantee.

## Dedicated CARP host

CARP's reference implementation uses CGI scripts plus writable local directories for ACLs, sessions, requests, answers, and used payment references. Do not deploy that stateful interface inside Vercel.

1. Provision a small persistent host isolated from the application and clone `https://github.com/bitsanity/agent-crvp`.
2. Configure TLS or a private tunnel, writable runtime directories, Node.js, `adilosjs`, and `ecjsonrpc` as required by the reference implementation.
3. Add `about`, `enquiry`, and `purchase` to the reference `cgi-bin/worker.js` service allowlist. Keep `about` and `enquiry` free in `cgi-bin/fees.js`. Set any `purchase` admission fee according to CABEZON policy after independently reviewing the amount, recipient, chain, and replay handling; do not confuse it with the $0.01 offer price.
4. Place the reviewed Seller declaration on the CARP host and include the three services in its `index.json`/menu. Preserve the canonical CARP field names. The Maha extension accepts the legacy purchase array and recommends the object form for exact network, asset, price, fulfillment, and idempotency binding.
5. Generate a dedicated secp256k1 CARP identity on that host. Keep the private key out of this repository, Vercel, logs, and discovery documents.
6. Replace the example DID and SAD with signed Maha documents containing the real public CARP URL. Publish only after verifying signatures and expiry.
7. Run the Maha worker on the same private network:

   ```bash
   CARP_INTERFACE_URL=http://127.0.0.1:8000 npm run worker:carp-seller
   ```

8. Verify `about`, free `enquiry`, legacy and object-form purchases, a rejected price mismatch, a rejected postal destination on the digital offer, and a successful payment instruction in a local handshake.
9. Shake hands with El-Cabezon and the Registrar. Join the Seller role and pay any reviewed membership/rent only after the advertised amounts and destination are independently verified.
10. Update the public profile from `contract_ready_pending_carp_handshake` only after the Concierge returns Maha in its Seller directory.

## Failure boundaries

- The worker rejects a quoted amount, asset, or network that differs from the current catalog.
- The worker accepts the legacy purchase array only when its price element contains the same exact amount, asset, and network object returned by enquiry.
- It does not sign an x402 payment for the buyer.
- It does not assert that a result was delivered merely because payment instructions were issued.
- An x402 failure stays an x402 failure; it is not translated into a false CARP shipment event.
- Physical orders require a delivery destination and carrier evidence. Digital orders do not collect a postal address.

## Upstream contribution boundary

The extension proposal is suitable for discussion with Bryan and for a focused change to `bitsanity/cabezon/roles/seller.json`. Do not submit it upstream as an adopted contract or deploy it as a CABEZON identity until:

1. Bryan confirms the compatibility approach and preferred versioning.
2. A local CARP handshake proves both parameter shapes.
3. The canonical example uses placeholders rather than Maha's payee, asset, price, or product identifiers.
4. The upstream diff changes only the Seller role and its explanatory documentation.
