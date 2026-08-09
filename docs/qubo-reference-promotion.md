# GPU QUBO/Ising reference engine promotion

## Current status

**Beta, undiscoverable, and unpromoted.** The standalone reference engine is a
transparent parallel-replica simulated-annealing heuristic implemented with
Torch. It is not Tensor-Opt, does not use tensor networks, and does not claim an
optimal solution or a certified bound for instances above the exact-enumeration
threshold.

The evidence record, as of 9 August 2026:

- Candidate `9e5be53` **failed** the reviewed 500 ms warm-p95 promotion gate on
  Modal A10G. Measured warm p95 was 2,689.549 ms at 64 variables, 5,464.895 ms
  at 128, and 10,777.480 ms at 256 — between five and twenty-one times the
  budget. See [the baseline](benchmarks/qubo-reference-a10-baseline-2026-08-05.md).
- Commit `ccd3b74` subsequently vectorized the solver, which is the change that
  would plausibly close that gap. **No passing A10G evidence is retained for
  that candidate or any later standalone QUBO candidate.**
- The later passing A10G evidence in
  [the restored-engines baseline](benchmarks/restored-engines-a10g-baseline-2026-08-06.md)
  covers the separate tensor-network and geometric-registration engines. It does
  not retroactively promote this engine.
- The public route was added in `8c0fb94`, after the failure and without
  replacement evidence.

Because the vectorized candidate is unmeasured rather than known-bad, the
correction is fail-closed but reversible: `POST /api/v1/jobs/qubo-ising` still
answers for callers holding the URL, and is withheld from every discovery
surface — OpenAPI, the agent card, the offers manifest, and the LLM manifest —
so nothing advertises an engine whose latency and quality are unknown. The SDK
methods remain, marked beta. Withdrawing discovery is reversible; deleting a
live customer route is not, and the benchmark that settles the question has not
run.

Do not restore the engine to public docs, the public SDK contract, MCP
discovery, or x402 until the gates below pass.

## Why the previous gate was not sufficient

The 2026-08-05 gate measured warm latency alone. That gate cannot distinguish a
solver that got faster from one that got faster by searching less — and
vectorization is precisely a change to how much searching happens per unit time.
Re-running a latency-only benchmark on the vectorized candidate would therefore
answer the wrong question, and could promote an engine that returns worse
assignments quickly.

The v2 benchmark measures quality alongside timing, against two independent
references:

- **Exact enumeration** for cases at or below 20 variables, giving a true
  optimality gap rather than a comparison against another heuristic. The
  annealer's own exact threshold is forced to zero during the benchmark so the
  heuristic is always the thing under test.
- **The bounded-bond tensor-network engine**, which is already promoted on this
  hardware, run on the same problems. This settles differentiation: an engine
  beaten on quality in every case and beaten on latency in every case has no
  product reason to exist as a separate endpoint, however well it scores against
  a threshold in isolation.

Quality is reported from the worst seeded repeat, not the best. A caller gets
one seed, not the best of seven.

## Choosing the SLA before the run

The thresholds live in [`qubo-promotion-sla.json`](qubo-promotion-sla.json) and
the verifier reads them from that file rather than from the command line. The
file must be committed before the benchmark runs, so git history shows whether
the gate predates the evidence it judges. That is what makes "the SLA was chosen
honestly" checkable rather than asserted.

The proposed thresholds are 500 ms warm p95 — unchanged from the budget reviewed
before the failing baseline, so the goalposts do not move to fit the candidate —
and a worst-case relative optimality gap of 0.02. They require operator sign-off
before the run; the file records its own status.

## Hardware evidence

Run the v2 benchmark against the exact candidate commit on Modal A10G:

```bash
modal run workers/maha_workers.py --engine qubo-promotion --commit "$(git rev-parse HEAD)" --output qubo-benchmark-evidence.json
```

The benchmark refuses CPU execution, warms the CUDA runtime separately, runs
five deterministic sparse problem sizes at least seven times each, and
independently recomputes every returned objective before trusting it. The
evidence file is ignored by Git because device and release evidence belongs in
protected build artifacts, not hand-edited application source.

Then verify:

```bash
python3 scripts/verify-qubo-promotion-v2.py qubo-benchmark-evidence.json
```

This is warm solver latency, not API end-to-end latency. Record Modal cold
start, Vercel dispatch, queue delay, callback, and polling latency separately.
The budget is an asynchronous optimization-engine budget; it does not replace or
reinterpret the separate Context Compression API SLA.

The v1 latency-only validator and its entry point are retained for reading the
2026-08-05 baseline, which was recorded under that schema.

## Required gates

1. Unit and contract tests pass for QUBO and Ising objective semantics.
2. The v2 evidence validator passes for the candidate commit, against an SLA
   file committed before the run.
3. Staging E2E covers enqueue, Modal execution, signed callback, ledger charge,
   polling, tenant isolation, and failure refunds.
4. Staging load tests establish p50/p95/p99 end-to-end latency and error rate at
   the intended concurrency. The public SLA must use those measurements.
5. Security review covers bounded input size, callback authentication,
   admission control, denial-of-service cost, and customer-data retention.
6. Only after review: restore the route to OpenAPI, the SDK contract as
   non-beta, the agent card, the offers manifest, and the LLM manifest, then
   decide x402 eligibility.

Failure of any gate keeps the engine beta and undiscoverable. A failure on the
differentiation axis specifically means withdrawal rather than continued beta:
an engine the tensor-network solver beats everywhere should not be advertised at
all.
