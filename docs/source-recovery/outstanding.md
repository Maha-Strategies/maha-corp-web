# Outstanding source-recovery queue

This is a deterministic, noncanonical search plan. It locates candidate copies; it does not inspect source content, create locators, change alignment verdicts, or authorize publication.

Contracts: 12 · affected records: 59

| Priority | Source contract | Domain | Current state | Search requests |
| ---: | --- | --- | --- | ---: |
| 12 | `source-advanced-materials-wide-bandgap` | advanced-materials | inaccessible-source | 8 |
| 11 | `source-biomolecular-engineering-pace` | biomolecular-engineering | insufficient-evidence | 8 |
| 10 | `source-biomolecular-engineering-riboregulators` | biomolecular-engineering | insufficient-evidence | 8 |
| 9 | `source-critical-supply-chains-mcs-gallium-germanium` | critical-supply-chains | inaccessible-source | 5 |
| 8 | `source-critical-supply-chains-mcs-specialty` | critical-supply-chains | insufficient-evidence | 5 |
| 7 | `source-critical-supply-chains-pp1802` | critical-supply-chains | inaccessible-source | 5 |
| 6 | `source-longevity-metabolism-bioenergetics` | longevity-metabolism | insufficient-evidence | 8 |
| 5 | `source-longevity-metabolism-hallmarks` | longevity-metabolism | insufficient-evidence | 8 |
| 4 | `source-neurotechnology-bci-channelrhodopsin` | neurotechnology-bci | inaccessible-source | 8 |
| 3 | `source-neurotechnology-bci-closed-loop` | neurotechnology-bci | insufficient-evidence | 8 |
| 2 | `source-neurotechnology-bci-foreign-body` | neurotechnology-bci | inaccessible-source | 8 |
| 1 | `source-neurotechnology-bci-intracortical-bci` | neurotechnology-bci | insufficient-evidence | 8 |

## Operating boundary

- Run `npm run recover:sources:outstanding` to regenerate this plan without network access.
- Run `npm run recover:sources:outstanding:live` to query allowlisted public metadata and repository endpoints and print normalized observations to stdout.
- Live results are not committed automatically. A candidate reaches `manual-inspection-ready` only after source identity, artifact type, version relationship, and an HTTPS copy are established.
- A human or internal editor must still open the artifact and record an exact inspected-content locator before any alignment judgement can change.
