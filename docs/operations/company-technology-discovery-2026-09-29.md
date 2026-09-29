# Company and technology discovery — 29 September 2026

## Outcome and release state

Implemented locally; not deployed or submitted to search engines. This change presents Maha Strategies LLC as a technology-development, research and publishing company, while separating implemented software from simulation, knowledge assets and exploratory directions.

The working tree contains substantial unrelated changes. Do not deploy or commit the entire checkout as part of this release without reviewing that work separately. The existing computational-architecture page is one linked dependency: confirm it is included in the intended release or remove that link until it is available. Local route existence is not proof of production availability.

## Public surfaces

- `/about/technology`: server-rendered portfolio, six activities and 24 knowledge fields, with current work, possible directions and limitations visible to readers.
- `/company.json`: public, versioned JSON profile generated from the same curated data as the portfolio.
- `/schemas/company-profile-1.0.json`: validation contract for that custom profile; not a Google-specific schema.
- Standard Schema.org Organization, CollectionPage and ItemList structured data: consistent identity and visible portfolio descriptions.
- Homepage, About page and default metadata: updated company description and portfolio links.
- `/llms.txt`, the agent card, machine-readable registry and sitemap: links to the new company surface.

`lib/company-profile.ts` is the shared, explicitly curated public source. It does not read strategy documents, customer records, environment variables or paid deliverables. Do not replace it with automatic filesystem publication.

## Meaning of status labels

Activity labels distinguish software/evaluation, internal simulation, exploratory research and publishing/education. Knowledge-field labels distinguish implemented software, documented simulation, knowledge assets and exploratory directions. None is a certification, independent validation, live health check or offer to sell a finished product.

Physical AI and Caldera are described as internal simulation work, not deployed robotics or building-safety validation. Longevity is research scoping, not a clinical service or demonstrated health benefit. Cultural interpretation is distinguished from empirical science. Proposed applications are hypotheses, not promises or existing partnerships.

The profile date records this editorial revision. Updating the registry date does not mean all existing services were rechecked live.

## Verification performed

- 13 tests passed: profile schema and negative controls; identity and unique field IDs; JSON/JSON-LD agreement; GET body and headers; local links and privacy boundaries; discovery links; server-rendered visible text and anchors; existing registry and sitemap hygiene.
- Scoped TypeScript check passed with `tsconfig.company-profile.json`.
- ESLint passed for the changed TypeScript/TSX files and new tests.
- `git diff --check` passed.

Commands:

```sh
node --experimental-strip-types --test test/company-profile.test.ts test/company-profile-render.test.cjs test/machine-readable-registry.test.ts test/sitemap-hygiene.test.ts
node node_modules/typescript/bin/tsc --project tsconfig.company-profile.json --noEmit
```

These checks use local code and server rendering. They are not a full production build, browser visual review, live CDN test or evidence of search-engine indexing.

## Release checks still required

1. Review the scoped changes and dependencies, preserving unrelated work. Run the normal build/release checks in the intended release checkout.
2. After deployment, verify successful HTML/JSON responses for the new page, profile and schema. Check canonical URL, content type, structured data and absence of unintended `noindex` or authentication requirements.
3. Verify the actual sitemap includes the portfolio and `/llms.txt` exposes the company links. Check linked product pages on production, not only on disk.
4. Use Google Search Console URL Inspection to check Google access and request indexing. Inspect CDN/WAF logs if crawler access fails; do not broadly disable protections. Sending a Googlebot user-agent string is not proof of access by Google's verified crawler.
5. Check indexing and relevant search traffic after release. Do not equate successful publication with ranking or AI citation.

## Search-engine expectations

Google says ordinary search eligibility and SEO practices apply to its AI features; special AI markup or machine-readable AI files are not required. The HTML and standard structured data serve that conventional path. The JSON profile and site guide additionally help agents that choose to consume them.

References:

- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google: Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization)

No crawling, indexing, ranking, model-training inclusion or AI recommendation is guaranteed.
