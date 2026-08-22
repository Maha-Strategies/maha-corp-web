# Bounded evaluation: claims exception approval

A customer-shaped evaluation of **one** decision, built on the existing Governed
Workflow State Graph. Synthetic throughout: no claimant, policy, document,
credential, payment authority, or live effect exists anywhere in it.

Version `2026-08-22` · Template `claims-exception-review` · Reproduce with
`npm run evaluate:claims-exception`

---

## Why claims, and why exceptions

Four verticals were candidates. Claims is the one with capability already
behind it, and the choice was made on what exists rather than on what sells.

| Vertical | Assessment |
| --- | --- |
| **Claims handling** ✅ | The state graph's evidence kinds are already `claim_form`, `policy_document`, `assessment_note`, `prior_decision`; its worked action is already `issue_decision_letter`. Nothing had to be invented to express a real claims decision. |
| Procurement | Would need supplier, requisition and purchase-order evidence kinds that do not exist. Expressible, but the evaluation would be mostly new domain modelling presented as capability. |
| Document approval | Already what the graph does generically. As a *vertical* it is the least differentiated — there is no specific buyer decision to bound. |
| Governed agent actions | Tempting, and the weakest. What makes it interesting is an agent *taking* an action, and taking actions is exactly what this release excludes: payment is forbidden at the root and side effects are simulated. The evaluation would be about the part that is not built. |

Within claims, the unit is an **exception**, not a standard claim. A standard
claim is a rules engine's job and needs no approval graph. An exception is where
a human must take responsibility, where the evidence set is contested, and where
an auditor later asks who allowed it — the question this model answers.

**No platform features were added.** The package is configuration: a policy
chain, an evidence requirement, an authority model, and six scenarios, all run
against the existing engine. The one thing it needed beyond the base template —
requiring `prior_decision` — was already an engine input, not a change.

---

## Customer problem and decision boundary

**Problem.** An insurer approves claims exceptions outside standard coverage
rules. Months later a regulator, an internal auditor, or a disputing claimant
asks: on what evidence was this allowed, under which policy version, by whom,
and could the same authorisation have produced two decision letters. Today those
answers live across a case management system, an email thread, and a person's
recollection.

**In scope — the decision boundary.** Exactly one decision:

> Approve or deny an out-of-rule claims exception, and authorise the decision
> letter that follows from it.

**Out of scope.** Everything before intake and everything after authorisation:
fraud scoring, reserving, reinsurance, the wording of the letter, and its
delivery. The workflow authorises a letter; it does not write or send one.

---

## Declared inputs, and prohibited data

Inputs are bounded scalars — codes, flags, integers. A field that could hold a
person or a payment instruction would eventually hold one, so none exists.

| Field | Type |
| --- | --- |
| `claimReference` | opaque reference |
| `coverageCategory` | `category-a \| category-b \| category-c` |
| `exceptionGroundsCode` | `late_notification \| out_of_network \| policy_lapse_grace \| documentation_shortfall` |
| `requestedAmountMinor` | integer, minor units |
| `priorDecisionWasDenial` | boolean |
| `submittedComplete` | boolean |

**Prohibited, and refused rather than ignored.** `claimantName`, `dateOfBirth`,
`address`, `nationalId`, `policyNumber`, `memberId`, `diagnosis`, `treatment`,
`adjusterNotes`, `narrative`, `iban`, `accountNumber`, `cardNumber`, `payee`,
`paymentInstruction`, and the rest of `CLAIMS_EXCEPTION_PROHIBITED_INPUT_FIELDS`.

`assertNoProhibitedInput` throws on any of them. The test does not merely check
they are absent — absence proves nothing — it supplies each one and requires a
rejection.

**Evidence is referenced, never carried.** Four documents enter as digests:

| Kind | Required |
| --- | --- |
| `claim_form` | yes |
| `policy_document` | yes |
| `assessment_note` | yes |
| `prior_decision` | yes — an exception departs from a previous position, and deciding one without that position is the failure this requirement prevents |

---

## Workflow states and authority model

States are the reference graph's, unchanged:

```
draft → evidence_collected → policy_evaluated → approval_pending → approved
      → action_authorized → action_completed → closed
```

with `denied`, `expired`, `needs_human_review`, `failed_recoverable`,
`failed_final`, `replay_blocked` off the main line.

**Authority resolves most-restrictive-wins across four layers:**

| Layer | Holds |
| --- | --- |
| `tenant` — insurer | The full operation set. **Payment forbidden**, and no lower layer can restore it. |
| `workflow` — claims-exception-review | Narrows to this template's operations. |
| `instance` — this claim | Where a branch office's reduced authority is expressed. |
| `action` — this transition | Cannot widen anything above it. |

**Roles.** `claims-intake-agent` and `claims-assessment-agent` are agents; they
prepare, refer and authorise-once-approved. `claims-exception-adjudicator` is the
only `human_reviewer`, and the only party that can grant an approval or clear an
escalation. Identities are digests plus a role — never a name, so the audit
trail can be retained indefinitely without becoming a personal-data store.

`workflow.issue_decision_letter` is on the tenant review list, so it **always**
requires an approval.

---

## Scenarios

One normal path and five adverse or recovery paths. Every one is executed
against the real engine; the table is generated behaviour, not description.

