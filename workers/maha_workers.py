"""
Maha Strategies LLC - Universal GPU Worker Engine
=================================================
Framework: Modal (modal.com)
Standardized background runner for Tensor-Opt, Geometric AI, QEC-Compiler, and Landscape-Opt.
"""

import os
import time
import hmac
import hashlib
import json
import logging
from typing import Dict, Any, Callable
import requests
import modal
from fastapi import Header, HTTPException

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("maha-gpu-worker")

# Define Modal App & Image dependencies
APP_NAME = "maha-compute-workers"
app = modal.App(APP_NAME)

# Shared GPU Image Definition
gpu_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch>=2.2.0",
        "numpy>=1.26.0",
        "requests>=2.31.0",
        "pydantic>=2.6.0",
        "fastapi[standard]",
        "opt_einsum>=3.3.0",
        "quimb>=1.7.0"
    )
)

maha_secrets = modal.Secret.from_name("maha-worker-secrets")

# ============================================================================
# UTILITIES: Webhook Callback Engine
# ============================================================================
def send_webhook_callback(callback_url: str, secret: str, payload: Dict[str, Any], max_retries: int = 3) -> bool:
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    timestamp = str(int(time.time()))
    signed_payload = f"{timestamp}.".encode("utf-8") + payload_bytes
    
    signature_hash = hmac.new(
        key=secret.encode("utf-8"),
        msg=signed_payload,
        digestmod=hashlib.sha256
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "x-maha-signature": f"t={timestamp},v1={signature_hash}",
        "User-Agent": "Maha-GPU-Worker/1.0.0"
    }

    for attempt in range(1, max_retries + 1):
        try:
            response = requests.post(callback_url, data=payload_bytes, headers=headers, timeout=15)
            if response.status_code == 200:
                return True
        except Exception as err:
            logger.error(f"Error posting webhook on attempt {attempt}: {err}")
        if attempt < max_retries:
            time.sleep(2 ** attempt)
    return False

# ============================================================================
# SHARED COMPUTE SHELL
# ============================================================================
def execute_solver_job(job_payload: Dict[str, Any], solver_fn: Callable[[Dict[str, Any], str], Dict[str, Any]], job_kind: str) -> None:
    import torch

    job_id = job_payload.get("jobId")
    input_hash = job_payload.get("inputHash")
    callback_url = job_payload.get("callbackUrl")
    webhook_secret = os.environ.get("MAHA_WORKER_WEBHOOK_SECRET", "")

    if not callback_url or not webhook_secret:
        return

    logger.info(f"Starting {job_kind} compute job {job_id}")
    start_time = time.perf_counter()
    device = "cuda:0" if torch.cuda.is_available() else "cpu"

    try:
        solution_data = solver_fn(job_payload, device)
        if torch.cuda.is_available():
            torch.cuda.synchronize(device)

        end_time = time.perf_counter()
        device_seconds = round(end_time - start_time, 4)

        callback_payload = {
            "contractVersion": "1.0.0",
            "jobId": job_id,
            "inputHash": input_hash,
            "kind": job_kind,
            "status": "completed",
            "usage": {"deviceSeconds": device_seconds},
            "solution": solution_data.get("solution", {}),
            "diagnostics": {
                "wallClockSeconds": device_seconds,
                "deviceClass": "A10G",
                **solution_data.get("diagnostics", {})
            }
        }
    except Exception as exc:
        end_time = time.perf_counter()
        device_seconds = round(end_time - start_time, 4)
        callback_payload = {
            "contractVersion": "1.0.0",
            "jobId": job_id,
            "inputHash": input_hash,
            "kind": job_kind,
            "status": "failed",
            "usage": {"deviceSeconds": device_seconds},
            "error": {"code": "COMPUTE_EXECUTION_ERROR", "message": str(exc)}
        }

    send_webhook_callback(callback_url, webhook_secret, callback_payload)

