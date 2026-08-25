# Evidence dossier operator guide

Internal editorial tool. It creates, validates, revises and renders evidence
dossiers without hand-editing TypeScript. It publishes nothing.

## What this tool will not do

It cannot promote a dossier to canonical, cannot claim external review, cannot
write to production, and has no public write API. Those refusals are enforced
in code, not by convention.

## Package shape

One package is one immutable revision. Four layers are kept apart:

| Layer | Meaning | In the digest? |
| --- | --- | --- |
| submitted | what an operator handed in, preserved verbatim | yes |
| extracted | what was read out of a source, with locators | yes |
| audited | what the evidence actually supports | yes |
| presentation | rendering choices only | **no** |

Because presentation sits outside the digest, restyling a report cannot be
confused with changing what it claims.

## Validating locally

Open `/internal/evidence-dossier/operator`. Paste a package or choose a local
file. Everything runs in the browser: nothing is uploaded, stored or indexed,
and closing the tab discards it.

The console reports every problem by exact JSON path, and previews nothing
until the package is clean. It also recomputes the payload digest and tells you
whether the supplied one matches.

## Ingesting from the command line

```bash
npm run evidence-dossier:ingest -- --file content/evidence-dossier/fixtures/valid-v0-2.json --dry-run
```

Flags: `--file` (required), `--store` (default `.dossier-store`), `--out` to
write a reviewer packet, `--dry-run` to validate without appending.

The command accepts file paths only. It refuses credential-shaped arguments and
never prints payload content, so a failed run is safe to paste into a ticket.

## Revision rules

```
illustrative-draft -> validate -> internally-audited -> revised draft
```

- The first revision must start at `illustrative-draft`.
- After the first, `parentDigest` is required and must match the stored head.
- `internally-audited` requires a recorded decision with a real rationale.
- `externally-reviewed` and `canonical` are refused outright.
- Changing evidence produces a new revision and a new digest. Nothing is edited
  in place; nothing is deleted.

## Regenerating fixtures

```bash
npm run evidence-dossier:fixtures
```

The valid fixture is generated from the committed v0.2 dossier so it cannot
drift. Each invalid fixture carries exactly one defect.

## What is still manual

- Reading the sources. Locators are recorded, not discovered; the tool cannot
  confirm a passage says what a claim says it says.
- Judging whether an audited statement is bounded correctly.
- Deciding whether a comparison axis is genuinely comparable.
- Everything after internal audit. There is no external review path here.
