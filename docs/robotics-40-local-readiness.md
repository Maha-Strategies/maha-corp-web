# Forty-page robotics section — local completion

Date: 2026-09-15. Publication status: **local only; noindex**. No Next production build, Vercel build, push, deployment or indexing request was run.

## Accounting

The original forty-topic selection is unchanged. There are now **38 editorial guides/walkthroughs + one package specification + one executable toy-experiment page = 40 topic routes**. The robotics discovery hub is an additional route: 41 local page renders in total.

| Group | Topic routes |
| --- | ---: |
| Foundations | 8 |
| Evaluation | 10 |
| Provenance and data | 8 |
| Human assistance | 6 |
| Governance | 4 |
| Specifications and examples | 4 |
| Total | 40 |

The last category includes two **manually worked intake examples**, not two implemented adapters. The only executable robotics experiment remains the discrete grid-world simulator. The package verifier supports that fixed experiment only.

## Navigation and metadata

Local discovery: `/knowledge` → `/knowledge/robotics` → all forty topics. Each editorial page has contextual related links and a return link. The hub groups topics and offers three question-led starting points. All existing topic slugs are preserved.

Every local topic has a title, description, canonical target and noindex metadata. The sitemap is untouched; publication requires separate approval and release checks. The Knowledge card is a local change, not evidence that live navigation has changed.

## Sources, rights and claims

The original six-source registry was extended with four primary-source references inspected on 2026-09-15:

- W3C PROV Overview: Abstract, Introduction and Document Roadmap. Non-normative overview of provenance representations; not authenticity evidence.
- NIST TN 1297 §2.1–2.4: measurement uncertainty and evaluation methods; not robot-specific tolerances or a calibration certificate.
- NIST Privacy Framework, About: voluntary privacy-risk context; not permission to reuse a recording.
- NIST AI RMF, Overview: voluntary lifecycle risk context; not legal applicability or safety certification.

LeRobotDataset v3 Format design and metadata layout were re-inspected; rosbag2 README playback ordering and metadata inspection were read through the official raw repository. A docs.ros.org tutorial returned access denied and was **not** used as inspected evidence. No access control was bypassed.

Each article separates a narrow source account from **Maha's original proposed workflow**, a synthetic worked illustration and an explicit boundary. Only links and original explanations are included; no third-party media, episode data or full-text publications are redistributed. Current law and standards clauses were not researched or claimed: the applicability page teaches how to document an unresolved specialist review, not which law or standard applies.

These are automated editorial drafts. No independent robotics expert, participant study or physical test has approved them. Reference availability does not establish the safety or effectiveness of the proposed workflows.

## Semantic review

The new topics have distinct decision questions. In particular:

- integrity asks whether bytes match; lineage asks how a derivative arose; retention asks what remains available;
- uncertainty describes a measurement estimate; calibration binds a reference to configuration; ground truth identifies the outcome observer;
- supervision describes operator involvement; handoff records transfer; recovery preserves a failed attempt and its continuation;
- governance identifies decision responsibility; change approval binds a particular decision to its evidence revision.

No copied answer, explanation, worked example or boundary appears across the 38 editorial pages. This is an exact-text/content-structure check plus editorial differentiation, **not** proof of exhaustive federation-wide semantic uniqueness. Existing robotics mentions in commercial briefs are not capability-test pages. The hub links to Mathematics and Agent Governance rather than claiming ownership of their general concepts. No market-demand or SEO-ranking score has been invented.

## Freeze and regeneration

The historical selection is returned by `roboticsCandidateFreezeV1()` and remains pinned to:

`sha256:44e1826b72ae7e8df5017ac4e202147ecbe447cb0478564977b9030c1909b070`

The implementation-status map is version `robotics-map/0.2`, with digest:

`sha256:b8fc24dcc4d84ad97e817a5ae26abe77527a697b619abe5e8cea03c50ca28323`

Its status changes do not rewrite the historical freeze. Demand remains unknown. Print all forty candidates and paths with the map command below; prepend `/knowledge/robotics/` to each slug.

## Verification

Results: **14 targeted tests passed; scoped TypeScript clean; targeted lint clean; 41 React page renders passed; map and simulation byte-identical across two separate executions.** The original selection digest still passes unchanged. A first-pass wording assertion incorrectly demanded attribution in one field; checking the combined answer and explanation preserved the actual attribution requirement without rewriting historical content. Lint also caught plain anchors to existing site pages; those now use Next Link with prefetch disabled.

```sh
node --experimental-strip-types --test test/robotics-local.test.ts
npx tsc -p tsconfig.robotics-local.json --noEmit
node scripts/verify-robotics-render.cjs
node --experimental-strip-types scripts/robotics-map.ts
node --experimental-strip-types scripts/robotics-simulation.ts summary
```

The scoped tests cover all forty IDs, the original selection digest, group accounting, dependency cycles, distinct content fields, source locators/rights/boundaries, related destinations and the unchanged simulator's adversarial cases. The server-render check covers all forty topics plus the hub, hub-to-topic reachability, expected sections, canonical metadata, draft indexing refusal and selected private-field markers.

These are local React renders, not a production artifact inspection. Mobile CSS, browser accessibility, host-specific refusal, full-repository integration and production bundle privacy remain release checks. No claim is made that the entire dirty repository is validated.

## Before publication

Review the articles and their source boundaries; inspect mobile/desktop rendering and host behavior in an authorized Preview; then reconcile the shared route registries, sitemap and draft indexing policy together. Request explicit approval before any Vercel build or deployment. This report supersedes the first-tranche readiness report for current counts, while preserving that report as history.
