# Federation property adapter readiness

Status: **local-owner-handoff**

Seven owner-specific adapter contracts cover **550 local routes** and **2750 bounded answers**. They do not create a route on any property by themselves.

| Property | Route root | Ready contracts |
| --- | --- | ---: |
| maha-strategies | `/clearing/` | 166 |
| maha-research | `/federation/` | 150 |
| agentic-publishing | `/agentic-publishing/` | 37 |
| maha-os | `/knowledge/` | 36 |
| mayone-maharajan | `/concepts/` | 23 |
| mayon-rajan | `/mayon-volcano/` | 30 |
| maha-policy | `/policy/` | 108 |

## Required owner integration

Each property installs its own catch-all route under the stated root, obtains static parameters from the contract, disables unspecified dynamic parameters, resolves exact content by path, returns not-found for absent or unready content, and derives metadata plus structured data from the same exact page object.

## Release boundary

No Next.js or Vercel build is authorized by this registry. Each owner must install its adapter, bind exact-revision review and canonical release, and obtain explicit build authorization.

Registry digest: `sha256:cca1b7ab7a09d3c57b7344bf69810feb221875e7058514e31eba88db3aef02d0`
