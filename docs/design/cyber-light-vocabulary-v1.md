# Cyber-light vocabulary v2

**Status:** frozen

**Scope:** `/apps/**`, `/books/**`, `/docs/**`, and `/intelligence/**`

**Accepted:** 24 August 2026

**Canonical implementation:** `app/intelligence/intelligence-cyber-light.module.css`

Version 2 supersedes the Books-only green pilot. The Intelligence analytical
interface is now the canonical cyber-light language: a pale blue technical
ground, restrained grid and scanline accents, near-black readable type, sharp
panels, monospace metadata, and semantic state colors. Apps, Books, and Docs
reuse that actual stylesheet rather than approximating it with sibling palettes.

The global header and footer remain the fixed Evidence Paper frame. `/audit`
also remains fixed paper. Operator surfaces and Knowledge keep their separately
reviewed visual contracts.

## Route ownership

Each participating nested layout carries both markers:

- `data-visual-system="cyber-light"`
- `data-visual-scope="apps|books|docs|intelligence"`

The markers do not belong on the root layout. The shared stylesheet is imported
by each route family, so tokens stay scoped and cannot leak into the global
chrome, `/audit`, Knowledge, or operator routes.

## Frozen vocabulary

### Ground and accent

| Token | Light value | Meaning |
| --- | --- | --- |
| `--intel-surface` | `#e9edf3` | pale analytical ground |
| `--intel-raised` | `#f7f9fc` | cards, forms, and readable content panels |
| `--intel-sunken` | `#dfe5ee` | inset or secondary technical surface |
| `--intel-accent` | `#24509a` | primary metadata, link, and focus accent |
| `--intel-accent-strong` | `#17376e` | interactive emphasis |
| `--intel-grid` | `rgb(36 80 154 / 5%)` | technical grid only |
| `--intel-line` | `rgb(36 80 154 / 22%)` | panel and navigation rules |

The persistent site mode may substitute the reviewed dark token values within
these four scopes. It does not introduce a separate section toggle.

### Semantic states

| State | Token | Use |
| --- | --- | --- |
| Verified | `--intel-verified` | confirmed or reproduced evidence |
| Sourced | `--intel-sourced` | attributed or informational evidence |
| Boundary | `--intel-boundary` | uncertainty, limitation, or review boundary |
| Illustrative | `--intel-illustrative` | modelled or example material |
| Unverified | `--intel-unverified` | failed, refused, or unsupported claim |

State colors carry meaning; they are not decorative card palettes. Every state
also has a corresponding pale tint. Foreground/tint pairings must remain WCAG-AA
readable at small metadata sizes.

### Technical structure

- Grid: 40px desktop and 28px mobile.
- Scanline: static and masked to the upper page; removed for reduced motion.
- Metadata: Geist Mono, restrained uppercase, and deliberate tracking.
- Cards: square borders, one accent corner, restrained offset shadow, and at
  most a one-pixel hover translation.
- Actions: square, high-contrast, keyboard-visible, and token-driven.
- Scalar Docs: map native Scalar variables to the same scoped tokens; no second
  dark-mode control.
- Books: preserve manuscript measure and chapter hierarchy beneath the shared
  technical shell.

## Acceptance templates

The original three Books template classes remain required visual specimens:

1. Book landing: `/books`
2. Reader/chapter: `/books/the-orbital-mind/read/the-governing-center`
3. Editorial/article: `/books/the-orbital-mind/what-is-executive-function`

The shared release gate additionally checks representative Apps and Docs routes,
desktop and mobile body overflow, both color modes, and rendered text contrast.

## Invariants

1. Content, route behavior, API schemas, checkout, payment, and MCP behavior do
   not change with the visual layer.
2. Header and footer remain fixed paper in both modes.
3. `/audit` remains fixed paper.
4. Dark code panels keep explicit light foregrounds.
5. Apps, Books, Docs, and Intelligence reuse one canonical stylesheet.
6. Mobile pages create no body-level horizontal scrolling.
7. Motion is bounded and disabled under `prefers-reduced-motion`.

## Excluded treatments

Do not add neon glow, animated grid movement, full-black page grounds,
decorative warning colors, terminal cosplay, or per-section mode switches.
Future changes require a versioned revision and the same desktop/mobile,
light/dark, contrast, and overflow checks.
