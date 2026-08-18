# maha-sdk

Zero-dependency Python client for the [Maha Strategies](https://www.mahastrategies.com)
API, with native tool adapters for LangChain and CrewAI.

```bash
pip install maha-sdk
```

## Client

```python
from maha_sdk import MahaClient

client = MahaClient(api_key="maha_live_sk_...")

client.balance()
client.compress(task="brief the board", documents=[{"id": "d1", "text": "..."}], token_budget=4000)
client.verify_claim("chronobiological-entrainment")
client.call_mcp_tool("mcp_srv_...", "tools/call", {"name": "calculateRiskScore", "arguments": {"portfolioId": "pf_1"}})

report = client.create_celestial_report({
    "apiVersion": "maha-celestial-api/1",
    "clientRequestId": "birth_case_001",
    "reportType": "individual-birth",
    "interpretationPack": {"packId": "facts-only", "version": "1.0.0"},
    "dataPolicy": {
        "saveReport": False,
        "retentionDays": 0,
        "consent": {
            "policyVersion": "celestial-consent/1",
            "basis": "explicit-subject-consent",
            "capturedAtUtc": "2026-08-17T10:00:00Z",
            "consentReferenceSha256": "sha256:<digest>",
        },
    },
    "input": {
        "date": "1992-11-30", "time": "20:09", "timeZone": "America/Chicago",
        "latitudeDegrees": 48.601, "longitudeDegrees": -93.411,
    },
})
```

Errors are typed, so an agent can act on them rather than parse strings:

```python
from maha_sdk import MahaAuthenticationError, MahaCreditError

try:
    client.compress(...)
except MahaCreditError as error:
    print(f"Out of credits. Top up at {error.purchase_url}")
except MahaAuthenticationError:
    print("The API key is invalid or revoked.")
```

## LangChain

```bash
pip install 'maha-sdk[langchain]'
```

```python
from langgraph.prebuilt import create_react_agent
from maha_sdk import MahaClient
from maha_sdk.langchain import MahaToolkit

tools = MahaToolkit(MahaClient(api_key="maha_live_sk_...")).get_tools()
agent = create_react_agent(llm, tools)
```

## CrewAI

```bash
pip install 'maha-sdk[crewai]'
```

```python
from crewai import Agent
from maha_sdk import MahaClient
from maha_sdk.crewai import maha_tools

researcher = Agent(
    role="Researcher",
    goal="Ground every claim in a cited source",
    tools=maha_tools(MahaClient(api_key="maha_live_sk_...")),
)
```

## Tools

| Tool | Purpose |
| --- | --- |
| `maha_compress_context` | Compile documents into a context pack that fits a token budget |
| `maha_verify_claim` | Resolve a published claim, its evidence status, and its sources |
| `maha_credit_balance` | Remaining API credits for the configured key |

`maha_verify_claim` returns the claim's status alongside its summary, and says
plainly when a record is not evidence-backed. The status label is material:
`VERIFIED` and `SOURCED` identify evidence status, while `ILLUSTRATIVE` and
`UNVERIFIED` must not be treated as established fact. An agent that cannot see
the label will present the latter as though it were the former.

## Design notes

**No runtime dependencies.** This installs into agent environments that already
pin their own HTTP stack, so it must not force a resolution against it, and it
cannot carry a transitive vulnerability into someone else's agent. Framework
packages are optional extras.

**Payment is never autonomous.** A depleted key raises `MahaCreditError` with a
purchase URL. Buying credits requires a human to authorize the payment; no
method here can charge anyone.
