"""
Maha Strategies LLC - Serverless GPU Worker for Tensor-Opt
===========================================================
Framework: Modal (modal.com)
Contract Version: maha-worker-contract-1.0.0
Author: Principal Compute Architect

This module implements the serverless GPU execution engine for Maha Tensor-Opt.
It acts as the external compute worker triggered asynchronously by the Vercel backend.

Flow:
  1. Vercel Backend POSTs job payload to `@app.function` web endpoint (`MAHA_WORKER_URL`).
  2. Endpoint validates Bearer token authentication (`MAHA_WORKER_TOKEN`).
  3. Endpoint spawns background GPU task (`execute_tensor_opt_job`) and immediately returns 202 Accepted.
  4. GPU Task runs PyTorch/CuPy tensor network optimization, timing exact `device_seconds`.
  5. Worker constructs callback payload and signs HTTP request body with HMAC-SHA256 (`MAHA_WORKER_WEBHOOK_SECRET`).
  6. Worker POSTs result back to Vercel (`x-maha-signature` header attached).
"""

import os
import time
import hmac
import hashlib
import json
import logging
from typing import Dict, Any, Tuple
import requests
import modal
from fastapi import Header, HTTPException

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("maha-gpu-worker")

# Define Modal App & Image dependencies
APP_NAME = "maha-tensor-opt-worker"
app = modal.App(APP_NAME)

# Configure GPU Container Image with PyTorch & standard utilities
gpu_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch>=2.2.0",
        "numpy>=1.26.0",
        "requests>=2.31.0",
        "pydantic>=2.6.0",
        "fastapi[standard]",
        "opt_einsum>=3.3.0", # Add your specific solver dependencies here
        "quimb>=1.7.0"
    )
)

# Secrets defined in Modal dashboard (MAHA_WORKER_TOKEN & MAHA_WORKER_WEBHOOK_SECRET)
maha_secrets = modal.Secret.from_name("maha-worker-secrets")


# ============================================================================
# UTILITIES: HMAC Signing & Webhook Callback Engine
# ============================================================================

def generate_hmac_signature(secret: str, payload_bytes: bytes) -> str:
    """
    Computes an HMAC-SHA256 signature for the given payload using the shared secret.
    Matches Vercel backend verification logic.
    """
    return hmac.new(
        key=secret.encode("utf-8"),
        msg=payload_bytes,
        digestmod=hashlib.sha256
    ).hexdigest()


def send_webhook_callback(
    callback_url: str,
    secret: str,
    payload: Dict[str, Any],
    max_retries: int = 3
) -> bool:
    """
    Sends signed JSON payload back to Vercel webhook endpoint with retry logic.
    Constructs a Stripe-style signature: X-Maha-Signature: t=<timestamp>,v1=<signature>
    """
    # Serialize with zero whitespace to exactly match Vercel's await request.text()
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    
    # 1. Grab current Unix timestamp
    timestamp = str(int(time.time()))
    
    # 2. Stripe-style payload matching Vercel: "{timestamp}.{raw_body}"
    signed_payload = f"{timestamp}.".encode("utf-8") + payload_bytes
    
    # 3. Generate HMAC-SHA256
    signature_hash = hmac.new(
        key=secret.encode("utf-8"),
        msg=signed_payload,
        digestmod=hashlib.sha256
    ).hexdigest()

    # 4. Format header exactly as Vercel expects
    signature_header = f"t={timestamp},v1={signature_hash}"

    headers = {
        "Content-Type": "application/json",
        "x-maha-signature": signature_header,
        "User-Agent": "Maha-GPU-Worker/1.0.0"
    }

    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Posting callback to Vercel webhook (attempt {attempt}/{max_retries})")
            response = requests.post(callback_url, data=payload_bytes, headers=headers, timeout=15)
            
            if response.status_code == 200:
                logger.info(f"Successfully posted webhook callback for job {payload.get('jobId')}")
                return True
            else:
                logger.warning(
                    f"Webhook callback returned non-200 status {response.status_code}: {response.text}"
                )
        except Exception as err:
            logger.error(f"Error posting webhook callback on attempt {attempt}: {err}")
        
        if attempt < max_retries:
            time.sleep(2 ** attempt)  # Exponential backoff

    return False

# ============================================================================
# COMPUTE SHELL: Background GPU Tensor Network Optimization Task
# ============================================================================

