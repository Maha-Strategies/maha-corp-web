# Maha design system — inventory and conversion status

Measured against `origin/main` at `c70c91d` on 23 August 2026. Counts are
generated from the tree, not estimated.

## 1. The system as it exists

There is no component library. The design system is **global CSS in
`app/globals.css`** (277 lines) plus a theme selector in `lib/site-theme.ts`.
A page is "converted" when its markup uses the `.evidence-*` vocabulary; it is
not converted merely by avoiding inline styles.

### Global shell

| Piece | Where | Notes |
| --- | --- | --- |
| Root layout | `app/layout.tsx` | Loads Geist Sans, Geist Mono, Newsreader; wraps `.site-body` |
| Theme selector | `lib/site-theme.ts` | `siteThemeForPath()` → `paper` everywhere except `/admin`, `/dashboard`, `/operations`, which get `operator` |
| Navigation | `components/Navbar.tsx` | 9 primary links + an "Explore" submenu of 20+; themed via `.site-chrome[data-theme]` |
| Footer | `components/SiteFooter.tsx` | Same chrome tokens |

### Tokens

| Group | Tokens |
| --- | --- |
| Surface | `--surface-paper` `#eef1ec`, `--surface-raised` `#fbfcfa`, `--surface-subtle` `#e2e7df` |
| Text | `--text-primary` `#1a2420`, `--text-secondary` `#3a453f`, `--text-muted` `#5a6660` |
| Border | `--border-default` `#c8cec6`, `--border-subtle` `#dde2db` |
| Status | `--status-verified` `#237a55`, `--status-sourced` `#2d63b8`, `--status-boundary` `#a06f14`, `--status-illustrative` `#6e56a8`, `--status-unverified` `#b3402e` |
| Operator | `--operator-surface` `#0a0a0c`, `--operator-raised`, `--operator-text`, `--operator-muted`, `--operator-border` |
| Measure | `--measure-copy` `42.5rem`, `--measure-product` `55rem`, `--measure-shell` `72rem` |

### Typography

Three faces, each with one job. Newsreader (serif) carries titles and ledes;
Geist Sans carries body copy; Geist Mono carries kickers, labels and CTA text.

| Class | Role |
| --- | --- |
| `.evidence-kicker` | Mono, 11px, `0.16em` tracking, uppercase — eyebrow and label |
| `.evidence-title` / `--product` | Newsreader, `clamp(2.75rem, 7vw, 5.5rem)`, weight 500 |
| `.evidence-section-title` | Newsreader, `clamp(2rem, 4vw, 3.25rem)` |
| `.evidence-lede` | Newsreader, `clamp(1.25rem, 2.5vw, 1.6rem)`, max 48rem |
| `.evidence-copy` | Geist Sans, 1rem/1.75, max `--measure-copy` |

### Layout, cards, CTAs

| Class | Role |
| --- | --- |
| `.evidence-page` | Full-height paper ground; sets `::selection` |
| `.evidence-container` / `--narrow` | `min(100% - 2.5rem, 72rem)` / 55rem, generous vertical rhythm |
| `.evidence-section` | Top rule + `clamp(4.5rem, 9vw, 7rem)` separation — the primary spacing device |
| `.evidence-card` (+ `-title`, `-copy`) | 1px border, 2px radius, raised surface, border darkens on hover |
| `.evidence-inset` | 3px `--status-sourced` left rule — emphasis block |
| `.evidence-action` (+ `--primary`/`--secondary`) | Mono uppercase, 2.75rem min height |
| `.evidence-link` | Underline offset `0.3em`, border-coloured until hover |
| `.evidence-code` | Inverted: dark ground, light text |

Spacing is Tailwind utilities on top of these (`mt-3/4/5/7/9`), not bespoke CSS.
Motion is limited to 150ms border/background transitions, with a global
`prefers-reduced-motion` override.

### Cyber-light editorial overlay

`/books/**` is the accepted pilot for a bounded technical overlay on Evidence
Paper. Its frozen route markers, colors, accents, invariants, and three-template
acceptance set are recorded in
[`cyber-light-vocabulary-v1.md`](./cyber-light-vocabulary-v1.md). Cyber-light is
route-scoped; it is not a new global theme and does not apply to Knowledge,
Intelligence, or operator surfaces.

### Gaps in the system

Two primitives are missing and are currently re-invented inline per page:

1. **Tables.** No table class exists. Eight routes render `<table>`, each with
   its own styling. Any page with a table cannot be converted without one.
2. **Status chips.** `--status-*` tokens exist with no component; the homepage
   hand-rolls a chip inline.

Both are added in the first conversion batch rather than duplicated again.

### Forms

No form primitive in the paper system. The only form styling is
`.navigator-label` / `.navigator-input`, which is dark-theme and specific to
`/navigator`. Forms are deferred until a batch actually needs one.

## 2. Route inventory

209 page routes.

| Status | Count | Meaning |
| --- | --- | --- |
| Converted | 8 | Six or more `.evidence-*` usages; on-system |
| Partial | 20 | One to five usages; started or borrowing a class |
| Remaining | 142 | No `.evidence-*` usage |
| Excluded | 39 | `/knowledge/**` and `/intelligence/**`, out of scope by instruction |

26 of the remaining routes sit under `/admin`, `/dashboard`, or `/operations`
and resolve to the `operator` theme. They are a separate visual track and
should not be folded into the paper conversion.

### Converted (the reference set)

| Route | `.evidence-*` uses |
| --- | --- |
| `/` | 74 |
| `/benchmarks/context-retention` | 68 |
| `/integrations/wso2` | 59 |
| `/developers` | 48 |
| `/context-compiler` | 37 |
| `/context-pack-evaluator` | 31 |
| `/mcp-bridge` | 29 |
| `/docs` | 8 |

### Explicitly excluded

`/knowledge` and `/intelligence` and everything beneath them — 39 routes.
Unchanged by instruction.

## 3. Priority order for the remaining work

The stated objective is that the four pillars should feel like one company.
Context control is already converted, so the batches are ordered by which
pillar is most conspicuously off-system.

| Batch | Routes | Pillar |
| --- | --- | --- |
| **1 (this PR)** | `/governed-workflow`, `/governed-workflow/evidence`, `/enterprise-mcp-gateway`, `/x402-buyer-policy` | Governed workflow state, gateway middleware, machine-readable infrastructure |
| 2 | `/audit`, `/mps`, `/mps/preflight`, `/utilities/receipts` | Evaluation and self-service tools |
| 3 | `/consulting`, `/consulting/*` | Services surfaces |
| 4 | `/research`, `/books`, `/case-studies` | Published work |

Batch 1 completes the product pillars named in the objective. Everything after
it is supporting surface.

### Deliberately not in batch 1

`/mps`, `/contact`, `/start`, `/about`, `/tools`, `/docs`, `/x402-observatory`
and 25 other routes have uncommitted local edits in the primary checkout.
Converting them here would collide with work in progress, so they are deferred
to a batch taken after those changes land.
