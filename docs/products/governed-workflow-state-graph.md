# Governed Workflow State Graph

**Status: evaluation-grade prototype.** This is not a compliance certification, not an
audited control, and not a deployed enterprise control plane. It is a working reference
implementation with a frozen synthetic corpus, published so that a buyer can inspect the
model rather than take a description of it on trust.

Schema version `1.0.0` · Policy model version `2026-08-21` · Corpus version `2026-08-21`

---

## What this is

A governed, evidence-bounded representation of **one** operational workflow: document
approval for a regulated decision. The reference workflow is a claims/policy-review style
approval, chosen because it is the shape buyers recognise.

It records, for a single workflow instance:

- what the agent proposes,
- what evidence the proposal is bound to,
- what remains uncertain,
- which actions policy permits,
- which approvals are required and who granted them,
- what side effect was intended and what receipt came back,
- and how an interrupted run recovers.

## What this is not

| Not | Why it matters |
| --- | --- |
| A general-purpose world model | It models one workflow template, with a closed state set. |
| A simulation engine | It does not predict outcomes. It records decisions and their bindings. |
| An agent memory store | It stores no free text and no recall corpus. See the comparison below. |
| An autonomous workflow runner | It authorizes; it never acts. Every side effect is an intent plus a receipt, and the middle is simulated. |
| A compliance certification | No external audit, no control attestation, no certification of any kind. |

**The prototype makes no payments, calls no providers, dispatches no messages, and invokes
no real external tools.** Payment is forbidden at the root policy layer, and the
inheritance rules make that impossible for any child layer to undo.

---

## Architecture

```
                       ┌──────────────────────────────────────────────┐
   caller / agent ───▶  │  demo API   app/api/governed-workflow/demo   │
                       │  stateless · program per request · no store  │
                       └───────────────────┬──────────────────────────┘
                                           │  metadata only
                                           ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │  lib/governed-workflow                                                 │
  │                                                                        │
  │   policy.ts  ──────▶  lib/governance/policy-inheritance.ts  (REUSED)   │
  │     4 scopes            most-restrictive-wins · restrictive-only child  │
  │     signed exception    resolveGovernancePolicy · MAX_POLICY_DEPTH 8    │
  │                                                                        │
  │   evidence.ts           digests, provenance labels, retention guard    │
  │   state-graph.ts        legal edges + safe checkpoints                 │
  │   engine.ts             transition gates · idempotency · replay        │
  │   audit.ts              the one sanitized projection                   │
  └──────────────────────────────┬─────────────────────────────────────────┘
                                 │  append-only, hash-chained
                                 ▼
                      ┌────────────────────────┐
                      │  GwsgEventLog          │
                      │  append · list · head  │   no update. no delete.
                      └────────────────────────┘
                                 │
                                 ▼
        operator view  app/governed-workflow  (read-only, synthetic fixtures)
```

The policy layer is a thin adapter over `lib/governance/policy-inheritance.ts`. That is
deliberate: the authorization framework already exists in this codebase, and a second one
would give two answers to "is this allowed" that drift apart. The only addition is the
fourth policy scope (`instance`) and the rule that unresolved uncertainty cannot be
silently ignored.

---

## State transitions

```
                     ┌──────────────────────────── needs_human_review ◀────────┐
                     │                                    │                    │
                     ▼                                    ▼                    │
  draft ──▶ evidence_collected ──▶ policy_evaluated ──▶ approval_pending ──▶ approved
                     │                    │                    │                │
                     │                    ▼                    ▼                ▼
                     │                 denied               denied      action_authorized
                     │                                      expired             │
                     │                                                          ▼
                     └──────────▶ failed_recoverable                    action_completed
                                          │                                     │
                                          ▼                                     ▼
                                    failed_final                              closed

  replay_blocked ◀── a repeated idempotency key with changed material inputs
```

Terminal: `closed`, `denied`, `failed_final`.
Halted (no automatic progress): the terminal set plus `expired`, `needs_human_review`,
`replay_blocked`.

**Safe checkpoints for recovery:** `evidence_collected`, `policy_evaluated`, `approved`.

