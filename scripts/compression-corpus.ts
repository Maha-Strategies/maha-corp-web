// Payloads for the compression measurement harness.
//
// Two things make a corpus honest here, and both are easy to get wrong.
//
// First, shape. `/compress` splits on blank lines and scores each passage by
// how many task keywords it contains, so anything that changes paragraph
// structure changes the result. Prose with long unbroken paragraphs, a SQL
// dump with one row per line, and a scraped page full of two-word nav items
// are three genuinely different problems, and a corpus of only one of them
// produces a number that means nothing about the others.
//
// Second, ground truth. Reduction percentage is not a quality measure -- the
// caller sets the budget, so it can be driven to any value by asking for a
// smaller pack. What actually matters is whether the passages carrying the
// answer survive. Every document below therefore marks which passages a
// correct answer depends on, so retention can be measured rather than assumed.
//
// The needles are planted, but the surrounding text is written to the shape of
// the real thing. Where a number here is invented it is invented plausibly;
// none of it should be quoted as a finding about real customer traffic. See
// the note in scripts/measure-compression.ts about replacing this with logs.

export type CorpusDocument = { id: string; title?: string; text: string }

export type Corpus = {
  name: string
  /** What the caller is asking, which is what passages are scored against. */
  task: string
  description: string
  documents: CorpusDocument[]
  /**
   * Passage text fragments a correct answer depends on. Retention is measured
   * by whether the compiled pack still contains them.
   */
  needles: string[]
}

const paragraphs = (...items: string[]) => items.join('\n\n')

// ---------------------------------------------------------------------------
// 1. Multi-turn agent execution log
// ---------------------------------------------------------------------------

function agentTurn(n: number, thought: string, tool: string, args: string, observation: string) {
  return paragraphs(
    `[turn ${n}] assistant: ${thought}`,
    `[turn ${n}] tool_call: ${tool}(${args})`,
    `[turn ${n}] observation: ${observation}`,
  )
}

const AGENT_LOG: Corpus = {
  name: 'multi-turn-agent-log',
  task: 'Why did the nightly inventory reconciliation job fail and which warehouse is affected?',
  description: 'A 40-turn agent trace with tool calls, retries and verbose observations. The failure cause appears twice; most turns are navigational.',
  documents: [{
    id: 'agent-trace',
    title: 'Agent execution trace — incident triage',
    text: paragraphs(
      ...Array.from({ length: 60 }, (_, index) => agentTurn(
        index + 1,
        'I should check the next service in the dependency chain before drawing a conclusion.',
        'get_service_health',
        `{"service":"svc-${index + 11}","window":"24h"}`,
        `status=healthy checks_passed=14 checks_failed=0 p99_latency_ms=${120 + index * 3} error_rate=0.00 last_deploy=2026-07-2${index % 9}T0${index % 6}:00:00Z region=us-east-1 replicas=6 cpu_pct=${30 + index} mem_pct=${40 + index} disk_pct=${20 + index} open_conns=${100 + index * 4} queue_depth=${index} gc_pause_ms=${2 + (index % 5)} thread_count=${48 + index} heap_mb=${900 + index * 11} uptime_s=${86400 + index * 97} version=4.${index % 7}.${index % 3} build=ci-${20000 + index} healthcheck_url=/healthz probe_interval_s=10 last_incident=none sli_availability=99.9${index % 9} sli_latency=99.8${index % 9} error_budget_remaining_pct=${70 + (index % 25)}`,
      )),
      // Needle 1 — the actual cause.
      agentTurn(19,
        'The dependency chain is clean, so the failure is likely in the job itself rather than upstream.',
        'get_job_logs',
        '{"job":"nightly-inventory-reconciliation","date":"2026-08-03"}',
        'FATAL: reconciliation aborted after 4 retries. Cause: warehouse WH-7 returned a stock ledger with 312 rows whose location_id is null, violating the not-null constraint on the staging table. No other warehouse reported null location_id.'),
      ...Array.from({ length: 40 }, (_, index) => agentTurn(
        index + 20,
        'Checking whether the same pattern appears elsewhere.',
        'query_warehouse_status',
        `{"warehouse":"WH-${index + 10}"}`,
        `warehouse=WH-${index + 10} rows_submitted=${4000 + index * 37} null_location_ids=0 last_sync=2026-08-03T23:5${index % 9}:00Z status=ok schema_version=4.2.1 ingest_lag_s=${index} sku_count=${2000 + index * 13} bin_count=${450 + index} cycle_count_pending=${index * 2} last_audit=2026-07-1${index % 9} adjustments_30d=${index * 3} shrinkage_pct=0.${index % 9}${index % 7} carrier=${['ups','fedex','dhl'][index % 3]} dock_doors=${8 + (index % 6)} shift_pattern=3x8 wms_version=6.1.${index % 5}`,
      )),
      // Needle 2 — corroboration, phrased differently.
      agentTurn(34,
        'Confirming WH-7 specifically.',
        'query_warehouse_status',
        '{"warehouse":"WH-7"}',
        'warehouse=WH-7 rows_submitted=3981 null_location_ids=312 last_sync=2026-08-03T23:47:00Z status=degraded schema_version=3.9.0 ingest_lag_s=1840 note=warehouse still on schema 3.9.0, which does not enforce location_id on outbound stock ledger rows'),
      ...Array.from({ length: 20 }, (_, index) => agentTurn(
        index + 35,
        'Gathering context for the write-up.',
        'get_oncall_roster',
        `{"team":"fulfilment","shift":${index}}`,
        `primary=engineer-${index + 1} secondary=engineer-${index + 7} escalation=manager-2 pager=configured timezone=UTC`,
      )),
    ),
  }],
  needles: [
    'warehouse WH-7 returned a stock ledger with 312 rows whose location_id is null',
    'warehouse still on schema 3.9.0, which does not enforce location_id',
  ],
}

