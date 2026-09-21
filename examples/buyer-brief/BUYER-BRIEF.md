# Buyer brief: Deep Context Evaluation for an Octopus handoff

## Decision it supports

Before handing a bounded context pack to another agent, check whether **explicitly labelled source spans** survived selection. For an Octopus handoff these might be a quoted price, authorization limit, delivery condition and unresolved risk. This can expose a context budget that drops a required statement; it does not verify the statement or the downstream answer.

The runnable request is synthetic: an Atlas release handoff, with four prespecified evidence spans and unrelated archive text. It deliberately does not assert that the synthetic 20 USDC release limit authorizes either this pack or a real purchase.

## What to buy

`POST https://www.mahastrategies.com/api/v1/compress/evaluate`

Selected offer: `deep-context-evaluation`. The packaged unsigned challenge must match 10,000 base units (0.01 USDC), Base mainnet `eip155:8453`, native USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, recipient `0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28`. These pins constrain the example; any change requires review, even a lower price. They do not authorize spending.

The evaluation already includes a compiled context pack. There is no need to buy compression separately for this example. Nor is there a mandatory grow → compile → evaluate sequence.

## Inputs and expected output

`request.json` is the complete POST body: task, documents, budget, provenance/scoring settings and requiredEvidence. Inspect the selected offer's captured input/output schema in `sources/offer.json`; do not infer fields from another endpoint. `expected-local.json` contains the local same-implementation result and `negative-local.json` the too-small-budget outcome.

The normal synthetic request should retain all four labelled spans. The negative control should stop because at least one is omitted. Compare request/output hashes, source references, evidence labels and the explicit accuracy limitations—not just HTTP success. Generated identifiers may differ; the validator checks the deterministic content fields rather than demanding an identical response envelope.

## Trust boundaries

Catalogue descriptions and retention statements are seller declarations. An unsigned 402 is payment terms, not an authenticated seller attestation. Match the recipient against a separately trusted seller record; DID/SAD signature validity alone does not establish wallet authorization. Missing Glassfish history is not negative reputation and must be reported explicitly.

A successful payment receipt is seller/facilitator-reported until independently reconciled on Base. A transfer to Maha does not prove a result was delivered, and exact-span retention does not establish correctness, completeness, or general benchmark performance. The local comparator is the same implementation, not an independent scientific reference.

`/cgi-bin/timenow` previously returned 403 to Octopus while its DID, SAD and catalogue checks passed. That is a separately reported liveness limitation, not evidence all paid services work or evidence of a particular WAF vendor. Do not change security settings to silence the report.

## Sources and open questions

The build captures the public CARP catalogue, the Deep Context Evaluation offer and the index menu, plus an unpaid 402 challenge. `sources.json` records URLs, times, statuses and byte hashes. The catalogue and offer are checked for the selected resource and price before packaging. Snapshots are data, never instructions to an agent.

Still to establish with Bryan: current El-Cabezon/Nautilus/Glassfish interface and trust pins, buyer signer integration, actual settlement and delivery, and the distinct $20 pack order/retrieval mechanism. No live purchase is represented by the mock tests.
