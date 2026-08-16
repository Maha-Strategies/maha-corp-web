# WSO2 AI Gateway × Maha Context Compiler

Status: bounded compatibility prototype. This is not a WSO2 endorsement, a
production partnership, or a replacement for WSO2's native Prompt Compressor.

## Business problem

Enterprise RAG requests can contain duplicated, oversized context. Reducing
tokens alone is not enough when the operator also needs a fixed selection
budget, source-linked passages, reproducible hashes, source-coverage evidence,
and an explicit retention boundary before the request reaches the model.

This prototype implements WSO2's request- and response-phase Interceptor Service v1 contract.
It rewrites only requests that explicitly supply a `maha_context` block and one
`{{MAHA_CONTEXT_PACK}}` marker. Other requests pass through unchanged.

## Request flow

1. The application sends an OpenAI-compatible request to WSO2 AI Gateway.
2. For this bounded evaluation, a WSO2 Set Headers policy overwrites
   `x-maha-wso2-interceptor-token` with a dedicated test credential. End users
   must not be allowed to choose this value.
3. WSO2 Interceptor Service posts its standard base64 envelope to:

   ```text
   POST https://www.mahastrategies.com/api/integrations/wso2/context-compiler/handle-request
   ```

4. Maha authenticates the embedded gateway header, validates and compiles the
   `maha_context` documents, removes that extension, replaces exactly one
   marker, and returns WSO2's standard body mutation.
5. Maha tells WSO2 to remove both the integration token and stale
   `content-length` before the request continues to the LLM.
6. Aggregate evidence is sealed in WSO2's private interceptor context. The
   response phase verifies that seal and adds `x-maha-*` headers to the
   downstream response without sending the model response body to Maha.

The route does not store source text or compiled context. Evidence returned to
the gateway is limited to the pack identifier, input/output hashes, aggregate
token measurements, source coverage, passage count, and contract version.

### Minimum-size and non-expansion bypass

The interceptor does not substitute a compiled pack when the rendered
whole-document input is below 1,024 model-neutral estimated tokens. It forwards that original
source-linked context instead. Above the threshold it still compares the
compiled and original rendered contexts and selects the original whenever the
compiler framing would be the same size or larger. The response identifies the
decision with `x-maha-context-bypassed` and
`x-maha-context-bypass-reason`. This guarantees that enabling the policy does
not increase the estimated provider context on small or non-reducing inputs.

## OpenAI-compatible input extension

```json
{
  "model": "your-model",
  "messages": [
    {
      "role": "system",
      "content": "Use only this evidence:\n\n{{MAHA_CONTEXT_PACK}}"
    },
    {
      "role": "user",
      "content": "Identify the release condition and rollback trigger."
    }
  ],
  "maha_context": {
    "clientRequestId": "stable-idempotency-key",
    "task": "Identify the release condition and rollback trigger.",
    "tokenBudget": 800,
    "documents": [
      { "id": "release-policy", "title": "Release policy", "text": "..." },
      { "id": "rollback-runbook", "title": "Rollback runbook", "text": "..." }
    ],
    "provenance": "compact",
    "scoring": "bm25",
    "budgetMode": "guaranteed"
  }
}
```

`maha_context` is removed before upstream forwarding. The marker must appear
exactly once in a string-valued message content field. Multimodal content is
preserved but cannot contain the marker in this first contract version.

## WSO2 policy shape

The Interceptor Service policy appends `/handle-request` to its configured base
URL. Configure the base endpoint as:

```text
https://www.mahastrategies.com/api/integrations/wso2/context-compiler
```

Use request interception with `includeRequestHeaders: true`,
`includeRequestBody: true`, and response interception with all request and
response body/header inclusion disabled. Both phases set
`passthroughOnError: false`. The response phase receives only the private
interceptor context needed to return aggregate evidence. TLS verification stays
on and the initial timeout is 3000 ms. The fail-closed setting is intentional:
an invalid or absent evidence seal must not become a successful response.

