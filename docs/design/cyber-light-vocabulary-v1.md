# Cyber-light vocabulary v1

**Status:** frozen  
**Scope:** `/books/**` pilot only  
**Accepted in Production:** 23 August 2026  
**Implementation:** `app/books/layout.tsx` and
`app/books/books-cyber-light.module.css`

Cyber-light is a bounded overlay on the Evidence Paper system. It does not
replace the paper surface, typography, spacing, or content hierarchy. It adds
just enough technical structure to connect editorial material to Maha's wider
evidence infrastructure without turning reading pages into an operator console.

## Accepted templates

The vocabulary was checked in Production on these three template classes at
1280px and 375px. All three carried the `cyber-light` route marker and had no
body-level horizontal overflow.

| Template | Production specimen | Acceptance focus |
| --- | --- | --- |
| Book landing | `/books` | editorial hierarchy, edition cards, global navigation |
| Reader / chapter | `/books/the-orbital-mind/read/the-governing-center` | long-form measure, chapter navigation, quiet reading ground |
| Editorial / article | `/books/the-orbital-mind/what-is-executive-function` | article metadata, section index, editorial hierarchy |

## Frozen vocabulary

### Route markers

- `data-visual-system="cyber-light"`
- `data-visual-scope="books"`

The markers belong on the nested Books layout. They must not be added to the
root layout or inferred from a global theme.

### Accent and state colors

| Token | Value | Use |
| --- | --- | --- |
| `--book-cyber-accent` | `#1f715f` | metadata, focus, card corner, active technical detail |
| `--book-cyber-accent-strong` | `#155347` | interactive hover state |
| `--book-cyber-accent-soft` | `rgb(31 113 95 / 8%)` | restrained hover/inset ground |
| `--book-cyber-grid` | `rgb(31 113 95 / 5%)` | paper-grid line only |
| `--book-cyber-line` | `rgb(31 113 95 / 24%)` | technical borders and navigation rules |
| `--status-sourced` | `#1f715f` | sourced or linked evidence |
| `--status-verified` | `#47704e` | verified state |
| `--status-boundary` | `#94642f` | limitation or boundary |
| `--status-unverified` | `#8b4c44` | unverified or refused state |

Status colors are semantic, not decorative. A template with no status does not
need a colored chip.

### Technical accents

- Square grid: 40px desktop, 28px mobile, 5% accent opacity.
- Metadata: existing Geist Mono vocabulary with the accent color and `0.17em`
  tracking.
- Cards: one accent corner, a restrained offset shadow, and at most a one-pixel
  hover translation.
- Navigation: existing links sharpen through border and underline treatment;
  the information architecture does not change.
- Focus: two-pixel accent outline with a three-pixel offset.
- Motion: 140–150ms only, disabled under `prefers-reduced-motion`.

## Invariants

Cyber-light v1 preserves all of the following:

1. Evidence Paper remains the base surface and typography system.
2. Manuscript and article body copy keep their existing measure and hierarchy.
3. Code blocks remain dark for contrast; the page itself remains light.
4. Content, schemas, routes, checkout, payment, and MCP behavior do not change.
5. `/knowledge/**`, `/intelligence/**`, and operator/admin surfaces do not inherit
   this overlay.
6. Mobile pages do not create body-level horizontal scrolling.

## Not in the vocabulary

Do not add neon glow, animated grid movement, scanlines, terminal chrome,
full-black panels, decorative warning colors, or global theme selectors. New
accents or states require a versioned revision and the same three-template
desktop/mobile acceptance pass.

