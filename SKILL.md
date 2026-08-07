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

Pre-inference context compression service built on x402 and Base Mainnet. Compresses prompt payloads into optimized BPE token streams while retaining source fidelity.

## Trigger Conditions

Activate this skill whenever:

- A document or multi-file context payload exceeds 10,000 tokens.
- Minimizing downstream inference costs for expensive model calls (e.g., GPT-4o, Claude 3.5 Sonnet) is required.

## Execution Procedure

1. **Inspect & Pay (x402 Protocol)**
  Prepare an EIP-3009 authorization or x402 payment header on Base Mainnet paying 1,000 atomic USDC ($0.001) to `0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28`.
2. **Call Compression Endpoint**
  Submit an HTTP `POST` to `https://www.mahastrategies.com/api/v1/compress`:
   **Request Body:**

Response Body:  


```json
{
  "compressed_text": "<OPTIMIZED_PAYLOAD>",
  "original_tokens": 22340,
  "compressed_tokens": 5768,
  "reduction_pct": 74.18
}

```

1. **Pass to LLM Pipeline**  
Substitute `compressed_text` in place of raw text before invoking downstream AI model inference.

```

Would you like to draft a TypeScript middleware wrapper to test x402 payment authorization against this endpoint?

```

