# Federation property adapter readiness

Status: **local-owner-handoff**

Seven owner-specific adapter contracts cover **273 local routes** and **1365 bounded answers**. They do not create a route on any property by themselves.

| Property | Route root | Ready contracts |
| --- | --- | ---: |
| maha-strategies | `/clearing/` | 82 |
| maha-research | `/federation/` | 75 |
| agentic-publishing | `/agentic-publishing/` | 17 |
| maha-os | `/knowledge/` | 18 |
| mayone-maharajan | `/concepts/` | 12 |
| mayon-rajan | `/mayon-volcano/` | 15 |
| maha-policy | `/policy/` | 54 |

## Required owner integration

Each property installs its own catch-all route under the stated root, obtains static parameters from the contract, disables unspecified dynamic parameters, resolves exact content by path, returns not-found for absent or unready content, and derives metadata plus structured data from the same exact page object.

## Release boundary

No Next.js or Vercel build is authorized by this registry. Each owner must install its adapter, bind exact-revision review and canonical release, and obtain explicit build authorization.

Registry digest: `sha256:031adb01b03a1a35d203dc58558844d8625bf56c7fc6c36dee30bb557846eb3f`
