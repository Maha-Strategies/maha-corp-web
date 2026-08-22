# MCP gateway ↔ governance decision interface

A protocol-neutral specification for putting a governance decision between an
MCP gateway and the thing it would dispatch to.

```
  MCP gateway  ──▶  Maha governance decision  ──▶  gateway enforcement + audit
   (yours)            (allow / deny / approval_required)      (yours)
```

Version `1.0.0` · Reference implementation `lib/mcp-gateway-interop/` ·
Fixtures `fixtures/mcp-gateway-interop/`

The gateway keeps its own authentication, sandboxing and audit log. This layer
answers one question — may this action proceed, and on what recorded basis —
and returns something the gateway can enforce with machinery it already has.

**Evaluation-grade reference layer.** Not an audited control, not a deployed
service, and not specific to any gateway product.

---

## 1. Design premise: the decision holds the callback

A decision service that returns `deny` and leaves the gateway to honour it is
advisory. Every integration bug then looks the same — the decision was correct
and the action happened anyway.

So the gateway passes **its own dispatch callback** into the decision, and the
callback is invoked only on the authorised path. There is no code path from a
denial to the callback. That inversion is the only structural claim here; the
rest is bookkeeping.

The gateway still executes the action. This layer never opens a socket, holds a
credential, or contacts an upstream.

---

## 2. Incoming envelope

Protocol-neutral. An MCP `tools/call` maps onto it directly, as do A2A tasks and
HTTP actions.

| Field | Meaning |
| --- | --- |
| `requestId` | gateway correlation id; echoed, never interpreted |
| `idempotencyKey` | stable across retries of the same intended effect |
| `tenantId`, `agentId` | identities **as the gateway already authenticated them** |
| `transport` | `mcp` \| `a2a` \| `http-x402` |
| `targetId`, `resource` | the upstream the gateway would dispatch to |
| `operation` | the method — for MCP, the JSON-RPC method |
| `capability` | the tool or skill, where the protocol distinguishes it |
| `inputSha256`, `inputBytes` | a **digest** of the arguments, and their size |
| `evidence[]` | `{ evidenceId, contentSha256 }` — references, never documents |
| `execution` | `{ hopCount, timeoutMs }` |
| `payment` | status only; settlement happens elsewhere, if at all |

**Arguments never cross this boundary.** The gateway hashes them and sends the
commitment. The decision binds what was asked without the decision record ever
holding it, which is what lets the record be retained as long as an auditor
wants.

Argument names that look like credentials (`apiKey`, `authorization`,
`access_token`, `clientSecret`, `password`, …) are **refused at translation**,
not hashed and accepted. A caller who believed a credential was required finds
out immediately.

---

## 3. The decision

Deterministic: the same envelope, policy and clock always produce the same
decision and the same digests.

Authority comes from `evaluateGovernedAction` in `lib/governance/envelope.ts` —
the existing engine. **This layer contains no allow/deny logic of its own.** A
second policy engine in the gateway path would be the one nobody audited.

| Governance outcome | Gateway decision | Gateway does |
| --- | --- | --- |
| `proceed` | `allow` | dispatch |
| `require_review` | `approval_required` | hold; surface to a reviewer |
| `deny` | `deny` | refuse; write its audit row |

Reason codes come from the governance vocabulary — `capability_not_allowed`,
`tenant_not_allowed`, `envelope_expired`, `input_limit_exceeded`,
`payment_forbidden`, `human_review_required`, and so on. All machine-readable;
none is free text.

Policy inheritance is `resolveGovernancePolicy`: allow-lists intersect, ceilings
take the minimum, review requirements are additive, and **a child layer can
never restore authority an ancestor removed.**

---

## 4. Policy identifier and evidence digests

Every result carries what an audit row needs:

| Field | What it commits to |
| --- | --- |
| `policy.policyId` / `policyVersion` / `policySha256` | the exact resolved policy |
| `evidence.envelopeSha256` | the decision inputs |
| `evidence.decisionSha256` | the decision itself |
| `evidence.inputSha256` | the arguments, by digest |
| `evidence.evidenceSetSha256` | the whole evidence set, order-independent |
| `evidence.contentRetained` | always `false` |

A digest commits two parties to the same bytes. It does **not** establish that
those bytes are true, authentic, or produced by any named party.

---

## 5. Token, spend and data boundaries

- **Spend.** `payment.mode: 'forbid'` at the root policy means no child layer
  can enable payment. This layer initiates none and has no code path to.
- **Tokens / size.** `maxInputBytes` bounds the declared payload;
  `input_limit_exceeded` denies past it. No token budget is ever defaulted.
- **Data.** No argument values, no document content, no credentials, in
  requests, results, logs or fixtures. Identities are the gateway's own opaque
  ids; reviewers are a digest plus a role, never a name.
- **Time.** The envelope's validity window is derived from the request's own
  `timeoutMs`, so an envelope cannot outlive the call it authorises.

Every result carries a `verification` block grading each field
`locally_verified`, `trusted_pass_through`, or `not_established` — so the
gateway operator never has to infer which is which:

| Field | Grade |
| --- | --- |
| envelope structure, policy evaluation, approval binding, idempotency | `locally_verified` |
| input digest, evidence digests, caller identity | `trusted_pass_through` |
| dispatch execution | `not_established` |

---

## 6. Approval binding

An approval is **content-addressed** over instance, transition, policy version,
input digest and evidence-set digest, using the workflow engine's own
`approvalIdFor`.

Change any of them and the approval id changes. The old grant is therefore not
*overridden* — it is **not found**, which is a much harder failure to get wrong
than a staleness flag someone forgets to check. Where a grant exists against a
superseded binding, the result says `approval_binding_stale` rather than
presenting a fresh review as though nothing had happened.

Only a `human_reviewer` may record a decision. An agent identity is refused.

---

## 7. Idempotency, receipts and indeterminate recovery

**Idempotency** is checked before anything that could dispatch. The same key
returns the original result with `dispatch.idempotentReplay: true`, and the
callback is not invoked again. The same key with **changed material inputs** —
policy, arguments or evidence — is refused as
`replay_material_change_rejected`, not silently re-run.

**Receipts.** The gateway's dispatch callback returns
`{ outcome, receiptId }`. The outcome is what the gateway observed, not what an
upstream actually did.

**Indeterminate.** An authorised action whose receipt is missing or
`indeterminate` is classified `indeterminate_side_effect` and
`safeToRetry: false`. Whether the effect landed is unknowable from the record,
and retrying is precisely how one authorisation becomes two effects. It routes
to a human instead.

```
  authorised ──▶ dispatch ──▶ receipt succeeded  ──▶ not_applicable
                     │
                     └──────▶ receipt indeterminate / absent
                                  └──▶ indeterminate_side_effect  (human decides)
```

---

## 8. Non-normative note on comparable gateways

Written against no particular product. A gateway that already performs
authentication, sandboxing and audit logging typically has a pre-dispatch
extension point — a plugin, interceptor, or middleware hook. This interface is
shaped for that slot: one synchronous decision, no state the gateway must keep,
and a result whose fields drop into an existing audit row unchanged.

Nothing here depends on that being true of any specific implementation, and no
product-specific integration is included.

---

## 9. What this does not do

- It does not authenticate anyone; identities are the gateway's.
- It does not sandbox or execute; dispatch is the gateway's callback.
- It does not replace the gateway's audit log; it supplies fields for it.
- It does not verify that a supplied digest matches bytes the caller holds.
- It does not contact providers, initiate payment, or persist beyond process
  memory in this reference implementation.
