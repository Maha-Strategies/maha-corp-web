# x402 follow-up operational work

Deferred deliberately from the 2026-08-11 promotion. Neither item blocks Deep
Context or MPS, and both were excluded from that change so a promotion and an
unrelated repair could not fail together.

## 1. Legacy trigger-function schema drift

`production-migrations.yml` run `31478415051` applied all ten migrations
successfully and then failed its post-apply drift check. Two separate causes,
both in the *verification* step rather than the apply:

- a Docker Hub rate limit (`toomanyrequests: Rate exceeded`);
- pgdelta could not read its TLS certificate
  (`ENOENT … /workspace/supabase/.temp/pgdelta/pgdelta-target-ca.crt`), so the
  catalog export produced no output.

The residual `drift-after.sql` is 1,348 bytes and contains **zero** x402
references. It concerns three legacy functions that predate this work:

- `public.handle_new_node()`
- `public.handle_new_user()`
- `public.join_fireteam()`

These appear to be live-schema definitions with no counterpart in the migration
tree — Production was changed outside the workflow at some earlier point. The
drift is genuine and should be reconciled, either by capturing the live
definitions into a migration or by dropping them if they are dead.

Until it is, every `production-migrations` run will fail its final drift gate
even when the apply itself is clean, which trains operators to read a red run as
normal. That is the real cost, and it is worth fixing for that reason rather
than because the functions themselves are urgent.

The pgdelta certificate failure should be investigated separately; a
verification step that cannot run is not the same as a verification step that
found a problem, and the workflow currently reports them identically.

## 2. `X402_CHAIN_RPC_URL` is unset

Absent in both Preview and Production.

Not currently harmful: `rpcUrlFor` falls back to a built-in default RPC for
Base, and Production readiness confirms *"Settlements are corroborated against
the chain."* Chain confirmation is live.

It should still be set explicitly. The default is a public endpoint, so
settlement confirmation currently depends on someone else's rate limits — and
the failure mode is quiet: `confirmOnChain` returning `indeterminate` does not
withhold the resource (correctly, since the payer's money has already moved),
so confirmation would silently degrade to the facilitator's word while
`x402_repeat_payers` reclassified those settlements as unconfirmed rather than
as purchases.

Setting a dedicated endpoint in both environments removes that dependency.
