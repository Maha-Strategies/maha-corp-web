# Maha visual-system inventory

**Status:** public conversion complete; bounded cyber-light families active
**Measured against:** the route-boundary contract on 24 August 2026
**Route count:** 215 App Router page templates

This inventory records the visual contract rather than estimating adoption from
individual utility classes. A route is complete when its rendered boundary owns
one of the five declared systems below. The contract is enforced by
`test/public-visual-system-completeness.test.ts`.

## Route coverage

| Visual system | Routes | Scope |
| --- | ---: | --- |
| Evidence Paper | 108 | All public product, service, research, policy, tool, protocol, and company routes not listed below |
| Shared analytical cyber-light | 39 | `/apps/**`, `/books/**`, `/docs/**`, `/intelligence/**`; one canonical Intelligence vocabulary |
| Knowledge cyber-light | 41 | `/knowledge/**`; readable technical grid with semantic evidence colors |
| Operator console | 27 | `/admin/**`, `/dashboard`, and `/operations/**`; operational workflows remain separately scoped from public Knowledge |
| **Total** | **215** | Every `app/**/page.tsx` belongs to exactly one system |

The old threshold of “six or more `.evidence-*` strings” is retired. It confused
shared-template routes with incomplete routes and counted metadata copy as CSS
usage. The route-boundary contract checks the actual owning shell or an explicit
shared Paper renderer.

## Evidence Paper

The public system is global CSS in `app/globals.css`, supported by Tailwind
utilities and a small set of shared renderers. Pages either own `.evidence-page`
or delegate their boundary to one of these reviewed renderers:

- `ResearchBriefServicePage`
- `EvidenceGuide`
- `ContextCompilerPlayground`

### Surface and text tokens

| Group | Tokens |
| --- | --- |
| Surface | `--surface-paper`, `--surface-raised`, `--surface-subtle` |
| Text | `--text-primary`, `--text-secondary`, `--text-muted` |
| Border | `--border-default`, `--border-strong`, `--border-subtle` |
| Status | `--status-verified`, `--status-sourced`, `--status-boundary`, `--status-illustrative`, `--status-unverified` |
| Status tint | `--surface-verified`, `--surface-sourced`, `--surface-boundary`, `--surface-illustrative`, `--surface-unverified` |

Body copy uses the neutral text tiers. Semantic colors are reserved for labels,
rules, restrained tints, and status chips. Dark code panels use `.evidence-code`
with a light code foreground; they must not inherit a Paper text token.

### Shared vocabulary

- Shell: `.evidence-page`, `.evidence-container`, `.evidence-container--narrow`
- Type: `.evidence-kicker`, `.evidence-title`, `.evidence-section-title`,
  `.evidence-lede`, `.evidence-copy`, `.evidence-prose`
- Structure: `.evidence-section`, `.evidence-card`, `.evidence-inset`,
  `.evidence-table-wrap`, `.evidence-table`
- Meaning: `.evidence-chip`, `.evidence-status-surface`,
  `.evidence-status-label`
- Interaction: `.evidence-action`, `.evidence-link`, `.evidence-field`,
  `.evidence-input`, `.evidence-form`
- Technical: `.evidence-code`

## Shared analytical cyber-light

`/apps/**`, `/books/**`, `/docs/**`, and `/intelligence/**` share the canonical
route-scoped overlay in `app/intelligence/intelligence-cyber-light.module.css`.
The vocabulary is frozen in
[`cyber-light-vocabulary-v1.md`](./cyber-light-vocabulary-v1.md). Books preserve
their editorial hierarchy; Apps adapt the Evidence Paper components; Docs map
Scalar variables to the same tokens; Intelligence remains the reference
implementation.

The overlay must not be moved to the root layout or global chrome. Knowledge
owns a separate cyber-light scope whose semantic palette is enforced
independently.

## Knowledge cyber-light

`/knowledge/**` owns a subtree-scoped overlay in
`app/knowledge/knowledge-cyber-light.module.css`. All 40 page templates inherit
the same light technical grid, near-black copy, accessible semantic labels,
light form controls, and explicit focus states. Dark surfaces are reserved for
machine-readable code or terminal panels and require a light foreground.

The Knowledge scope maps existing domain accents to fixed meanings without
rewriting source content: cyan for information, blue for sourced material,
green for verified or established material, violet for illustrative or modelled
material, amber for boundaries and uncertainty, and red for unverified,
prohibited, or failed states.

## Intentional dark systems

Admin, Dashboard, and Operations remain a dark operator console. A public
light page may still contain a dark code block or bounded interactive simulation;
that does not change its route-level visual system.

## Completion gates

The conversion is considered complete while all of the following stay true:

1. Every page template belongs to exactly one declared visual system.
2. Every public Paper route owns or delegates an Evidence Paper boundary.
3. Every cyber-light family owns an explicit subtree-scoped marker.
4. Paper text tiers remain WCAG-AA readable against the Paper surface.
5. Dark code panels do not use dark Paper foreground tokens.
6. The shared `--border-strong` token remains defined for the interactive
   controls that consume it.

Adding a page is therefore a visual-contract change: it must adopt Paper or be
placed deliberately into one of the bounded route families.
