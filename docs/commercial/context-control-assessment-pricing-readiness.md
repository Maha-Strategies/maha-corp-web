# Context-Control Evidence Assessment — pricing readiness record

**Status: GATE CLOSED. No public price or sales copy was changed.**
**Checked:** 2026-08-21 against `origin/main` at `5f6acd1`.

Internal record. The published offer stays at its current `$5,000` / `$2,500`
wording until the package a buyer is asked to pay for is publicly concrete.

## Why the gate exists

The proposed prices — `$12,500` standard, `$25,000` extended, `$2,500` founding
partner — are defensible only if a prospect can inspect what they are buying
*before* the call. Raising the price while the evidence, the sample deliverable,
the data-boundary statement and the honest benchmark are all still on unmerged
branches would be asking for more money for a package that is, from outside, a
description.

## Prerequisite status

All four are **not merged and not publicly reachable**. Verified three ways:
none of the branch tips is an ancestor of `origin/main`; none of the artifact
files exists in the `origin/main` tree; and the public paths return 404.

| # | Prerequisite | Branch | PR | On `main`? | Public path | HTTP |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Reproducible WSO2 evidence artifact | `codex/wso2-verifiable-evidence` @ `72046b2` | [#126](https://github.com/Maha-Strategies/maha-corp-web/pull/126) OPEN | No | *(no public path yet)* | — |
| 2 | Sample assessment deliverable | `codex/context-control-sample-assessment` @ `7dd1691` | [#127](https://github.com/Maha-Strategies/maha-corp-web/pull/127) DRAFT | No | `/assessments/context-control-evidence-assessment-sample.pdf` | **404** |
| 3 | Security / data-boundary one-pager | `codex/context-control-security-boundary` @ `aaca418` | [#129](https://github.com/Maha-Strategies/maha-corp-web/pull/129) DRAFT | No | `/security/context-control-security-boundary.pdf` | **404** |
| 4 | MCRB-1 dense baseline + public results | `codex/mcrb1-dense-retriever-baseline` @ `79af97d` | [#130](https://github.com/Maha-Strategies/maha-corp-web/pull/130) DRAFT | No | `/benchmarks/mcrb-1/dense/results.json` | **404** |

The live offer page still shows `$5,000`, carries no per-workload evidence
link, and references no `validate:wso2-live-evidence` command. That is the
correct state while the gate is closed.

Each branch still carries its artifact, so nothing has been lost — the work
exists and is waiting on review, not on rework.

## Merge signals the guard watches

The gate is driven by artifacts, not by a flag someone can flip. Each
prerequisite is identified by a file that only exists once its PR merges:

| # | Gate id | Artifact that signals the merge |
| --- | --- | --- |
| 1 | `wso2-evidence-artifact` | `content/integrations/wso2-live-evaluation-evidence.json` |
| 2 | `sample-assessment` | `content/assessments/context-control-evidence-assessment-sample.pdf` |
| 3 | `security-boundary` | `content/security/context-control-security-boundary.pdf` |
| 4 | `mcrb1-dense-baseline` | `public/benchmarks/mcrb-1/dense/results.json` |

All four are absent from `origin/main` today. Note that presence in the tree is
necessary but not sufficient: items 2 and 3 also need a public path, which is
the open question recorded below.

## Blocking order

PR #127 targets **#126's branch, not `main`**. It cannot land independently:

```
#126  wso2-verifiable-evidence      -> main      (merge first)
#127  sample-assessment             -> #126      (merge second, or retarget to main after #126 lands)
#129  security-boundary             -> main      (independent)
#130  mcrb1-dense-baseline          -> main      (independent)
```

#129 and #130 can merge in any order. #126 must precede #127.

## Two things to settle before the price moves

**Public paths do not exist yet.** Prerequisites 2 and 3 commit their PDFs
under `content/`, which Next.js does not serve. Reaching
`/assessments/...` and `/security/...` needs either a move to `public/` or a
route that serves them. Neither PR does this, so "publicly reachable" will
still be false the moment they merge. This is a small, separate change and it
should be made deliberately rather than discovered after a price rise.

**The dense-baseline result changes the sales copy.** PR #130 measures an
off-the-shelf embedder at **71.2%** complete-evidence-set retention against
`maha_bm25`'s **60.4%** on the frozen cohort. Any copy implying Maha leads on
retention is no longer supportable, and the offer page must not be rewritten
around a claim the company's own published benchmark contradicts. The
defensible framing is the one the benchmark supports: determinism, provenance,
hard budgets, cost and latency — with retention reported honestly and a hybrid
named as open work.

## What happens when the gate opens

No decision is deferred; only execution is. Once all four are merged **and**
their public paths resolve:

- `/integrations/wso2`: `$5,000` → **`$12,500`** standard, add **`$25,000`**
  extended.
- Founding Design Partner **`$2,500`**, stated as **limited to the first two
  signed reference customers**, requiring named reference participation, and
  explicitly **not a general discount**.
- Scope block: customer-supplied sanitized workload; frozen configuration and
  workload digest; three paths (baseline, gateway-native compression, Maha);
  cost/token, retention, citations and provenance, latency, failure-path
  evidence; sanitized per-workload findings; written proceed/revise/stop.
- Exclusions, verbatim: no production deployment; no guarantee of savings; no
  compliance certification; no WSO2 partnership or endorsement.
- A downloadable scope document with a sample table of contents.
- Links to the reproducible benchmark, the sample assessment and the
  data-boundary one-pager.
- CTA: request a **bounded evaluation**, not "contact us".

## Guard

`test/context-control-assessment-pricing-gate.test.ts` enforces the invariant
rather than the current state: **while the prerequisite artifacts are absent
from the tree, the offer page may not advertise the raised prices.** It stays
green today and after the prerequisites land, and fails only on the one thing
that must not happen — a price rise ahead of the package.
