"""Private Modal infrastructure for QUBO benchmarking and staging MCP tests.

There is deliberately no customer execution endpoint for the QUBO reference
solver. A correctly named, versioned contract is added only after promotion.
"""

import os
import time
import hmac
import json
import re
from datetime import datetime, timezone
from typing import Dict, Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen
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
    .add_local_python_source("workers.tensor_network")
    .add_local_python_source("workers.geometric_registration")
)
e2e_image = modal.Image.debian_slim(python_version="3.11").pip_install("fastapi==0.115.6")

maha_secrets = modal.Secret.from_name("maha-worker-secrets")


def _valid_worker_token(provided: str) -> bool:
    """Accept isolated Production and Preview dispatch credentials."""
    expected_tokens = [
        value for value in (
            os.environ.get("MAHA_WORKER_TOKEN", ""),
            os.environ.get("MAHA_WORKER_PREVIEW_TOKEN", ""),
        ) if value
    ]
    matches = [hmac.compare_digest(provided, expected) for expected in expected_tokens]
    return bool(matches) and any(matches)


def _post_signed_callback(callback_url: str, payload: Dict[str, Any]) -> None:
    parsed = urlparse(callback_url)
    hostname = parsed.hostname or ""
    allowed = parsed.scheme == "https" and (
        hostname in {"www.mahastrategies.com", "mahastrategies.com"} or hostname.endswith(".vercel.app")
    )
    if not allowed:
        raise RuntimeError("callback URL is outside the Maha deployment boundary")
    secret = os.environ.get("MAHA_WORKER_WEBHOOK_SECRET", "")
    if not secret:
        raise RuntimeError("worker callback signing is not configured")
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    timestamp = str(int(time.time()))
    signature = hmac.new(secret.encode("utf-8"), f"{timestamp}.".encode("utf-8") + body, "sha256").hexdigest()
    headers = {"Content-Type": "application/json", "X-Maha-Signature": f"t={timestamp},v1={signature}"}
    bypass = os.environ.get("VERCEL_AUTOMATION_BYPASS_SECRET")
    if bypass:
        headers["x-vercel-protection-bypass"] = bypass
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urlopen(Request(callback_url, data=body, headers=headers, method="POST"), timeout=20) as response:
                if 200 <= response.status < 300:
                    return
                raise RuntimeError(f"callback returned HTTP {response.status}")
        except Exception as error:
            last_error = error
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"callback delivery failed: {last_error}")


def _execute_gpu_job(handoff: Dict[str, Any], expected_kind: str, solve) -> None:
    import torch

    if handoff.get("contractVersion") not in {"2.0.0", "3.0.0"} or handoff.get("kind") != expected_kind:
        raise RuntimeError(f"unsupported {expected_kind} worker contract")
    if handoff.get("contractVersion") == "2.0.0" and expected_kind != "qubo-ising":
        raise RuntimeError("contract v2 is limited to QUBO/Ising")
    job_id = handoff.get("jobId")
    input_hash = handoff.get("inputHash")
    if not isinstance(job_id, str) or not re.fullmatch(r"job_[a-f0-9]{32}", job_id):
        raise RuntimeError("invalid job id")
    if not isinstance(input_hash, str) or not re.fullmatch(r"[a-f0-9]{64}", input_hash):
        raise RuntimeError("invalid input hash")

    started = time.perf_counter()
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    try:
        result = solve(handoff.get("problem", {}), handoff.get("solver", {}), device)
        if torch.cuda.is_available():
            torch.cuda.synchronize(device)
        elapsed = time.perf_counter() - started
        diagnostics = result.get("diagnostics", {})
        payload = {
            "contractVersion": handoff["contractVersion"], "kind": expected_kind,
            "jobId": job_id, "inputHash": input_hash, "status": "completed",
            "solution": result["solution"],
            "diagnostics": {**diagnostics, "wallClockSeconds": elapsed, "deviceClass": torch.cuda.get_device_name(device) if torch.cuda.is_available() else "cpu"},
            "error": None, "usage": {"deviceSeconds": elapsed},
        }
    except Exception as error:
        elapsed = time.perf_counter() - started
        payload = {
            "contractVersion": handoff["contractVersion"], "kind": expected_kind,
            "jobId": job_id, "inputHash": input_hash, "status": "failed",
            "solution": None, "diagnostics": None,
            "error": {"code": "compute_execution_error", "message": str(error)[:500]},
            "usage": {"deviceSeconds": elapsed},
        }
    _post_signed_callback(str(handoff.get("callbackUrl", "")), payload)


