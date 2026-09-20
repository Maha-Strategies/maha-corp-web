# Nanotechnology and Physical AI — candidate map, evidence packets and readiness ledger

Prepared 2026-09-19, revised 2026-09-20 after a source-to-claim review. Local work only: nothing in this record was pushed, deployed or built on Vercel,
and no production database was touched.

## What these sections are

Two new Knowledge sections publish explanation and evaluation method:

- `/knowledge/nanotechnology` — what the nanoscale actually changes, what each characterisation
  method can and cannot see, how to report a size with its uncertainty, and how to read a supplier
  claim. Maha makes no materials, runs no synthesis or characterisation, and certifies nothing.
- `/knowledge/physical-ai` — world models, vision-language-action policies, learning from
  demonstration, domain randomization, uncertainty, runtime monitoring and benchmark validity.
  Maha operates no robot, replicates no benchmark, and endorses no system or vendor.

Robotics is a dependency of physical AI, not a competing corpus. `/knowledge/robotics` keeps the
hardware, the evidence intake and the safety boundaries; physical AI links to it rather than
publishing a second version of those subjects. Four physical-AI candidates were declined on exactly
that ground (below).

## Counts

| | Nanotechnology | Physical AI | Total |
|---|---|---|---|
| Candidates proposed | 24 | 24 | 48 |
| Implemented (published) | 17 | 16 | **33** |
| Evidence-ready, not implemented | 0 | 0 | 0 |
| Blocked on an uninspected source | 4 | 2 | 6 |
| Declined as duplicative | 3 | 4 | 7 |
| Sent back for revision | 0 | 2 | 2 |
| Sources inspected | 11 | 11 | 22 |
| Routes | 2 (hub + `[slug]`) | 2 (hub + `[slug]`) | 4 |

All eight previously evidence-ready candidates were completed on 2026-09-20, each against a source
opened and read that day. No candidate now sits in `evidence-ready`: what remains is blocked on a
source that could not be read, duplicative of a route that already owns the subject, or sent back
for revision on editorial grounds.

Search demand is recorded as `unknown` for all 48 candidates. No Search Console export was
available locally, and no demand figure was invented.

## Source-to-claim review of commit 0c47b91f

Every source record in the original commit was re-opened and checked against the claim recorded
with it. **Ten of the twelve verified on 2026-09-20; the two that did not are itemised below and
both are now resolved**, so all twenty sources in the section have been checked.

Verified exactly, including the specifics most costly to get wrong: OpenVLA's 7B parameters, 970k
demonstrations, RT-2-X at 55B and the 16.5-point gap across 29 tasks; Meta-World's 50 tasks and its
"as few as ten distinct training tasks"; the seven enumerated randomisation categories in Tobin
§III-A with the fixed table height and uncalibrated camera; Ha and Schmidhuber's temperature
parameter and the adversarial dream policy; the NNI's 1–100 nm wording; EPA's TSCA reporting rule
and premanufacture notification; NIST TN 1297's Type A and Type B definitions; and DAgger's induced
distribution.

### The two not covered by that count

1. **`osha` — a fabricated inspection.** The record claimed an inspection of
   `osha.gov/nanotechnology` dated 2026-09-19 with a specific claim about engineered-nanomaterial
   definitions and permissible exposure limits. The page could not be read on 2026-09-20 — OSHA's
   CDN returns 403 to both a plain fetch and a real headless browser — and the prior session's own
   fetch log records status `000` for that URL, meaning no content was ever retrieved. The claim
   had no inspection behind it. **Resolution: the source was removed**, not hedged, and replaced by
   NIOSH *Approaches to Safe Nanotechnology* (DHHS/NIOSH 2009-125), read at §4.1, §4.2 and §8.3.5
   from the PDF. The three articles that cited OSHA were rewritten against it. Dependent claims
   audited: `what-nanoscale-means` (definition range), `nanomaterial-classes` (class taxonomy),
   `exposure-and-safety-evidence` (exposure-limit framing) — all three rewritten.
