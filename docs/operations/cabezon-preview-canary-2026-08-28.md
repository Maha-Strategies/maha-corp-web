# CABEZON Preview Seller canary — 2026-08-28

PR #266 was exercised only on `codex/cabezon-preview-adapter` against the isolated `Preview` database and a Vercel Preview deployment. Production was not modified.

## Result

- The named migration ran successfully in GitHub Actions run `33173876204` at commit `8bc109f` and verified eight expected database objects.
- The private offer projection returned `200` with payment disabled.
- Stale catalog, substituted customer identity, unavailable offer and premature acknowledgement were rejected with `409`, `403`, `409` and `409` respectively.
- One free synthetic enquiry completed the append-only `enquiry_received → offer_returned → delivery_recorded → acknowledgement_recorded` lifecycle.
- Replay of the enquiry was idempotent.
- No purchase, payment, external artifact delivery, canonical release or broader CABEZON action occurred.

## Credential boundary

The CABEZON bearer was stored as a sensitive Vercel variable scoped only to the PR branch and as a GitHub `Preview` environment secret while that environment allowed exactly the same branch. The existing shared Vercel automation bypass secret was removed from the canary workflow and was not used. Vercel CLI account authentication supplied deployment-protection bypass without exposing a bypass credential to the canary.

Evidence retains only a SHA-256 fingerprint of the CABEZON token. The Vercel token was removed, the adapter was set to disabled, the branch alias was rebuilt, and the protected route returned `404`. Local secret material was removed. GitHub token deletion is pending the account's privileged-action confirmation and must be completed before this evidence is final.

The machine-readable record is [`cabezon-preview-canary-2026-08-28.json`](./cabezon-preview-canary-2026-08-28.json).
