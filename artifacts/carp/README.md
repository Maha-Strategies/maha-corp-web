# CARP verification evidence

This directory holds sanitized, public verification records for Maha's CARP Seller integration.

Evidence may include public DIDs, public keys, peer URLs, transaction hashes, result identifiers, content digests and boolean protocol checks. It must never contain private keys, session keys, ADILOS challenges or responses, encrypted message bodies, source documents, result content, access tokens, retrieval credentials or webhook secrets.

The live handshake script writes `handshake-evidence.json`. `rfq-purchase-verification-v0.2.json` records the pre-money Cinnamon RFQ boundary: the exact accepted request shape, the observed `QUOTE_REQUIRED` refusal, and the absence of payment, escrow, and delivery instructions. The bounded delivery record is published only after the corresponding free enquiry, exact purchase instruction and separately authorized x402 delivery have all completed.
