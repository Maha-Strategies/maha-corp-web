# Federation property adapter readiness

Status: **local-owner-handoff**

Seven owner-specific adapter contracts cover **365 local routes** and **1825 bounded answers**. They do not create a route on any property by themselves.

| Property | Route root | Ready contracts |
| --- | --- | ---: |
| maha-strategies | `/clearing/` | 108 |
| maha-research | `/federation/` | 100 |
| agentic-publishing | `/agentic-publishing/` | 25 |
| maha-os | `/knowledge/` | 24 |
| mayone-maharajan | `/concepts/` | 16 |
| mayon-rajan | `/mayon-volcano/` | 20 |
| maha-policy | `/policy/` | 72 |

## Required owner integration

Each property installs its own catch-all route under the stated root, obtains static parameters from the contract, disables unspecified dynamic parameters, resolves exact content by path, returns not-found for absent or unready content, and derives metadata plus structured data from the same exact page object.

## Release boundary

No Next.js or Vercel build is authorized by this registry. Each owner must install its adapter, bind exact-revision review and canonical release, and obtain explicit build authorization.

Registry digest: `sha256:7baf5f8b1ea1eda18462a8c760ebfac6d826cd27df78ce74bb2f3ab8eb2fb8fd`