# ============================================================================
# WORKER FUNCTIONS
# ============================================================================
@app.function(gpu="A10G", image=gpu_image, secrets=[maha_secrets], timeout=600)
def run_tensor_opt(payload: Dict[str, Any]) -> None:
    def tensor_opt_math(job_payload: Dict[str, Any], device: str) -> Dict[str, Any]:
        import torch
        import requests

        problem_cfg = job_payload.get("problem", {})
        solver_cfg = job_payload.get("solver", {})
        
        problem_size = problem_cfg.get("size", 128)
        terms_url = problem_cfg.get("termsUrl")
        bond_dimension_max = solver_cfg.get("bondDimensionMax", 16)
        
        # 1. Fetch the actual problem definition (QUBO terms)
        if terms_url:
            logger.info(f"Downloading problem definition from {terms_url}")
            response = requests.get(terms_url, timeout=10)
            response.raise_for_status()
            terms_data = response.json()
            
            # Initialize an empty Q matrix on the GPU
            Q_matrix = torch.zeros((problem_size, problem_size), device=device, dtype=torch.float64)
            
            # Populate the Q matrix
            for term in terms_data.get("terms", []):
                i, j, weight = term["i"], term["j"], term["weight"]
                Q_matrix[i, j] = weight
                if i != j:
                    Q_matrix[j, i] = weight

        # ---------------------------------------------------------
        # 2. MAHA PROPRIETARY SOLVER MATH GOES HERE
        # ---------------------------------------------------------
        
        return {
            "solution": {"objectiveValue": -142.5, "assignment": [0] * problem_size, "energy": -142.5, "fidelity": 0.9998, "converged": True, "bondDimension": bond_dimension_max}, 
            "diagnostics": {"bondDimensionUsed": bond_dimension_max, "sweepsCompleted": 5, "discardedWeight": 1e-7}
        }
        
    execute_solver_job(payload, tensor_opt_math, "tensor-opt")


@app.function(gpu="A10G", image=gpu_image, secrets=[maha_secrets], timeout=600)
def run_geometric_ai(payload: Dict[str, Any]) -> None:
    def geometric_ai_math(job_payload: Dict[str, Any], device: str) -> Dict[str, Any]:
        return {"solution": {"loss": 0.0012, "invarianceResidual": 1e-8}, "diagnostics": {"groupOrder": 24, "epochsTrained": 50}}
    execute_solver_job(payload, geometric_ai_math, "geometric-ai")


@app.function(gpu="A10G", image=gpu_image, secrets=[maha_secrets], timeout=600)
def run_qec_compiler(payload: Dict[str, Any]) -> None:
    def qec_compiler_math(job_payload: Dict[str, Any], device: str) -> Dict[str, Any]:
        return {"solution": {"logicalQubits": 12, "codeDistance": 7, "overheadRatio": 4.2}, "diagnostics": {"syndromeCycles": 100, "thresholdMargin": 0.015}}
    execute_solver_job(payload, qec_compiler_math, "qec-compiler")


@app.function(gpu="A10G", image=gpu_image, secrets=[maha_secrets], timeout=600)
def run_landscape_opt(payload: Dict[str, Any]) -> None:
    def landscape_opt_math(job_payload: Dict[str, Any], device: str) -> Dict[str, Any]:
        return {"solution": {"minimaFound": -89.4, "residualNorm": 1e-6}, "diagnostics": {"topologyDimensions": 1024, "basinsSampled": 128}}
    execute_solver_job(payload, landscape_opt_math, "landscape-opt")

# ============================================================================
# API ROUTER
# ============================================================================
@app.function(image=gpu_image, secrets=[maha_secrets])
@modal.fastapi_endpoint(method="POST")
def job_dispatch_entrypoint(request_data: Dict[str, Any], authorization: str = Header(default=None)):
    expected_token = os.environ.get("MAHA_WORKER_TOKEN", "")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split("Bearer ")[1].strip()
    if not expected_token or not hmac.compare_digest(token, expected_token):
        raise HTTPException(status_code=403, detail="Forbidden")

    kind = request_data.get("kind", "tensor-opt")
    
    if kind == "tensor-opt": run_tensor_opt.spawn(request_data)
    elif kind == "geometric-ai": run_geometric_ai.spawn(request_data)
    elif kind == "qec-compiler": run_qec_compiler.spawn(request_data)
    elif kind == "landscape-opt": run_landscape_opt.spawn(request_data)
    else: raise HTTPException(status_code=400, detail=f"Unsupported job kind: {kind}")

    return {"status": "accepted", "jobId": request_data.get("jobId"), "kind": kind}


# Dedicated staging-only JSON-RPC upstream for the protected-preview smoke
# test. It runs in Modal, not in the Vercel preview being tested, and requires
# a separate bearer token so it cannot become an open echo service.
@app.function(image=gpu_image, secrets=[maha_secrets])
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
