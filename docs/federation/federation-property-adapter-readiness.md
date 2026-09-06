# Federation property adapter readiness

Status: **local-owner-handoff**

Seven owner-specific adapter contracts cover **844 local routes** and **4220 bounded answers**. They do not create a route on any property by themselves.

| Property | Route root | Ready contracts |
| --- | --- | ---: |
| maha-strategies | `/clearing/` | 259 |
| maha-research | `/federation/` | 225 |
| agentic-publishing | `/agentic-publishing/` | 64 |
| maha-os | `/knowledge/` | 54 |
| mayone-maharajan | `/concepts/` | 37 |
| mayon-rajan | `/mayon-volcano/` | 45 |
| maha-policy | `/policy/` | 160 |

## Required owner integration

Each property installs its own catch-all route under the stated root, obtains static parameters from the contract, disables unspecified dynamic parameters, resolves exact content by path, returns not-found for absent or unready content, and derives metadata plus structured data from the same exact page object.

## Release boundary

No Next.js or Vercel build is authorized by this registry. Each owner must install its adapter, bind exact-revision review and canonical release, and obtain explicit build authorization.

Registry digest: `sha256:9b3d4b47f14876becdfa90c78abcc894c0f0dbc7fd72b688f4832595d2443b5f`
