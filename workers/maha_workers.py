"""Private Modal infrastructure for QUBO benchmarking and staging MCP tests.

There is deliberately no customer execution endpoint for the QUBO reference
solver. A correctly named, versioned contract is added only after promotion.
"""

import os
import time
import hmac
import json
from datetime import datetime, timezone
from typing import Dict, Any
import modal
from fastapi import Header, HTTPException

# Define Modal App & Image dependencies
APP_NAME = "maha-compute-workers"
app = modal.App(APP_NAME)

# Benchmark image contains only the CUDA/Torch runtime required by the solver.
# Keeping the staging FastAPI fixture separate avoids shipping web dependencies
# into the measured GPU container or old research packages into either image.
gpu_image = (
    modal.Image.from_registry("pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime")
    # Modal imports this module in each function image; the shared staging
    # endpoint annotations therefore require FastAPI at import time.
    .pip_install("fastapi==0.115.6")
    .add_local_python_source("workers.qubo_reference")
)
e2e_image = modal.Image.debian_slim(python_version="3.11").pip_install("fastapi==0.115.6")

maha_secrets = modal.Secret.from_name("maha-worker-secrets")

@app.function(gpu="A10G", image=gpu_image, timeout=1200)
def benchmark_qubo_reference(commit: str) -> Dict[str, Any]:
    """Generate private promotion evidence on real Modal GPU hardware."""
    import torch
    from workers.qubo_reference import benchmark_torch

    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    started = time.perf_counter()
    evidence = benchmark_torch(device)
    evidence["commit"] = commit
    evidence["generatedAt"] = datetime.now(timezone.utc).isoformat()
    evidence["benchmarkWallClockMs"] = round((time.perf_counter() - started) * 1_000, 3)
    return evidence


@app.local_entrypoint()
def benchmark(commit: str, output: str = "qubo-benchmark-evidence.json") -> None:
    """Run with: modal run workers/maha_workers.py --commit <git-sha>."""
    evidence = benchmark_qubo_reference.remote(commit)
    with open(output, "w", encoding="utf-8") as handle:
        json.dump(evidence, handle, indent=2, sort_keys=True)
        handle.write("\n")
    print(f"Wrote private benchmark evidence to {output}")


# Dedicated staging-only JSON-RPC upstream for the protected-preview smoke
# test. It runs in Modal, not in the Vercel preview being tested, and requires
# a separate bearer token so it cannot become an open echo service.
@app.function(image=e2e_image, secrets=[maha_secrets])
@modal.fastapi_endpoint(method="POST")
def e2e_mcp_upstream(request_data: Dict[str, Any], authorization: str = Header(default=None)):
    expected_token = os.environ.get("MAHA_E2E_MCP_TOKEN", "")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split("Bearer ", 1)[1].strip()
    if not expected_token or not hmac.compare_digest(token, expected_token):
        raise HTTPException(status_code=403, detail="Forbidden")

    request_id = request_data.get("id")
    method = request_data.get("method")
    if request_data.get("jsonrpc") != "2.0" or not isinstance(method, str) or not method:
        return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32600, "message": "Invalid JSON-RPC 2.0 request"}}

    if method == "test/timeout":
        time.sleep(2)
        return {"jsonrpc": "2.0", "id": request_id, "result": {"authenticated": True, "method": method}}

    if method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "tools": [{
                    "name": "calculateRiskScore",
                    "description": "Returns a deterministic authenticated E2E risk-score fixture.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "portfolioId": {"type": "string"},
                            "alpha": {"type": "number"},
                        },
                        "required": ["portfolioId"],
                        "additionalProperties": False,
                    },
                }]
            },
        }

    # Return only deterministic, non-sensitive request metadata. In
    # particular, never echo Authorization or any upstream credential.
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "result": {
            "authenticated": True,
            "method": method,
            "params": request_data.get("params", {}),
        },
    }
