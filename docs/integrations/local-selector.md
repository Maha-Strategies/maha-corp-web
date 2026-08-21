# Local context selector

Run Maha's deterministic context selection inside your own process, so source
text never reaches Maha-hosted infrastructure through Maha code.

**Evaluation-grade.** This is a reference runtime and a versioned contract, not
a production deployment claim. What is proven is listed at the end, and so is
what is not.

## What it is

`lib/local-selector/` wraps the shared Context Compiler in a narrow contract.
It is not a second selector: a parity test asserts the local runtime produces
the byte-identical pack the shared compiler produces on the frozen fixture. If
they ever diverge, the test fails rather than the behaviour drifting.

```ts
import { selectLocally } from './lib/local-selector/index.ts'

const result = selectLocally({
  contractVersion: '1.0.0',
  task: 'Report the rollback threshold and the retention period.',
  tokenBudget: 512,
  documents: [{ id: 'runbook', title: 'Runbook', text: '...' }],
  requiredEvidence: [{ evidenceId: 'bravo', sourceId: 'runbook', text: 'Rollback begins after 2 consecutive failures.' }],
})
```

You get retained passages with **half-open byte offsets into the normalized
source**, reason codes, per-source hashes, the budget result, measured
retention of your labelled spans, and the privacy boundary.

The offsets are the point. A reviewer can slice the original document at
`[sourceStartByte, sourceEndByte)` and confirm the passage came from where it
claims — without trusting the selector.

## Evaluate it locally

```bash
npm run verify:local-selector        # 14 tests, no network, no credentials
npm run probe:local-selector-wasm    # feasibility boundary, builds nothing
```

## Privacy boundary, stated narrowly

"Runs locally" is often heard as "is private". Only the first clause is
something this code can be responsible for.

**What the runtime establishes:**

- Source text does not leave the caller's process **through Maha code**.
- No network call, no telemetry, no model inference, no payment, **no cloud
  fallback** — there is no hosted path to fall back to.
- Hashes and metadata leave only if the caller exports them.

A test replaces `fetch`, `XMLHttpRequest`, `WebSocket` and `navigator` with
traps that throw on read or call, then runs a full selection. The claim is
enforced, not asserted.

**What it does not claim**, and cannot:

- Privacy of your endpoint, process, or storage.
- Browser, operating system, or device privacy properties.
- Absence of analytics added by the application embedding this.
- Behaviour of any third-party library loaded alongside it.
- That derived hashes and metrics are non-identifying for every corpus.

That last one matters more than it looks. A per-source SHA-256 is not source
text, but on a small or well-known corpus it can still confirm a guess. Treat
exported metadata as data about your documents.

## Minimum-size bypass

Below 1,024 estimated tokens the original is forwarded whole and
`bypass.applied` is `true`. Selection framing on a short document costs more
tokens than it removes, and a bypass a caller can see beats a saving that is
not one.

## Determinism

Identical input plus identical `policyVersion` produces identical output —
tested by comparing two full runs field by field, excluding only `packId`,
which is a fresh identifier by design. Pin `policyVersion` if you need to
detect a selection change across upgrades.

## WASM: interface now, artifact not yet

**No `.wasm` is committed, and a test asserts none is.** A placeholder artifact
would imply a port that has not happened.

What ships instead is the interface that makes a port possible. The runtime
needs exactly four things from a host, all injectable through
`LocalSelectorHost`: `sha256Hex`, `randomId`, `utf8ByteLength`, and
Unicode-aware regex. A test runs the full selector on a host with **no
`node:crypto` and no `Buffer`** and asserts byte-identical offsets, so the seam
is proven rather than described.

`npm run probe:local-selector-wasm` reports the boundary. Today it finds two
kinds of blocker:

| Blocker | Why it matters |
| --- | --- |
| No toolchain installed (rust/cargo/wasm-pack, emscripten, tinygo, assemblyscript, javy) | A build cannot be produced or smoke-tested here at all. |
| **25 Unicode property escapes** in the selection path | A WASM target without ICU-class regex will tokenize CJK, Cyrillic and Arabic differently and **silently select different passages**. This is a correctness problem, not a build problem, and it would not surface as a failure. |

The second is the one to plan around. A port is not "compile it and ship"; it
needs a regex strategy and a parity run across scripts before anyone trusts it.

### Prospective embedding

For a browser or edge target, the shape is: supply `sha256Hex` from WebCrypto
(which is async, so the entry point would need an async variant),
`utf8ByteLength` from `TextEncoder`, `randomId` from `crypto.getRandomValues` —
the `portableHost` helper already does the latter two — and resolve the regex
question above.

### Browser and edge caveats

- WebCrypto's digest is async; today's synchronous entry point would need an
  async sibling. That is an interface change, not a detail.
- Worker CPU limits apply to selection on large payloads; the payload caps that
  make sense on a server are not the ones that make sense on an edge runtime.
- A browser tab is a shared environment. Nothing here prevents the page that
  loads it from reading the same data.

## Status

**Implemented and locally verified.** The contract, the Node runtime, offsets,
reason codes, duplicate handling, hard budget, minimum-size bypass, measured
evidence retention, determinism, no-network behaviour, host portability, and
parity with the shared compiler. 14 tests, sanitized fixtures, no credentials.

**Intentionally deferred.** A production WASM build, and an async entry point
for WebCrypto hosts.

**Still needs customer-environment validation.** Behaviour and performance in a
real browser, edge runtime or air-gapped deployment; corpus-specific tuning of
the minimum-size threshold; and whether exported metadata is acceptable under
the customer's own data policy. None of that is knowable from this repository.
