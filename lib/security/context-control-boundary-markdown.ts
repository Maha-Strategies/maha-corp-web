import {
  BOUNDARY_MANIFEST_PATH,
  BOUNDARY_VERSION,
  SECTIONS,
  VERIFICATION_COMMANDS,
} from './context-control-boundary.ts'

/**
 * The Markdown is the canonical text. The PDF renders the same claim objects,
 * so the two cannot disagree about what was asserted.
 */
export function renderBoundaryMarkdown(): string {
  const parts: string[] = []

  parts.push(`# Context-Control Security and Data Boundary

**Maha Strategies LLC · version ${BOUNDARY_VERSION}**

An evidence summary for a technical or procurement reviewer. Every statement
below is traceable to committed source, a test, or a published artifact; the
mapping is machine-checkable in \`${BOUNDARY_MANIFEST_PATH}\`.

It claims no certification, no compliance status, no partnership, and no
guaranteed outcome. Where a boundary is narrower than it might sound, the
narrow version is the one written down.`)

  for (const section of SECTIONS) {
    const lines = [`## ${section.title}`]
    if (section.lead) lines.push(`*${section.lead}*`)
    lines.push(section.claims.map((claim) => `- ${claim.text}`).join('\n'))
    parts.push(lines.join('\n\n'))
  }

  parts.push(`## Verify it yourself

${VERIFICATION_COMMANDS.map((entry) => `- \`${entry.command}\`\n  — ${entry.what}`).join('\n')}

No credential is needed for any of the above, and none of them contacts a
gateway, a model provider, or any Maha production system.`)

  parts.push(`---

*This document describes the Maha Context Compiler and its bounded WSO2
interceptor integration only. It is not a security certification, a regulatory
attestation, a WSO2 endorsement, or a substitute for your own review.*`)

  return `${parts.join('\n\n')}\n`
}
