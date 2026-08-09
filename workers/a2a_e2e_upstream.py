"""Controlled, token-gated A2A v0.3 compatibility fixture for staging E2E."""

import base64
import hashlib
import hmac
import json
import os
import uuid

import modal
from fastapi import FastAPI, Header, HTTPException, Request, Response

app = modal.App("maha-a2a-e2e-upstream")
image = modal.Image.debian_slim(python_version="3.11").pip_install("fastapi==0.115.6")
secrets = modal.Secret.from_name("maha-a2a-e2e-secrets")
web = FastAPI()

USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
PAYEE = "0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28"


def _authorized(authorization: str | None) -> None:
    expected = os.environ.get("MAHA_E2E_A2A_TOKEN", "")
    supplied = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not expected or not hmac.compare_digest(expected, supplied):
        raise HTTPException(status_code=401, detail="Unauthorized")


@web.get("/.well-known/agent-card.json")
async def agent_card(request: Request):
    origin = str(request.base_url).rstrip("/")
    return {
        "name": "Maha governed compatibility fixture",
        "description": "A deterministic A2A v0.3 agent used to prove proxy compatibility without modifying the upstream.",
        "url": f"{origin}/a2a",
        "protocolVersion": "0.3.0",
        "version": "1.0.0",
        "capabilities": {"streaming": False, "pushNotifications": False},
        "defaultInputModes": ["text/plain"],
        "defaultOutputModes": ["text/plain"],
        "skills": [{
            "id": "governance.echo",
            "name": "Governed echo",
            "description": "Returns a deterministic task after Maha task-policy admission.",
            "tags": ["compatibility", "governance"],
            "examples": ["Confirm this task passed policy."],
        }],
    }


def _message_text(params: dict) -> str:
    message = params.get("message", {})
    parts = message.get("parts", []) if isinstance(message, dict) else []
    return " ".join(part.get("text", "") for part in parts if isinstance(part, dict))


def _challenge(resource: str, amount: str) -> tuple[dict, str]:
    body = {
        "x402Version": 2,
        "resource": {"url": resource, "description": "Controlled A2A compatibility payment fixture", "mimeType": "application/json"},
        "accepts": [{"scheme": "exact", "network": "eip155:8453", "amount": amount, "payTo": PAYEE, "maxTimeoutSeconds": 60, "asset": USDC, "extra": {"name": "USD Coin", "version": "2"}}],
        "error": "Payment required for the controlled A2A fixture.",
    }
    encoded = base64.b64encode(json.dumps(body, separators=(",", ":")).encode()).decode()
    return body, encoded


@web.post("/a2a")
async def a2a_rpc(
    request: Request,
    response: Response,
    authorization: str | None = Header(default=None),
    payment_signature: str | None = Header(default=None, alias="PAYMENT-SIGNATURE"),
):
    _authorized(authorization)
    payload = await request.json()
    request_id = payload.get("id")
    method = payload.get("method")
    if payload.get("jsonrpc") != "2.0" or method not in {"message/send", "tasks/get", "tasks/cancel"}:
        return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32601, "message": "Unsupported A2A method"}}
    if method == "message/send":
        text = _message_text(payload.get("params", {}))
        if text.startswith("paid:") or text.startswith("expensive:"):
            amount = "1000" if text.startswith("paid:") else "1000000"
            if not payment_signature:
                body, encoded = _challenge(str(request.url), amount)
                response.status_code = 402
                response.headers["PAYMENT-REQUIRED"] = encoded
                return body
            try:
                payment = json.loads(base64.b64decode(payment_signature).decode())
                accepted = payment["accepted"]
                payer = payment["payload"]["authorization"]["from"]
                if accepted["amount"] != amount or accepted["network"] != "eip155:8453":
                    raise ValueError("payment terms differ")
            except (KeyError, TypeError, ValueError, json.JSONDecodeError):
                raise HTTPException(status_code=402, detail="Invalid controlled payment fixture")
            transaction = "0x" + hashlib.sha256(payment_signature.encode()).hexdigest()
            receipt = {"success": True, "transaction": transaction, "network": "eip155:8453", "payer": payer}
            response.headers["PAYMENT-RESPONSE"] = base64.b64encode(json.dumps(receipt, separators=(",", ":")).encode()).decode()
        message = payload.get("params", {}).get("message", {})
        task_seed = message.get("contextId") or message.get("messageId") or uuid.uuid4().hex
        task_id = f"task_{hashlib.sha256(task_seed.encode()).hexdigest()[:32]}"
        return {
            "jsonrpc": "2.0", "id": request_id,
            "result": {"id": task_id, "contextId": f"ctx_{uuid.uuid4().hex}", "status": {"state": "completed"}, "artifacts": [{"artifactId": f"artifact_{uuid.uuid4().hex}", "parts": [{"kind": "text", "text": text}]}]},
        }
    return {"jsonrpc": "2.0", "id": request_id, "result": {"id": payload.get("params", {}).get("id"), "status": {"state": "completed"}}}


@app.function(image=image, secrets=[secrets])
@modal.asgi_app()
def endpoint():
    return web
