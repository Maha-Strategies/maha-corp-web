# QUBO reference baseline — NVIDIA A10 — 2026-08-05

Candidate `9e5be53` was run on Modal's requested A10G class. The runtime reported
an NVIDIA A10 with 23,684,841,472 bytes of device memory, Torch 2.5.1+cu124 and
CUDA 12.4. The benchmark used 64 replicas, 64 sweeps and seven warm repetitions
per deterministic sparse QUBO case.

| Variables | Terms | Warm p50 | Warm p95 | Objective checks |
| ---: | ---: | ---: | ---: | --- |
| 64 | 245 | 2,596.249 ms | 2,689.549 ms | 7/7 passed |
| 128 | 501 | 5,401.094 ms | 5,464.895 ms | 7/7 passed |
| 256 | 1,013 | 10,125.171 ms | 10,777.480 ms | 7/7 passed |

Total benchmark wall time was 147,205.037 ms. No heuristic result claimed
optimality. The baseline fails the reviewed 500 ms warm-p95 promotion budget
and must not be exposed as a production API. Profiling identified the Python
per-variable update loop and repeated small CUDA kernel launches as the primary
architectural problem; the next candidate replaces it with accurately labelled
parallel-update annealing.

The raw JSON artifact is intentionally excluded from Git and retained with the
Modal run evidence for candidate `9e5be53`.
