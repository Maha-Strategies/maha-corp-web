# Federation property adapter readiness

Status: **local-owner-handoff**

Seven owner-specific adapter contracts cover **456 local routes** and **2280 bounded answers**. They do not create a route on any property by themselves.

| Property | Route root | Ready contracts |
| --- | --- | ---: |
| maha-strategies | `/clearing/` | 135 |
| maha-research | `/federation/` | 125 |
| agentic-publishing | `/agentic-publishing/` | 32 |
| maha-os | `/knowledge/` | 30 |
| mayone-maharajan | `/concepts/` | 19 |
| mayon-rajan | `/mayon-volcano/` | 25 |
| maha-policy | `/policy/` | 90 |

## Required owner integration

Each property installs its own catch-all route under the stated root, obtains static parameters from the contract, disables unspecified dynamic parameters, resolves exact content by path, returns not-found for absent or unready content, and derives metadata plus structured data from the same exact page object.

## Release boundary

No Next.js or Vercel build is authorized by this registry. Each owner must install its adapter, bind exact-revision review and canonical release, and obtain explicit build authorization.

Registry digest: `sha256:90b6490df4d2dc806a34f15225b0e5ed76fc6c315dfb9681c070365718ee24be`
