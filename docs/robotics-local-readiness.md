# Robotics foundation tranche — local readiness

Historical first-tranche report. Current forty-page status is in `docs/robotics-40-local-readiness.md` (2026-09-15); counts below describe the earlier delivery.

Date: 2026-09-14. Status: local drafts and prototype; no push, Vercel build, production build, deployment or sitemap submission.

## Delivered

- Twelve distinct foundational/evaluation articles with source locators, source boundaries, original proposed workflows and worked illustrations.
- One evidence-package specification and one executable grid-world example.
- A local discovery hub linking all fourteen deliverables. The hub is infrastructure outside the forty-topic budget.
- Forty-candidate map: 8 foundations, 10 evaluation, 8 provenance, 6 assistance, 4 governance, 4 specifications/examples. Fourteen implemented drafts/prototypes; twenty-six unreviewed plans. Search demand remains unknown.

Map freeze: `sha256:44e1826b72ae7e8df5017ac4e202147ecbe447cb0478564977b9030c1909b070`. The test pins this digest. Changes require explicit reconciliation, not silent regeneration. Print the full machine-readable map with `node --experimental-strip-types scripts/robotics-map.ts`.

## Local routes

Base: `/knowledge/robotics`. Twelve article suffixes:

1. embodiment-and-capability
2. task-contracts
3. perception-evidence
4. manipulation-evidence
5. mobility-and-localization
6. planning-control-and-authority
7. intervention-and-autonomy
8. frames-and-units
9. success-denominators
10. simulation-to-hardware
11. replay-and-reproduction
12. controller-regressions

Additional deliverables: `evidence-package`, `pick-place-example`.

All are noindex local drafts. Existing homepage navigation, sitemap and canonical articles are untouched. The hub is accessible by its local route; production discovery integration awaits publication review.

## Evidence and semantic boundaries

Selected sections of six primary sources informed the articles: NIST's completed performance-assessment project; ROS REP 103, REP 105 and REP 2004; rosbag2 documentation; LeRobotDataset v3 documentation. Exact locators and narrow attributed statements are in `lib/robotics-knowledge.ts`. Original paraphrase/link only: no third-party full text, figures or datasets copied. Inspection is automated editorial preparation, not expert approval.

Robotics frames are an application of coordinate conventions, not a competing mathematics definition. Robot authority is an application of governance, not a new canonical definition of permission. Generic policy, mathematics and audit concepts should be linked to existing owners during federation integration. Current dependency validation covers this forty-topic DAG only; an exhaustive cross-federation semantic-duplication review has not been completed. Dependencies do not confer evidence readiness.

Twenty-six planned topics still require source, locator, rights, scope and boundary packets. In particular, standards applicability and human-facing assistance need additional domain review. No safety or regulatory-compliance determination is supplied.

## Executable result

Six fixtures per controller, twelve trials total. Direct controller: 2 autonomous, 1 assisted, 3 failed. Search controller: 3 autonomous, 1 assisted, 2 failed. Denominator is six in both cases. These hand-selected fixtures are not statistical samples or a robot benchmark.

The verifier recomputes the fixed plan and entire trace. Rehashing a modified package cannot bypass replay. It is intentionally specific to this one experiment. Observer and verifier share implementation assumptions; no independent oracle or physical robot has been tested. Function-source fingerprints depend on the runtime/toolchain, so preserve the execution environment when comparing digests.

No physical dynamics, perception, real operators, network requests, credentials, customer logs, paid endpoint, ROS adapter or LeRobot adapter are involved. Assistance is a simulated event flag, not a modeled intervention policy.

## Reproduce verification

```sh
node --experimental-strip-types --test test/robotics-local.test.ts
npx tsc -p tsconfig.robotics-local.json --noEmit
node scripts/verify-robotics-render.cjs
node --experimental-strip-types scripts/robotics-simulation.ts summary
node --experimental-strip-types scripts/robotics-map.ts
```

Targeted checks cover the candidate partition and freeze, dependency cycles, source fields, related links, exact metrics, determinism, key ordering, omitted/duplicated/reordered trials, hidden assistance, rewritten plans, changed controller identities, unsupported physical claims and unknown fields.

React server-render inspection is not a Next build or browser inspection. Production bundle privacy, host-specific routing, mobile layout and full repository integration remain release gates. This tranche does not claim all existing repository tests pass; unrelated work was preserved.

## Next decision

Review the content and experiment locally before selecting the next evidence-acquisition batch. A useful next implementation would accept a sanitized real ROS/LeRobot evaluation export, preserve its original limitations and validate it without issuing a safety claim. That adapter is not part of this delivery.
