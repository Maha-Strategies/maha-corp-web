# Agent discovery metering

Whether autonomous agents are finding this platform is the first question the
machine-economy thesis depends on, and until now nothing measured it. The
discovery documents were static files in `public/`, so requests for them never
reached the origin and were never counted. Paid usage cannot answer the question
either: an agent that never discovers the offers never becomes a customer.

## What is measured

Two surfaces, at their unchanged public URLs:

| Surface | URL |
| --- | --- |
| `agent_card` | `/.well-known/agent.json` |
| `agent_offers` | `/agent-offers.json` |

Each request is counted once against a **client class** — one of seven values,
derived from the request in memory and then discarded:

| Class | Meaning |
| --- | --- |
| `agent_runtime` | An AI agent framework or MCP client calling on its own behalf |
| `ai_crawler` | An AI vendor's indexing or training crawler |
| `search_crawler` | A conventional search engine crawler |
| `http_client` | A script or command-line tool |
| `browser` | A person looking at the document |
| `unspecified` | No user agent offered |
| `other` | Unrecognised |

The headline is **machine share**: the proportion of discovery traffic from
`agent_runtime`, `ai_crawler`, or `http_client` rather than a browser. A rising
`agent_runtime` count is the signal that matters most, because that is an agent
acting for itself rather than a crawler indexing a page.

## Privacy

The platform's standing rule is that no user agent, IP, or visitor identifier is
stored anywhere. Answering this question needs to know something about the
caller, so the resolution is to classify in memory and store only the class.

The table holds five columns — day, surface, client class, count, and last
observation time. Seven possible class values aggregated per day cannot identify
a visitor. The user agent string is read to compute the class and is never
returned, logged, or persisted; a test asserts the meter's payload contains no
fragment of it.

## Why these are routes now

A static file in `public/` is served without touching the origin, so it cannot
be counted. The two documents moved to `content/discovery/` and are served by
route handlers, with rewrites in `next.config.ts` preserving the canonical URLs.
Nothing about the documents themselves changed.

They are deliberately **not edge-cached**, and the header is `no-store` rather
than a zero `max-age`. That distinction matters: Vercel serves `public/` assets
with `public, max-age=0, must-revalidate`, and those responses still come back
`x-vercel-cache: HIT` with a non-zero `age`. A revalidation directive does not
keep a response off the edge, and an edge-cached discovery document is invisible
to measurement — which is the entire reason these are routes. Both documents are
small and low-traffic, so paying the origin cost is the price of the signal.

If either surface ever becomes hot enough for that to matter, sample rather than
cache: caching silently undercounts, whereas a known sampling rate can be
corrected for.

Metering is best-effort: a meter write failure is logged and the document still
serves. A discovery document failing because a counter could not be incremented
would be a far worse outcome than a missing data point.

## Reading the numbers

Apply `supabase/migrations/20260802000100_agent_discovery_metering.sql`, then
open `/admin/commercial-api-metering`, which reports discovery alongside paid
API usage. The discovery section degrades independently: if that migration has
not been applied, the section reports itself unavailable and the rest of the
board keeps working.

Interpret honestly. Crawler traffic is not demand — `ai_crawler` hits mean an AI
vendor is indexing the site, not that an agent wants to transact. `agent_runtime`
against `/agent-offers.json` is the closest thing to a real buying signal,
because that is something reading the commercial manifest deliberately. Zero
machine traffic after a reasonable window is itself a finding, and a more useful
one than building further on an untested assumption.

Classification is a heuristic over a self-reported header. An agent that sends no
user agent lands in `unspecified`, and a novel runtime lands in `other`; if
either grows large, extend the signatures in `lib/agent-discovery-metering.ts`
rather than guessing what they were.
