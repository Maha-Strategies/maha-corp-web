# CABEZON product federation Preview canary — 2026-08-29

## Outcome

The dedicated MCP evidence-licensing migration converged on an ephemeral, schema-only Supabase Preview branch. The full CABEZON federation lifecycle did not run because the branch correctly contained no canonical-release data.

The workflow stopped before creating a client credential, license grant, MCP execution, CABEZON enquiry, delivery, acknowledgement, payment or escrow event. PR #271 remains unmerged.

## Verified migration evidence

- Exact branch: `codex/cabezon-product-federation`
- Exact commit: `77a77822ed1d7ac970a161facc22b4f144e6e1b8`
- Workflow run: `33240121120`
- Applied migration: `20260829000100_mcp_evidence_tool_licensing.sql`
- Migration digest: `sha256:6488200d90da3d47c0621c8d770e52153961059c45e024bd64fae0af09d50d56`
- Verified objects: 10
- Migration convergence: yes
- Production data copied: no
- Production database changed: no

## Fail-closed finding

The first lifecycle precondition selects one exact active canonical release. The isolated branch was created without data and contained zero canonical releases. The workflow therefore stopped before credential provisioning. Treating an invented row as canonical would falsify release governance, so no release fixture was inferred or inserted.

Final isolated counts before deletion:

- Canonical releases: 0
- Agent credentials: 0
- MCP evidence grants: 0
- MCP evidence executions: 0

## Cleanup

The temporary GitHub copy of the existing Vercel automation bypass token was deleted immediately after the canary. All exact-branch Vercel variables, the credential-bearing Preview deployment, the dedicated protected GitHub environment and the ephemeral Supabase branch were then deleted. No secret value appears in this report or its JSON companion.

## Release decision

Do not merge PR #271 from this result. A complete rerun requires explicit authorization for a non-fabricated release-data strategy. Acceptable options are a purpose-built synthetic test entity that is not represented as canonical, or a separately isolated environment containing an already authorized release fixture. Copying private Production release rows or directly manufacturing canonical state is not an acceptable workaround.
