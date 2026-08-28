# Maha Computational Provenance Witness

`maha-witness` creates tamper-evident receipts for explicitly declared
scientific computations. It is local-first, dependency-free, and offline by
default.

It records execution identity, bounded environment metadata, random seeds,
configuration, and hashes of named input/code/output artifacts. It deliberately
does not capture function arguments, environment variables, file paths, file
contents, or credentials. Docker, SLURM, and Qiskit adapters normalize supplied
metadata; they do not run external commands or contact services.

```python
from maha_witness import ArtifactSpec, witness

@witness(
    job_id="thermal-run-001",
    input_artifacts=[ArtifactSpec("mesh", "mesh.json", "input", "application/json")],
    output_artifacts=[ArtifactSpec("temperatures", "out.json", "output", "application/json")],
    random_seeds={"solver": 7},
    configuration={"solver": "fixed-point-v1"},
)
def run():
    # scientific workload
    ...

run()
receipt = run.last_receipt
```

Verify without a network or Maha account:

```bash
maha-witness verify receipt.json
```

Registry submission is a separate explicit library call. It accepts only HTTPS,
validates before sending, and receives its bearer token from the caller rather
than reading or storing credentials. Phase 2 submission also requires a caller
idempotency key and an explicit 1-3650 day payload-retention period. The
immutable digest ledger survives payload deletion; the receipt snapshot does
not.

## Epistemic boundary

A valid receipt establishes integrity of the recorded metadata and artifacts.
It does not establish that the workload was scientifically correct, that the
environment description was complete, that an output was independently
reproduced, or that a result is safe or fit for a regulated purpose. Those
properties remain separate fields and default to false.