2. **`risk` — never verified.** The NIST AI Risk Management Framework record was carried from the
   first commit without being re-opened; it was simply missed in the first pass and was not among
   the ten. **Resolution: verified on 2026-09-20.** The page states the framework is "intended for
   voluntary use and to improve the ability to incorporate trustworthiness considerations into the
   design, development, use, and evaluation of AI products, services, and systems", which matches
   the recorded claim. The boundary was sharpened: NIST has issued companion profiles for other
   sectors, but there is no robot-specific profile and no acceptance criterion for a physical
   machine. Dependent claim audited: `runtime-monitoring-and-fallback`, whose `establishes` already
   said only "that a recognised public framework exists for organising these questions" — narrow
   enough to stand, and left unchanged.

### A third defect: historical scope

The replacement NIOSH document is from **2009**, and its statement that no specific US exposure
limits then existed for airborne engineered nanomaterials was being presented as the current
position. It is not. NIOSH has since issued recommended exposure limits of its own:

- **CIB 63 (2011)** — 2.4 mg/m³ for fine TiO₂ and 0.3 mg/m³ for ultrafine, including engineered
  nanoscale, TiO₂, as TWA concentrations for up to 10 hours a day in a 40-hour week; ultrafine TiO₂
  classified a potential occupational carcinogen, fine TiO₂ with insufficient data to classify.
  Read from the PDF at the executive summary, p. iii.
- **CIB 65 (2013)** — 1 µg/m³ elemental carbon as a respirable-mass 8-hour TWA for carbon nanotubes
  and nanofibres.

Both were added as sources and `exposure-and-safety-evidence` was rewritten around the history,
which makes a better article than the flat claim did: one chemical carries two different limits and
two different carcinogenicity findings purely on size, and both limits are *recommendations*, not
enforceable standards, with NIOSH recording residual risk at the carbon-nanotube figure. The 2009
document's boundary now states its own date and says this section cites it for definitions and
reasoning only, never for the current state of exposure limits. A new reader check was added:
"Check the date on any statement that no limit exists."

An intermediate search result also offered 7 µg/m³ for carbon nanotubes — the 2010 *proposed* REL,
superseded by 1 µg/m³ in the final 2013 bulletin. Going to the primary document is what caught it.

### Attribution errors in the same day's new work

Four author attributions were wrong on first draft and were corrected against each paper's author
list before commit: the bandgap paper is Ferreira et al. (not Segets), the battery comment is Lin,
Liu, Ai and Liang in *Nature Communications* 2018 (not Cao, Li and Liu), the protein-corona review
is Akhter et al. in *Biomedicines* 2021, and the chemiresistive review is Liu et al. in
*Nanomaterials* 2025.

### What the tests do and do not prove

Two tests were added. One pins every figure verified on 2026-09-20; the other requires each source
to carry a short verbatim `anchor` phrase from the passage it cites, checks the phrase is fifteen
words or fewer, and checks no two sources share one.

**Neither test proves a source was inspected, and neither proves a source supports the claim made
from it.** They are drift guards: they stop a number or a citation changing silently, and they stop
an anchor going missing. The anchor is a *verification handle*, not verification — its value is that
a reviewer can search the source for that exact phrase and see for themselves. That handle is now
published: every article renders it under "Locator, anchor and reuse basis", with an invitation to
report a citation where the phrase is absent or does not carry the stated meaning. Only a person
re-reading the source closes the loop, and this document should not be read as claiming otherwise.

## Evidence standard applied

Every article follows one seven-part structure: a direct answer, the mechanism, a concrete case,
what the evidence establishes, what it does not, questions worth asking, and the sources with their
locators. Each source below was opened and read at the section or passage recorded with it. Reported
performance figures are attributed to the authors who reported them; none has been replicated here.
Where an article proposes a method rather than reporting a finding about the world, it carries no
source and says so in its own words.

### Source packets

The full registry — title, URL, locator, inspection date, verbatim anchor, what the passage
establishes, what it does not, and the reuse basis — lives in `lib/nanotechnology-knowledge.ts`
(11 sources) and `lib/physical-ai-knowledge.ts` (11 sources), and every field is rendered on the
articles that cite it. A test asserts that every listed source is actually cited by an article, so
an unearned citation cannot sit unused in the registry.

