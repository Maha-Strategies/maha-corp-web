# Production canonical-release closeout — 2026-08-28

This report consolidates the database dry-run and repaired-revision canary evidence that established the first known-good canonical-release protocol. It contains no participant data, natal data, credentials, private review prose, or customer information.

## Result

The repaired-revision canary remains healthy after deployment, indexing and cache propagation. Both exact repaired revisions are publicly reachable, provenance-reachable and present in every intended public index. The Production database migration tree is current and showed no schema delta in the read-only validation run.

| Check | Result |
| --- | --- |
| Repaired records released | 2 initial releases; 0 replays |
| Public record routes | 2/2 HTTP 200 |
| Public provenance routes | 2/2 HTTP 200 |
| Sitemap | 2/2 exact paths present |
| `llms.txt` | 2/2 exact paths present |
| Public release registry | 2/2 exact revision digests present |
| Pending Production migrations | 0 |
| Pre-apply schema comparison | `no-delta` |
| Production mutation during migration validation | none |

## Repaired-revision canary evidence

Release run: [33087830174](https://github.com/Maha-Strategies/maha-corp-web/actions/runs/33087830174), commit `0100c0cc60dfc97707dd65377bffc221bc0a1932`, completed successfully on 2026-08-27.

The run used `review-publish-verify` with the exact `RELEASE_2_REPAIRED_REVISIONS` confirmation. It created two initial canonical releases and then verified their public projection. The records are:

1. `urn:maha:record:agentic-systems-mcp-tool-deny-by-default`
   - Released revision: `sha256:bc3682ef4b4613b4cff9c468953c218fb20ebad8786ab8c6cc4bbcc8dccb1a66`
   - Public path: `/knowledge/agentic-systems-mcp/concepts/agentic-systems-mcp-human-denial-control-for-tool-invocations`
2. `urn:maha:record:fusion-plasma-systems-breeding-blanket-test-modules`
   - Released revision: `sha256:4e6718f1603760cec3f677744f669991415c5466c982f9c0aae3f6b39824636a`
   - Public path: `/knowledge/fusion-plasma-systems/concepts/fusion-plasma-systems-breeding-blanket-test-modules`

Token-free verification was repeated on 2026-08-28 at 04:21 UTC from current `main`. Both routes and both provenance documents returned HTTP 200; neither record was missing from the sitemap, `llms.txt`, or release registry.

This is an internal editorial release. It does not claim external expert endorsement, peer review, independent reproduction, scientific validation, operational qualification or commercial certification.

## Migration evidence

Read-only run: [33090092159](https://github.com/Maha-Strategies/maha-corp-web/actions/runs/33090092159), commit `c91832835c9c56528e5bbf56c1289118fc4a2588`, completed successfully on 2026-08-27.

- The workflow asserted the literal Production Supabase project before connecting.
- Migration integrity passed for the repository migration tree.
- Supabase CLI 2.116.0 installed and completed the linked dry-run.
- Production reported no pending migrations.
- `drift-before.sql` was empty, so the pre-apply classification was `no-delta`.
- Apply and post-apply checks were correctly skipped because the requested mode was `dry-run`.
- No schema mutation occurred.
- The earlier pg-delta certificate-cache warning did not recur on this dry-run path. A future legitimate apply is still required to test the apply path specifically.

## Historical append-only observation

PR #231 recorded the state immediately after the earlier Batch 2 reconciliation deployment: five Batch 2 routes reachable, three substantially rendered, twenty-five Batch 1 pages intact, and twenty-seven Batch 2 records withheld. That dated observation remains valid as history. Subsequent internal review and the two-record repaired-revision release changed the current state, so the observation must not be read as a current inventory.

## Frozen protocol

The machine-readable freeze is [`known-good-canonical-release-protocol-v1.json`](./known-good-canonical-release-protocol-v1.json). It pins the verified workflows, runner, exact canary definition, migration-integrity checker and repaired-revision persistence migration by SHA-256.

The operating sequence is:

1. Run the Production migration workflow in `dry-run` mode with schema-drift checking enabled.
2. Stop on a target mismatch, unexplained drift, migration-integrity failure or pending migration not separately authorized for apply.
3. Confirm every candidate is an exact reviewed revision and that the release workspace reports it ready.
4. Use the protected repaired-revision workflow. Publication requires the exact confirmation phrase and protected-environment approval.
5. Keep ingestion/review operations and canonical release authority on separate credentials.
6. Require the workflow's strict post-publication projection check.
7. Repeat token-free verification after deployment and cache propagation.
8. Preserve run identifiers, commit SHAs, exact record digests and public-projection results in an append-only report.

Changing a frozen component is allowed, but it deliberately invalidates this version's digest test. The change must receive normal review, create a new protocol version and supply fresh dry-run and canary evidence before becoming the next known-good protocol.