`action_authorized` is deliberately **not** a safe checkpoint. Once an action is
authorized the side effect may already have landed, so resuming from there risks a second
one. That path is classified `indeterminate_side_effect` and routed to a human instead.

### Required behaviour, and where it is enforced

| Rule | Enforcement |
| --- | --- |
| An action cannot be authorized without a successful policy decision | `engine.ts` — the authorization branch runs only after `evaluateTransitionPolicy` returns `allowed` |
| A policy decision cannot silently ignore unresolved uncertainty | `policy.ts` — uncertainty is classified *before* the allow-list is consulted |
| A required approval cannot be bypassed by an agent | `recordApprovalDecision` throws unless the actor is `human_reviewer` |
| Approval binds instance, transition, policy version, input digest, evidence digest set | `ApprovalBinding`; the approval id is derived from it |
| Stale or changed evidence invalidates a pending approval | The binding is content-addressed, so a changed evidence set yields a different approval id — the old grant is not found |
| A repeated transition with the same key returns the original result | `applyTransition` checks the idempotency record before anything that could cause an effect |
| A repeated transition with changed material inputs is rejected | `replay_material_change_rejected` → `replay_blocked` |
| Recovery reconstructs state and finds the last safe checkpoint | `replayWorkflow` + `assessRecovery` |
| Every denied or failed transition produces a machine-readable reason code | 20 codes in `GwsgReasonCode`; asserted for every scenario |

---

## Policy model

Four scopes resolve root-to-leaf, and precedence is the order:

```
tenant  ──▶  workflow (template)  ──▶  instance  ──▶  transition/action
```

Resolution is **most-restrictive-wins**, inherited from
`resolveGovernancePolicy`:

- allow-lists **intersect** — a child can only remove values,
- ceilings take the **minimum** — a child can only lower them,
- review requirements and payment prohibitions are **additive** — a child can only add them,
- a child can **never** restore authority an ancestor removed.

There is no override flag anywhere in this model. The only way to widen a resolved policy
is a **signed policy exception**: an explicit object naming exactly one workflow instance,
one transition, and one operation, HMAC-signed and time-bounded. It is verified against
all five properties, and an exception cannot override a blocking uncertainty even when
correctly signed.

---

## Evidence and trust boundaries

The model stores **references**, never content.

```
   ┌───────────────────────────────────────────────────────────────────┐
   │ VERIFIED LOCALLY          structure · digest format · set digest  │
   ├───────────────────────────────────────────────────────────────────┤
   │ TRUSTED PASS-THROUGH      contentSha256 · contentBytes            │
   │                           accepted from the caller, named         │
   │                           explicitly on every reference           │
   ├───────────────────────────────────────────────────────────────────┤
   │ NOT ESTABLISHED           sourceAuthenticityVerified   = false    │
   │                           factualTruthEstablished      = false    │
   │                           providerExecutionVerified    = false    │
   └───────────────────────────────────────────────────────────────────┘
```

A SHA-256 digest commits two parties to the same bytes. It proves that the thing being
discussed has not changed. **It does not prove that the bytes are true, that the document
is authentic, or that any provider executed anything.** Those three fields are pinned to
`false` in the TypeScript type *and* in the published JSON Schema, so a conforming record
cannot assert them. They are the boundary, not placeholders awaiting implementation.

---

## Data retention model

> Do not retain raw source documents in durable workflow state. Store only references,
> digests, bounded classifications, and caller-supplied safe metadata.

This is enforced structurally rather than by policy:

1. **The durable event type has no content field.** A shape that cannot represent source
   text cannot leak it by accident.
2. **Labels are bounded** — at most 12 keys, 120 characters each. An excerpt does not fit.
3. **One sanitized projection.** Every API response and every rendered view goes through
   `audit.ts`, so the guarantee is a property of a single function that tests attack
   directly.
4. **The demo API refuses content-bearing payloads.** A body with a `content`, `text`,
   `body`, `raw`, `excerpt`, `snippet`, `document`, or `passage` field is rejected with
   `payload_not_metadata` rather than silently stripped.