Government and standards sources: NNI, NIOSH 2009-125, NIOSH CIB 63, NIOSH CIB 65, EPA (TSCA), FDA,
NIST TN 1297, NIST AI RMF. Open-access literature: DAgger, Tobin domain randomization, Ha and
Schmidhuber, OpenVLA, RT-2, Deep Ensembles, Meta-World, ALOHA/ACT, Welch and Bishop, Concrete
Problems in AI Safety, the protein-corona review, the bandgap paper, the chemiresistive selectivity
review, and the battery-metrics comment.

Reported performance figures are attributed to the authors who reported them; none has been
replicated here. Where an article proposes a method rather than reporting a finding about the
world, it carries no source and says so in its own words.

## Candidates not implemented, and why

### Blocked on a source that could not be read

Citing an unread source is the failure this section exists to prevent, so these stay unpublished.

- `electron-microscopy-artifacts` (nano) — needs a microscopy standards or instrument-documentation
  source at section depth; none inspected.
- `light-scattering-weighting` (nano) — requires an ISO 22412-class standard; paywalled.
- `environmental-fate` (nano) — needs an OECD or EPA fate document at section depth; OECD refused
  automated access.
- `standards-landscape` (nano) — core vocabulary and method standards are paywalled.
- `contact-rich-manipulation` (physical AI) — needs a contact-dynamics or force-control paper read
  at passage depth.
- `locomotion-evaluation` (physical AI) — deferred rather than summarised second-hand.

### Declined as duplicative

- `nano-in-electronics` → `/knowledge/suppliers` and the semiconductor process map
- `memristive-devices` → `/knowledge/neuromorphic-biocomputing`
- `medical-nanomaterials` → folded into `/knowledge/nanotechnology/regulatory-status-is-not-safety`
- `sensor-calibration` → `/knowledge/robotics/calibration-records`
- `time-synchronisation` → `/knowledge/robotics/sensor-time-alignment`
- `execution-evidence` → `/knowledge/robotics/evidence-package`
- `human-robot-interaction` → `/knowledge/robotics/human-robot-handoff` and `accessibility-evaluation`

A test resolves each of these notes against the App Router tree, so a candidate cannot be waved
away by naming a route that does not exist.

### Sent back for revision

- `multimodal-perception` — the draft framing overlapped `perception-action-loops` without adding a
  distinct question.
- `energy-and-compute-budgets` — would need measured figures Maha does not have, and would
  otherwise restate vendor specifications.

### The eight completed on 2026-09-20

Each was blocked only on a dedicated source. Each now has one, opened and read at the locator in
its record.

| Article | Source inspected | What it added |
|---|---|---|
| `surface-functionalisation` | Akhter et al., protein corona review (*Biomedicines* 2021) | Hard/soft corona, biological vs synthetic identity, targeting ligands cloaked |
| `quantum-confinement` | Ferreira et al., size-dependent bandgap (arXiv 1710.01376) | Confinement as a real size effect; what an optically inferred size assumes |
| `nano-sensing` | Liu et al., chemiresistive selectivity review (*Nanomaterials* 2025) | Sensitivity and selectivity from one mechanism; no standard selectivity method |
| `energy-storage-claims` | Lin, Liu, Ai and Liang (*Nature Communications* 2018) | The reporting items a capacity figure must carry |
| `state-estimation-and-filtering` | Welch and Bishop, TR 95-041 | Predict/correct weighting; a filter's confidence is not a check on it |
| `reward-specification` | Amodei et al., Concrete Problems in AI Safety | Named misspecification mechanisms, with the cleaning-robot examples |
| `foundation-model-fine-tuning` | Brohan et al., RT-2 (plus OpenVLA) | What web pretraining transfers, and what it does not |
| `teleoperation-interfaces` | Zhao, Kumar, Levine and Finn, ALOHA/ACT | The collection interface as part of the dataset |

The `nano-sensing` ownership question is now settled rather than deferred: surface transduction and
its evidence problems belong here, event-driven encoding and computation to
`/knowledge/neuromorphic-biocomputing`, and the article links there.

## The two executable examples

### `scripts/nanoscale-surface-area.ts` — unit-aware geometry

