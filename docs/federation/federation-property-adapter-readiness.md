# Federation property adapter readiness

Status: **local-owner-handoff**

Seven owner-specific adapter contracts cover **748 local routes** and **3740 bounded answers**. They do not create a route on any property by themselves.

| Property | Route root | Ready contracts |
| --- | --- | ---: |
| maha-strategies | `/clearing/` | 228 |
| maha-research | `/federation/` | 200 |
| agentic-publishing | `/agentic-publishing/` | 55 |
| maha-os | `/knowledge/` | 48 |
| mayone-maharajan | `/concepts/` | 33 |
| mayon-rajan | `/mayon-volcano/` | 40 |
| maha-policy | `/policy/` | 144 |

## Required owner integration

Each property installs its own catch-all route under the stated root, obtains static parameters from the contract, disables unspecified dynamic parameters, resolves exact content by path, returns not-found for absent or unready content, and derives metadata plus structured data from the same exact page object.

## Release boundary

No Next.js or Vercel build is authorized by this registry. Each owner must install its adapter, bind exact-revision review and canonical release, and obtain explicit build authorization.

Registry digest: `sha256:4d330216e49cf9437522e86b6ecd4271726078b653370d3aefa414f3403b8778`
