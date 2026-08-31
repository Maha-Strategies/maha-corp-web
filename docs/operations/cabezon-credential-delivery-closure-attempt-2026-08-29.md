# CABEZON credential-to-delivery closure attempt — 2026-08-29

Commit `6890fa9e740ad3ba65f5baa69ff9f481e60a9203` fixes the prior zero-dollar grant failure. The earlier workflow did create an ephemeral credential; the next request failed because `validUntil` omitted the milliseconds required by the canonical grant snapshot. The always-run cleanup revoked that credential. The corrected workflow sends a canonical `.000Z` instant and records bounded machine-readable failure diagnostics without logging credentials or complete response payloads.

Local verification passed: 22 targeted tests, 2,262 full-suite tests, typecheck, lint with zero errors, and the production build.

## Preview attempt

A fresh schema-only Supabase branch was created without Production data. Eleven Vercel variables were scoped to `codex/cabezon-product-federation`, and the protected GitHub environment allowed only that branch. An exact-commit Vercel Preview deployment reached `READY`.

The lifecycle stopped before migration. The existing designated Vercel automation bypass value available through the authenticated environment runner was rejected by Deployment Protection with HTTP 302 to Vercel SSO. Vercel also refused to decrypt that sensitive variable through the single-variable API. A replacement bypass token was not created because the authorization explicitly prohibited it.

Consequently, this attempt created no synthetic release, credential, grant, licensed retrieval, delivery or acknowledgement. It is not interoperability or commercial-validation evidence.

## Security handling and cleanup

During the first branch-inspection attempt, a redaction filter omitted the word `SECRET`, allowing one ephemeral branch JWT secret to appear in internal command output. It was not committed or published. The affected branch was immediately deleted, invalidating its credentials, and the temporary file was removed. No Production credential was involved.

Final cleanup was independently checked:

- non-default Supabase branches: `0`;
- dedicated GitHub environment: absent;
- exact-branch Vercel variables: `0`;
- credential-bearing Preview deployments: `0`;
- local temporary secret paths: `0`.

The credential-to-delivery sprint remains open. Its next prerequisite is an approved, working way to authenticate the protected Preview without creating an unauthorized bypass token or broadening deployment access.
