# Book publication discovery

`lib/book-publications.ts` is the shared public source for The Maha Principle,
The Orbital Mind, and The Imagined Life. It drives:

- `/books/publications.json` and its published JSON schema;
- `/books/publications`, with reader-facing descriptions and edition status;
- Book JSON-LD on the catalog and the Orbital Mind / Imagined Life hubs;
- the published-books section of `/llms.txt`.

The catalog is also listed in the machine-readable registry, books index, and
the reader page's sitemap entry. The Maha Principle full web edition remains
under its existing publishing-maintenance restriction; discovery of retail
metadata does not expose its manuscript.

Update the catalog's date and edition records after checking the publisher
dashboards. `live` is KDP's observed status, `published` is Draft2Digital's;
neither proves stock or delivery in every marketplace. Keep submissions as
`in_review`, `publishing`, or `preparing_manuscript` until confirmed. Missing
retailer URLs and ISBNs stay absent. Do not reuse another platform's ISBN.

The abstract work and each retailer/open-web edition have separate JSON-LD
identifiers. Only the existing open web edition carries its July 2026 web
publication date and free-access declaration. Retail publication dates are
omitted until independently established. The catalog makes no stock Offers,
and doesn't advertise private publisher administration URLs or unpublished
local manuscript revisions. Companion working papers retain their own
verification and licensing boundaries.

Local checks: the book-publications, machine-readable-registry, and
company-profile test files; scoped ESLint and TypeScript checks; HTTP checks
against the local Next.js server. Deployments require the explicit Vercel
build-credit approval described in AGENTS.md.
