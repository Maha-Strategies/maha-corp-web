# Restored GPU engines: A10G promotion baseline

Date: 2026-08-06

Modal run: `ap-Q5uc9UF2RRJb9iqMAZGC67`

Hardware: NVIDIA A10G, CUDA 12.4, Torch 2.5.1

Repetitions: 7 warm runs per bounded case

This evidence promotes two accurately bounded engines. It does not restore the
old mock workers or their fixed outputs.

## Tensor-network QUBO/Ising heuristic

Algorithm: `bounded-bond-transfer-contraction-torch-v1` with bond dimension
256. The solver contracts binary factors in variable order and truncates the
frontier after every step. All reported objectives were independently
recomputed from the returned assignments. Runs above the exact threshold are
heuristic and never claim a certified bound or optimality.

| Variables | Terms | p50 | p95 | Verified |
|---:|---:|---:|---:|:---:|
| 64 | 248 | 20.948 ms | 21.404 ms | 7/7 |
| 128 | 504 | 42.320 ms | 42.658 ms | 7/7 |
| 256 | 1,016 | 84.932 ms | 86.075 ms | 7/7 |

Reviewed promotion threshold: **p95 ≤ 150 ms** for the benchmarked 256-variable,
bond-dimension-256 envelope. This is warm solver latency, not HTTP or container
cold-start latency.

## SE(3) geometric registration

Algorithm: `weighted-kabsch-svd-torch-v1`. Synthetic paired point clouds were
generated from a known rigid transform. Every run independently compared the
recovered rotation and translation with the known transform and verified RMSE.

| Paired points | p50 | p95 | Transform verified |
|---:|---:|---:|:---:|
| 256 | 2.191 ms | 2.513 ms | 7/7 |
| 4,096 | 12.871 ms | 72.177 ms | 7/7 |
| 16,384 | 46.888 ms | 111.413 ms | 7/7 |

Reviewed promotion threshold: **p95 ≤ 200 ms** for the benchmarked 16,384-point
envelope. The contract assumes known point correspondences and rigid motion; it
does not claim correspondence search, learned geometry, or non-rigid fitting.
