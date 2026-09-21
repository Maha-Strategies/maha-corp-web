# Buyer-Brief release and publication boundary — 21 September 2026

## Sales remain withheld

The prepared $20 pack was accidentally published by PR #450 in the public
repository, including its archive and authoring files. Removing these from the
current tree does not remove prior commits, PR views, caches, forks or downloads.
Do not describe the original v1 artifact as exclusive or send an activation email.
No history rewrite is authorized. No new payment or refund is authorized here.

## Public versus private

Keep the offer metadata, schemas, payment/recovery/support interfaces, free buyer
client and synthetic security tests public. Keep the paid brief, runbook, report
template, archive, authoring runner and pack builder outside this public repository.
Shared, previously public compiler/evaluator code and context examples stay public.
Private copies of the original authoring material and archive are preserved in the
owner's original checkout and output directory; do not commit them from that checkout.

Runtime delivery uses the service-role private Supabase bucket buyer-brief-private.
The production preparation workflow validates the exact pinned bytes, confirms the
bucket is private, and checks that unauthenticated public retrieval fails. Never
bundle the archive into the website or publish a signed download URL in a catalogue.
The receipt/hash is public metadata, not the paid content.

## Release gates still required

- Run application, private-boundary and real PostgreSQL notification tests.
- Apply the reviewed notification migration using the protected main-only workflow.
- Prepare private storage and verify the unauthenticated denial.
- Test the synthetic notification through cron and confirm actual inbox receipt;
  provider acceptance alone does not establish delivery.
- Resolve the original edition's historical publication before commercial activation.
  A genuinely new private edition needs new content, version, digest and agreed terms;
  simply re-zipping or renaming the same contents does not undo prior publication.
- Keep the catalogue withheld and activation flag off until these gates pass.
- Check unsigned terms, buyer-specific approval, delivery and recovery independently.
  Only Bryan may authorize and sign the actual Octopus payment.

Settlement notifications do not prove buyer receipt. Purchase recovery requires the
saved secret-bound order and paid ledger entry, never another payment. Support events
queue access/correction/refund review. The approved remedy is access or correction
within two business days, otherwise a reviewed 20 USDC purchase-price refund; no
automatic refund is authorized. Classify any eventual run as invited, assisted usage.

## History-cleanup plan — approval required before execution

1. Inventory every branch, tag, PR, workflow artifact, release and deployment that
   contains the paid paths or archive. Check for copies/renames and public exports,
   not just the original file paths. Retain a private recovery copy before removal.
2. Coordinate a brief push freeze with collaborators and automation. Record remote
   refs and open PR dependencies; plan how each checkout will be replaced or rebased.
3. In a separate mirror, prepare a targeted history rewrite of the paid paths only.
   Review the resulting diff/ref map and verify unrelated work and public contracts
   are intact. No rewrite, force-push or tag change has been performed.
4. Obtain explicit approval for the exact refs, force-push, affected PRs and any
   artifact/deployment deletions. Then coordinate those changes and request GitHub
   help with residual PR/cached views where available; removal is not guaranteed.
5. Re-clone affected checkouts and prevent old branches from reintroducing the files.
   Re-check raw URLs, PR views, artifacts, deployments and references without auth.
6. Document residual exposure. Neither rewriting history nor removing caches can
   revoke copies already downloaded or retained in third-party forks.