```
node --experimental-strip-types scripts/nanoscale-surface-area.ts --shape sphere --size 10 --density 4
```

Returns 150 m²/g and an area-to-volume ratio of 6 × 10⁸ m⁻¹ for a 10 nm sphere at 4.0 g/cm³, with
the dimensional check behind every unit and the geometry-only boundary attached to the result.

Counterexamples and refusals, all covered by tests: a platelet matched to the sphere on volume
returns a far larger specific surface area (so a size number alone cannot predict it); a long thin
rod likewise; zero, negative and non-finite dimensions are refused; zero and negative density are
refused rather than returning infinity; unsupported units and shapes are refused. The sphere case
is checked against the closed form 6/(ρ·d) rather than against a stored snapshot.

### `scripts/physical-ai-loop.ts` — a deterministic perception–action fixture

```
node --experimental-strip-types scripts/physical-ai-loop.ts counterexamples
```

Three measured counterexamples, with the article text written to match the measurement:

1. **Latency alone flips the outcome.** Same seed, noise, gain and monitor threshold; only the
   actuation delay differs. Zero delay → `autonomous-success` in 4 steps (final error 0.044); three
   steps of delay → `failure` after 40 steps (final error 5.00), with no monitor firing and no
   intervention to rescue it.
2. **A threshold below the noise floor buys nuisance, not safety.** The calibrated monitor fires 0
   times and the run is an `autonomous-success`; tightened to 0.02 it fires 14 times, all 14
   classified as false alarms because the scenario contains no disturbance, and the run downgrades
   to `assisted-success`.
3. **With a real disturbance, a firing has something to explain.** With an injected jump at step 3
   the report separates 2 true detections from 2 false alarms; without the disturbance the same
   monitor records 0 true and 1 false.

Failure tests also assert what the fixture refuses to say: an assisted success is never reported as
autonomous, a run with no operator available aborts rather than continuing unmonitored, and every
report carries its configuration and its limitations. Negative noise, negative or fractional delay,
zero gain, zero tolerance, zero steps and non-finite parameters are all refused.

Both scripts are offline, dependency-free and write nothing.

## Navigation and reachability

Homepage → `/knowledge` (global navigation) → section hub → article, through ordinary `<a href>`
links with no JavaScript and no search step. Verified against served HTML, not just source:
`scripts/verify-nano-physical-ai-render.cjs` fetches all 25 articles, both hubs, the knowledge
index, the homepage and the sitemap; it checks that each article's answer, explanation, example,
boundary, checks and source locators appear in the served markup, that every internal link returns
200, that an unpublished slug returns 404, and that the sitemap lists every new route.

Cross-links added: the robotics hub now links both new sections and states that it keeps ownership
of hardware, evidence intake and safety; the neuromorphic hub links both; both new hubs link back
to robotics, to each other and to the relevant existing sections.

## Reconciliation with the primary checkout

Measured on 2026-09-20 rather than assumed. `origin/main` is at `ec076e2f`; this branch is based on
it with zero commits behind, so there is nothing to merge in.

The primary checkout sits on `feat/context-control-and-outer-planets`, which has **diverged** from
main, with a large set of uncommitted changes. This branch touches three of those files:
`app/knowledge/page.tsx`, `app/sitemap.ts` and `test/public-visual-system-completeness.test.ts`.

A three-way merge was simulated in a throwaway worktree — the primary checkout was never written
to, and its three files are byte-for-byte as they were found.

1. **Merging `origin/main` into the uncommitted state conflicts today, independently of this
   work**: `app/knowledge/page.tsx` and `test/public-visual-system-completeness.test.ts` each
   conflict, `app/sitemap.ts` merges cleanly.
2. Both conflicts are one line. `app/knowledge/page.tsx`: the robotics card kicker, local
   "Robotics evidence · local editorial draft" against main's "· editorial guides" — main's is now
   the accurate label, since robotics is published. The test: a `knowledge: 71` route pin against
   main's `knowledge: 75`. Main supersedes both.
