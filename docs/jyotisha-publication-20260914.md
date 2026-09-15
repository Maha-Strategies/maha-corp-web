# Educational Jyotisha publication — 2026-09-14

User authorized publication and verification. Production source was newer than
the tested Preview: c45a3b2c, not the workspace's 5e14ed50. Reconciled only the
astrology and discovery changes onto that Production commit in an isolated
checkout; newer catalogue, navigation and sitemap changes are preserved.

Release commit: 0ea713c7cc005d5ff3c46bf2022b71a7677ce937.
Remote branch: codex/jyotisha-publication-20260914.
Source integration PR: https://github.com/Maha-Strategies/maha-corp-web/pull/444
Original checkout and unrelated dirty files are preserved.

78 targeted chart, report, compiler, privacy, discovery, visual-system and
catalogue tests passed. Isolated full TypeScript check passed. Production build
completed. Existing dynamic filesystem tracing warnings in the context-control
offer remain; this release does not change that module.

The direct Production publication is distinct from merging main. PR #444 must
be integrated before a later main deployment can safely retain these changes.
No GSC submission is claimed.

## Live verification

Deployment dpl_C5zbhFuRvxZAKvhLWJnESbe9ZKzz reached READY and was aliased to
https://www.mahastrategies.com. The three public destinations return 200 with
self-canonical metadata and without page noindex. The reader and hub link the
guide; the guide links the reader. The guide appears exactly once in sitemap.xml,
the reader is present, and the interpretation API is absent from the sitemap.

Two anonymous synthetic Production requests returned successful reports with
four educational sections and nine planetary notes; 30-minute uncertainty
withholds personalized reflection. Both responses carry no-store/noindex.
The Policy homepage still returns 200. The guide was also opened and its full
content observed in the browser. No personal birth details were submitted.

Verifier: scripts/verify-jyotisha-production.ts. This task does not claim a new
375px mobile audit or a completed Google indexing request.
