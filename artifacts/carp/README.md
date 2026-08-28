# CARP verification evidence

This directory holds sanitized, public verification records for Maha's CARP Seller integration.

Evidence may include public DIDs, public keys, peer URLs, transaction hashes, result identifiers, content digests and boolean protocol checks. It must never contain private keys, session keys, ADILOS challenges or responses, encrypted message bodies, source documents, result content, access tokens, retrieval credentials or webhook secrets.

The live handshake script writes `handshake-evidence.json`. `rfq-purchase-verification-v0.2.json` records the pre-money Cinnamon RFQ boundary: the exact accepted request shape, the observed `QUOTE_REQUIRED` refusal, and the absence of payment, escrow, and delivery instructions. `thrivbe-buyer-review-2026-08-27.json` records the independent buyer-side public review, the fail-closed 401 from the not-yet-approved peer, and the defects reported for correction. `thrivbe-reciprocal-attempt-2026-08-28.json` records the later one-use reciprocal proof attempt, which failed closed at the Production-to-Thrivbe challenge fetch before any response or enquiry was sent. Neither artifact claims a completed direct encrypted enquiry.

The four public Bogawantalawa inspection copies are byte-identical to the digests in `bogawantalawa-legend-tea-retail-test-v1.json`. They show retail product packaging only; the Cargills receipt remains unavailable and is not implied by the photographs. The bounded delivery record is published only after the corresponding free enquiry, exact purchase instruction and separately authorized delivery have all completed.
