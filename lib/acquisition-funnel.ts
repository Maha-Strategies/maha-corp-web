// Assembles the acquisition-to-paid funnel from meters that already exist but
// have never been read together.
//
// The honest shape of this is cohort-level, and that is a consequence of a
// deliberate privacy decision rather than a shortcoming to be engineered away.
// Agent discovery is recorded as day x surface x client class with no visitor
// identifier, so there is no key that joins a discovery event to the credential
// that may later be created. Individual journey attribution would require
// retaining exactly the identifier the platform refuses to keep.
//
// So the stages below are counts over the same window, and the ratios between
// them are cohort ratios: how many discoveries happened, how many credentials
// appeared, how many were used, how many came back, how many paid. That is a
// weaker claim than a tracked funnel and it is the strongest claim the data
// supports. Reading a stage ratio as "this fraction of discoverers converted"
// would be wrong; the callers in each stage are not known to be the same
// callers.
//
// Stages that cannot be measured are reported as unavailable rather than zero.
// A zero says nobody did it; unavailable says nobody knows, and the two lead to
// opposite decisions.

export type FunnelWindow = { fromDay: string; toDay: string }

export type StageValue =
  | { available: true; count: number }
  /** No meter exists, or the meter could not be read. Never conflated with 0. */
  | { available: false; reason: string }

export type FunnelStages = {
  /** Machine discovery surfaces fetched: agent card and offers manifest. */
  discovery: StageValue
  /** Credentials created in the window. */
  credentialsCreated: StageValue
  /** Credentials that made at least one successful Context Compiler call. */
  activated: StageValue
  /** Credentials successful on two or more distinct days: the repeat signal. */
  repeated: StageValue
  /** Distinct payers that settled at least one x402 payment. */
  paidAutonomous: StageValue
  /** Successful compress calls served without any credential or payment. */
  anonymousSuccess: StageValue
  /**
   * Unpaid requests answered with a 402 challenge or a payment refusal.
   *
   * Recorded at the proxy boundary, because that is where they terminate: the
   * route handler never runs for them. This is the discovery denominator, and
   * without it a quiet endpoint and an unattractive one look identical.
   */
  challenges: StageValue
}

export type FunnelReport = {
  window: FunnelWindow
  stages: FunnelStages
  /** Adjacent-stage cohort ratios. Null where either side is unavailable. */
  ratios: {
    discoveryToCredential: number | null
    credentialToActivated: number | null
    activatedToRepeated: number | null
    /**
     * Settlements per challenge. Low means agents found the endpoint and
     * declined -- a price or description problem. No challenges at all means
     * they never found it -- a discovery problem. The two need opposite fixes.
     */
    challengeToSettlement: number | null
  }
  /** Stated on every report so the ratios are never read as journeys. */
  interpretation: string
}

type Ledger = {
  rpc?: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
  from: (table: string) => {
    select: (columns: string, options?: { count?: 'exact'; head?: boolean }) => {
      gte: (column: string, value: string) => {
        lte: (column: string, value: string) => PromiseLike<{ data: unknown; error: unknown; count?: number | null }>
      }
    }
  }
}

const unavailable = (reason: string): StageValue => ({ available: false, reason })

/** Null rather than a misleading 0/0 or a division by an unknown. */
function ratio(numerator: StageValue, denominator: StageValue): number | null {
  if (!numerator.available || !denominator.available) return null
  if (denominator.count === 0) return null
  return Number((numerator.count / denominator.count).toFixed(4))
}

async function rows(ledger: Ledger, table: string, columns: string, dayColumn: string, window: FunnelWindow): Promise<Record<string, unknown>[] | null> {
  try {
    const { data, error } = await ledger.from(table).select(columns).gte(dayColumn, window.fromDay).lte(dayColumn, window.toDay)
    if (error) return null
    return Array.isArray(data) ? data as Record<string, unknown>[] : []
  } catch {
    return null
  }
}

