# Agent task attribution and chargeback export

**Status:** scoped 9 August 2026. Step 1 and 2 implemented; steps 3–5 not started.

An enterprise platform team running agents cannot currently answer "which
department spent this." Usage is metered per credential and per day, which
answers whether a customer came back, and answers nothing about who inside that
customer to bill. This document scopes the smallest addition that turns the
meters already in the repo into an attribution ledger a finance team can file.

It is deliberately **out-of-band**. Nothing here runs in a request path, reads a
budget before serving, or can withhold a response. The failure mode of a wrong
report is an argument; the failure mode of an inline component is an outage, and
the second is not a position this platform has earned yet.

## What was already true, and what was not

Two findings from reading the schema changed the design.

**The credential in the usage meter is not the credential in Postgres.**
`context_compiler_usage_daily.credential_id` holds `key_<32hex>`, the API-key id
`proxy.ts` injects as `x-maha-api-key-id`, which lives in Redis.
`agent_client_credentials.public_id` matches `^cred_[a-f0-9]{32}$` and is scoped
to `rapid-intelligence-brief` and `verified-research-brief`. They are unrelated
identity systems.

A consequence worth fixing on its own: `buildAcquisitionFunnel` computed
`credentialToActivated` by dividing distinct `key_*` ids that made a successful
call by the count of `cred_*` rows created. That is a ratio between two
unrelated populations, and it was being reported as a conversion rate.

**There is no tenant table in Postgres.** Tenant identity is a Redis hash. The
proxy injects `x-maha-tenant-id`, so the value is available at the route, but no
foreign key is possible and the fact table carries it denormalized.

## Grain

`context_compiler_usage_daily` stays untouched. Its primary key is four
low-cardinality columns and its own comment describes the grain as "deliberately
coarse". Adding `task_id` there would turn a table with a handful of rows per
day into one with a row per task per day, destroying the thing it was built to
answer.

So there are two tables at two grains:

| Table | Grain | Question |
|---|---|---|
| `context_compiler_usage_daily` | day × access mode × credential × status | Did this credential come back? |
| `agent_task_spend_daily` | day × tenant × task × cost centre × surface | Who inside the customer spent this? |

Task rows are day-grained rather than task-lifetime. A task that spans midnight
writes two rows which sum at export. That keeps the update window bounded and
matches every other meter here.

## The retention decision

`task_id` is the first customer-supplied string this platform retains.
Everything recorded today is either derived (hashes, token counts) or structural
(status class, access mode). `sourceTextStored: false` remains true — a task
identifier is not payload — but a customer can put an email address, a case
number, or a truncated prompt into one, and it will sit in Postgres and appear
in exports.

Hashing it would make the product useless: a chargeback report the customer
cannot read against its own task ids is not a chargeback report. So the
mitigations are constraints rather than obfuscation:

- charset and length are constrained by a `check` on the column, so it cannot
  carry arbitrary text;
- the primary key is tenant-scoped, so identifiers cannot collide or leak
  across tenants;
- the public contract states that task identifiers are retained and exported,
  and that personal data must not be placed in them.

This was accepted deliberately on 9 August 2026 rather than arrived at as a side
effect of a migration.

## Resolution precedence

Cost centre is resolved once, at write time, and stored on the fact row:

1. `x-maha-cost-center` request header, if present and well-formed;
2. the credential's default, if one is configured;
3. `'unallocated'`.

Stored rather than joined, because a chargeback ledger must bill what was true
when the call happened. Re-pointing a credential at a different department next
quarter must not silently rewrite last quarter's invoice.

A malformed header resolves as absent and falls through to the next source. It
never lands in a different tenant's bucket and never becomes an empty string —
`'unallocated'` is a real value that a finance team can see and chase, whereas
an empty string is a gap that looks like a bug.

## Budgets are read, never enforced

`agent_cost_center_budgets` (step 5) is consulted by reports only. Nothing in a
request path reads it and no breach returns 402. Enforcement would move this
system inline, which is exactly the property that makes it sellable without a
security review.

## Export

`lib/chargeback-export.ts` (step 3) is a pure function: window in, CSV out.

- **Reproducible.** Same window, same bytes, deterministic column and row
  ordering. An export that differs between runs cannot be reconciled.
- **Content-hashed**, in the same style as the context packs, so a finance team
  can prove the file it filed is the file that was produced.
- **Credits, not dollars.** The effective rate differs by pack ($0.002 Builder,
  $0.00167 Scale) and correct valuation needs purchase-lot accounting that does
  not exist. v1 exports credits and a stated tenant rate.
- **Tokens saved as a quantity, never as a dollar saving.** Converting requires
  the customer's own model input price, which this service does not know.
  Inventing one would repeat the error the $3/M reference figure is carefully
  framed to avoid.

## Explicitly out of scope for v1

- **NetSuite and Stripe Billing connectors.** Per-customer field mappings and
  credential handling, and no customer has named an ERP. CSV first.
- **Threshold alerts.** Computing budget status is cheap; delivering a
  notification needs a channel, a scheduler and dedupe. Status in a report
  first.
- **A dashboard.** The CSV is the product for the first customer. A UI is what
  gets built after someone pays for the CSV.

## Staging

1. **Migration** — `agent_task_spend_daily` and `record_agent_task_spend`,
   migration integrity green. *(done)*
2. **Attribution on `/api/v1/compress`** — headers parsed, defaulting to
   `unallocated`, no behaviour change for a caller that sends neither. *(done)*
3. **Export function and tests**, run against a week of real production data.
4. **Jobs and gateway surfaces.**
5. **Budgets, read-only.**

Steps 1–3 are testable end to end without a customer and produce the CSV that is
the actual sales artifact.