3. **Nothing unique is lost.** The one piece of original documentation in the uncommitted set — the
   comment "// 70 -> 71: the Jyotisha reader guide uses the existing Knowledge overlay." — is
   already present verbatim in main at line 66, and the sitemap's two astrology lines are already in
   main at lines 183–184.
4. **This branch then merges with zero conflicts** on top of that resolution, and the combined tree
   passes the section tests and both route tripwires (24 tests, 24 pass).

So the conflict cost of this work is nil; the conflict that exists is between the primary
checkout and main, and it predates this branch. The remaining ~180 uncommitted files are untouched
by this branch entirely, and resolving the three is the checkout owner's call, not this branch's.

Separately: the primary checkout gained 23 new untracked x402 *buyer-brief* files during this
session, from concurrent work in the shared repository. None originates here — zero of them appear
in this branch's commits. Noted only because it confirms the checkout is live and must not be
written to.

## Verification run locally

| Check | Result |
|---|---|
| `tsc --noEmit` | No new errors. The 13 pre-existing `RouteContext` errors come from Next-generated route types that only exist after a build, and none is in a file touched here. |
| `eslint` on all new and changed files | Clean. |
| `test/nanotechnology-physical-ai.test.ts` | 14 tests pass, including the new figure-verification tripwire. |
| `test/nanoscale-geometry.test.ts` | 7 tests pass. |
| `test/physical-ai-loop.test.ts` | 8 tests pass. |
| `test/public-visual-system-completeness.test.ts` | Passes; knowledge route count repinned 75 → 79. |
| `test/knowledge-cyber-light.test.ts` | Passes; route count repinned 75 → 79. |
| `scripts/verify-nano-physical-ai-render.cjs` against a local dev server | All served-output checks pass across **33 articles**, 2 hubs, the index, the homepage and the sitemap. |
| Neighbouring suites (sitemap hygiene, sitewide route reachability, sitemap canonical freshness, knowledge data, robotics, neuromorphic, theme contrast, colour scheme, machine-readable registry) plus the three new files | 88 tests, 88 pass, 0 fail. |
| Rendering at 375 px and 1440 px in headless Chrome | No horizontal overflow on either width across both hubs, four sampled articles and two control pages; no element extends past the viewport. Heading contrast 14.16:1, body copy 5.30:1 — both above WCAG AA. Every link in `main` is keyboard-focusable, with focus rings from the global `:focus-visible` rule. |

The tests found four defects in the data on 2026-09-19, all fixed rather than papered over: a
candidate marked `implemented` with no article (`medical-nanomaterials`), two duplicative candidates
whose notes named no resolvable owning route, and an article with only one onward link. The
2026-09-20 source review found two more — the fabricated OSHA inspection and the FDA draft/final
error — plus four wrong author attributions in the same day's new work. All are fixed above.

Postgres-backed tests in the wider suite fail in this environment because `initdb` cannot run. That
is a pre-existing local limitation unrelated to this work.

## Remaining checks that need authorization

### Production-build verification — done 2026-09-20, authorised by the user

The one outstanding check has been run. `next build` in the worktree succeeded with no warnings and
no errors, generating 3,700 static pages. Both hubs build as static routes (`○`) and both article
routes prerender as SSG (`●`), which is what `dynamicParams = false` is there to produce.

Against `next start` on the built output:

| Check | Result |
|---|---|
| `scripts/verify-nano-physical-ai-render.cjs` | All served-output checks passed across 33 articles, 2 hubs, the knowledge index, the homepage and the sitemap — bodies, source locators, boundary statements, every internal link 200, an unpublished slug 404, every route in the sitemap. |
| Rendering at 375 px and 1440 px | No horizontal overflow and no element past the viewport on either width, across both hubs, four of the new articles, and two control pages. |
| Contrast | Headings 14.16:1, body copy 5.30:1 — both above WCAG AA. |
| Keyboard | Every link in `main` focusable, focus rings from the global `:focus-visible` rule. |

This closes the gap the dev-server verification left. It was a local build only: nothing was
pushed, deployed, sent to Vercel, or written to any database.

### Still not done, and not requested

Publication. Nothing has been pushed and no PR has been opened — opening one triggers CI, which is
a build on someone else's infrastructure, and that decision is the user's.
