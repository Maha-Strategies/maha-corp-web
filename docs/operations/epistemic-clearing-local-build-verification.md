# Epistemic clearing local build verification

Observed: 2026-09-05  
State: local production build passed; not deployed

## Outcome

The operator-authorized local production build completed successfully with Next.js 16.2.12 and generated exactly **1,993/1,993 static-page work units**. This replaces the earlier 1,993 planning projection with an observed local-build count.

The build does not establish that any route is deployed, indexed, clicked, or commercially validated. The 1,000 epistemic-clearing guides remain `prepared-not-deployed` until their exact reviewed changes are reconciled, committed, passed through CI, and separately authorized for deployment.

## Build evidence

- command: `npm run build`
- compilation: passed in 16.9 seconds
- TypeScript build check: passed in 15.5 seconds
- page-data collection: passed with 9 workers
- static generation: 1,993/1,993 in 23.0 seconds
- prerender manifest: 1,983 materialized routes and 44 dynamic route definitions
- generated HTML files: 1,944 total
- epistemic-clearing HTML files: 1,000

The first sandboxed attempt failed because Turbopack could not bind an internal loopback port (`Operation not permitted`). Re-running the same local build with only that sandbox restriction lifted compiled in 16.9 seconds. The failure was environmental and did not require a content, route, dependency, or release-gate change.

## Epistemic-clearing reconciliation

| Lane | Routes |
|---|---:|
| Machine integrations | 100 |
| Tamil religion | 200 |
| Astrology infrastructure | 150 |
| Evidence clearing | 250 |
| Mathematics and astronomy | 250 |
| Cross-domain synthesis | 50 |
| **Total** | **1,000** |

All 1,000 paths are unique, all 1,000 appear in the production prerender manifest, none appears in the not-found set, and every generated clearing page contains the digest-bound guide rendering contract.

`llms.txt` contains every clearing path exactly once. `sitemap.ts` derives its clearing entries from the same finite 1,000-page registry; no separate route list is maintained.

## Boundary inspection

- 172 JavaScript client chunks inspected
- zero credential-shaped values in client chunks or prerendered application output
- zero private Tamil boundary-inspection schema markers in client chunks or generated clearing pages
- zero audit-corpus or review-packet markers in generated clearing pages
- no Vercel build, Preview deployment, Production deployment, database write, canonical release, or credential mutation performed

## Artifact binding

The build consumed the following deterministic batch artifacts:

1. `sha256:9d8fb55638bc4b46a51985e81aaad6d99de03162658e7d792b041e7b03f1582a`
2. `sha256:c6df032f6628fcb98d14d4d5d492a9325c305aa897371a22c9c6e658395e240f`
3. `sha256:e37ad8573ebab8b583b338a8526c48570cd58422f7465c61392a6b0a6371416a`
4. `sha256:5d99b6b2b0878a3b2394b3ec9252cf6770a2bad339605b6168a4f4b7dfd9fb98`
5. `sha256:d8363dac1fe08207231ff9298d6fa730bb28d5b07ef9ba9435629c2aed46673a`
6. `sha256:63d25c59269bb04e281053a5a36993599a5de26ce323dd3d3db00f8cc454a9df`

This observation is bound to the local working tree rather than a reviewed commit. A deployable artifact still requires reconciliation onto current `main` and a clean commit-bound CI build.
