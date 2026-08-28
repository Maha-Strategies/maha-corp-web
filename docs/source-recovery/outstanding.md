# Outstanding source-recovery queue

This is a deterministic, noncanonical search plan. It locates candidate copies; it does not inspect source content, create locators, change alignment verdicts, or authorize publication.

Contracts: 19 · affected records: 94

| Priority | Source contract | Domain | Current state | Search requests |
| ---: | --- | --- | --- | ---: |
| 19 | `source-advanced-materials-wide-bandgap` | advanced-materials | insufficient-evidence | 8 |
| 18 | `source-agentic-systems-mcp-autogen` | agentic-systems-mcp | insufficient-evidence | 4 |
| 17 | `source-biomolecular-engineering-pace` | biomolecular-engineering | insufficient-evidence | 8 |
| 16 | `source-biomolecular-engineering-riboregulators` | biomolecular-engineering | insufficient-evidence | 8 |
| 15 | `source-biomolecular-engineering-toehold` | biomolecular-engineering | inaccessible-source | 8 |
| 14 | `source-critical-supply-chains-mcs-gallium-germanium` | critical-supply-chains | inaccessible-source | 5 |
| 13 | `source-critical-supply-chains-mcs-industrial` | critical-supply-chains | inaccessible-source | 5 |
| 12 | `source-critical-supply-chains-mcs-specialty` | critical-supply-chains | insufficient-evidence | 5 |
| 11 | `source-critical-supply-chains-pp1802` | critical-supply-chains | inaccessible-source | 5 |
| 10 | `source-fusion-plasma-systems-nif-ignition` | fusion-plasma-systems | insufficient-evidence | 4 |
| 9 | `source-longevity-metabolism-autophagy-guidelines` | longevity-metabolism | inaccessible-source | 8 |
| 8 | `source-longevity-metabolism-bioenergetics` | longevity-metabolism | insufficient-evidence | 8 |
| 7 | `source-longevity-metabolism-hallmarks` | longevity-metabolism | insufficient-evidence | 8 |
| 6 | `source-mechanistic-interpretability-feature-visualization` | mechanistic-interpretability | insufficient-evidence | 8 |
| 5 | `source-neurotechnology-bci-channelrhodopsin` | neurotechnology-bci | inaccessible-source | 8 |
| 4 | `source-neurotechnology-bci-closed-loop` | neurotechnology-bci | insufficient-evidence | 8 |
| 3 | `source-neurotechnology-bci-foreign-body` | neurotechnology-bci | inaccessible-source | 8 |
| 2 | `source-neurotechnology-bci-intracortical-bci` | neurotechnology-bci | insufficient-evidence | 8 |
| 1 | `source-neurotechnology-bci-micro-ecog` | neurotechnology-bci | inaccessible-source | 8 |

## Operating boundary

- Run `npm run recover:sources:outstanding` to regenerate this plan without network access.
- Run `npm run recover:sources:outstanding:live` to query allowlisted public metadata and repository endpoints and print normalized observations to stdout.
- Live results are not committed automatically. A candidate reaches `manual-inspection-ready` only after source identity, artifact type, version relationship, and an HTTPS copy are established.
- A human or internal editor must still open the artifact and record an exact inspected-content locator before any alignment judgement can change.
