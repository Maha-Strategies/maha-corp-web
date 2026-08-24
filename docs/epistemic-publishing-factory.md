# Epistemic publishing factory — Phases 5–8

The factory scales internal draft preparation without scaling publication authority. It operates only on the latest immutable candidate for each selected record.

## Phase 5 — audit and packet compilation

Each reviewer packet binds:

- the exact candidate and review-target SHA-256 digests;
- the complete frozen candidate snapshot;
- a claim-to-source matrix with exact locators, rights basis, source scope, and source boundaries;
- the published criteria for all four expert-review scopes, each explicitly marked `unreviewed`;
- an automated source-to-claim and unsupported-inference audit;
- `noncanonical-draft` and `noindex, nofollow, noarchive` controls.

Automated audits can block or flag a packet. They cannot approve one, satisfy an expert-review scope, or establish that a source is accurately interpreted.

## Phase 6 — bounded batch operation

One run accepts 1–500 current targets. It fails closed on duplicate records, hash drift, stale revisions, promoted records, or a record snapshot that differs from the durable ingestion ledger. Runs, audits, and packets are append-only Supabase records inserted only through the `record_epistemic_factory_run` security-definer function.

No candidate route is generated. Candidate records and packets are absent from `app/sitemap.ts`.

## Phase 7 — independent public-authority conformance

The public fixture at `/conformance/celestial-public-authority-v1.json` freezes:

- 28 geocentric apparent ecliptic-of-date longitude comparisons against NASA/JPL Horizons DE441; and
- two lunar-phase event-time comparisons against the US Naval Observatory Astronomical Applications Department API.

The fixture uses neutral timestamps and contains no participant, natal, founder, customer, or business-event data. It validates arithmetic and declared conventions only; it does not validate astrological interpretation or predictive claims.

## Phase 8 — chat-operable provenance

The operator command previews by default:

```sh
npm run operate:epistemic-factory
```

Persist a reviewed run explicitly:

```sh
npm run operate:epistemic-factory -- --apply
```

Limit a run by repeating `--record-id`:

```sh
npm run operate:epistemic-factory -- --record-id urn:maha:record:example --record-id urn:maha:record:example-two
```

The command requires `EPISTEMIC_OPERATIONS_TOKEN` and refuses non-Production hosts. The private API returns only packet summaries for batch operations; a full packet can be retrieved with an authenticated `GET /api/admin/epistemic-factory?recordId=<URN>`.

The operations credential never reaches canonical release control. Independent review and separately authenticated release authorization remain later human decisions.