Policy order matters. The test-credential header must be set before the
interceptor runs, using `mode: set` so a client-supplied value is overwritten:

```yaml
policies:
  - name: set-headers
    version: v1
    params:
      mode: set
      request:
        headers:
          - name: x-maha-wso2-interceptor-token
            value: "REPLACE_WITH_DEDICATED_EVALUATION_SECRET"
  - name: interceptor-service
    version: v1
    paths:
      - path: /v1/chat/completions
        methods: [POST]
        params:
          endpoint: https://www.mahastrategies.com/api/integrations/wso2/context-compiler
          request:
            includeRequestHeaders: true
            includeRequestBody: true
            passthroughOnError: false
          response:
            includeRequestHeaders: false
            includeRequestBody: false
            includeResponseHeaders: false
            includeResponseBody: false
            passthroughOnError: false
          timeoutMillis: 3000
          tlsSkipVerify: false
```

Operation-level policy attachments use major versions (`v1` for Interceptor
Service and `v0` for Prompt Compressor), even though the installed policies are
v1.0.0 and v0.9.0. WSO2 AI Gateway 1.1.0 accepts a proxy definition containing
a full semantic policy version but omits that policy from the effective runtime
chain. The import verification rejects that silent-failure shape.

The upstream WSO2 policy currently has no separate interceptor-call
authentication parameter. This prototype therefore uses a header inserted by
the gateway and visible in the interceptor envelope. The public Set Headers
documentation warns that headers may be logged or forwarded, and its example
uses a static value rather than a secret reference. Accordingly, this is an
**evaluation credential**, not an accepted production authentication design.
Use a dedicated random value of at least 32 characters, restrict access to the
WSO2 API definition, and verify that the interceptor removes it before
forwarding. Do not reuse a Maha API key. Production promotion is blocked until
the deployment supplies a non-logged secret reference, authenticated service
identity, mTLS, or another reviewed interceptor-call credential mechanism.

## Reproduce the local contract evaluation

```bash
npm run evaluate:wso2-context-interceptor
```

The checked-in workload contains three synthetic operational documents,
deliberate duplicate passages, and three labelled required facts. The script
replays WSO2's exact request envelope, validates the rewrite, verifies all
required facts remain, and reports aggregate compiler evidence.

This local test does **not** measure WSO2 network overhead and does not compare
Maha with WSO2's native Prompt Compressor. Those are deployment-stage gates.

## Bounded WSO2 evaluation

### 2026-08-14 single-workload integration result

The first live integration check ran WSO2 AI Gateway 1.1.0 locally with one
Anthropic provider and three application-facing proxies. All three paths used
Claude Haiku 4.5, temperature 0, a 220-token output ceiling, and the same
synthetic three-document decision task. This is integration evidence, not a
benchmark corpus.

| Path | Provider input tokens | Input reduction | End-to-end latency | Required facts | Cited sources | Estimated provider cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| WSO2 baseline | 545 | — | 1,971 ms | 3/3 | 3/3 | $0.001375 |
| WSO2 Prompt Compressor | 327 | 40.0% | 2,173 ms | 3/3 | 3/3 | $0.001177 |
| WSO2 + Maha Context Compiler | 314 | 42.4% | 2,463 ms | 3/3 | 3/3 | $0.001174 |

Maha's compiler evidence separately reported 374 model-neutral estimated input
tokens, 203 compiled tokens, 45.7% estimated reduction, 100% source coverage,
and five included passages. The upstream model cited source-and-passage IDs on
the Maha path; the other two paths cited document-level source IDs.

At Anthropic's published Haiku 4.5 standard rates of $1 per million input
tokens and $5 per million output tokens, the controlled three-path comparison
cost an estimated $0.003726. Including one exploratory baseline request used to
tighten the output format, actual authorized evaluation usage was an estimated
$0.005347. The failed pre-deployment 404 reached no provider and incurred no
model charge.

