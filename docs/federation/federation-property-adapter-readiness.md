# Federation property adapter readiness

Status: **local-owner-handoff**

Seven owner-specific adapter contracts cover **941 local routes** and **4705 bounded answers**. They do not create a route on any property by themselves.

| Property | Route root | Ready contracts |
| --- | --- | ---: |
| maha-strategies | `/clearing/` | 287 |
| maha-research | `/federation/` | 250 |
| agentic-publishing | `/agentic-publishing/` | 74 |
| maha-os | `/knowledge/` | 60 |
| mayone-maharajan | `/concepts/` | 42 |
| mayon-rajan | `/mayon-volcano/` | 50 |
| maha-policy | `/policy/` | 178 |

## Required owner integration

Each property installs its own catch-all route under the stated root, obtains static parameters from the contract, disables unspecified dynamic parameters, resolves exact content by path, returns not-found for absent or unready content, and derives metadata plus structured data from the same exact page object.

## Release boundary

No Next.js or Vercel build is authorized by this registry. Each owner must install its adapter, bind exact-revision review and canonical release, and obtain explicit build authorization.

Registry digest: `sha256:e33c1822239ca43aeb844261414dab5176f4c77bac740e6af16c17416d71aa26`
