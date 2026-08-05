# GPU QUBO/Ising reference engine promotion

## Current status

The reference engine is private and has no customer execution endpoint. It is a transparent parallel-replica
simulated-annealing heuristic implemented with Torch. It is not Tensor-Opt,
does not use tensor networks, and does not claim an optimal solution or a
certified bound for instances above the exact-enumeration threshold.

Do not add the engine to public docs, the public SDK, MCP discovery, or x402
until every promotion gate below has passed.

## Hardware evidence

Run the benchmark against the exact candidate commit on Modal A10G:

```bash
modal run workers/maha_workers.py \
  --commit "$(git rev-parse HEAD)" \
  --output qubo-benchmark-evidence.json
```

The benchmark refuses CPU execution, warms the CUDA runtime separately, runs
three deterministic sparse problem sizes at least seven times each, and
independently recomputes every returned objective. The evidence file is
ignored by Git because device and release evidence belongs in protected build
artifacts, not hand-edited application source.

Choose the production p95 budget before looking at the result, then run:

```bash
python3 scripts/verify-qubo-promotion.py \
  qubo-benchmark-evidence.json \
  --maximum-p95-ms 500
```

This is warm solver latency, not API end-to-end latency. Record Modal cold
start, Vercel dispatch, queue delay, callback, and polling latency separately.

The reviewed promotion budget is 500 ms warm p95 for every committed benchmark
case through 256 variables. This is an asynchronous optimization-engine budget;
it does not replace or reinterpret the separate Context Compression API SLA.

## Required gates

1. Unit and contract tests pass for QUBO and Ising objective semantics.
2. The hardware evidence validator passes for the candidate commit.
3. Staging E2E covers enqueue, Modal execution, signed callback, ledger charge,
   polling, tenant isolation, and failure refunds.
4. Staging load tests establish p50/p95/p99 end-to-end latency and error rate at
   the intended concurrency. The public SLA must use those measurements.
5. Security review covers bounded input size, callback authentication,
   admission control, denial-of-service cost, and customer-data retention.
6. The legacy private `tensor-opt` route is replaced by an accurately named,
   versioned QUBO/Ising route and contract.
7. Only after review: implement the production execution worker, expose the new
   route in OpenAPI and SDK, add MCP discovery,
   decide x402 eligibility, and enable the production flag.

Failure of any gate keeps the engine private and disabled.
