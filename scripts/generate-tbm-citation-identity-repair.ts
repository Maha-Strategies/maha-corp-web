import { writeFileSync } from 'node:fs'

import { TBM_CITATION_REPAIR_PACKAGE } from '../lib/tbm-citation-identity-repair.ts'

writeFileSync('content/substantial-pages/tbm-citation-identity-repair.json', `${JSON.stringify(TBM_CITATION_REPAIR_PACKAGE, null, 2)}\n`)

const p = TBM_CITATION_REPAIR_PACKAGE
const lines = [
  '# TBM citation identity repair', '', p.boundary, '',
  `Package digest: \`${p.packageDigest}\``, '',
  '## Revision lineage', '',
  `- Preserved revise-again revision: \`${p.lineage.supersededRevision}\``,
  `- Corrected additive revision: \`${p.lineage.correctedRevision}\``,
  `- Prior decision ledger: \`${p.lineage.supersededLedgerDigest}\``, '',
  '## Corrected source identity', '',
  `- Title: ${p.sourceIdentityVerification.htmlTitle}`,
  `- Publisher: ${p.sourceIdentityVerification.publisher}`,
  `- URL and stable identifier: ${p.sourceIdentityVerification.finalUrl}`,
  `- Locator: ${p.sourceIdentityVerification.exactLocator}`,
  '- Chronology: living document; no displayed publication date, update date, edition, or pinned archive.',
  `- Rights: ${p.sourceIdentityVerification.rightsBasis}; ${p.sourceIdentityVerification.rightsNote}`, '',
  '## Gate chain', '',
  `- Alignment: \`${p.alignmentAudit.outcome}\``,
  `- Substantial page eligible: ${p.substantialPageDecision.pageEligible ? 'yes' : 'no'}`,
  `- Internal rereview: ${p.decisionLedger.verdictTotals.approve}/10 approve; \`${p.decisionLedger.state}\``,
  `- Separate repaired-revision canary ready: ${p.releasePreflight.readyForSeparateRepairedRevisionCanary ? 'yes' : 'no'}`,
  '- Canonical release created: no',
  '- Release authority used: no', '',
  '## Fresh decisions', '',
  '| Dimension | Verdict | Rationale |', '|---|---|---|',
  ...p.decisionLedger.decisions.map((d) => `| \`${d.dimension}\` | **${d.verdict}** | ${d.rationale} |`), '',
]
writeFileSync('docs/substantial-pages/tbm-citation-identity-repair.md', lines.join('\n'))
console.log(JSON.stringify({ revision: p.lineage.correctedRevision, packageDigest: p.packageDigest, ready: p.releasePreflight.readyForSeparateRepairedRevisionCanary }, null, 2))
