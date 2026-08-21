import { existsSync } from 'node:fs'

import { ALL_CLAIMS, SECTIONS, sha256File } from './context-control-boundary.ts'

/**
 * Claims this document must never make.
 *
 * Written as affirmative constructions rather than bare keywords, because the
 * document legitimately *denies* several of these and a keyword ban would flag
 * its own disclaimers. "Maha is not a WSO2 partner" has to pass; "WSO2-certified"
 * has to fail.
 */
export const PROHIBITED_PATTERNS: readonly { id: string; pattern: RegExp }[] = [
  { id: 'soc2', pattern: /\bSOC\s*2\b/i },
  { id: 'iso27001', pattern: /\bISO[\s-]?27001\b/i },
  { id: 'hipaa', pattern: /\bHIPAA\b/i },
  { id: 'pci', pattern: /\bPCI(\s*[-–]?\s*DSS)?\b/i },
  { id: 'gdpr', pattern: /\bGDPR\b/i },
  { id: 'compliant', pattern: /\b(?:is|are|fully)\s+(?:\w+\s+)?compliant\b/i },
  { id: 'certified', pattern: /\b(?:is|are)\s+certified\b|\b(?:SOC|ISO|WSO2|security)[\s-]certified\b/i },
  { id: 'encryption-at-rest', pattern: /\bencrypt(?:ed|ion)\s+at\s+rest\b/i },
  { id: 'encryption-in-transit', pattern: /\bencrypt(?:ed|ion)\s+in\s+transit\b/i },
  { id: 'never-store', pattern: /\bwe\s+never\s+store\b|\bnever\s+stores?\s+(?:any\s+)?data\b/i },
  { id: 'zero-retention-absolute', pattern: /\bzero\s+data\s+retention\b(?!\s*(?:header|declaration))/i },
  { id: 'wso2-partnership', pattern: /\b(?:official|certified|approved)\s+WSO2\b|\bWSO2\s+partner(?:ship)?\b(?!\s*(?:and|,)?\s*claims\s+no)/i },
  { id: 'endorsement', pattern: /\bendorsed\s+by\b|\bWSO2\s+endorses\b/i },
  { id: 'guaranteed-savings', pattern: /\bguarantee[ds]?\s+(?:savings|cost\s+reduction|uptime|availability)\b/i },
  { id: 'prevents-injection', pattern: /\bprevents?\s+(?:all\s+)?prompt\s+injection\b|\bprotects?\s+against\s+all\b/i },
  { id: 'production-approved', pattern: /\bproduction[\s-]approved\b|\bapproved\s+for\s+production\s+by\b/i },
]

/** Boundaries the document must always carry, regardless of how it is edited. */
export const REQUIRED_BOUNDARIES: readonly { id: string; pattern: RegExp }[] = [
  { id: 'not-a-review', pattern: /not a substitute for your own (?:security )?review/i },
  { id: 'no-universal-retention', pattern: /does not claim universal zero retention/i },
  { id: 'synthetic-corpus', pattern: /evaluation corpus is synthetic/i },
  { id: 'no-certification', pattern: /no security certification or regulatory attestation/i },
  { id: 'no-wso2-endorsement', pattern: /not a WSO2 partner and claims no WSO2 endorsement/i },
  { id: 'no-guarantee', pattern: /No saving, latency, availability or provider behaviour is guaranteed/i },
  { id: 'no-injection-protection', pattern: /does not protect against prompt injection/i },
  { id: 'customer-responsibilities', pattern: /Yours to operate/i },
  { id: 'local-contract-tests', pattern: /local contract test/i },
  { id: 'scope-excludes-deployment', pattern: /does not describe your gateway/i },
]

export const REQUIRED_SECTION_IDS = [
  'scope', 'data', 'source-text', 'integrity', 'fail-closed', 'budget', 'limits',
] as const

/** Strings that must never appear in a document that leaves the building. */
export const SENSITIVE_PATTERNS: readonly RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{4,}/,
  /\bBearer\s+[A-Za-z0-9._-]{12,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\/Users\//,
  /\/private\/tmp/,
  /\.codex\/worktrees/,
  /ANTHROPIC_API_KEY\s*=/,
  /WSO2_CONTEXT_INTERCEPTOR_SECRET\s*=/,
  /\b0x[a-fA-F0-9]{40}\b/,
]

export function findProhibited(text: string): string[] {
  return PROHIBITED_PATTERNS.filter((entry) => entry.pattern.test(text)).map((entry) => entry.id)
}

export function findMissingBoundaries(text: string): string[] {
  return REQUIRED_BOUNDARIES.filter((entry) => !entry.pattern.test(text)).map((entry) => entry.id)
}

export function findSensitive(text: string): string[] {
  return SENSITIVE_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source)
}

/** Claims whose sources are missing from disk, or whose bytes have moved. */
export function findUnbackedClaims(manifest: { sources: { path: string; sha256: string }[]; claims: { id: string; sources: { path: string }[] }[] }): string[] {
  const problems: string[] = []
  const digests = new Map(manifest.sources.map((source) => [source.path, source.sha256]))

  for (const claim of manifest.claims) {
    if (claim.sources.length === 0) { problems.push(`${claim.id}: no source`); continue }
    for (const source of claim.sources) {
      if (!existsSync(source.path)) { problems.push(`${claim.id}: missing source ${source.path}`); continue }
      const recorded = digests.get(source.path)
      if (!recorded) { problems.push(`${claim.id}: ${source.path} absent from the digest list`); continue }
      if (recorded !== `sha256:${sha256File(source.path)}`) {
        problems.push(`${claim.id}: ${source.path} has changed since the claim was written`)
      }
    }
  }
  return problems
}

/** Every claim in the model must actually appear in the rendered document. */
export function findUnrenderedClaims(markdown: string): string[] {
  return ALL_CLAIMS.filter((claim) => !markdown.includes(claim.text)).map((claim) => claim.id)
}

export function findMissingSections(): string[] {
  const present = new Set(SECTIONS.map((section) => section.id))
  return REQUIRED_SECTION_IDS.filter((id) => !present.has(id))
}
