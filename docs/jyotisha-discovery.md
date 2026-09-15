# Jyotisha search discovery — local preparation

Prepared 2026-09-14. No build, push, deployment or GSC submission in this task.

## Distinct search destinations

1. `/knowledge/birth`: existing tool URL, index/follow metadata and sitemap entry
   preserved. Updated title/description, plain-language free-report introduction,
   and guide link. Targets visitors who want to calculate a report.
2. `/knowledge/astrology/reading-guide`: new static explanatory article with a
   calculator-checked synthetic example, evidence disclosure instructions,
   D1/D9 distinction, uncertainty behavior, period/transit limits and privacy.
   Self-canonical, index/follow, TechArticle metadata, one sitemap entry.
3. `/knowledge/astrology`: existing hub now links directly to both destinations.
   Knowledge already links to this hub, providing an existing discovery path.

Existing Lahiri, Vimshottari and frame-comparison pages already point to the
reader. No additional near-duplicate calculator landing pages created.
No claims of search-volume research, confirmed indexing or ranking guarantees.

## Publication gate and indexing order

Publish these changes together with the tested educational reader, not ahead of
its functionality. After explicit build/deployment approval, verify the public
hosts return 200, self-canonical metadata, crawlable links and sitemap entries.
Inspect the new guide at phone width as part of that served-output review.
Then request indexing for the reader, guide and updated astrology hub through
GSC. Do not submit the protected Preview, POST API or personalized results.
Observe impressions/clicks per page and query over comparable reporting windows;
submission is a discovery request, not a guarantee of indexing or traffic.

## Verification

15 targeted discovery, educational/privacy and visual-system tests pass.
Scoped ESLint and diff whitespace check pass. The new route moves the exact
Knowledge page-file count from 70 to 71; no unrelated counter was relaxed.
The new article has not been rendered in a production build yet.
Full workspace TypeScript checking reports four ES2020/BigInt target errors in
the unrelated, untracked `examples/context-growth/workflow.ts` (lines 11, 89,
104). No errors were reported in the discovery files; the full workspace check
is not claimed green. That separate work was left untouched.
