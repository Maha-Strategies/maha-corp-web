# Educational Jyotisha Preview — 2026-09-14

## Scope and authorization

The user approved a separate internally reviewed educational interpretation
profile and a test deployment. Production promotion is not part of this run.
The profile does not create practitioner approvals or change the existing
compiler's blocked techniques. It is not a complete predictive horoscope.

## What the visitor receives

- Existing D1/D9, Lahiri, mean-node and whole-sign calculations.
- Relationship and work reflections selected through the actual D1 seventh-
  and tenth-house rulers, with the corresponding D9 positions shown separately.
- Nine planetary study notes, explicitly withholding unsupported node readings.
- Current Vimshottari period explanation and 30-/90-day position snapshots.
- Source accounts, exact locators, rights, required factors, exceptions, rule
  and report digests, a readable report, and the internal—not expert—review label.
- Synthesis distinguishes the relationship and work lenses; a repeated ruler
  is not double evidence. Nonzero uncertainty withholds all personal prompts.

The prompts are modern reflective questions, not claims that a sign determines
personality, that a spouse can be identified, or that an event will occur.
The period names select study vocabulary; this is not a classical period-outcome
rule. D1 house meanings are never transferred to D9 to manufacture a marriage rule.

## Source inspection and internal review

Wellcome record: https://wellcomecollection.org/works/afmgm695

Downloaded public-domain 1885 Foster Press / N. Chidambaram Iyer edition:
https://iiif.wellcomecollection.org/pdf/b2488442x

PDF SHA-256: `267c568e6453d4c0697782b41667676abc35db2bdb1c8973ca61bfc2f640d25b`

The main agent visually inspected complete PDF pages 52, 53, 54, 55, 56, 57
and 60. Accepted bounded accounts are I.15 and note (a), printed 11–12 (PDF
52–53); II.1, printed 14 (PDF 55); II.3, printed 15 (PDF 56).
This is automated internal source/implementation review, not a qualified
practitioner endorsement. No source scan or private demonstration is deployed.

II.1's health and sorrow language is not converted into health or misfortune
predictions. The naming passage for Rahu/Ketu does not establish psychological,
foreign-spouse, destiny, or period-outcome meanings. Historical gendered language
is disclosed; gender-neutral relationship questions are labelled as adaptation.

## Access and privacy

Reader: `/knowledge/birth`

Free API: `POST /api/v1/interpretations/jyotisha/basic`, JSON schema version
`jyotisha-basic/0.2`. Existing synthetic request shape is documented in
`jyotisha-local-readiness.md`.

The exact free route bypasses the paid API gate, not its own safety checks.
Both the form and API use an atomic Redis service budget: 30 requests per
60-second window and 1,000 per 24-hour window. Counters contain no IP, identity,
birth details or report. These are shared rolling-from-first-use counters,
not per-user limits. Unavailable Redis fails closed. Preview keys use the
existing Preview namespace rather than Production's keyspace.

No report storage or paid packaging added. The API uses private/no-store and
noindex headers. Sentry server and browser events associated with the reading
are dropped, including navigation breadcrumbs. Optional place lookup transmits
place text only, as disclosed in the UI. A report displayed in a browser remains
sensitive; hashes are integrity identifiers, not anonymization.

## Local verification

- 68 chart, timing, foundation, education, compiler, privacy and API tests pass.
- 12 existing API-key/credential-limiter regression tests pass.
- Scoped ESLint clean; diff whitespace check clean.
- Clean snapshot: Next route type generation and full TypeScript check pass.
- Snapshot is based on `5e14ed50` plus the explicit astrology file allowlist,
  not the workspace's unrelated dirty checkout or a claim that HEAD contains
  these changes.

## Preview verification

Deployment `dpl_6595pG6DJJAVovZkAiZgv9K6eYgq` reached READY:
https://maha-corp-893dsfpvv-mayonerajans-projects.vercel.app/knowledge/birth

Vercel compilation, TypeScript checking and static generation completed.
The synthetic-only remote verifier passed on 2026-09-14:

- Free basic POST returns the educational profile, four sections and nine
  planetary notes without a paid API credential.
- Returned educational payload digest recomputes.
- Nonzero time uncertainty withholds personalized reflections.
- Ambiguous DST input, query parameters and injected reviews are refused;
  GET on the POST endpoint returns 405.
- API responses carry no-store and noindex; served reader HTML includes the
  review disclosure and uncertainty input.

After the user signed in, a separate browser tab generated a report through
the visitor form using synthetic 2000-01-01 12:00 UTC, coordinates 0/0.
The result rendered all four educational sections, nine planetary notes,
D1/D9 placements and timing. Evidence disclosure exposed the expected source
locators, rights and limits. Enter toggled the disclosure and its keyboard
focus outline was visible. Re-submitting with 30 minutes uncertainty replaced
the reflections with explicit withholding and alternatives guidance. The URL
remained `/knowledge/birth`, without submitted parameters.

Rendered width/clientWidth/scrollWidth matched at 1280 and 647 pixels; the
report and disclosure were visually inspected. A requested 375-pixel override
did not take effect, so phone-width verification is still outstanding, not
claimed passed. The override was reset. Deployment protection was not disabled.
No personal birth details were used in remote tests.

Production is unchanged. No git push, merge or Production promotion performed.
