# D1/D9 reader: local readiness, 2026-09-13

Status: locally implemented calculation and source-trace scaffold, NOT a complete personal interpretation product. No Vercel build, push, deployment, new practitioner acceptance, or public demonstration.

## Implemented

- `natal-foundation.ts`: D1 plus continuous ninth-harmonic D9, whole-sign houses from each chart's own ascendant, Lahiri and mean-node conventions; existing Vimshottari timing and its actual-nakshatra-stay-time birth balance / 365.2425-day year remain explicit.
- Declared birth uncertainty up to ±120 minutes: at most 49 samples, <=5-minute spacing, nominal plus endpoints. Distinct observed D1/D9/nakshatra states and endpoint/nominal dasha alternatives are returned. These are samples, NOT an exhaustive interval proof. Unconditional notes remain withheld with nonzero uncertainty.
- Versioned calculation receipt, source/rule digests, predicates, matched facts, locators, editions, rights, limitations and recorded disagreements. Existing compiler gates remain authoritative. No D1 rule is implicitly applied to D9.
- Existing `/knowledge/birth` form and report gain uncertainty input, D9 placements, alternatives and source-trace disclosures. Existing timezone/place lookup remains available. The optional external location search transmits place text only.
- Repeat form submissions no longer send the prior report back as action state. Local Next development logging exposed that unnecessary round trip with synthetic data; the client now passes an empty idle state. Production framework/APM verification remains a separate release check.
- Anonymous `POST /api/v1/interpretations/jyotisha/basic`, separate from the token-protected pilot. Strict schema, 2 KiB actual body limit, no query inputs, no-store/noindex responses and generic errors. No persistence, birth-content telemetry or external calls added to the handler.
- Five report sections: overview, relationships, work, periods and transit snapshots. Coverage is explicit. Thirty-/ninety-day snapshots are not ingress dates or event predictions.

## Basic request (synthetic)

```json
{
  "date": "2000-01-01",
  "time": "12:00",
  "timeZone": "UTC",
  "latitudeDegrees": 0,
  "longitudeDegrees": 0,
  "birthTimeUncertaintyMinutes": 30,
  "timingInstantUtc": "2026-09-13T12:00:00.000Z"
}
```

The response has `schemaVersion`, `foundation`, and `reading`. Do not put personal input or output in query strings, public examples, telemetry or shared caches. Digests are integrity identifiers, not anonymization. The basic endpoint refuses ambiguous/nonexistent DST wall times; a future explicit occurrence selector is still needed. The older form surfaces its existing timezone resolution behavior.

## Verified locally

Final targeted run: 59 tests passed, 0 failed across foundation, basic API, prior pilot, birth report, natal chart/timing and interpretation compiler. Focused TypeScript check and scoped ESLint passed; `git diff --check` clean.

- Independent modality-based oracle over all 108 D9 divisions; invalid inputs and wraparound boundaries.
- D9 house mapping uses D9 ascendant, not D1. Crossing a D9 ascendant boundary changes the seventh-house predicate.
- Sampling disagreement and tiny-range sampled agreement both tested; neither implies interval stability.
- Uncertainty cannot bypass withholding through legacy tradition rendering.
- Repeated input reproduces calculations and rule report. Source metadata, pending-review exclusions and separate practitioner status are asserted.
- API accepts anonymous synthetic input; rejects unknown fields, injected approvals, impossible dates, DST gaps/folds, implicit UTC, oversized bodies and queries. Errors do not echo input.
- Browser: synthetic form submission, nominal notes and uncertain alternatives rendered. Width/client/scroll all 375 and all 1280 at respective viewports; mobile screenshot visually inspected. Development server only, not a production-render verification or full WCAG audit.

## Remaining release blockers

1. Relationship/work/dasha/transit interpretive rules still require actual source-fidelity and formalization review. Existing calendar notes are not a substitute for a personal reading. No reviewers or acceptances were invented.
2. A reviewed, executable combined D1/D9 rule set, including qualifications and explicit conflict handling, is still missing. Practitioner captions and ambiguous arithmetic remain disabled.
3. Current synthesis explains coverage and recorded disagreement; it does not yet synthesize a full relationship/work reading.
4. Uncertainty is sampled and conservatively withheld, not exhaustively boundary-solved. DST occurrence selection and stronger interval evaluation remain work.
5. Before exposing the anonymous route at scale, configure/verify deployment-level abuse protection and capacity limits. The body/sample bounds are not a distributed rate limiter.
6. Full production build, served-bundle privacy inspection, keyboard/screen-reader audit and deployment still require a later verification pass and explicit build authorization.

Repository-wide typechecking initially refused on pre-existing generated references to absent Maha Principle pages and ES2017/BigInt conflicts in `examples/context-growth/workflow.ts`. Those unrelated files were not changed. Targeted checks must not be represented as a clean full-repository gate.

## Visitor release audit — 2026-09-14

The user authorized completion followed by a test deployment. No build or
deployment was performed: the requested interpretive coverage is not ready.

Shared report validation now rejects impossible calendar dates, DST gaps and
folds, non-UTC timing strings, normalized invalid timing dates, and a reference
instant before the end of the birth uncertainty range. Invalid zone errors no
longer repeat supplied text. The form rejects absent/blank coordinates rather
than coercing them to zero. This protects the form path as well as the API.

Verification: 60 targeted tests passed, including a new shared-validation
regression. Existing report-policy and practitioner-review tests still pass;
no review acceptance was created and no withheld rule was enabled.

Product decision required before expanding interpretation: the current
compiler requires digest-bound practitioner reviews and categorically blocks
several natal techniques. A separately labelled internally reviewed educational
profile would be a change to that policy, not an expert acceptance. It needs
explicit agreement plus real source inspection, executable predicates and tests.
The existing medical, death, guaranteed-event and high-stakes decision exclusions
must remain. Public API abuse protection, production rendering/privacy checks
and Preview verification remain outstanding.
