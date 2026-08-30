# Outstanding source-recovery queue

This is a deterministic, noncanonical search plan. It locates candidate copies; it does not inspect source content, create locators, change alignment verdicts, or authorize publication.

Contracts: 1 · affected records: 5

| Priority | Source contract | Domain | Current state | Search requests |
| ---: | --- | --- | --- | ---: |
| 1 | `source-advanced-materials-wide-bandgap` | advanced-materials | inaccessible-source | 8 |

## Operating boundary

- Run `npm run recover:sources:outstanding` to regenerate this plan without network access.
- Run `npm run recover:sources:outstanding:live` to query allowlisted public metadata and repository endpoints and print normalized observations to stdout.
- Live results are not committed automatically. A candidate reaches `manual-inspection-ready` only after source identity, artifact type, version relationship, and an HTTPS copy are established.
- A human or internal editor must still open the artifact and record an exact inspected-content locator before any alignment judgement can change.
