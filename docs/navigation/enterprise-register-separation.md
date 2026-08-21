# Enterprise register separation — navigation inventory and migration note

**Date:** 2026-08-21 · **Scope:** global navigation only. No route, page, book, app, research paper or experimental surface was deleted, redirected or deindexed.

## Why

`mahastrategies.com` sells context control, evidence and governance. Its global
chrome also offered Doctrine, Protocols, the Timing Board, Celestial Reports,
the Overclock game, Books and Apps — so a platform owner evaluating a
five-figure evidence assessment was one click from an astrological operating
calendar. `POSITIONING-FIX.md` identifies the adjacency, not the material, as
the problem. This change moves the material out of the *menu*, and does nothing
else to it.

## Navigation surfaces inventoried

| Surface | File | Changed |
| --- | --- | --- |
| Root layout (mounts chrome) | `app/layout.tsx` | No |
| Desktop primary bar | `components/Navbar.tsx` | **Yes** |
| Desktop "Explore +" dropdown | `components/Navbar.tsx` | **Yes** |
| Mobile full-screen menu | `components/Navbar.tsx` | **Yes** — renders the same two lists |
| Footer, Developers column | `components/SiteFooter.tsx` | **Yes** |
| Footer, Explore column | `components/SiteFooter.tsx` | **Yes** |
| Homepage prominent cards and links | `app/page.tsx` | **Yes** |
| Enterprise entry pages | `app/{context-compiler,integrations/wso2,enterprise-mcp-gateway,evidence-audit,developers,case-studies,contact}` | No — none linked to Register C |
| Route aliases / redirects | `next.config.ts` | No |
| Sitemap | `app/sitemap.ts` | No — every route still listed |

Desktop and mobile previously duplicated two literal arrays. They now map the
same exported constants, so the two viewports cannot drift apart.

## Removed from global navigation

Menu entries only. Every route below still resolves and is still indexed.

| Entry | Route | Where it was |
| --- | --- | --- |
| Books | `/books` | Primary bar, mobile menu, homepage |
| Apps | `/apps` | Primary bar, mobile menu |
| Doctrine | `/doctrine` | Explore, mobile menu |
| Protocols | `/protocols` | Explore, mobile menu |
| Timing Board | `/operations/timing` | Explore, mobile menu |
| Celestial Reports | `/reports/celestial` | Explore, mobile menu |
| Overclock Game | `/overclock` | Explore, mobile menu, homepage |
| Personal Protocols | `/start` | Explore, mobile menu |
| Maha OS | `/software` | Explore, mobile menu |
| Research | `/research` | Explore, mobile menu, homepage |

Two judgement calls, both recorded because neither is named in the brief's list:

- **`/research`** is excluded because its own document title is
  *"Research & Doctrine"* and its description is *"custom silicon strategy,
  edge architecture, and biological sovereignty"* — it is the landing page
  `POSITIONING-FIX.md` Task 1 names explicitly. Its enterprise child
  `/research/mcp` (Cognitive Gateway) stays in the menu via an exact-path
  exception.
- **`/software`** (Maha OS) and **`/start`** (Personal Protocols) are consumer
  and personal surfaces adjacent to the prohibited Apps and Protocols
  sections.

## The enterprise navigation

Primary bar, ordered as a buyer moves — what it is, the evidence, the control
layer, how to build on it, who to talk to:

`/context-compiler` · `/integrations/wso2` · `/evidence-audit` ·
`/enterprise-mcp-gateway` · `/developers` · `/contact`

Six items, not seven. The bar shares one `max-w-6xl` line with the wordmark and
the Explore control, and product names run longer than the section names they
replaced — "Context Compiler" against "Books". A seven-item set measured about
922px against roughly 819px of room and would have wrapped. `Case Studies`
moved to Explore and remains in the footer;
`PRIMARY_NAVIGATION_CHARACTER_BUDGET` and a test now guard the limit.

Explore keeps everything commercially supportable today: Method, Case Studies, MPS Standard,
Live Auditor, MPS Preflight, API Documentation, Try Context Compiler, Context
Pack Evaluator, Cognitive Gateway, x402 Conformance Observatory, x402 Buyer
Policy, Maha Navigator, Tools & API, Intelligence, Knowledge, Insights, Policy,
About Maha.

**The orchestration control plane is deliberately absent.** It is pilot-grade by
its own documentation — no OIDC/SAML, one storage backend, no DR exercise — and
has no public page. Listing it would advertise something a buyer cannot yet
evaluate.

`/knowledge` stays. It is a research and discovery surface, not astrology; its
`/knowledge/astrology` subtree is Register C and is not linked from the chrome.

## Homepage

- The "Published work" grid led with five book cards and the Overclock game.
  It now shows the two public intelligence briefs. **No book or brief page was
  touched.**
- "All books ↗" became "Case studies ↗".
- The two-card row pointed at `/research` and at an external author-brand book
  brief. It now points at the WSO2 evaluation and MPS/0.1.

## Redirects: deliberately not implemented

`POSITIONING-FIX.md` Task 1 asks for 301s from `/doctrine` and `/research` to
`mayonemaharajan.com`, preceded by *"Content goes to mayonemaharajan.com"*.

That precondition is unmet. Checked 2026-08-21:

| Destination | Status |
| --- | --- |
| `https://mayonemaharajan.com/doctrine` | **404** |
| `https://www.themahaprinciple.com/doctrine` | **404** |
| `https://mayonemaharajan.com/research` | 200 (contents not verified as equivalent) |

Redirecting live pages to a 404 would delete the content from the web and
destroy the accrued authority the redirect exists to preserve — violating
`POSITIONING-FIX.md`'s own constraint 4, *"No 404s on paths that currently
exist."* The routes are therefore preserved unchanged.

**To finish Task 1 later:** publish the content at the destination, verify it
resolves, then add the 301s to `redirects()` in `next.config.ts` (note: `.ts`,
not the `.js` the work order names). Next.js issues 308 for
`permanent: true`, which is the method-preserving equivalent of a 301.

The single pre-existing redirect —
`/research/chronobiological-entrainment-endocrine-homeostasis` to the research
subdomain — is untouched.

## Outstanding from Task 1

- **Exactly one author-brand link.** Task 1 permits one, in the footer *or* an
  About-page bio. `app/about/page.tsx` already carries it with `rel="me"`, and
  the entity graph references that anchor, so it is the canonical one and this
  change adds none. `app/contact/page.tsx` also links to the author brand;
  consolidating that is a copy decision, not a navigation one, and is left
  open.
- **Register C vocabulary in surviving copy** (Task 1, final bullet) is a copy
  pass and is not attempted here.
- **Task 2's homepage hero rewrite** is a separate task in the work order.

## What is guaranteed, and how

`test/enterprise-register-separation.test.ts` asserts:

- no prohibited destination in any global navigation list;
- desktop and mobile render the same two vetted constants;
- neither chrome component hardcodes an internal route;
- the homepage and every enterprise entry page link to no Register C route;
- **no experimental route file was deleted**;
- **no Register C route gained a redirect, a `noindex`, or `index: false`**;
- the sitemap still lists doctrine, protocols and books for crawlers;
- prefix matching does not swallow lookalikes (`/startup-guide` is not `/start`);
- the primary bar stays inside its measured width budget;
- nothing dropped from the bar fell out of navigation entirely;
- the mobile menu keeps `aria-expanded`, `aria-controls`, `role="dialog"`,
  `aria-modal`, its labelled toggle, Escape-to-close and tap-to-close.
