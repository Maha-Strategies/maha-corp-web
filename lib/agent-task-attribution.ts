// Resolving who inside a customer to bill for a call.
//
// The existing meters record a credential, which identifies the customer. A
// platform team running agents across several departments needs the level
// below that, and only the caller knows it -- so it is supplied per request and
// therefore untrusted, which is what most of this file is about.
//
// Resolution is deliberate about three things:
//
//   * A malformed value is absent, never a different bucket. Reading a typo as
//     a cost centre would put one department's spend on another's invoice, and
//     that is worse than an unattributed row, because it is wrong rather than
//     merely incomplete.
//   * The result is stored on the fact row rather than joined later. A
//     chargeback ledger has to bill what was true when the call happened;
//     re-pointing a credential at another department next quarter must not
//     rewrite last quarter's invoice.
//   * 'unallocated' is a real value, not a blank. A finance team can see it and
//     chase it; an empty string reads as a defect in the meter.
//
// The identifier is retained and appears in exports, which is a change to this
// platform's retention posture and is documented as one. The charset below is
// the mitigation: it is narrow enough that the column cannot carry prose, and
// wide enough for the identifiers real systems generate.

/** Set by the caller to name the unit of work this request belongs to. */
export const TASK_ID_HEADER = 'x-maha-task-id'
/** Set by the caller to name the department or project to bill. */
export const COST_CENTER_HEADER = 'x-maha-cost-center'

/** Mirrors the column check in 20260809000300_agent_task_spend.sql. */
const TASK_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const COST_CENTER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/

export const UNALLOCATED = 'unallocated'

export type TaskAttribution = {
  /** Absent when the caller supplied none, or supplied one that was malformed. */
  taskId: string | null
  costCenter: string
  /** True when a value was sent and rejected, so a caller can be told. */
  rejectedTaskId: boolean
  rejectedCostCenter: boolean
}

/**
 * Trim and validate one header value.
 *
 * Returns null for absent and for malformed alike, because the caller's next
 * decision is the same in both cases: fall through to the next source. The
 * difference is reported separately, so a customer whose identifiers are being
 * silently dropped can be told rather than left wondering why its invoice is
 * mostly unallocated.
 */
function readConstrained(value: string | null, pattern: RegExp): { value: string | null; rejected: boolean } {
  if (value === null) return { value: null, rejected: false }
  const trimmed = value.trim()
  if (!trimmed) return { value: null, rejected: false }
  return pattern.test(trimmed) ? { value: trimmed, rejected: false } : { value: null, rejected: true }
}

/**
 * Resolve attribution for one request.
 *
 * `credentialDefault` is the cost centre configured against the credential, if
 * any. Precedence is request header, then credential default, then
 * 'unallocated' -- most specific wins, which is what lets one agent serve
 * several departments while a single-purpose credential needs no per-request
 * header at all.
 */
export function resolveTaskAttribution(
  headers: Headers,
  credentialDefault?: string | null,
): TaskAttribution {
  const task = readConstrained(headers.get(TASK_ID_HEADER), TASK_ID)
  const requested = readConstrained(headers.get(COST_CENTER_HEADER), COST_CENTER)

  const fallback = readConstrained(credentialDefault ?? null, COST_CENTER).value

  return {
    taskId: task.value,
    costCenter: requested.value ?? fallback ?? UNALLOCATED,
    rejectedTaskId: task.rejected,
    rejectedCostCenter: requested.rejected,
  }
}

/** The header proxy.ts injects after authorizing a credential. */
export const TENANT_ID_HEADER = 'x-maha-tenant-id'

/**
 * The billing identity a spend row is keyed on.
 *
 * One function rather than a header read at each call site, because the two
 * identities in play look interchangeable and are not: `x-maha-api-key-id`
 * carries `key_<hex>` and identifies one credential, while this carries
 * `tenant_<hex>` and identifies the customer that credential belongs to. A
 * surface that recorded the key id would write rows a tenant-scoped export
 * silently skips -- which is exactly what the jobs path did before this
 * existed, and it would have looked like missing usage rather than a defect.
 */
export function resolveTenantId(headers: Headers): string | null {
  const value = headers.get(TENANT_ID_HEADER)?.trim()
  return value ? value : null
}

/**
 * Whether this call can be attributed at all.
 *
 * Without a task identifier there is nothing to group a multi-call task by, and
 * a row keyed on the tenant alone duplicates what the existing daily meter
 * already records. So an unattributed call writes nothing here rather than
 * writing a row nobody can act on.
 */
export function isAttributable(attribution: TaskAttribution, tenantId: string | null | undefined): boolean {
  return Boolean(attribution.taskId) && Boolean(tenantId?.trim())
}
