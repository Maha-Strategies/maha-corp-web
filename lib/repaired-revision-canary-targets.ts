import type { EpistemicRecord } from './epistemic-schema.ts'

// Frozen snapshots of the two exact revisions that passed the repaired-record
// review chain. Keep this leaf dependency-free: the ingestion registry is also
// reachable from server-rendered knowledge routes and must not import internal
// audit artifact constructors.
export const REPAIRED_REVISION_CANARY_RECORDS = [
  {
    "schemaVersion": "maha-epistemic/1.0",
    "evidencePolicyVersion": "mps/0.1",
    "id": "urn:maha:record:agentic-systems-mcp-tool-deny-by-default",
    "domainSlug": "agentic-systems-mcp",
    "recordKind": "concept",
    "slug": "agentic-systems-mcp-human-denial-control-for-tool-invocations",
    "title": "Human denial control for tool invocations",
    "description": "A source-bounded concept record for the human denial control the Model Context Protocol recommends for tool invocations, within agentic systems and MCP.",
    "summary": "Tool deny by default is represented as one reviewable unit in the Agentic systems and MCP graph. Its source, locator, scope, uncertainty, and prohibited inference remain attached to the claim rather than being generalized across the domain.",
    "claims": [
      {
        "id": "urn:maha:claim:agentic-systems-mcp-tool-deny-by-default",
        "statement": "The Model Context Protocol specification recommends, as a normative SHOULD for implementors rather than a protocol mandate, that a human remain in the loop with the ability to deny tool invocations, and states that the protocol itself does not mandate any specific user interaction model.",
        "claimKind": "empirical-claim",
        "evidenceMaturity": "single-study",
        "sourceIds": [
          "source-agentic-systems-mcp-mcp-core"
        ],
        "scope": "Limited to the User Interaction Model warning and the Security Considerations list on the Tools page of the Model Context Protocol specification, version 2024-11-05. It records what the specification recommends to implementors and does not describe any organisation’s allowlist, identity, retention, or approval policy.",
        "boundary": "A recommendation addressed to implementors is not a protocol requirement, is not evidence that any deployed system denies tools by default, and establishes no system-level performance, safety, scalability, economic advantage, or deployment readiness.",
        "uncertainty": {
          "kind": "qualitative",
          "statement": "No cross-source quantitative interval is asserted. Definitions, operating conditions, samples, instruments, and outcome measures must be checked against the exact cited locator during review."
        },
        "replication": {
          "independentReplicationCount": null,
          "assessment": "Independent replication and cross-platform transfer have not been compiled for this candidate; the evidence maturity refers only to the bounded source contract.",
          "asOfDate": "2026-08-24"
        }
      }
    ],
    "sources": [
      {
        "id": "source-agentic-systems-mcp-mcp-core",
        "title": "Model Context Protocol specification",
        "authors": [
          "Model Context Protocol contributors"
        ],
        "publisher": "Model Context Protocol",
        "publishedAt": "2024-11-05",
        "url": "https://modelcontextprotocol.io/specification/2024-11-05/server/tools",
        "identifiers": [
          {
            "scheme": "url",
            "value": "https://modelcontextprotocol.io/specification/2024-11-05/index"
          }
        ],
        "exactLocator": "Tools page, version 2024-11-05: the \"User Interaction Model\" warning block and the \"Security Considerations\" list.",
        "rights": {
          "basis": "citation-with-paraphrase",
          "quotationUsed": false,
          "note": "The candidate uses original boundary language and a short paraphrase linked to the cited source. No source passage, figure, or table is reproduced."
        },
        "establishes": "The Tools page states that for trust, safety and security there SHOULD always be a human in the loop with the ability to deny tool invocations, that the protocol itself does not mandate any specific user interaction model, that servers MUST implement proper access controls and validate tool inputs, and that clients SHOULD prompt for user confirmation on sensitive operations.",
        "boundary": "The specification recommends implementor behaviour and mandates server-side input validation and access control. It does not prescribe an organisation’s allowlist, identity, retention, or approval policy, and it expressly does not mandate a user interaction model."
      }
    ],
    "sections": [
      {
        "heading": "What the cited work establishes",
        "paragraphs": [
          "The specification defines client, server, and host roles and capability-negotiated protocol primitives.",
          "Limited to Architecture, lifecycle, capabilities, resources, prompts, and security sections. in “Model Context Protocol specification”; this candidate records the concept boundary and does not pool results from uncited systems or studies."
        ],
        "claimIds": [
          "urn:maha:claim:agentic-systems-mcp-tool-deny-by-default"
        ]
      },
      {
        "heading": "What remains a separate question",
        "paragraphs": [
          "Tool deny by default does not by itself establish system-level performance, safety, manufacturability, scalability, economic advantage, clinical benefit, or deployment readiness.",
          "A protocol primitive does not prescribe an organization’s allowlist, identity, retention, or approval policy."
        ],
        "claimIds": []
      }
    ],
    "bridges": [
      {
        "id": "urn:maha:bridge:agentic-systems-mcp-tool-deny-by-default-1",
        "sourceConceptId": "urn:maha:record:agentic-systems-mcp-tool-deny-by-default",
        "targetConceptId": "urn:maha:record:agentic-systems-mcp-tool-allowlisting",
        "bridgeType": "mechanistic-dependency",
        "statement": "Tool deny by default is positioned after Tool allowlisting in this bounded dependency sequence; the edge is navigational and does not assert equivalence or causation beyond the cited source scope."
      }
    ],
    "boundaries": [
      "A recommended human denial control does not by itself establish system-level performance, safety, manufacturability, scalability, economic advantage, clinical benefit, or deployment readiness.",
      "A source-bounded concept record does not establish manufacturing yield, economic advantage, safety, clinical benefit, or commercial readiness unless those outcomes are measured in a separately scoped record."
    ],
    "prohibitedInferences": [
      "Do not use this human denial control record to claim that the surrounding technology is proven, safe, scalable, commercially available, or strategically superior.",
      "Do not transfer a reported result across hardware, organisms, protocols, datasets, operating conditions, or outcome definitions without a declared comparison contract.",
      "Do not read a recommended human ability to deny an invocation as a requirement that tools be denied unless explicitly permitted."
    ],
    "publication": {
      "requestedPublicPromotion": false,
      "reviewState": "draft",
      "canonicalVersion": "0.1.0",
      "lastReviewedAt": "2026-08-24T00:00:00.000Z",
      "requiredReviewScopes": [
        "source-fidelity",
        "domain-fidelity",
        "boundary-adequacy",
        "rights-and-locator"
      ],
      "reviewEvents": []
    }
  },
  {
    "schemaVersion": "maha-epistemic/1.0",
    "evidencePolicyVersion": "mps/0.1",
    "id": "urn:maha:record:fusion-plasma-systems-breeding-blanket-test-modules",
    "domainSlug": "fusion-plasma-systems",
    "recordKind": "concept",
    "slug": "fusion-plasma-systems-breeding-blanket-test-modules",
    "title": "Breeding blanket test modules",
    "description": "A source-bounded concept record for the ITER Test Blanket Module programme within fusion and plasma systems.",
    "summary": "Breeding blanket test modules is represented as one reviewable unit in the Fusion and plasma systems graph. Its source, locator, scope, uncertainty, and prohibited inference remain attached to the claim rather than being generalized across the domain.",
    "claims": [
      {
        "id": "urn:maha:claim:fusion-plasma-systems-breeding-blanket-test-modules",
        "statement": "ITER documents a Test Blanket Module programme under which in-vessel modules will be used to test tritium breeding concepts, and states that further research is necessary to demonstrate the feasibility of large-scale tritium production and recycling.",
        "claimKind": "observation",
        "evidenceMaturity": "single-study",
        "sourceIds": [
          "source-fusion-plasma-systems-iter-support"
        ],
        "scope": "Limited to the \"ITER Test Blanket Module (TBM) Program\" section of the ITER Tritium Breeding page. It records a planned test programme and its stated objective, and pools no results from other devices, studies, or blanket concepts.",
        "boundary": "A planned test programme is not a measurement. This record establishes no breeding ratio, no extraction rate, no neutron or heat-load performance, no materials qualification outcome, and no commercial blanket readiness.",
        "uncertainty": {
          "kind": "qualitative",
          "statement": "No cross-source quantitative interval is asserted. Definitions, operating conditions, samples, instruments, and outcome measures must be checked against the exact cited locator during review."
        },
        "replication": {
          "independentReplicationCount": null,
          "assessment": "Independent replication and cross-platform transfer have not been compiled for this candidate; the evidence maturity refers only to the bounded source contract.",
          "asOfDate": "2026-08-24"
        }
      }
    ],
    "sources": [
      {
        "id": "source-fusion-plasma-systems-iter-support",
        "title": "Tritium Breeding | ITER is First Fusion Device to Test",
        "authors": [
          "ITER Organization"
        ],
        "publisher": "ITER Organization",
        "publishedAt": "",
        "sourceChronology": {
          "status": "living-document",
          "accessedAt": "2026-08-27"
        },
        "url": "https://www.iter.org/machine/supporting-systems/tritium-breeding",
        "identifiers": [
          {
            "scheme": "url",
            "value": "https://www.iter.org/machine/supporting-systems/tritium-breeding"
          }
        ],
        "exactLocator": "“ITER Test Blanket Module (TBM) Program” section and the immediately preceding paragraph ending “Further research will be necessary to demonstrate the feasibility of large-scale tritium production and recycling.”",
        "rights": {
          "basis": "citation-with-paraphrase",
          "quotationUsed": false,
          "note": "Original bounded paraphrase with a link and exact section locator; no ITER image, figure, table, or extended passage is reproduced."
        },
        "establishes": "The page names test blanket modules, states that ITER will experiment with tritium production within the vacuum vessel by way of TBMs, identifies four member TBM concepts, and states that further research will be necessary to demonstrate the feasibility of large-scale tritium production and recycling.",
        "boundary": "An authoritative description of a planned test programme is not evidence of demonstrated tritium breeding, of measured performance, or of commercial blanket readiness."
      }
    ],
    "sections": [
      {
        "heading": "What the cited work establishes",
        "paragraphs": [
          "ITER documents a planned Test Blanket Module programme for testing tritium-breeding concepts in the device.",
          "The cited page states that further research remains necessary to demonstrate feasibility at large scale; this record reports the programme, not a result."
        ],
        "claimIds": [
          "urn:maha:claim:fusion-plasma-systems-breeding-blanket-test-modules"
        ]
      },
      {
        "heading": "What remains a separate question",
        "paragraphs": [
          "The cited page does not establish a measured breeding ratio, extraction rate, neutron or heat-load performance, materials qualification, operational success, or commercial readiness.",
          "Results cannot be transferred among the four member concepts without separately cited evidence and an explicit comparison contract."
        ],
        "claimIds": []
      }
    ],
    "bridges": [
      {
        "id": "urn:maha:bridge:fusion-plasma-systems-breeding-blanket-test-modules-1",
        "sourceConceptId": "urn:maha:record:fusion-plasma-systems-breeding-blanket-test-modules",
        "targetConceptId": "urn:maha:record:fusion-plasma-systems-tritium-fuel-cycle",
        "bridgeType": "mechanistic-dependency",
        "statement": "Breeding blanket test modules is positioned after Tritium fuel cycle in this bounded dependency sequence; the edge is navigational and does not assert equivalence or causation beyond the cited source scope."
      }
    ],
    "boundaries": [
      "A documented test programme does not by itself establish system-level performance, safety, manufacturability, scalability, economic advantage, clinical benefit, or deployment readiness.",
      "A source-bounded concept record does not establish manufacturing yield, economic advantage, safety, clinical benefit, or commercial readiness unless those outcomes are measured in a separately scoped record."
    ],
    "prohibitedInferences": [
      "Do not use this test blanket module programme record to claim that the surrounding technology is proven, safe, scalable, commercially available, or strategically superior.",
      "Do not transfer a reported result across hardware, organisms, protocols, datasets, operating conditions, or outcome definitions without a declared comparison contract.",
      "Do not read a planned test programme as demonstrated tritium breeding, measured performance, completed materials qualification, or commercial blanket readiness."
    ],
    "publication": {
      "requestedPublicPromotion": false,
      "reviewState": "draft",
      "canonicalVersion": "0.1.0",
      "lastReviewedAt": "2026-08-24T00:00:00.000Z",
      "requiredReviewScopes": [
        "source-fidelity",
        "domain-fidelity",
        "boundary-adequacy",
        "rights-and-locator"
      ],
      "reviewEvents": []
    }
  }
] as unknown as readonly EpistemicRecord[]