| # | Scenario | Ends | Recovery | Reason code |
| --- | --- | --- | --- | --- |
| 1 | **Exception approved** — normal path | `closed` | `not_applicable` | — |
| 2 | **Assessment revised after approval** | `needs_human_review` | `requires_human_review` | `approval_binding_stale` |
| 3 | **Adjudicator's approval aged out** | `expired` | `requires_human_review` | `approval_expired` |
| 4 | **Interrupted after authorisation** | `action_authorized` | `indeterminate_side_effect` | — |
| 5 | **Branch office lacks authority** | `denied` | `not_applicable` | `policy_denied` |
| 6 | **Assessment conflicts with prior decision** | `needs_human_review` | `requires_human_review` | `uncertainty_blocks_decision` |

**2** is the one most worth watching. The approval is addressed by its content —
instance, transition, policy version, input digest, evidence digest set — so
revising the assessment note yields a different approval identity. The granted
approval is not overridden; it is *not found*. No letter is authorised.

**4** is the one that matters operationally. The action was authorised and no
receipt came back, so whether the letter went out is unknowable from the log.
The file is classified `indeterminate_side_effect` and routed to a human rather
than retried, and the retry a naive runner would attempt returns the original
record and raises no second letter.

**6** also proves the agent cannot clear its own escalation.

---

## Evidence shape returned to the evaluator

Metadata only. `npm run evaluate:claims-exception` emits authority (scope chain,
policy digest, what requires approval, payment mode), inputs (declared field
names, input digest, the prohibited list), evidence (required kinds, evidence-set
digest, per-document digest and byte count), and per-scenario sanitized
timelines: transition ids, states, actor role and digest, policy and input and
evidence digests, uncertainty status, authorisation result, approval state,
recovery classification, reason codes, and the hash chain.

There is no field anywhere in that output that can hold document text, and the
script refuses to emit if any string is long enough to be prose.

---

## Success criteria

The evaluation succeeds if an architect, working only from the emitted evidence,
can answer each of these without asking anyone:

1. Which policy version and evidence set each decision was bound to.
2. That the decision letter was never authorised without a human approval.
3. That revising evidence after approval prevented authorisation — scenario 2.
4. That an aged-out approval could not authorise — scenario 3.
5. That an interrupted run produced no second letter, and was routed to a human
   rather than retried — scenario 4.
6. That a reduced-authority instance could not be widened from below — scenario 5.
7. That no document text, claimant identifier, or payment instruction appears
   anywhere in the output.
8. That re-running the evaluation reproduces byte-identical evidence.

Every one is covered by a test in `test/claims-exception-evaluation.test.ts`.

## Timeline

| Stage | Effort |
| --- | --- |
| Confirm the decision and its boundary with the claims owner | 0.5 day |
| Map the customer's real evidence kinds and authority layers onto the model, as metadata only | 1 day |
| Substitute the customer's codes and policy chain; re-run | 0.5 day |
| Walk the six scenarios with the claims owner and an auditor | 0.5 day |
| Write findings and production prerequisites | 0.5 day |

**Three days, no production access.** No source documents, credentials, payment
authority, or live effects are needed at any stage.

---

## Explicit exclusions

Not part of this evaluation, and not implied by it:

- Any real claim, claimant, policy, or document.
- Any integration with a claims or case-management system.
- Delivery of a decision letter. The workflow authorises; it does not send.
- Any payment, disbursement or reserve movement.
- Fraud detection, reserving, reinsurance, or subrogation.
- Regulatory interpretation. That an exception is *permitted* is the insurer's
  determination, not this model's.
- Load, concurrency and latency behaviour.
- Any statement about whether the underlying documents are true. Digests commit
  parties to the same bytes and say nothing about their content.

## Production prerequisites — not yet implemented

These are the customer's decisions and Maha's remaining work. None is supplied
by this package.

1. **Durable storage.** The reference event log is in-memory. Production needs an
   append-only store with the same integrity properties and a retention policy.
2. **Identity.** Adjudicator identities are synthetic digests. Production needs
   real identity provisioning, role assignment, and joiner-mover-leaver handling.
3. **Key management.** The signed-exception secret is environment-supplied. No
   rotation, custody, or escrow model exists.
4. **Digest custody.** The engine never fetches or hashes source bytes; it accepts
   caller-supplied digests. It therefore cannot detect a caller that supplies a
   digest for bytes it does not hold. Closing that needs an ingestion component
   that hashes at the boundary.
5. **A signed chain.** The event chain is tamper-*evident* against edit, removal
   and re-digest. It is not signed, so an actor able to rewrite the whole log can
   produce a self-consistent alternative history.
6. **Letter issuance.** The side effect is simulated. A real issuance path needs
   the effect, its receipt, and a reconciliation for the indeterminate case in
   scenario 4.
7. **Control ownership.** Who owns this control, who reviews its exceptions, and
   what evidence the insurer's own auditors require.
8. **External assurance.** Nothing here is audited or certified. Any such
   assessment is a separate engagement.

---

**Evaluation-grade prototype.** Synthetic evaluation corpus — not a customer
result — not a compliance certification, not an audited control, and not a
deployed enterprise control plane.