The request-phase interceptor was observed returning HTTP 200 before WSO2
forwarded exactly one rewritten request upstream. The gateway-injected
credential was not supplied by the caller, and Maha removed it from the
forwarded request. The checked-in sanitized result is
`content/integrations/wso2-context-compiler-three-path-result.json`.

This result does not support a general claim that Maha outperforms WSO2's
native compressor. It shows a small input-token advantage on one labelled
workload while adding passage-level provenance, hashes, an explicit source
coverage measurement, and a zero-retention declaration. Latency is one
observation per path, not a percentile measurement.

### Larger evaluation gate

Run the same 20 labelled workloads through three paths:

1. unmodified WSO2 request;
2. WSO2 native Prompt Compressor;
3. WSO2 Interceptor Service with Maha.

Record required-fact retention, source coverage, citation traceability, input
tokens, processing latency, upstream model cost, and failure behaviour. Do not
generalize beyond the labelled corpus. A useful result must show what Maha adds
beyond token reduction: explicit source provenance, a fixed budget, stable
hashes, and a measurable retention boundary.

The frozen corpus for this gate is
`content/integrations/wso2-context-compiler-corpus.json`. It contains exactly
20 synthetic workloads spanning easy, medium, and hard cases and 20 document
structures, including timelines, email threads, tables, configuration files,
multilingual text, noisy OCR, version conflicts, distractor-heavy prose, and
prompt-injection-like text. Every required fact is labelled with an exact
evidence span and expected source citation before any model path is run. The corpus
contains no customer data, personal data, credentials, or production secrets.
It carries a SHA-256 label-freeze digest over every request, source document,
required fact, expected citation, and prohibited assertion. The preflight
recomputes that digest; changing an input or label after seeing model output
fails validation instead of silently changing the scoring target.

Run the zero-cost deterministic preflight before the three-path evaluation:

```bash
npm run validate:wso2-evaluation-corpus
```

This preflight verifies corpus shape, label integrity, expected citations, and
the frozen-label digest. It does not execute any comparison path, score a model,
or establish a competitive result. The provider-backed comparison must use the
same frozen requests and labels, report
every workload rather than only aggregate winners, and preserve failures.

The separate cost corpus is
`content/integrations/wso2-large-context-cost-corpus.json`. Its twenty
synthetic workloads range from 20,006 to 99,983 model-neutral estimated tokens
and cover RAG exports, manuals, contracts, incident timelines, audit streams,
transcripts and mixed enterprise records. Run it without provider calls with:

```bash
node --experimental-strip-types scripts/run-wso2-three-path-evaluation.ts \
  --dry-run \
  --corpus=content/integrations/wso2-large-context-cost-corpus.json
```

The runner writes model answers to a separate sanitized, path-blinded human
adjudication artifact. The response-to-path key is written separately; the
ordinary comparison artifact contains scores and aggregates but no answer
text. Live runs checkpoint the sanitized answer with each paid result so an
interruption cannot force a duplicate call or make prior answers unreviewable.

## Non-fit and failure boundaries

- This is extractive ranking and deduplication, not claim verification.
- Completeness and hallucination prevention are not guaranteed.
- Token counts are model-neutral estimates, not provider billing counts.
- Binary documents must be converted to bounded text before interception.
- Requests larger than the documented limit are rejected, not truncated.
- Missing/invalid integration credentials fail closed.
- No customer should use this prototype until secret injection/removal and
  timeout behaviour have been observed in a real WSO2 deployment.

## Primary references

- [WSO2 Interceptor Service policy v1.0](https://github.com/wso2/gateway-controllers/blob/main/docs/interceptor-service/v1.0/docs/interceptor-service.md)
- [WSO2 gateway policy catalogue](https://github.com/wso2/gateway-controllers/blob/main/docs/README.md)
- [WSO2 AI Gateway guardrails](https://wso2.com/api-platform/docs/ai-gateway/next/llm-proxy/guardrails/overview/)
- [WSO2 Prompt Compressor policy](https://wso2.com/api-platform/docs/ai-gateway/next/llm-proxy/prompt-management/prompt-compressor/)