// ---------------------------------------------------------------------------
// 2. Scraped web page
// ---------------------------------------------------------------------------

const NAV_NOISE = [
  'Home', 'Products', 'Solutions', 'Pricing', 'Docs', 'Blog', 'About', 'Careers', 'Contact',
  'Sign in', 'Start free trial', 'Book a demo', 'Cookie preferences', 'Accept all cookies',
  'Privacy Policy', 'Terms of Service', 'Do not sell my information', 'Back to top',
  'Share on X', 'Share on LinkedIn', 'Copy link', 'Subscribe to our newsletter',
]

const WEB_SCRAPE: Corpus = {
  name: 'web-scrape',
  task: 'What is the maximum request body size and the rate limit for the batch endpoint?',
  description: 'A scraped documentation page: short navigational fragments, boilerplate, and two paragraphs that carry the answer.',
  documents: [{
    id: 'scraped-docs',
    title: 'api.example.com/docs/batch (scraped)',
    text: paragraphs(
      ...NAV_NOISE,
      'This site uses cookies to enhance your browsing experience, serve personalised content, and analyse our traffic. By clicking "Accept all", you consent to our use of cookies.',
      ...NAV_NOISE.slice(0, 12),
      'The batch endpoint accepts multiple operations in a single request, reducing round trips for bulk workloads. It is available on all paid plans.',
      // Needle 1
      'Request bodies for the batch endpoint are limited to 10 MiB. Requests exceeding this return 413 Payload Too Large. Individual operations within a batch are additionally limited to 256 KiB each.',
      'Batch responses preserve the order of submitted operations. Partial failures are reported per operation rather than failing the whole batch.',
      ...NAV_NOISE.slice(4, 18),
      // Needle 2
      'The batch endpoint is rate limited to 60 requests per minute per API key, independent of the per-operation limits applied to the underlying resources. Exceeding it returns 429 with a Retry-After header.',
      'See also: the streaming endpoint, the webhooks guide, and the SDK reference.',
      ...Array.from({ length: 24 }, (_, index) =>
        `Section ${index + 1}. The platform provides a consistent interface across all resource types, with predictable pagination, idempotency semantics and error envelopes. Requests are authenticated with a bearer token issued from the dashboard and scoped to a single project. Responses are JSON encoded with UTF-8 and include a request identifier in the X-Request-Id header, which should be quoted when contacting support. Clients are expected to retry idempotent operations on 5xx responses using exponential backoff with jitter, and to respect the Retry-After header where present. Pagination is cursor based; offset pagination is deprecated and will be removed in the next major version. Timestamps are RFC 3339 in UTC. Monetary amounts are integer minor units with an explicit currency code. Field names are lowerCamelCase and unknown fields should be ignored rather than rejected, so that additive changes remain backward compatible.`),
      ...NAV_NOISE,
      'Copyright 2026 Example Inc. All rights reserved. Example and the Example logo are trademarks of Example Inc. registered in the US and other countries.',
    ),
  }],
  needles: [
    'limited to 10 MiB',
    'rate limited to 60 requests per minute per API key',
  ],
}

// ---------------------------------------------------------------------------
// 3. SQL result dump
// ---------------------------------------------------------------------------