@app.function(gpu="A10G", image=gpu_image, secrets=[maha_secrets], timeout=600)
def run_qubo_ising(handoff: Dict[str, Any]) -> None:
    """Execute contract v2 without logging or persisting customer coefficients."""
    from workers.qubo_reference import solve_torch
    _execute_gpu_job(handoff, "qubo-ising", solve_torch)


@app.function(gpu="A10G", image=gpu_image, secrets=[maha_secrets], timeout=600)
def run_tensor_network(handoff: Dict[str, Any]) -> None:
    from workers.tensor_network import solve_transfer_torch
    _execute_gpu_job(handoff, "tensor-network", solve_transfer_torch)


@app.function(gpu="A10G", image=gpu_image, secrets=[maha_secrets], timeout=600)
def run_geometric_registration(handoff: Dict[str, Any]) -> None:
    from workers.geometric_registration import solve_kabsch_torch
    _execute_gpu_job(handoff, "geometric-registration", solve_kabsch_torch)


@app.function(image=e2e_image, secrets=[maha_secrets])
@modal.fastapi_endpoint(method="POST")
def qubo_ising_dispatch(request_data: Dict[str, Any], authorization: str = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split("Bearer ", 1)[1].strip()
    if not _valid_worker_token(token):
        raise HTTPException(status_code=403, detail="Forbidden")
    version = request_data.get("contractVersion")
    kind = request_data.get("kind")
    if version not in {"2.0.0", "3.0.0"} or kind not in {"qubo-ising", "tensor-network", "geometric-registration"}:
        raise HTTPException(status_code=400, detail="Unsupported worker contract")
    if version == "2.0.0" and kind != "qubo-ising":
        raise HTTPException(status_code=400, detail="Contract v2 is limited to QUBO/Ising")
    if kind == "qubo-ising":
        run_qubo_ising.spawn(request_data)
    elif kind == "tensor-network":
        run_tensor_network.spawn(request_data)
    else:
        run_geometric_registration.spawn(request_data)
    return {"status": "accepted", "jobId": request_data.get("jobId"), "kind": kind}

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
    # Modal pickles return values. A TorchVersion instance would otherwise make
    # the local client require Torch merely to receive JSON-shaped evidence.
    return json.loads(json.dumps(evidence))


@app.function(gpu="A10G", image=gpu_image, timeout=1200)
def benchmark_restored_engines(commit: str) -> Dict[str, Any]:
    import torch
    from workers.tensor_network import benchmark_tensor_network
    from workers.geometric_registration import benchmark_geometric_registration

    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    started = time.perf_counter()
    evidence = {
        "schema": "maha.restored-engines-benchmark.v1",
        "commit": commit,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "tensorNetwork": benchmark_tensor_network(device),
        "geometricRegistration": benchmark_geometric_registration(device),
    }
    evidence["benchmarkWallClockMs"] = round((time.perf_counter() - started) * 1_000, 3)
    return json.loads(json.dumps(evidence))


@app.local_entrypoint()
def benchmark(commit: str, output: str = "qubo-benchmark-evidence.json", engine: str = "qubo") -> None:
    """Run with: modal run workers/maha_workers.py --commit <git-sha>."""
    if engine not in {"qubo", "restored"}:
        raise ValueError("engine must be qubo or restored")
    evidence = benchmark_qubo_reference.remote(commit) if engine == "qubo" else benchmark_restored_engines.remote(commit)
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
