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
| Sources inspected | 9 | 11 | 20 |
| Routes | 2 (hub + `[slug]`) | 2 (hub + `[slug]`) | 4 |

All eight previously evidence-ready candidates were completed on 2026-09-20, each against a source
opened and read that day. No candidate now sits in `evidence-ready`: what remains is blocked on a
source that could not be read, duplicative of a route that already owns the subject, or sent back
for revision on editorial grounds.

Search demand is recorded as `unknown` for all 48 candidates. No Search Console export was
available locally, and no demand figure was invented.

## Source-to-claim review of commit 0c47b91f

Every source record in the original commit was re-opened and checked against the claim recorded
with it. Ten of twelve verified exactly, including the specifics most costly to get wrong:
OpenVLA's 7B parameters, 970k demonstrations, RT-2-X at 55B and the 16.5-point gap across 29 tasks;
Meta-World's 50 tasks and its "as few as ten distinct training tasks"; the seven enumerated
randomisation categories in Tobin §III-A with the fixed table height and uncalibrated camera;
Ha and Schmidhuber's temperature parameter and the adversarial dream policy; the NNI's 1–100 nm
wording; EPA's TSCA reporting rule and premanufacture notification; and NIST TN 1297's Type A and
Type B definitions.

Two defects were found and fixed:

1. **A fabricated inspection.** The `osha` source recorded an inspection of
   `osha.gov/nanotechnology` dated 2026-09-19 with a specific claim about engineered-nanomaterial
   definitions and permissible exposure limits. That page could not be read today — OSHA's CDN
   returns 403 to both a plain fetch and a real browser — and the prior session's own fetch log
   records status `000` for it, meaning no content was ever retrieved. The claim was therefore not
   supported by an inspection. The source has been **removed** and replaced with NIOSH
   *Approaches to Safe Nanotechnology* (DHHS/NIOSH 2009-125), read at §4.1, §4.2 and §8.3.5, which
   covers the same ground with better support: the ISO/TS 27687:2008 nano-object taxonomy, and the
   statement that no specific US exposure limits exist for airborne engineered nanomaterials while
   limits for larger particles of the same chemistry may not be health-protective. The three
   articles that cited OSHA were rewritten against the new source.
2. **A wrong locator detail.** The FDA entry described the drug-products guidance as draft; it is
   listed as final. Corrected, and the inspection re-dated.

Four author attributions written on 2026-09-20 were also wrong on first draft and were corrected
after checking each paper's author list: the bandgap paper is Ferreira et al. (not Segets), the
battery comment is Lin, Liu, Ai and Liang in *Nature Communications* 2018 (not Cao, Li and Liu),
the protein-corona review is Akhter et al. in *Biomedicines* 2021, and the chemiresistive review is
Liu et al. in *Nanomaterials* 2025.

A new test pins the verified figures. If anyone edits OpenVLA's 16.5 points, Meta-World's ten
training tasks, ALOHA's 80–90% over six tasks, RT-2's ~6,000 trials or the battery paper's
99.96%/500-cycle and 2 vs 5–10 mg/cm² figures, the test fails rather than absorbing the change.

## Evidence standard applied

Every article follows one seven-part structure: a direct answer, the mechanism, a concrete case,
what the evidence establishes, what it does not, questions worth asking, and the sources with their
locators. Each source below was opened and read at the section or passage recorded with it. Reported
performance figures are attributed to the authors who reported them; none has been replicated here.
Where an article proposes a method rather than reporting a finding about the world, it carries no
source and says so in its own words.

### Nanotechnology source packets

| Key | Source | Read at | Inspected | Reuse basis |
|---|---|---|---|---|
| `nni` | National Nanotechnology Initiative — About Nanotechnology | About Nanotechnology, opening paragraph; "How small is nano?" | 2026-09-19 | Original paraphrase and link only |
| `osha` | OSHA — Nanotechnology (Safety and Health Topics) | Overview; Standards | 2026-09-19 | Original paraphrase and link only |
| `epa` | EPA — Control of Nanoscale Materials under TSCA | Nanoscale Materials; Regulatory Approach; Information gathering rule; Reporting under the rule | 2026-09-19 | Original paraphrase and link only |
| `fda` | FDA — Nanotechnology Guidance Documents | Guidance list, including the product-application, cosmetics and draft drug-product guidances | 2026-09-19 | Original paraphrase and link only; guidances not reproduced |
| `uncertainty` | NIST Technical Note 1297 | §2 classification; §3 Type A; §4 Type B; §7 reporting | 2026-09-19 | Original paraphrase and link only |

### Physical AI source packets

| Key | Source | Read at | Inspected | Reuse basis |
|---|---|---|---|---|
| `imitation` | Ross, Gordon and Bagnell — DAgger | Abstract; §1 | 2026-09-19 | Paraphrase and link to the open preprint |
| `randomization` | Tobin et al. — Domain Randomization | §III-A | 2026-09-19 | Paraphrase and link to the open preprint |
| `worldmodel` | Ha and Schmidhuber — World Models | §4.4 and surrounding discussion of model imperfections | 2026-09-19 | Paraphrase and link to the open preprint |
| `vla` | Kim et al. — OpenVLA | Abstract; §1 | 2026-09-19 | Paraphrase and link; reported figures attributed to the authors |
| `uncertainty` | Lakshminarayanan et al. — Deep Ensembles | Abstract; §1 | 2026-09-19 | Paraphrase and link to the open preprint |
| `benchmark` | Yu et al. — Meta-World | Abstract; §1 | 2026-09-19 | Paraphrase and link to the open preprint |
| `risk` | NIST AI Risk Management Framework | Overview of the AI RMF | 2026-09-19 | Original paraphrase and link only |

A test asserts that every listed source is actually cited by an article, so an unearned citation
cannot sit in the registry unused.

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

One consolidated check remains, covering both commits at once.

**Production-build verification of all 33 articles and both hubs.** Everything above was verified
against a local dev server. The dev server can mask problems that only appear in a production
build — stale cached imports, and the static-generation behaviour of `dynamicParams = false`, which
is exactly what makes an unpublished slug 404. The check is:

```
npx next build && npx next start -p 3117
node --experimental-strip-types scripts/verify-nano-physical-ai-render.cjs http://localhost:3117
```

This is a local build only. It runs on this machine, pushes nothing, deploys nothing, triggers no
Vercel build and writes to no database. It needs authorization because the brief said no production
build without one.

Publication is a separate decision and is not being requested here: nothing has been pushed, and
opening a PR would trigger CI.
