# Federation property adapter readiness

Status: **local-owner-handoff**

Seven owner-specific adapter contracts cover **650 local routes** and **3250 bounded answers**. They do not create a route on any property by themselves.

| Property | Route root | Ready contracts |
| --- | --- | ---: |
| maha-strategies | `/clearing/` | 197 |
| maha-research | `/federation/` | 175 |
| agentic-publishing | `/agentic-publishing/` | 47 |
| maha-os | `/knowledge/` | 42 |
| mayone-maharajan | `/concepts/` | 28 |
| mayon-rajan | `/mayon-volcano/` | 35 |
| maha-policy | `/policy/` | 126 |

## Required owner integration

Each property installs its own catch-all route under the stated root, obtains static parameters from the contract, disables unspecified dynamic parameters, resolves exact content by path, returns not-found for absent or unready content, and derives metadata plus structured data from the same exact page object.

## Release boundary

No Next.js or Vercel build is authorized by this registry. Each owner must install its adapter, bind exact-revision review and canonical release, and obtain explicit build authorization.

Registry digest: `sha256:4e63ef58c778a903978543811e0dd0606b80a58d9c676e408255312f2f010381`
