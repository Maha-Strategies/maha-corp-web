# GPT-6 Astra readiness

Status: prepared locally; production model unchanged; access unconfirmed.

## Objective

Adopt GPT-6 Astra only where it improves a measured Maha workload without weakening evidence, release, privacy, entitlement, replay, or cost controls. The first rollout is a private canary, not a global model replacement.

## Repository finding

Maha's public OpenAI-compatible proxy currently forwards non-streaming Chat Completions requests. That path can remain available for text-only compatibility, but Astra tool workflows require a separate Responses API adapter. The existing proxy must not be silently repurposed because its request and response contract is public.

The compatibility contract in `lib/openai-astra-readiness.ts` now provides a secret-free preflight for both endpoints. It refuses unsupported sampling/log-probability controls, unsupported reasoning effort, and tool calling through Chat Completions. It also prevents automatic model fallback after a side-effectful tool dispatch.

## Business use, in priority order

1. **Evidence Dossiers and source recovery.** Use Astra for difficult multi-source work: source identity, locator inspection, claim-to-passage checks, rights boundaries, conflicting evidence, and deterministic dossier assembly.
2. **The 4,000-route federation.** Use its long context selectively to inspect dependency slices spanning Research, Policy, Publish, Knowledge, books, and machine registries. Never send the entire corpus when a bounded subgraph will do.
3. **MCP and CABEZON execution.** Use async tool calling to overlap independent read-only retrievals. Keep entitlement, metering, idempotency, endpoint binding, release authority, and receipts in Maha code—not in model judgment.
4. **Publishing quality assurance.** Compare generated pages against exact source packets, canonical revisions, duplication boundaries, internal-link requirements, and public-bundle privacy rules.
5. **Commercial delivery.** Reserve Astra for paid preflight/dossier cases or escalations where measured quality gain exceeds its additional cost. Bulk classification and routine rendering should remain on cheaper deterministic or smaller-model paths.

These are leverage opportunities, not evidence of revenue. Conversion and retention must be measured separately.

## Rollout gates

1. Confirm `gpt-6-astra` is available to the intended API project with a read-only model lookup. Do not infer API access from ChatGPT access.
2. Keep every active model default unchanged. Add an Astra canary flag with a default allocation of zero.
3. Move only tool-bearing canary workloads to the Responses API. Preserve Chat Completions compatibility for existing text clients.
4. Remove unsupported request fields before canary review: `temperature`, `top_p`, `top_logprobs`; Chat Completions `logprobs`; Responses `message.output_text.logprobs`. Use only `low`, `medium`, `high`, `xhigh`, or `max` reasoning effort.
5. Run the eight evaluation lanes exported by the readiness contract against the current production model and Astra on the same frozen inputs.
6. Require no regression in citation fidelity, unsupported-inference refusal, canonical revision binding, entitlement, replay protection, privacy, structured output, or deterministic receipt verification.
7. Record input, cached input, output, latency, retries, tool count, and task-level success. Long requests must be separately costed; do not treat context-window size as a target.
8. Permit automatic fallback only when access is unavailable before any side-effectful tool dispatch. After a side effect, stop and reconcile by request and receipt identity.
9. Expand traffic only after a reviewed private canary. Production rollout and any Vercel build remain separate approvals.

## Frozen evaluation lanes

- evidence-preflight boundary fidelity;
- canonical release and exact-revision binding;
- MCP entitlement and bounded side effects;
- federated knowledge-graph retrieval;
- asynchronous tool lifecycle and replay protection;
- mid-turn steering without discarding completed work;
- private-corpus and credential non-disclosure;
- cost, latency, token, and output-schema regression.

## Prompt and instruction audit

Astra is more sensitive to supplied instructions. Before enabling it, inventory every `AGENTS.md`, skill, system prompt, tool description, and retrieved instruction-bearing document that a workload can see. State instruction priority explicitly, treat retrieved content as data rather than authority, define when delegation is expected, request concise output where appropriate, and cap testing effort in proportion to risk.

## Explicit non-actions

- No model alias or default changed.
- No OpenAI credential read or API request made.
- No Responses endpoint exposed publicly.
- No Vercel or Next production build run.
- No deployment or production mutation performed.
