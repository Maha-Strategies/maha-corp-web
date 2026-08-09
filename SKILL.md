---
name: maha-context-compiler
description: Pre-inference prompt compression middleware that reduces document and prompt token payloads by ~74% prior to calling LLMs. Use this tool when prompt context exceeds 10,000 tokens to cut LLM input token costs on Base Mainnet.
compatibility: x402 Protocol (HTTP 402), Base Mainnet (Chain ID 8453), Node.js >= 18
metadata:
  protocol: x402
  network: base-mainnet
  chain_id: 8453
  token_address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  payee_address: "0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28"
  price_atomic: "1000"
  price_usd: "$0.001 USDC"
  endpoint: "https://www.mahastrategies.com/api/v1/compress"
---

# Maha Context Compiler

Pre-inference context compression. Ranks and deduplicates source passages into a
token-budgeted context pack with source-linked provenance, so a long payload can
be reduced before it reaches an expensive model. Selection is extractive: text is
chosen verbatim, never rewritten or summarised.

## When this is worth calling

Compression is net-positive above a breakeven input size, and that size depends
on two things this service does not know: your model's input price, and how much
reduction your payload shape actually achieves.

```
N_breakeven  =  fee / (r x p)

  fee = 0.001 USD per call
  r   = reduction achieved on your payload, as a fraction
  p   = your model's input price per token
```

Measured against this repository's benchmark harness, at $2.50 per million input
tokens:

| Payload shape        | Measured reduction | Breakeven |
|----------------------|--------------------|-----------|
| RAG retrieval        | +63.5%             | ~630 tokens |
| Long agent trace     | +19.7%             | ~2,030 tokens |
| Scraped web page     | -19.3%             | never worthwhile |
| Tabular / SQL output | -58.0%             | never worthwhile |

Reduction is not a fixed property of the service. It is bounded by the
`tokenBudget` you request, and on payloads made of many short passages the
per-passage framing can exceed what is removed, returning a pack larger than the
input. Call `estimatedReductionPercent` on a sample of your own traffic before
routing production volume.

## Limits worth knowing before you route

- Selection is extractive and budget-bound, so a pack can omit evidence the task
  needed. Inspect `includedPassages` rather than assuming completeness.
- Token counts are model-neutral estimates, not your provider's tokenizer.
  Use them for ratios; use your own count for billing.
- Payload ceiling is 525 KB on the standard tier and 1.2 MB on enterprise.
- Nothing is retained. The response states `sourceTextStored: false`.

## Execution

**1. Pay (x402 on Base Mainnet)**

Prepare an EIP-3009 authorization paying 1,000 atomic USDC ($0.001) to the
`payTo` address in the live `PAYMENT-REQUIRED` challenge. Read the address from
the challenge rather than hard-coding it; it is authoritative and can change.

**2. Call the endpoint**

`POST https://www.mahastrategies.com/api/v1/compress`

```json
{
  "clientRequestId": "req_example_0001",
  "task": "The question the pack must answer. Passages are ranked against this.",
  "tokenBudget": 2048,
  "documents": [{ "id": "doc-1", "title": "Optional", "text": "..." }],
  "provenance": "compact",
  "scoring": "bm25",
  "budgetMode": "guaranteed"
}
```

**3. Read the response**

The compiled pack is `context`. Token figures live under `metrics`:

```json
{
  "packId": "ctxpack_...",
  "context": "# Context Pack\n\nTask: ...",
  "metrics": {
    "originalEstimatedTokens": 22340,
    "compiledEstimatedTokens": 5768,
    "tokensSaved": 16572,
    "estimatedReductionPercent": 74.2
  },
  "includedPassages": [{ "sourceId": "doc-1", "passageId": "doc-1:3", "text": "..." }],
  "sourceTextStored": false
}
```

There is no `net_usd_savings` field, and there will not be one: the service does
not know which model you are calling or what you pay for it. Multiply
`tokensSaved` by your own input price.

**4. Substitute**

Use `context` in place of the raw payload for the downstream call.