export async function buildAcquisitionFunnel(ledger: Ledger | null, window: FunnelWindow): Promise<FunnelReport> {
  const interpretation =
    'Cohort counts over one window, not tracked journeys. Agent discovery carries no visitor identifier '
    + 'by design, so no stage can be joined to the next at the level of an individual caller. Ratios '
    + 'compare populations, not conversions.'

  if (!ledger) {
    const none = unavailable('ledger_unavailable')
    return {
      window,
      stages: { discovery: none, credentialsCreated: none, activated: none, repeated: none, paidAutonomous: none, anonymousSuccess: none, challenges: none },
      ratios: { discoveryToCredential: null, credentialToActivated: null, activatedToRepeated: null, challengeToSettlement: null },
      interpretation,
    }
  }

  const discoveryRows = await rows(ledger, 'agent_discovery_usage_daily', 'request_count', 'usage_day', window)
  const usageRows = await rows(ledger, 'context_compiler_usage_daily', 'usage_day,access_mode,credential_id,status_class,request_count', 'usage_day', window)
  const paymentRows = await rows(ledger, 'x402_payments', 'payer', 'claimed_at', window)
  const credentialRows = await rows(ledger, 'agent_client_credentials', 'public_id', 'created_at', window)

  const discovery: StageValue = discoveryRows === null
    ? unavailable('discovery_meter_unreadable')
    : { available: true, count: discoveryRows.reduce((sum, row) => sum + Number(row.request_count ?? 0), 0) }

  const credentialsCreated: StageValue = credentialRows === null
    ? unavailable('credential_table_unreadable')
    : { available: true, count: credentialRows.length }

  let activated: StageValue = unavailable('compress_usage_meter_unreadable')
  let repeated: StageValue = unavailable('compress_usage_meter_unreadable')
  let anonymousSuccess: StageValue = unavailable('compress_usage_meter_unreadable')
  let challenges: StageValue = unavailable('compress_usage_meter_unreadable')

  if (usageRows !== null) {
    const successful = usageRows.filter((row) => row.status_class === '2xx')

    // Activation is a credential that got a successful call, not one that was
    // merely issued. A key created and never used is the failure this measures.
    const daysByCredential = new Map<string, Set<string>>()
    for (const row of successful) {
      const credential = String(row.credential_id ?? '')
      if (!credential) continue
      const set = daysByCredential.get(credential) ?? new Set<string>()
      set.add(String(row.usage_day))
      daysByCredential.set(credential, set)
    }

    activated = { available: true, count: daysByCredential.size }
    // Two distinct days, not two calls: a burst of calls in one sitting is one
    // evaluation, while returning the next day is the retention signal.
    repeated = { available: true, count: [...daysByCredential.values()].filter((days) => days.size >= 2).length }
    anonymousSuccess = {
      available: true,
      count: successful.filter((row) => row.access_mode === 'anonymous').reduce((sum, row) => sum + Number(row.request_count ?? 0), 0),
    }
    // Anonymous non-2xx on this path is definitionally a challenge or refusal:
    // the proxy answers every unauthenticated request before the route can
    // produce any other client error.
    challenges = {
      available: true,
      count: usageRows
        .filter((row) => row.access_mode === 'anonymous' && row.status_class !== '2xx')
        .reduce((sum, row) => sum + Number(row.request_count ?? 0), 0),
    }
  }

  const paidAutonomous: StageValue = paymentRows === null
    ? unavailable('payment_ledger_unreadable')
    : { available: true, count: new Set(paymentRows.map((row) => String(row.payer ?? '').toLowerCase())).size }

  return {
    window,
    stages: { discovery, credentialsCreated, activated, repeated, paidAutonomous, anonymousSuccess, challenges },
    ratios: {
      discoveryToCredential: ratio(credentialsCreated, discovery),
      credentialToActivated: ratio(activated, credentialsCreated),
      activatedToRepeated: ratio(repeated, activated),
      challengeToSettlement: ratio(paidAutonomous, challenges),
    },
    interpretation,
  }
}

/** The window ending today, inclusive, in UTC days. */
export function trailingWindow(days: number, now = new Date()): FunnelWindow {
  const toDay = new Date(now.getTime()).toISOString().slice(0, 10)
  const fromDay = new Date(now.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10)
  return { fromDay, toDay }
}