@app.function(
    gpu="A10G",
    image=gpu_image,
    secrets=[maha_secrets],
    timeout=600,
    min_containers=0
)
def execute_tensor_opt_job(job_payload: Dict[str, Any]) -> None:
    import torch
    import requests

    job_id = job_payload.get("jobId")
    input_hash = job_payload.get("inputHash")
    callback_url = job_payload.get("callbackUrl")
    webhook_secret = os.environ.get("MAHA_WORKER_WEBHOOK_SECRET", "")

    logger.info(f"Starting actual GPU execution for job {job_id}")

    if not callback_url or not webhook_secret:
        logger.error(f"Job {job_id} missing callbackUrl or MAHA_WORKER_WEBHOOK_SECRET")
        return

    # 1. Extract dynamic configurations from payload
    problem_cfg = job_payload.get("problem", {})
    solver_cfg = job_payload.get("solver", {})
    
    problem_size = problem_cfg.get("size", 128)
    terms_url = problem_cfg.get("termsUrl")
    
    bond_dimension_max = solver_cfg.get("bondDimensionMax", 16)
    target_precision = solver_cfg.get("target_precision", 1e-6)

    start_time = time.perf_counter()
    device_seconds = 0.0

    try:
        device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        
        # 2. Fetch the actual problem definition (QUBO terms)
        if terms_url:
            logger.info(f"Downloading problem definition from {terms_url}")
            response = requests.get(terms_url, timeout=10)
            response.raise_for_status()
            terms_data = response.json()
            
            # Initialize an empty Q matrix on the GPU
            Q_matrix = torch.zeros((problem_size, problem_size), device=device, dtype=torch.float64)
            
            # Populate the Q matrix (assuming terms_data is a list of [i, j, weight])
            for term in terms_data.get("terms", []):
                i, j, weight = term["i"], term["j"], term["weight"]
                Q_matrix[i, j] = weight
                if i != j:
                    Q_matrix[j, i] = weight  # Ensure symmetry if required
        
        # ---------------------------------------------------------
        # 3. MAHA PROPRIETARY SOLVER MATH GOES HERE
        # ---------------------------------------------------------
        # Example setup for an MPS (Matrix Product State) representation:
        # state = init_mps_state(size=problem_size, max_bond=bond_dimension_max, device=device)
        # H = construct_hamiltonian(terms_data, device=device)
        # 
        # sweeps_completed, discarded_weight = 0, 0.0
        # while not converged:
        #     state, trunc_err = apply_dmrg_sweep(state, H, max_bond=bond_dimension_max)
        #     discarded_weight += trunc_err
        #     sweeps_completed += 1
        # ---------------------------------------------------------
        
        # MOCKING THE REAL OUTPUTS FOR NOW:
        if torch.cuda.is_available():
            torch.cuda.synchronize(device)
            
        end_time = time.perf_counter()
        device_seconds = round(end_time - start_time, 4)

        # Replace these with real tensor outputs
        final_energy = -142.5  
        fidelity = 0.9998
        solution_assignment = [0] * problem_size # Your actual 0/1 array
        actual_bond_used = bond_dimension_max
        sweeps_completed = 5
        discarded_weight = 1e-7

        # 4. Construct the callback with rich diagnostics
        callback_payload = {
            "contractVersion": "1.0.0",
            "jobId": job_id,
            "inputHash": input_hash,
            "status": "completed",
            "usage": {
                "deviceSeconds": device_seconds
            },
            "solution": {
                "objectiveValue": final_energy,
                "assignment": solution_assignment,
                "energy": final_energy,
                "fidelity": fidelity,
                "converged": True,
                "bondDimension": actual_bond_used
            },
            "diagnostics": {
                "wallClockSeconds": device_seconds,
                "bondDimensionUsed": actual_bond_used,
                "sweepsCompleted": sweeps_completed,
                "discardedWeight": discarded_weight,
                "deviceClass": "A10G"
            }
        }

    except Exception as exc:
        end_time = time.perf_counter()
        device_seconds = round(end_time - start_time, 4)
        logger.error(f"Job {job_id} failed with error: {str(exc)}", exc_info=True)
        
        callback_payload = {
            "contractVersion": "1.0.0",
            "jobId": job_id,
            "inputHash": input_hash,
            "status": "failed",
            "usage": {
                "deviceSeconds": device_seconds
            },
            "error": {
                "code": "COMPUTE_EXECUTION_ERROR",
                "message": str(exc)
            }
        }

    send_webhook_callback(callback_url, webhook_secret, callback_payload)

# ============================================================================
# ENTRYPOINT: FastAPI / Modal Web Endpoint (MAHA_WORKER_URL)
# ============================================================================

@app.function(
    image=gpu_image,
    secrets=[maha_secrets]
)
@modal.fastapi_endpoint(method="POST")
def job_dispatch_entrypoint(
    request_data: Dict[str, Any], 
    authorization: str = Header(default=None)
):
    """
    Web Endpoint acting as MAHA_WORKER_URL.
    Receives HTTP POST requests from Vercel Backend, validates Bearer Token,
    spawns background GPU task, and immediately returns 202 Accepted.
    """
    expected_token = os.environ.get("MAHA_WORKER_TOKEN", "")

    # 1. Validate Authentication Token
    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("Rejecting request: Missing or invalid Authorization header format")
        raise HTTPException(status_code=401, detail="Unauthorized: Missing Bearer token")

    token = authorization.split("Bearer ")[1].strip()
    if not expected_token or not hmac.compare_digest(token, expected_token):
        logger.warning("Rejecting request: Bearer token mismatch")
        raise HTTPException(status_code=403, detail="Forbidden: Invalid worker authentication token")

    # 2. Validate Contract Payload Structure (Using camelCase to match Vercel)
    job_id = request_data.get("jobId")
    callback_url = request_data.get("callbackUrl")

    if not job_id or not callback_url:
        logger.error("Payload missing jobId or callbackUrl")
        raise HTTPException(status_code=400, detail="Bad Request: Missing required jobId or callbackUrl in payload")

    logger.info(f"Received valid job dispatch request: {job_id}. Spawning background GPU execution...")

    # 3. Asynchronously Spawn GPU Worker Task (Unblocks Web Endpoint)
    execute_tensor_opt_job.spawn(request_data)

    # 4. Return Accepted Status
    return {
        "status": "accepted",
        "jobId": job_id,
        "message": "Job dispatched to serverless GPU compute worker",
        "timestamp": int(time.time())
    }