5. **A last-line check.** Every demo response is scanned for strings long enough to be
   prose; one would fail the request rather than ship.
6. **Actor identity is a digest.** Reviewers are recorded as `actorIdSha256` plus a role,
   never a name — an audit trail designed to be retained indefinitely should not become a
   personal-data store.

The test for this is an affirmative length bound, not a banned-keyword scan. A keyword
list would pass any document that simply avoided the words on it.

---

## Comparison with generic agent memory

| | Generic agent memory | Governed Workflow State Graph |
| --- | --- | --- |
| Stores | Free text, embeddings, recalled passages | References, digests, bounded classifications |
| Retrieval | Similarity, ranked, approximate | Exact replay from an append-only log |
| Determinism | Varies with index and model | Same events → same state, always |
| Mutability | Compacted, summarised, overwritten | Append-only, hash-chained, tamper-evident |
| Authorization | Usually external to memory | Every transition carries its policy decision |
| Approval | Not modelled | Bound to instance, transition, policy, input, evidence |
| On repeat | May re-run and re-act | Returns the original record; no second side effect |
| Answers | "What did we see about X?" | "What was decided, on what basis, by whom, and could it happen twice?" |

They solve different problems. Agent memory helps an agent recall. This helps an
organisation account for what an agent was permitted to do.

---

## Buyer use cases

- **Claims processing** — an adjudication bound to the exact evidence set that supported
  it, where revising a form after approval visibly invalidates the approval.
- **Policy review** — a reviewer's grant tied to one policy version, so a policy change
  does not silently inherit old approvals.
- **Document approval for a regulated decision** — a metadata-only audit trail that can be
  retained and shown without exposing the documents themselves.
- **Procurement** — an approval chain where a lower-level exception cannot widen what a
  tenant-level policy forbids, and any exception is signed and traceable.
- **Governed agentic purchase** — the shape a purchasing agent needs before it is trusted
  with a budget: an authorization that binds, an approval that expires, and a replay that
  cannot double-spend. Payment itself is forbidden in this prototype.

---

## Known limitations

1. **Evaluation-grade only.** No external audit, no certification, no production
   deployment. The reference store is in-memory.
2. **The corpus is synthetic and frozen.** No real claim, claimant, document, reviewer, or
   payment is involved anywhere in this work.
3. **Digests are trusted pass-through.** The engine never fetches or hashes source bytes
   itself, so it cannot detect a caller that supplies a digest for bytes it does not hold.
4. **No signature on the event chain.** The chain is tamper-*evident* against edit,
   removal and re-digest. It is not signed, so an actor who can rewrite the entire log can
   produce a self-consistent alternative history.
5. **One workflow template.** Multi-template and cross-workflow dependencies are not
   modelled.
6. **Recovery is an assessment, not an executor.** `assessRecovery` classifies and locates
   the last safe checkpoint; resuming from it is the caller's decision.
7. **The demo API is unauthenticated** because it holds no data and performs no effect. It
   is a worked example, not a service, and should not be treated as one.
8. **Exception secrets are environment-supplied.** Key management, rotation, and reviewer
   identity provisioning are out of scope.

---

## Verification

Run the focused suite:

```bash
npm test -- test/governed-workflow-scenarios.test.ts test/governed-workflow-properties.test.ts test/governed-workflow-exceptions.test.ts
```

The corpus covers all ten required scenarios: normal approved path, denied policy path,
uncertainty requiring human review, approval expiry, changed evidence after approval,
duplicate/replayed action, interrupted execution and recovery, attempted policy bypass,
tenant/template/instance policy conflict, and the metadata-only audit guarantee.

The suite proves six properties: deterministic replay, no duplicate side effect, no raw
source text in durable events or API responses or view fixtures, approval binding
invalidation, most-restrictive policy precedence, and append-only event-chain integrity.

## Surfaces

| Surface | Path |
| --- | --- |
| Domain library | `lib/governed-workflow/` |
| Schemas | `public/schemas/governed-workflow/` |
| Demo API | `app/api/governed-workflow/demo` |
| Operator view | `app/governed-workflow` |