const SQL_DUMP: Corpus = {
  name: 'sql-dump',
  task: 'Which region had negative gross margin in Q2 and what was the margin?',
  description: 'A wide query result. Every row is structurally identical, so keyword scoring has almost nothing to separate them.',
  documents: [{
    id: 'query-result',
    title: 'SELECT * FROM regional_pnl WHERE quarter = 2026Q2',
    text: paragraphs(
      'region | revenue_usd | cogs_usd | opex_usd | gross_margin_pct | headcount | quarter',
      '-------|-------------|----------|----------|------------------|-----------|--------',
      ...Array.from({ length: 140 }, (_, index) =>
        `region-${String(index + 1).padStart(2, '0')} | ${(1_200_000 + index * 31_000).toLocaleString()} | ${(700_000 + index * 12_000).toLocaleString()} | ${(300_000 + index * 5_000).toLocaleString()} | ${(18 + (index % 11)).toFixed(1)} | ${40 + index} | 2026Q2`),
      // Needle — the one anomalous row.
      'region-emea-south | 840,000 | 910,000 | 220,000 | -8.3 | 61 | 2026Q2   <-- negative gross margin, only region below zero this quarter',
      ...Array.from({ length: 90 }, (_, index) =>
        `region-${String(index + 41).padStart(2, '0')} | ${(1_500_000 + index * 22_000).toLocaleString()} | ${(800_000 + index * 9_000).toLocaleString()} | ${(310_000 + index * 4_000).toLocaleString()} | ${(21 + (index % 9)).toFixed(1)} | ${52 + index} | 2026Q2`),
      '(66 rows)',
    ),
  }],
  needles: ['region-emea-south', '-8.3'],
}

// ---------------------------------------------------------------------------
// 4. Deep RAG retrieval
// ---------------------------------------------------------------------------

function ragChunk(n: number, source: string, score: number, body: string) {
  return paragraphs(
    `--- chunk ${n} | source=${source} | score=${score.toFixed(4)} | embedding_model=text-embed-3-large | chunk_size=512 | overlap=64 ---`,
    body,
  )
}

const RAG_RETRIEVAL: Corpus = {
  name: 'rag-retrieval',
  task: 'What is the notice period for terminating the master services agreement for convenience?',
  description: 'Twenty retrieved chunks with metadata headers. Retrieval scored the right chunk fourth, so the answer is present but not first.',
  documents: [{
    id: 'retrieval',
    title: 'Vector retrieval — top 20 chunks',
    text: paragraphs(
      ragChunk(1, 'msa_v4.pdf', 0.8821, 'This Master Services Agreement is entered into by and between the parties as of the Effective Date. Capitalised terms have the meanings given in Section 1. This Agreement supersedes all prior understandings relating to its subject matter.'),
      ragChunk(2, 'msa_v4.pdf', 0.8790, 'Each party represents that it has full corporate power and authority to enter into this Agreement and that its execution has been duly authorised by all necessary corporate action.'),
      ragChunk(3, 'sow_2026_03.pdf', 0.8744, 'The Statement of Work describes the services, deliverables, acceptance criteria and fees. In the event of conflict between this SOW and the Agreement, the Agreement governs except as to the specific deliverables described here.'),
      // Needle.
      ragChunk(4, 'msa_v4.pdf', 0.8702, 'Termination for Convenience. Either party may terminate this Agreement, in whole or in part, for its convenience upon ninety (90) days prior written notice to the other party. Fees for services rendered through the effective date of termination remain payable.'),
      ...Array.from({ length: 22 }, (_, index) => ragChunk(index + 5, index % 2 ? 'msa_v4.pdf' : 'policy_handbook.pdf', 0.86 - index * 0.004,
        'Neither party shall be liable for any indirect, incidental, special, consequential or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, arising from the use of the services, regardless of the theory of liability and even if advised of the possibility of such damages. Each party shall maintain, at its own expense, commercial general liability insurance with limits not less than those customary in the industry, and shall provide certificates of insurance upon reasonable request. The provisions of this section shall survive termination or expiration of this Agreement. Nothing in this section limits liability for fraud, wilful misconduct, or any liability that cannot be excluded under applicable law. The parties agree that the limitations set out here are a reasonable allocation of risk having regard to the fees payable, and that each party has had the opportunity to obtain independent legal advice on their effect.')),
    ),
  }],
  needles: ['ninety (90) days prior written notice'],
}

export const CORPORA: Corpus[] = [AGENT_LOG, WEB_SCRAPE, SQL_DUMP, RAG_RETRIEVAL]

/** Loads real payloads from a directory instead, when one is supplied. */
export async function loadCorporaFrom(directory: string): Promise<Corpus[]> {
  const { readdir, readFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const files = (await readdir(directory)).filter((name) => name.endsWith('.json'))
  return Promise.all(files.map(async (name) => JSON.parse(await readFile(join(directory, name), 'utf8')) as Corpus))
}
