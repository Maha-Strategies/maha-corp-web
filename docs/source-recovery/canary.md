# Inaccessible-source recovery canary

This is a deterministic, noncanonical search plan. It locates candidate copies; it does not inspect source content, create locators, change alignment verdicts, or authorize publication.

Contracts: 20 · affected records: 100

| Priority | Source contract | Domain | Current state | Search requests |
| ---: | --- | --- | --- | ---: |
| 20 | `source-advanced-materials-vdw` | advanced-materials | mismatched | 8 |
| 19 | `source-agentic-systems-mcp-autogen` | agentic-systems-mcp | mismatched, partially-supported | 4 |
| 18 | `source-biomolecular-engineering-toehold` | biomolecular-engineering | mismatched, partially-supported, supported | 8 |
| 17 | `source-biomolecular-engineering-pace` | biomolecular-engineering | insufficient-evidence | 8 |
| 16 | `source-critical-supply-chains-mcs-specialty` | critical-supply-chains | insufficient-evidence | 5 |
| 15 | `source-critical-supply-chains-mcs-industrial` | critical-supply-chains | mismatched, partially-supported | 5 |
| 14 | `source-critical-supply-chains-pp1802` | critical-supply-chains | inaccessible-source | 5 |
| 13 | `source-critical-supply-chains-mcs-gallium-germanium` | critical-supply-chains | inaccessible-source | 5 |
| 12 | `source-fusion-plasma-systems-nif-ignition` | fusion-plasma-systems | mismatched, partially-supported, supported | 4 |
| 11 | `source-longevity-metabolism-autophagy-guidelines` | longevity-metabolism | supported | 8 |
| 10 | `source-longevity-metabolism-hallmarks` | longevity-metabolism | insufficient-evidence | 8 |
| 9 | `source-longevity-metabolism-mitophagy` | longevity-metabolism | insufficient-evidence, partially-supported, supported | 8 |
| 8 | `source-mechanistic-interpretability-induction` | mechanistic-interpretability | mismatched, partially-supported, supported | 4 |
| 7 | `source-mechanistic-interpretability-feature-visualization` | mechanistic-interpretability | mismatched, supported | 8 |
| 6 | `source-neurotechnology-bci-intracortical-bci` | neurotechnology-bci | insufficient-evidence | 8 |
| 5 | `source-neurotechnology-bci-channelrhodopsin` | neurotechnology-bci | inaccessible-source | 8 |
| 4 | `source-neurotechnology-bci-foreign-body` | neurotechnology-bci | inaccessible-source | 8 |
| 3 | `source-neurotechnology-bci-closed-loop` | neurotechnology-bci | insufficient-evidence, partially-supported | 8 |
| 2 | `source-neurotechnology-bci-micro-ecog` | neurotechnology-bci | partially-supported, supported | 8 |
| 1 | `source-longevity-metabolism-bioenergetics` | longevity-metabolism | insufficient-evidence | 8 |

## Operating boundary

- Run `npm run recover:sources` to regenerate this plan without network access.
- Run `npm run recover:sources:live` to query allowlisted public metadata and repository endpoints and print normalized observations to stdout.
- Live results are not committed automatically. A candidate reaches `manual-inspection-ready` only after source identity, artifact type, version relationship, and an HTTPS copy are established.
- A human or internal editor must still open the artifact and record an exact inspected-content locator before any alignment judgement can change.
